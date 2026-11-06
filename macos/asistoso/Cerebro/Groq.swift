import Foundation

/// Un mensaje de la conversación, con los mismos roles que usa la web (`system`, `user`, `assistant`).
struct Mensaje: Codable, Sendable {
    var role: String
    var content: String
}

/// Cliente de Groq (API compatible con OpenAI) para lo que Apple Intelligence no alcanza.
/// La key vive en el Llavero; si no se eligió modelo, usa el de chat con más contexto que ofrece la cuenta
/// (igual que hacía el Worker `uku-cerebro`).
actor Groq {
    static let compartido = Groq()

    enum Fallo: LocalizedError {
        case sinKey
        case sinModelos
        case http(Int, String)

        var errorDescription: String? {
            switch self {
            case .sinKey: "Falta la key de Groq (Ajustes › Cerebro)"
            case .sinModelos: "Groq no ofrece modelos de chat con esta key"
            case .http(let status, let detalle): "Groq respondió \(status): \(detalle)"
            }
        }
    }

    private let base = URL(string: "https://api.groq.com/openai/v1")!
    private var elegido: String?

    /// Hay key guardada (no comprueba que sea válida).
    nonisolated var configurado: Bool { Llavero.leer(Llavero.groq)?.isEmpty == false }

    /// El modelo que se usará: el de Ajustes o, si no hay, el de más contexto y más grande.
    func modelo() async throws -> String {
        let fijo = UserDefaults.standard.string(forKey: Ajustes.groqModelo)?.trimmingCharacters(in: .whitespaces) ?? ""
        if !fijo.isEmpty { return fijo }
        if let elegido { return elegido }
        let lista = try await modelos()
        // Para conversar: los que responden rápido y con gracia en español; si no está ninguno, el de más contexto
        let preferidos = ["llama-3.3-70b-versatile", "meta-llama/llama-4-maverick-17b-128e-instruct", "moonshotai/kimi-k2-instruct", "llama-3.1-8b-instant"]
        guard let primero = preferidos.first(where: lista.contains) ?? lista.first else { throw Fallo.sinModelos }
        elegido = primero
        return primero
    }

    /// Los modelos de chat (sin voz, transcripción ni moderación), del de más contexto al de menos.
    func modelos() async throws -> [String] {
        struct Lista: Decodable {
            struct Modelo: Decodable { let id: String; let active: Bool?; let context_window: Int? }
            let data: [Modelo]
        }
        let (datos, _) = try await pedir("/models", cuerpo: nil)
        let lista = try JSONDecoder().decode(Lista.self, from: datos)
        let noChat = /(?i)whisper|tts|playai|orpheus|guard|safeguard|distil|compound/
        func tamano(_ id: String) -> Int {
            guard let m = id.firstMatch(of: /(?i)(\d+)b\b/) else { return 0 }
            return Int(m.1) ?? 0
        }
        return lista.data
            .filter { $0.active != false && $0.id.firstMatch(of: noChat) == nil }
            .sorted { a, b in
                let ca = a.context_window ?? 0, cb = b.context_window ?? 0
                return ca != cb ? ca > cb : tamano(a.id) > tamano(b.id)
            }
            .map(\.id)
    }

    /// Conversa en streaming: `alParcial` recibe el texto acumulado mientras llega. Devuelve el texto final.
    func responder(_ mensajes: [Mensaje], maxTokens: Int, alParcial: @Sendable (String) async -> Void) async throws -> (texto: String, modelo: String) {
        let id = try await modelo()
        let cuerpo: [String: Any] = [
            "model": id,
            "messages": mensajes.map { ["role": $0.role, "content": $0.content] },
            "max_tokens": maxTokens,
            "temperature": 0.8,
            "stream": true
        ]
        var peticion = try peticionBase("/chat/completions")
        peticion.httpMethod = "POST"
        peticion.httpBody = try JSONSerialization.data(withJSONObject: cuerpo)
        peticion.timeoutInterval = 20

        let (bytes, respuesta) = try await URLSession.shared.bytes(for: peticion)
        let status = (respuesta as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else {
            var detalle = ""
            for try await linea in bytes.lines { detalle += linea; if detalle.count > 300 { break } }
            // El modelo elegido ya no está: se vuelve a elegir la próxima vez
            if status == 400 || status == 404 { elegido = nil }
            throw Fallo.http(status, String(detalle.prefix(200)))
        }

        // Flujo SSE: líneas "data: {...}" con choices[0].delta.content
        struct Trozo: Decodable {
            struct Opcion: Decodable { struct Delta: Decodable { let content: String? }; let delta: Delta? }
            let choices: [Opcion]
        }
        var texto = ""
        for try await linea in bytes.lines {
            guard linea.hasPrefix("data:") else { continue }
            let dato = linea.dropFirst(5).trimmingCharacters(in: .whitespaces)
            if dato.isEmpty || dato == "[DONE]" { continue }
            guard let json = dato.data(using: .utf8),
                  let trozo = try? JSONDecoder().decode(Trozo.self, from: json),
                  let delta = trozo.choices.first?.delta?.content, !delta.isEmpty else { continue }
            texto += delta
            await alParcial(texto)
        }
        return (texto, id)
    }

    // MARK: - HTTP

    private func peticionBase(_ ruta: String) throws -> URLRequest {
        guard let key = Llavero.leer(Llavero.groq), !key.isEmpty else { throw Fallo.sinKey }
        var peticion = URLRequest(url: base.appending(path: ruta))
        peticion.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        peticion.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return peticion
    }

    private func pedir(_ ruta: String, cuerpo: Data?) async throws -> (Data, HTTPURLResponse) {
        var peticion = try peticionBase(ruta)
        if let cuerpo { peticion.httpMethod = "POST"; peticion.httpBody = cuerpo }
        peticion.timeoutInterval = 10
        let (datos, respuesta) = try await URLSession.shared.data(for: peticion)
        let http = respuesta as? HTTPURLResponse
        guard let http, http.statusCode == 200 else {
            throw Fallo.http(http?.statusCode ?? 0, String(decoding: datos.prefix(200), as: UTF8.self))
        }
        return (datos, http)
    }

    /// Olvida el modelo elegido (al cambiar la key o el modelo en Ajustes).
    func reiniciar() { elegido = nil }
}
