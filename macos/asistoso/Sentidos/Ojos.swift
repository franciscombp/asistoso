import AVFoundation
import CoreImage
import Foundation
import os
import Vision

/// Los ojos de Uku: la cámara del Mac con Vision, en el chip (sin descargas ni red).
/// - Manos (21 puntos, los mismos índices que MediaPipe) y cuerpo en cada cuadro: se mandan a la web con el mismo
///   formato que usaba MediaPipe (`vision.js › normalizar`), así `gestos.js` sigue igual.
/// - Guarda el último cuadro para reconocer caras (`Caras`) cuando la web lo pide.
/// La cara (expresiones y giro de la cabeza) la sigue viendo MediaPipe en la web.
nonisolated final class Ojos: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate, @unchecked Sendable {
    /// Un cuadro procesado, listo para JSON.
    typealias Cuadro = [String: Any]
    /// Un cuadro de la cámara para pasar entre hilos (Vision y Core ML solo lo leen).
    struct Pixeles: @unchecked Sendable { let buffer: CVPixelBuffer }

    /// Se llama en la cola de la cámara con cada cuadro procesado.
    var alCuadro: (@Sendable (Cuadro) -> Void)?

    private let sesion = AVCaptureSession()
    private let cola = DispatchQueue(label: "uku.ojos", qos: .userInteractive)
    private let manosReq: VNDetectHumanHandPoseRequest = {
        let r = VNDetectHumanHandPoseRequest()
        r.maximumHandCount = 2
        return r
    }()
    private let cuerpoReq = VNDetectHumanBodyPoseRequest()
    private let ultimo = OSAllocatedUnfairLock<Pixeles?>(initialState: nil)
    private var configurada = false
    private var cuadros = 0
    private var ultimaPose: [String: Any]?

    var corriendo: Bool { sesion.isRunning }

    /// Pide permiso y enciende la cámara (720p, la misma que usa la web).
    func encender() async throws {
        guard await AVCaptureDevice.requestAccess(for: .video) else { throw Fallo.sinPermiso }
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            cola.async {
                do {
                    if !self.configurada { try self.configurar() }
                    if !self.sesion.isRunning { self.sesion.startRunning() }
                    cont.resume()
                } catch { cont.resume(throwing: error) }
            }
        }
    }

    func apagar() {
        cola.async { if self.sesion.isRunning { self.sesion.stopRunning() } }
    }

    /// El último cuadro de la cámara (para reconocer caras).
    func cuadroActual() -> Pixeles? { ultimo.withLock { $0 } }

    private func configurar() throws {
        guard let camara = AVCaptureDevice.default(for: .video) else { throw Fallo.sinCamara }
        sesion.beginConfiguration()
        defer { sesion.commitConfiguration() }
        if sesion.canSetSessionPreset(.hd1280x720) { sesion.sessionPreset = .hd1280x720 }
        // 15 cuadros por segundo alcanzan para gestos y ahorran la mitad del trabajo (importa con 8 GB)
        if (try? camara.lockForConfiguration()) != nil {
            let quince = CMTime(value: 1, timescale: 15)
            if camara.activeFormat.videoSupportedFrameRateRanges.contains(where: { $0.minFrameDuration <= quince && quince <= $0.maxFrameDuration }) {
                camara.activeVideoMinFrameDuration = quince
                camara.activeVideoMaxFrameDuration = quince
            }
            camara.unlockForConfiguration()
        }
        let entrada = try AVCaptureDeviceInput(device: camara)
        guard sesion.canAddInput(entrada) else { throw Fallo.sinCamara }
        sesion.addInput(entrada)
        let salida = AVCaptureVideoDataOutput()
        salida.alwaysDiscardsLateVideoFrames = true // si Vision va atrasado, se salta cuadros en vez de acumularlos
        salida.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        salida.setSampleBufferDelegate(self, queue: cola)
        guard sesion.canAddOutput(salida) else { throw Fallo.sinCamara }
        sesion.addOutput(salida)
        configurada = true
    }

    // MARK: - Cada cuadro

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixeles = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let guardado = Pixeles(buffer: pixeles)
        ultimo.withLock { $0 = guardado }
        // Las manos en cada cuadro; el cuerpo (cambia más lento) uno sí y uno no
        cuadros &+= 1
        let conCuerpo = cuadros % 2 == 0
        let handler = VNImageRequestHandler(cvPixelBuffer: pixeles, orientation: .up)
        try? handler.perform(conCuerpo ? [manosReq, cuerpoReq] : [manosReq])
        let manos = (manosReq.results ?? []).compactMap(Self.mano)
        if conCuerpo { ultimaPose = (cuerpoReq.results?.first).flatMap(Self.pose) }
        let pose = ultimaPose
        var cuadro: Cuadro = ["manos": manos]
        cuadro["pose"] = pose ?? NSNull()
        alCuadro?(cuadro)
    }

    // MARK: - Al formato de MediaPipe (0–1, origen arriba a la izquierda, imagen sin espejo)

    private static func punto(_ p: VNRecognizedPoint) -> [String: Double] {
        ["x": Double(p.location.x), "y": 1 - Double(p.location.y), "z": 0, "visibility": Double(p.confidence)]
    }

    /// Los 21 puntos en el orden de MediaPipe (muñeca, pulgar, índice, medio, anular, meñique).
    private static let ordenMano: [VNHumanHandPoseObservation.JointName] = [
        .wrist,
        .thumbCMC, .thumbMP, .thumbIP, .thumbTip,
        .indexMCP, .indexPIP, .indexDIP, .indexTip,
        .middleMCP, .middlePIP, .middleDIP, .middleTip,
        .ringMCP, .ringPIP, .ringDIP, .ringTip,
        .littleMCP, .littlePIP, .littleDIP, .littleTip
    ]

    private static func mano(_ obs: VNHumanHandPoseObservation) -> [String: Any]? {
        guard let todos = try? obs.recognizedPoints(.all) else { return nil }
        var puntos: [[String: Double]] = []
        for j in ordenMano {
            guard let p = todos[j], p.confidence > 0.15 else { return nil } // mano a medias: no sirve para gestos
            puntos.append(punto(p))
        }
        let lado = obs.chirality == .left ? "Left" : obs.chirality == .right ? "Right" : NSNull() as Any
        return ["lado": lado, "score": Double(obs.confidence), "puntos": puntos]
    }

    /// Índice de MediaPipe Pose → articulación de Vision (los que no tiene Vision quedan con visibilidad 0).
    private static let ordenPose: [Int: VNHumanBodyPoseObservation.JointName] = [
        0: .nose, 1: .leftEye, 2: .leftEye, 3: .leftEye, 4: .rightEye, 5: .rightEye, 6: .rightEye, 7: .leftEar, 8: .rightEar,
        11: .leftShoulder, 12: .rightShoulder, 13: .leftElbow, 14: .rightElbow, 15: .leftWrist, 16: .rightWrist,
        23: .leftHip, 24: .rightHip, 25: .leftKnee, 26: .rightKnee, 27: .leftAnkle, 28: .rightAnkle
    ]
    /// Pares izquierda/derecha de MediaPipe (para corregir el lado si hace falta).
    private static let pares: [(Int, Int)] = [(1, 4), (2, 5), (3, 6), (7, 8), (9, 10), (11, 12), (13, 14), (15, 16), (17, 18), (19, 20), (21, 22), (23, 24), (25, 26), (27, 28), (29, 30), (31, 32)]

    private static func pose(_ obs: VNHumanBodyPoseObservation) -> [String: Any]? {
        guard let todos = try? obs.recognizedPoints(.all) else { return nil }
        let vacio: [String: Double] = ["x": 0, "y": 0, "z": 0, "visibility": 0]
        var puntos = Array(repeating: vacio, count: 33)
        for (i, j) in ordenPose { if let p = todos[j], p.confidence > 0 { puntos[i] = punto(p) } }
        guard (puntos[11]["visibility"] ?? 0) > 0 || (puntos[12]["visibility"] ?? 0) > 0 else { return nil }
        // En MediaPipe, 11 es el hombro izquierdo *de la persona*: en la imagen sin espejo queda a la derecha (x mayor).
        // Los hombros nunca se cruzan, así que si quedaron al revés se intercambian todos los pares.
        if (puntos[11]["visibility"] ?? 0) > 0.3, (puntos[12]["visibility"] ?? 0) > 0.3,
           (puntos[11]["x"] ?? 0) < (puntos[12]["x"] ?? 0) {
            for (a, b) in pares { puntos.swapAt(a, b) }
        }
        return ["puntos": puntos]
    }

    enum Fallo: LocalizedError {
        case sinPermiso, sinCamara
        var errorDescription: String? {
            switch self {
            case .sinPermiso: "NotAllowed: sin permiso para la cámara"
            case .sinCamara: "No hay cámara"
            }
        }
    }
}
