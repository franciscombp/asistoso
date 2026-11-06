import AVFoundation
import Foundation
import os

/// La voz de Uku: AVSpeechSynthesizer con la mejor voz en español instalada, sonando por `MotorAudio` (para que el
/// micrófono cancele el eco).
/// - Habla **por frases**: mientras el cerebro escribe, la primera frase ya suena (`avanzarRespuesta`).
/// - Se puede interrumpir (`callar`): si alguien le habla encima, se calla y escucha.
/// - Avisa cuándo empieza a sonar cada frase (para mover la boca) y cuándo termina.
@MainActor
final class Voz: NSObject, AVSpeechSynthesizerDelegate {
    enum Evento {
        case frase(String)
        case fin(interrumpido: Bool)
    }

    var alEvento: (Evento) -> Void = { _ in }

    /// Lo que dijo hace poco (para que el oído no tome su propia voz como si fuera de otro).
    private(set) var reciente: [String] = []
    /// Hasta cuándo puede quedar eco de su voz en el micrófono.
    private(set) var ecoHasta = Date.distantPast

    var hablando: Bool { !cola.isEmpty || sintetizando || CACurrentMediaTime() < estado.withLock { $0.finCola } }

    private let sintetizador = AVSpeechSynthesizer()
    private var cola: [String] = []
    private var sintetizando = false
    private var avisoFin = true          // ya avisó que terminó (para no repetir)
    private var reloj: Timer?
    private let estado = OSAllocatedUnfairLock(initialState: Estado())

    /// La respuesta del cerebro que se va diciendo mientras se escribe: qué id tiene y cuánto ya se encoló.
    private var respuesta: (id: Int, encolado: String, cuando: Date)?
    private var ultimoId = 0

    /// Lo que comparten el hilo del sintetizador y el principal.
    struct Estado: Sendable {
        var generacion = 0
        var finCola: CFTimeInterval = 0              // cuándo termina de sonar lo programado
        var marcas: [Marca] = []                     // cuándo empieza a sonar cada frase
    }
    struct Marca: Sendable { var cuando: CFTimeInterval; var texto: String }

    override init() {
        super.init()
        sintetizador.delegate = self
    }

    /// Carga la voz antes de la primera frase (la primera vez tarda ~1 s; después sintetiza una frase en ~20 ms).
    func precalentar() {
        let u = AVSpeechUtterance(string: "Hola.")
        u.voice = Self.mejorVoz()
        sintetizador.write(u) { _ in }
    }
    /// La frase que se está sintetizando (para no confundir el aviso de una frase vieja que se canceló).
    private var actual: ObjectIdentifier?

    // MARK: - Voces

    /// La voz elegida en Ajustes o, si no, la de más calidad en el español más cercano a Ecuador.
    static func mejorVoz() -> AVSpeechSynthesisVoice? {
        if let id = UserDefaults.standard.string(forKey: Ajustes.voz), !id.isEmpty, let v = AVSpeechSynthesisVoice(identifier: id) { return v }
        let regiones = ["es-EC", "es-419", "es-US", "es-MX", "es-CO", "es-ES"]
        return vocesEnEspanol().sorted { a, b in
            if a.quality != b.quality { return a.quality.rawValue > b.quality.rawValue }
            return (regiones.firstIndex(of: a.language) ?? 99) < (regiones.firstIndex(of: b.language) ?? 99)
        }.first
    }

    static func vocesEnEspanol() -> [AVSpeechSynthesisVoice] {
        AVSpeechSynthesisVoice.speechVoices().filter { $0.language.hasPrefix("es") }
    }

    // MARK: - Hablar

    /// Dice un texto completo. Si es la respuesta que ya se estaba diciendo mientras se escribía, solo agrega lo que falte.
    func hablar(_ texto: String) {
        if let r = respuesta, Date().timeIntervalSince(r.cuando) < 60, let resto = Self.resto(de: texto, yaDicho: r.encolado) {
            respuesta = nil
            if Self.letras(resto).isEmpty {
                if !hablando { alEvento(.fin(interrumpido: false)) }
            } else {
                encolar(Self.frases(resto))
            }
            return
        }
        respuesta = nil
        callar(interrumpido: false, avisar: false)
        encolar(Self.frases(texto))
    }

    /// Empieza una respuesta del cerebro que se dirá mientras se escribe. Devuelve su id.
    func nuevaRespuesta() -> Int {
        ultimoId += 1
        callar(interrumpido: false, avisar: false)
        respuesta = (ultimoId, "", Date())
        return ultimoId
    }

    /// El cerebro escribió más: se encolan las frases ya completas.
    func avanzarRespuesta(_ id: Int, _ parcial: String, final: Bool = false) {
        guard var r = respuesta, r.id == id else { return }
        // Si el texto cambió por completo (otro modelo tomó la posta), lo dicho ya no se puede desdecir
        guard Self.letras(parcial).hasPrefix(Self.letras(r.encolado)) else { return }
        guard let resto = Self.resto(de: parcial, yaDicho: r.encolado) else { return }
        let completas: String
        if final {
            completas = resto
        } else if let corte = resto.lastIndex(where: { ".!?…".contains($0) }), resto[resto.index(after: corte)...].first?.isWhitespace ?? false {
            completas = String(resto[...corte])
        } else { return }
        guard !Self.letras(completas).isEmpty else { return }
        r.encolado += (r.encolado.isEmpty ? "" : " ") + completas.trimmingCharacters(in: .whitespaces)
        r.cuando = Date()
        respuesta = r
        encolar(Self.frases(completas))
    }

    /// Se calla ya (alguien le habló encima, o apagaron la voz).
    func callar(interrumpido: Bool = true, avisar: Bool = true) {
        let estaba = hablando
        cola.removeAll()
        sintetizando = false
        actual = nil
        sintetizador.stopSpeaking(at: .immediate)
        estado.withLock { $0.generacion += 1; $0.finCola = 0; $0.marcas.removeAll() }
        let r = MotorAudio.compartido.reproductor
        if r.engine != nil {
            r.stop()
            if MotorAudio.compartido.motor.isRunning { r.play() }
        }
        if interrumpido { respuesta = nil }
        if estaba && avisar { avisoFin = true; alEvento(.fin(interrumpido: interrumpido)) }
    }

    private func encolar(_ frases: [String]) {
        let limpias = frases.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !Self.letras($0).isEmpty }
        guard !limpias.isEmpty else { return }
        do { try MotorAudio.compartido.encender(conMicrofono: MotorAudio.compartido.conMicrofono) } catch {
            print("Uku · no pude encender el audio: \(error.localizedDescription)")
            return
        }
        cola.append(contentsOf: limpias)
        avisoFin = false
        siguiente()
        if reloj == nil {
            reloj = Timer.scheduledTimer(withTimeInterval: 0.04, repeats: true) { [weak self] _ in
                MainActor.assumeIsolated { self?.vigilar() }
            }
        }
    }

    /// Sintetiza la siguiente frase de la cola (de a una, en orden).
    private func siguiente() {
        guard !sintetizando, !cola.isEmpty else { return }
        let texto = cola.removeFirst()
        sintetizando = true
        reciente = Array((reciente + [texto]).suffix(4))
        let u = AVSpeechUtterance(string: texto)
        u.voice = Self.mejorVoz()
        u.rate = AVSpeechUtteranceDefaultSpeechRate * 1.04
        u.pitchMultiplier = 1.15
        let generacion = estado.withLock { $0.generacion }
        let bloque = Self.alRecibir(estado: estado, reproductor: Caja(MotorAudio.compartido.reproductor), generacion: generacion, texto: texto)
        actual = ObjectIdentifier(u)
        sintetizador.write(u, toBufferCallback: bloque)
    }

    /// Cada 40 ms: avisa la frase que empieza a sonar y cuándo terminó todo.
    private func vigilar() {
        let ahora = CACurrentMediaTime()
        let (empiezan, fin) = estado.withLock { e -> ([Marca], CFTimeInterval) in
            let ya = e.marcas.filter { $0.cuando <= ahora }
            e.marcas.removeAll { $0.cuando <= ahora }
            return (ya, e.finCola)
        }
        for m in empiezan { alEvento(.frase(m.texto)) }
        if hablando { ecoHasta = Date().addingTimeInterval(0.9) }
        if !hablando, !avisoFin, ahora >= fin {
            avisoFin = true
            alEvento(.fin(interrumpido: false))
            reloj?.invalidate(); reloj = nil
        }
    }

    // MARK: - AVSpeechSynthesizerDelegate

    /// Terminó de sintetizar una frase (el audio sigue sonando): se sintetiza la siguiente.
    nonisolated func speechSynthesizer(_ s: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        let cual = ObjectIdentifier(utterance)
        Task { @MainActor in
            guard cual == self.actual else { return } // el precalentado o una frase ya callada
            self.actual = nil
            self.sintetizando = false
            self.siguiente()
        }
    }


    // MARK: - En el hilo del sintetizador

    /// Recibe el audio de una frase y lo programa en el reproductor (convertido al formato del motor).
    nonisolated private static func alRecibir(estado: OSAllocatedUnfairLock<Estado>, reproductor: Caja<AVAudioPlayerNode>, generacion: Int,
                                              texto: String) -> AVSpeechSynthesizer.BufferCallback {
        let conversor = Caja(Conversor())
        let primero = Caja(true) // el sintetizador entrega los trozos de una frase de a uno, en un solo hilo
        return { buffer in
            guard let pcm = buffer as? AVAudioPCMBuffer else { return }
            guard estado.withLock({ $0.generacion }) == generacion else { return }
            if pcm.frameLength <= 1 { return } // el último trozo viene casi vacío: el fin lo avisa el delegate
            guard let listo = conversor.valor.convertir(pcm) else { return }
            let dura = Double(listo.frameLength) / listo.format.sampleRate
            let ahora = CACurrentMediaTime()
            estado.withLock { e in
                let inicio = max(ahora + 0.02, e.finCola)
                if primero.valor { e.marcas.append(Marca(cuando: inicio, texto: texto)) }
                e.finCola = inicio + dura
            }
            primero.valor = false
            reproductor.valor.scheduleBuffer(listo, completionHandler: nil)
        }
    }

    /// Convierte la salida del sintetizador (16 o 32 bits, 22 kHz…) al formato del reproductor.
    nonisolated final class Conversor {
        private var conversor: AVAudioConverter?
        func convertir(_ b: AVAudioPCMBuffer) -> AVAudioPCMBuffer? {
            let destino = MotorAudio.formatoVoz
            if b.format == destino { return b }
            if conversor?.inputFormat != b.format { conversor = AVAudioConverter(from: b.format, to: destino) }
            guard let conversor else { return nil }
            let capacidad = AVAudioFrameCount(Double(b.frameLength) * destino.sampleRate / b.format.sampleRate) + 64
            guard let salida = AVAudioPCMBuffer(pcmFormat: destino, frameCapacity: capacidad) else { return nil }
            var entregado = false
            var error: NSError?
            conversor.convert(to: salida, error: &error) { _, estadoEntrada in
                if entregado { estadoEntrada.pointee = .noDataNow; return nil }
                entregado = true
                estadoEntrada.pointee = .haveData
                return b
            }
            return error == nil ? salida : nil
        }
    }

    // MARK: - Texto

    /// Las frases de un texto (para decirlo de a una).
    static func frases(_ t: String) -> [String] {
        var salida: [String] = [], actual = ""
        for c in t {
            actual.append(c)
            if ".!?…".contains(c) { salida.append(actual); actual = "" }
        }
        if !actual.trimmingCharacters(in: .whitespaces).isEmpty { salida.append(actual) }
        // Las frases muy cortas («¡Ja!») van con la siguiente: suena más natural
        var unidas: [String] = []
        for f in salida {
            if let ultima = unidas.last, letras(ultima).count < 12 { unidas[unidas.count - 1] = ultima + f } else { unidas.append(f) }
        }
        return unidas
    }

    /// Solo letras y números, en minúscula y sin tildes (para comparar textos que se limpiaron distinto).
    nonisolated static func letras(_ t: String) -> String {
        String(t.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil).unicodeScalars
            .filter { CharacterSet.alphanumerics.contains($0) }.map(Character.init))
    }

    /// Lo que queda de `texto` después de lo ya dicho (comparando solo letras). nil si no empieza igual.
    static func resto(de texto: String, yaDicho: String) -> String? {
        let dicho = letras(yaDicho)
        guard letras(texto).hasPrefix(dicho) else { return nil }
        var faltan = dicho.count
        var i = texto.startIndex
        while faltan > 0, i < texto.endIndex {
            if !letras(String(texto[i])).isEmpty { faltan -= 1 }
            i = texto.index(after: i)
        }
        // Lo que cerraba lo ya dicho (el punto, la coma) no se repite al empezar lo que falta
        while i < texto.endIndex, ".,;:!?…)»\" ".contains(texto[i]) { i = texto.index(after: i) }
        return String(texto[i...])
    }
}
