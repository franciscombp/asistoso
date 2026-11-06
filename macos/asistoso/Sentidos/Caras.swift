import AppKit
import CoreImage
import CoreML
import Foundation
import Vision

/// Saca la huella de una cara del cuadro de la cámara:
/// Vision encuentra la cara y sus ojos, se endereza (los ojos en horizontal), se recorta y FaceNet (Core ML, en el
/// Neural Engine) devuelve 512 números con norma 1. Dos fotos de la misma persona quedan a menos de ~1 de distancia.
nonisolated final class Caras: @unchecked Sendable {
    struct Analisis: Sendable {
        var huella: [Float]
        var foto: Data      // JPEG de 160 px, en espejo (como la persona se ve a sí misma)
        var calidad: Float  // 0–1, para quedarse con la mejor foto
    }

    private let modelo: MLModel?
    private let restriccion: MLImageConstraint?
    private let contexto = CIContext()

    init() {
        // MLModel directo (no la clase generada, que quedaría atada al hilo principal): corre en el hilo que la pida
        let config = MLModelConfiguration()
        config.computeUnits = .all
        modelo = Bundle.main.url(forResource: "Huella", withExtension: "mlmodelc").flatMap { try? MLModel(contentsOf: $0, configuration: config) }
        restriccion = modelo?.modelDescription.inputDescriptionsByName["cara"]?.imageConstraint
    }

    var listo: Bool { modelo != nil }

    /// Analiza la cara más cercana a `caja` (0–1, origen arriba a la izquierda, como la da MediaPipe) o, sin caja,
    /// la más grande. Devuelve nil si no hay una cara clara (chica, muy de perfil o borrosa).
    func analizar(_ cuadro: Ojos.Pixeles, caja: CGRect?) -> Analisis? {
        guard let modelo, let restriccion else { return nil }
        let pixeles = cuadro.buffer
        let caraReq = VNDetectFaceLandmarksRequest()
        let calidadReq = VNDetectFaceCaptureQualityRequest()
        let handler = VNImageRequestHandler(cvPixelBuffer: pixeles, orientation: .up)
        try? handler.perform([caraReq])
        guard let caras = caraReq.results, !caras.isEmpty else { return nil }

        // Vision usa origen abajo a la izquierda: se pasa la caja de MediaPipe a ese sistema
        let elegida: VNFaceObservation
        if let caja {
            let centro = CGPoint(x: caja.midX, y: 1 - caja.midY)
            elegida = caras.min { a, b in
                hypot(a.boundingBox.midX - centro.x, a.boundingBox.midY - centro.y) < hypot(b.boundingBox.midX - centro.x, b.boundingBox.midY - centro.y)
            }!
            guard hypot(elegida.boundingBox.midX - centro.x, elegida.boundingBox.midY - centro.y) < max(0.15, caja.width) else { return nil }
        } else {
            elegida = caras.max { $0.boundingBox.width < $1.boundingBox.width }!
        }

        // Solo caras claras: de frente (±35°), de buen tamaño y nítidas
        let ancho = CGFloat(CVPixelBufferGetWidth(pixeles)), alto = CGFloat(CVPixelBufferGetHeight(pixeles))
        if let yaw = elegida.yaw?.doubleValue, abs(yaw) > 0.6 { return nil }
        if elegida.boundingBox.width * ancho < 70 { return nil }
        calidadReq.inputFaceObservations = [elegida]
        try? handler.perform([calidadReq])
        let calidad = calidadReq.results?.first?.faceCaptureQuality ?? 0.5
        if calidad < 0.2 { return nil }

        // Enderezar: el ángulo entre los ojos (en píxeles)
        let imagen = CIImage(cvPixelBuffer: pixeles)
        let caja = elegida.boundingBox
        var angulo: CGFloat = 0
        if let lm = elegida.landmarks, let ojoI = lm.leftPupil?.pointsInImage(imageSize: CGSize(width: ancho, height: alto)).first,
           let ojoD = lm.rightPupil?.pointsInImage(imageSize: CGSize(width: ancho, height: alto)).first {
            angulo = atan2(ojoI.y - ojoD.y, ojoI.x - ojoD.x)
            if abs(angulo) > .pi / 2 { angulo += angulo > 0 ? -.pi : .pi } // el orden de los ojos no importa
        } else if let roll = elegida.roll?.doubleValue {
            angulo = CGFloat(roll)
        }
        let centro = CGPoint(x: caja.midX * ancho, y: caja.midY * alto)
        // Recorte cuadrado algo más grande que la caja de Vision (FaceNet se entrenó con la cara entera y un margen)
        let lado = max(caja.width * ancho, caja.height * alto) * 1.25
        let derecha = imagen
            .transformed(by: CGAffineTransform(translationX: -centro.x, y: -centro.y))
            .transformed(by: CGAffineTransform(rotationAngle: -angulo))
            .cropped(to: CGRect(x: -lado / 2, y: -lado / 2, width: lado, height: lado))
            .transformed(by: CGAffineTransform(scaleX: 160 / lado, y: 160 / lado))
            .transformed(by: CGAffineTransform(translationX: 80, y: 80))
        let marco = CGRect(x: 0, y: 0, width: 160, height: 160)
        guard let cg = contexto.createCGImage(derecha, from: marco),
              let valor = try? MLFeatureValue(cgImage: cg, constraint: restriccion),
              let entrada = try? MLDictionaryFeatureProvider(dictionary: ["cara": valor]),
              let salida = try? modelo.prediction(from: entrada),
              let vector = salida.featureValue(for: "huella")?.multiArrayValue else { return nil }
        let huella = Self.normalizar(vector)

        // La foto en espejo
        let espejo = derecha.transformed(by: CGAffineTransform(scaleX: -1, y: 1).translatedBy(x: -160, y: 0))
        let foto = contexto.jpegRepresentation(of: espejo.cropped(to: marco), colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!,
                                               options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.75]) ?? Data()
        return Analisis(huella: huella, foto: foto, calidad: calidad)
    }

    private static func normalizar(_ m: MLMultiArray) -> [Float] {
        var v = (0..<m.count).map { Float(truncating: m[$0]) }
        let norma = sqrt(v.reduce(0) { $0 + $1 * $1 })
        if norma > 0 { v = v.map { $0 / norma } }
        return v
    }

    static func distancia(_ a: [Float], _ b: [Float]) -> Float {
        guard a.count == b.count else { return .infinity }
        var s: Float = 0
        for i in a.indices { let d = a[i] - b[i]; s += d * d }
        return s.squareRoot()
    }
}
