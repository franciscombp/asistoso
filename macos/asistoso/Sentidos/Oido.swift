import AVFoundation
import Foundation
import Speech

/// El oído de Uku: SpeechAnalyzer + SpeechTranscriber en el equipo, con el micrófono del `MotorAudio` (que cancela el
/// eco de la voz de Uku).
/// - **Turnos**: junta lo que dices hasta que callas un momento (`silencio`) y lo manda entero; así una pausa a mitad
///   de frase no corta la conversación.
/// - **Eco**: si lo que llega se parece a lo que Uku acaba de decir, es su propia voz y se descarta.
/// - **Interrumpir**: si le hablas encima mientras habla, Uku se calla y te escucha.
@MainActor
final class Oido {
    enum Evento {
        case parcial(String)
        case texto(String)
        case error(String)
    }

    var alEvento: (Evento) -> Void = { _ in }
    /// La voz de Uku (para el filtro de eco y para callarla si lo interrumpen).
    weak var voz: Voz?

    /// Cuánto silencio cierra un turno.
    static let silencio: TimeInterval = 0.8

    private var analizador: SpeechAnalyzer?
    private var lectura: Task<Void, Never>?
    private var reloj: Timer?
    private var entrada: AsyncStream<AnalyzerInput>.Continuation?
    private(set) var escuchando = false

    private var turno: [String] = []          // frases ya firmes del turno en curso
    private var volatil = ""                  // lo que está diciendo ahora (todavía puede cambiar)
    private var ultimaVoz = Date.distantPast  // la última vez que llegó algo (no eco)

    /// Mientras sea true (el panel está abierto), lo que se oye no cuenta.
    var callado = false {
        didSet { if callado { turno = []; volatil = "" } }
    }

    /// Empieza a escuchar en el idioma pedido (es-EC por defecto; si no hay modelo, el español más cercano).
    func escuchar(idioma: String) async throws {
        if escuchando { return }
        guard await AVCaptureDevice.requestAccess(for: .audio) else { throw Fallo.sinPermiso }

        let locale = try await localeCompatible(idioma)
        let transcriptor = SpeechTranscriber(locale: locale, transcriptionOptions: [], reportingOptions: [.volatileResults], attributeOptions: [])
        if let instalar = try await AssetInventory.assetInstallationRequest(supporting: [transcriptor]) {
            try await instalar.downloadAndInstall()
        }
        guard let formato = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriptor]) else { throw Fallo.sinIdioma }

        // El micrófono, con cancelación de eco
        let audio = MotorAudio.compartido
        try audio.encender(conMicrofono: true)
        let (secuencia, entrada) = AsyncStream.makeStream(of: AnalyzerInput.self, bufferingPolicy: .bufferingNewest(64))
        self.entrada = entrada
        instalarMicrofono(formato: formato)
        audio.alReconfigurar = { [weak self] in self?.instalarMicrofono(formato: formato) }

        let analizador = SpeechAnalyzer(modules: [transcriptor], options: .init(priority: .userInitiated, modelRetention: .processLifetime))
        let contexto = AnalysisContext()
        contexto.contextualStrings[.general] = ["Uku", "Fran", "oye Uku", "Uku, ¿dónde está Fran?"]
        try? await analizador.setContext(contexto)
        try await analizador.prepareToAnalyze(in: formato)
        self.analizador = analizador

        lectura = Task { [weak self] in
            do {
                for try await r in transcriptor.results {
                    self?.recibir(String(r.text.characters), final: r.isFinal)
                }
            } catch {
                self?.alEvento(.error(error.localizedDescription))
            }
        }
        try await analizador.start(inputSequence: secuencia)
        reloj = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.revisarTurno() }
        }
        escuchando = true
    }

    func parar() {
        reloj?.invalidate(); reloj = nil
        lectura?.cancel(); lectura = nil
        if MotorAudio.compartido.conMicrofono { MotorAudio.compartido.motor.inputNode.removeTap(onBus: 0) }
        entrada?.finish(); entrada = nil
        let analizador = self.analizador
        self.analizador = nil
        escuchando = false
        turno = []; volatil = ""
        Task { await analizador?.cancelAndFinishNow() }
    }

    private func instalarMicrofono(formato: AVAudioFormat) {
        guard let entrada else { return }
        let nodo = MotorAudio.compartido.motor.inputNode
        nodo.removeTap(onBus: 0)
        do {
            try nodo.installAudioTap(onBus: 0, bufferSize: 4096, format: nodo.outputFormat(forBus: 0), tapProvider: Self.tap(formato: formato, entrada: entrada))
        } catch {
            alEvento(.error("No pude abrir el micrófono: \(error.localizedDescription)"))
        }
    }

    /// El bloque del micrófono corre en el hilo de audio: convierte y entrega al analizador, nada más.
    nonisolated private static func tap(formato: AVAudioFormat, entrada: AsyncStream<AnalyzerInput>.Continuation) -> @Sendable (AVReadOnlyAudioPCMBuffer, AVAudioTime) -> Void {
        let conversor = Caja(AnalyzerInputConverter(analyzerFormat: formato))
        return { buffer, _ in
            guard let entradas = try? conversor.valor.convert(AVAudioPCMBuffer(copying: buffer), at: nil) else { return }
            for e in entradas { entrada.yield(e) }
        }
    }

    // MARK: - Turnos

    private func recibir(_ crudo: String, final: Bool) {
        let texto = crudo.trimmingCharacters(in: .whitespacesAndNewlines)
        if callado { return }
        if texto.isEmpty { if final { volatil = "" }; return }
        if esEco(texto) {
            if final { volatil = "" }
            return
        }
        ultimaVoz = Date()
        // Le hablan encima: Uku se calla y escucha (con dos palabras o más, para no cortarse por un ruido)
        if let voz, voz.hablando, texto.split(separator: " ").count >= 2 { voz.callar(interrumpido: true) }
        if final { turno.append(texto); volatil = "" } else { volatil = texto }
        alEvento(.parcial((turno + [volatil]).filter { !$0.isEmpty }.joined(separator: " ")))
    }

    /// Cierra el turno cuando la persona calló un momento.
    private func revisarTurno() {
        let quieto = Date().timeIntervalSince(ultimaVoz)
        // Si el reconocedor no firmó lo último en un buen rato, se toma como está
        if !volatil.isEmpty && quieto > Self.silencio + 1.2 { turno.append(volatil); volatil = "" }
        guard !turno.isEmpty, volatil.isEmpty, quieto >= Self.silencio else { return }
        let dicho = turno.joined(separator: " ")
        turno = []
        alEvento(.texto(dicho))
    }

    /// ¿Es la voz de Uku que se coló por el micrófono? (si la mayoría de las palabras son de lo que acaba de decir)
    private func esEco(_ texto: String) -> Bool {
        guard let voz, voz.hablando || Date() < voz.ecoHasta else { return false }
        let suyas = Set(voz.reciente.flatMap { Self.palabras($0) })
        let oidas = Self.palabras(texto)
        guard !oidas.isEmpty else { return true }
        let comunes = oidas.filter { suyas.contains($0) }.count
        return Double(comunes) / Double(oidas.count) >= 0.6
    }

    private static func palabras(_ t: String) -> [String] {
        t.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil)
            .split { !$0.isLetter && !$0.isNumber }.map(String.init)
    }

    private func localeCompatible(_ idioma: String) async throws -> Locale {
        if let l = await SpeechTranscriber.supportedLocale(equivalentTo: Locale(identifier: idioma)) { return l }
        let soportados = await SpeechTranscriber.supportedLocales
        for p in ["es-419", "es-US", "es-MX", "es-ES"] {
            if let l = soportados.first(where: { $0.identifier(.bcp47) == p }) { return l }
        }
        if let l = soportados.first(where: { $0.language.languageCode?.identifier == "es" }) { return l }
        throw Fallo.sinIdioma
    }

    enum Fallo: LocalizedError {
        case sinPermiso, sinIdioma
        var errorDescription: String? {
            switch self {
            case .sinPermiso: "NotAllowed: sin permiso para el micrófono"
            case .sinIdioma: "Este Mac no tiene reconocimiento de voz en español"
            }
        }
    }
}
