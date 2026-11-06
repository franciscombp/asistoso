import Foundation
import FoundationModels

/// El cerebro de Uku en el Mac.
/// - **Apple Intelligence** (FoundationModels, en el equipo): la charla de todos los días. Rápido, privado y sin red.
/// - **Groq** (en la nube): lo complejo. Preguntas largas o de conocimiento, explicar, redactar, calcular, y lo que
///   Uku hace al cerrar una conversación (anotar hechos en la memoria y escribir el diario).
/// Si uno falla o no está, prueba con el otro. Sin ninguno, la web responde con su compendio de frases.
/// El prompt lo sigue armando la web (atiende.js › sistema); aquí solo se decide quién contesta.
@MainActor
final class Cerebro {
    static let compartido = Cerebro()

    /// Por dónde va una respuesta.
    enum Via: String { case apple, groq }

    struct Respuesta {
        var texto: String?
        var via: Via?
        var modelo: String = ""
        var motivo: String = ""
        var error: String = ""
    }

    private let modeloApple = SystemLanguageModel.default

    var appleDisponible: Bool { modeloApple.availability == .available }

    /// Por qué Apple Intelligence no está (para Ajustes y el chat de depurar).
    var appleEstado: String {
        switch modeloApple.availability {
        case .available: return "Listo"
        case .unavailable(let razon):
            switch razon {
            case .deviceNotEligible: return "Este Mac no es compatible con Apple Intelligence"
            case .appleIntelligenceNotEnabled: return "Activa Apple Intelligence en Ajustes del Sistema"
            case .modelNotReady: return "El modelo se está descargando"
            @unknown default: return "No disponible"
            }
        }
    }

    /// Lo que la web pregunta al arrancar (mente.js › comprobar).
    func estado() async -> [String: Any] {
        let apple = appleDisponible, groq = Groq.compartido.configurado
        var partes: [String] = []
        if apple { partes.append("Apple Intelligence") }
        if groq, let id = try? await Groq.compartido.modelo() { partes.append("Groq · \(id)") }
        else if groq { partes.append("Groq") }
        // Con 8 GB, sin key de Groq la charla carga el modelo de Apple junto al 3D: que se note en el inicio
        if apple && !groq && Self.pocaMemoria { partes = ["Apple Intelligence (con \(Self.memoriaGB) GB va más fluido con una key de Groq: ⌘, › Cerebro)"] }
        var r: [String: Any] = ["listo": apple || groq, "modelo": partes.joined(separator: " + "), "apple": apple, "groq": groq]
        if !apple && !groq { r["error"] = "\(appleEstado) y no hay key de Groq" }
        return r
    }

    /// Responde a la conversación. `crudo` = memoria o diario (memoria.js): no se corta y va a Groq si está.
    /// `alParcial` recibe el texto mientras se escribe (solo de la vía que termina contestando).
    func responder(_ mensajes: [Mensaje], crudo: Bool, alParcial: @escaping (String) -> Void) async -> Respuesta {
        var r = Respuesta()
        let orden = rutas(para: mensajes, crudo: crudo)
        r.motivo = orden.motivo
        for via in orden.vias {
            do {
                switch via {
                case .apple:
                    r.texto = try await conApple(mensajes, crudo: crudo, alParcial: alParcial)
                    r.modelo = "Apple Intelligence"
                case .groq:
                    let g = try await Groq.compartido.responder(recortar(mensajes), maxTokens: crudo ? 320 : 160) { t in
                        await MainActor.run { alParcial(t) }
                    }
                    r.texto = g.texto
                    r.modelo = "Groq · \(g.modelo)"
                }
                r.via = via
                if let t = r.texto, !t.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return r }
                r.motivo += " · \(via.rawValue) respondió vacío"
            } catch {
                r.error += (r.error.isEmpty ? "" : " · ") + "\(via.rawValue): \(error.localizedDescription)"
            }
        }
        if orden.vias.isEmpty { r.motivo = "ni Apple Intelligence ni Groq están disponibles" }
        r.texto = nil
        return r
    }

    // MARK: - Qué es complejo

    /// Preferencia en Ajustes: auto (por defecto), solo Apple Intelligence o solo Groq.
    private var preferencia: String { UserDefaults.standard.string(forKey: Ajustes.cerebroPreferencia) ?? "auto" }

    private func rutas(para mensajes: [Mensaje], crudo: Bool) -> (vias: [Via], motivo: String) {
        let apple = appleDisponible, groq = Groq.compartido.configurado
        func disponibles(_ orden: [Via]) -> [Via] { orden.filter { $0 == .apple ? apple : groq } }
        switch preferencia {
        case "apple": return (disponibles([.apple]), "Ajustes: solo Apple Intelligence")
        case "groq": return (disponibles([.groq]), "Ajustes: solo Groq")
        default: break
        }
        if crudo { return (disponibles([.groq, .apple]), "memoria/diario: lo hace Groq si está") }
        if let porque = Self.complejo(mensajes) { return (disponibles([.groq, .apple]), "complejo (\(porque)): Groq") }
        // Con poca memoria (8 GB), el modelo de Apple compite con el mundo 3D y todo va a tropezones: la charla va a Groq
        if Self.pocaMemoria && groq { return (disponibles([.groq, .apple]), "charla: Groq (este Mac tiene \(Self.memoriaGB) GB)") }
        return (disponibles([.apple, .groq]), "charla: Apple Intelligence")
    }

    static let memoriaGB = Int((Double(ProcessInfo.processInfo.physicalMemory) / 1_073_741_824).rounded())
    /// 8 GB o menos: no conviene cargar el modelo de Apple junto al mundo 3D.
    static let pocaMemoria = memoriaGB <= 8

        /// Devuelve por qué la pregunta es compleja, o nil si es charla para Apple Intelligence.
    static func complejo(_ mensajes: [Mensaje]) -> String? {
        let ultimo = mensajes.last(where: { $0.role == "user" })?.content ?? ""
        let t = ultimo.lowercased()
        let palabras = t.split(whereSeparator: \.isWhitespace).count
        if palabras > 30 || t.count > 180 { return "pregunta larga" }
        // Contexto que no cabe cómodo en los 4096 tokens del modelo del equipo
        let total = mensajes.reduce(0) { $0 + $1.content.count }
        if total > 9000 { return "mucho contexto" }
        let senales: [(Regex<Substring>, String)] = [
            (/expl[ií]ca|c[oó]mo funciona|por qu[eé] (?:es|son|pasa|se|hay)|qu[eé] diferencia|compara/, "explicar"),
            (/resum|traduc|en ingl[eé]s|en franc[eé]s|c[oó]mo se dice/, "resumir o traducir"),
            (/calcula|cu[aá]nto es \d+.*[x×*\/^]|porcentaje|ra[ií]z cuadrada|ecuaci[oó]n/, "calcular"),
            (/c[oó]digo|programa|python|swift|javascript|excel|f[oó]rmula/, "técnico"),
            (/receta|historia de|qui[eé]n (?:fue|invent[oó]|gan[oó]|descubri[oó])|cu[aá]l es la capital|en qu[eé] a[nñ]o/, "conocimiento"),
            (/escr[ií]be(?:me)? (?:un|una)|redacta|ay[uú]dame a (?:escribir|redactar|organizar|planear|decidir)|haz(?:me)? un plan/, "redactar o planear"),
            (/qu[eé] opinas (?:de|sobre)|dame (?:ideas|consejos) (?:para|sobre)|pros y contras/, "pensar a fondo")
        ]
        for (re, porque) in senales where t.firstMatch(of: re) != nil { return porque }
        return nil
    }

    // MARK: - Apple Intelligence

    private func conApple(_ mensajes: [Mensaje], crudo: Bool, alParcial: @escaping (String) -> Void) async throws -> String {
        let sistema = mensajes.first(where: { $0.role == "system" })?.content ?? ""
        let charla = mensajes.filter { $0.role != "system" }.suffix(8)
        // Sesión nueva en cada turno (la web manda todo el contexto): el historial va en el prompt
        let instrucciones = String(sistema.prefix(6000)) + "\n\nResponde en español, sin emojis ni formato (se lee en voz alta)."
        let session = LanguageModelSession(model: modeloApple, instructions: instrucciones)
        var prompt = ""
        if charla.count > 1 {
            prompt += "Conversación hasta ahora:\n"
            for m in charla.dropLast() {
                prompt += (m.role == "assistant" ? "Uku: " : "Persona: ") + String(m.content.prefix(400)) + "\n"
            }
            prompt += "\nLo último que te dijeron:\n"
        }
        prompt += String((charla.last?.content ?? "").prefix(crudo ? 4000 : 600))

        let opciones = GenerationOptions(temperature: crudo ? 0.3 : 0.75, maximumResponseTokens: crudo ? 300 : 120)
        let flujo = session.streamResponse(to: prompt, options: opciones)
        var texto = ""
        for try await parte in flujo {
            texto = parte.content
            alParcial(texto)
            // Como el modelo local de la web: en la charla corta apenas tiene dos frases, para no hacer esperar
            if !crudo, Self.frasesCompletas(texto) >= 2 { break }
        }
        return texto
    }

    static func frasesCompletas(_ t: String) -> Int {
        let recortado = t.trimmingCharacters(in: .whitespaces)
        guard let ultimo = recortado.last, ".!?…".contains(ultimo) else { return 0 }
        return recortado.matches(of: /[.!?…](\s|$)/).count
    }

    // MARK: - Groq

    /// Lo que va a Groq: el sistema (hasta 6000 caracteres) y las últimas 10 frases, cada una corta (como el Worker).
    private func recortar(_ mensajes: [Mensaje]) -> [Mensaje] {
        let sistema = mensajes.first(where: { $0.role == "system" }).map { Mensaje(role: "system", content: String($0.content.prefix(6000))) }
        let resto = mensajes.filter { $0.role != "system" }.suffix(10).map { Mensaje(role: $0.role, content: String($0.content.prefix(2000))) }
        return (sistema.map { [$0] } ?? []) + resto
    }
}
