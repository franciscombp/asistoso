import AVFoundation
import Foundation

/// Un solo motor de audio para oír y hablar.
/// La voz de Uku sale por este motor y el micrófono entra por él con el procesamiento de voz de Apple (el de FaceTime):
/// así el micrófono **resta lo que Uku está diciendo** (cancelación de eco). Uku no se oye a sí mismo y se le puede
/// interrumpir mientras habla.
@MainActor
final class MotorAudio {
    static let compartido = MotorAudio()

    /// El formato en que suena la voz (la que sale de AVSpeechSynthesizer se convierte a este).
    nonisolated static let formatoVoz = AVAudioFormat(standardFormatWithSampleRate: 22_050, channels: 1)!

    let motor = AVAudioEngine()
    let reproductor = AVAudioPlayerNode()
    private(set) var conMicrofono = false
    private(set) var cancelaEco = false
    /// Se llama cuando el sistema reconfiguró el audio (auriculares, otro micrófono) y hubo que rearrancar.
    var alReconfigurar: () -> Void = {}

    private init() {
        motor.attach(reproductor)
        NotificationCenter.default.addObserver(forName: .AVAudioEngineConfigurationChange, object: motor, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.rearrancar() }
        }
    }

    /// Enciende el motor. Con micrófono, activa el procesamiento de voz (cancelación de eco) antes de arrancar.
    func encender(conMicrofono mic: Bool) throws {
        if motor.isRunning && (conMicrofono || !mic) { return }
        if motor.isRunning { motor.stop() }
        if mic && !conMicrofono {
            do {
                try motor.inputNode.setVoiceProcessingEnabled(true)
                // Que no baje el volumen de lo demás (el mundo de Uku) más de lo necesario
                motor.inputNode.voiceProcessingOtherAudioDuckingConfiguration = .init(enableAdvancedDucking: false, duckingLevel: .min)
                cancelaEco = true
            } catch {
                print("Uku · sin cancelación de eco: \(error.localizedDescription)")
                cancelaEco = false
            }
            conMicrofono = true
        }
        // La conexión va después del procesamiento de voz (cambia el formato de salida)
        motor.disconnectNodeOutput(reproductor)
        try motor.connectNode(reproductor, to: motor.mainMixerNode, format: Self.formatoVoz)
        motor.prepare()
        try motor.start()
        try reproductor.playAudio()
    }

    private func rearrancar() {
        guard !motor.isRunning else { return }
        motor.disconnectNodeOutput(reproductor)
        try? motor.connectNode(reproductor, to: motor.mainMixerNode, format: Self.formatoVoz)
        try? motor.start()
        try? reproductor.playAudio()
        alReconfigurar()
    }
}

/// Para pasar entre hilos objetos de audio que no son Sendable pero que se usan con cuidado (uno a la vez).
nonisolated final class Caja<T>: @unchecked Sendable {
    var valor: T
    init(_ v: T) { valor = v }
}

/// Una referencia débil que se puede pasar entre hilos.
nonisolated final class Debil<T: AnyObject>: @unchecked Sendable {
    weak var valor: T?
    init(_ v: T) { valor = v }
}
