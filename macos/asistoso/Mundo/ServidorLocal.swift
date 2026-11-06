import Foundation
import Network
import os

/// Sirve el mundo de Uku (Web.bundle) en http://127.0.0.1:<puerto>/ solo para este Mac.
/// Hace falta un origen http de verdad: los módulos ES no cargan desde file:// y la cámara (getUserMedia) solo
/// funciona en un contexto seguro, que localhost sí es. El puerto es fijo para que el localStorage de la web
/// (memoria, visitas, diario) se conserve entre aperturas.
nonisolated final class ServidorLocal: @unchecked Sendable {
    static let puertos: [UInt16] = [47615, 47616, 47617]

    private let raiz: URL
    private var listener: NWListener?
    private let cola = DispatchQueue(label: "uku.servidor")

    init(raiz: URL) { self.raiz = raiz.standardizedFileURL }

    /// Arranca en el primer puerto libre y devuelve la URL base.
    func arrancar() async throws -> URL {
        var ultimoError: Error?
        for puerto in Self.puertos {
            do { return try await arrancar(en: puerto) } catch { ultimoError = error }
        }
        throw ultimoError ?? URLError(.cannotConnectToHost)
    }

    private func arrancar(en puerto: UInt16) async throws -> URL {
        let parametros = NWParameters.tcp
        parametros.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: puerto)!)
        parametros.allowLocalEndpointReuse = true
        let listener = try NWListener(using: parametros)
        listener.newConnectionHandler = { [weak self] conexion in self?.atender(conexion) }
        return try await withCheckedThrowingContinuation { cont in
            // La continuación se resuelve una sola vez, aunque el listener cambie de estado después
            let resuelto = OSAllocatedUnfairLock(initialState: false)
            let resolver = { () -> Bool in resuelto.withLock { ya in defer { ya = true }; return !ya } }
            listener.stateUpdateHandler = { estado in
                switch estado {
                case .ready:
                    if resolver() { cont.resume(returning: URL(string: "http://127.0.0.1:\(puerto)/")!) }
                case .failed(let error):
                    listener.cancel()
                    if resolver() { cont.resume(throwing: error) }
                default: break
                }
            }
            self.listener = listener
            listener.start(queue: cola)
        }
    }

    // MARK: - HTTP mínimo (GET y HEAD, una petición por conexión)

    private func atender(_ conexion: NWConnection) {
        conexion.start(queue: cola)
        leer(conexion, acumulado: Data())
    }

    private func leer(_ conexion: NWConnection, acumulado: Data) {
        conexion.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) { [weak self] datos, _, terminado, error in
            guard let self else { return }
            var total = acumulado
            if let datos { total.append(datos) }
            if total.range(of: Data("\r\n\r\n".utf8)) != nil {
                self.responder(conexion, peticion: String(decoding: total, as: UTF8.self))
            } else if terminado || error != nil || total.count > 256 * 1024 {
                conexion.cancel()
            } else {
                self.leer(conexion, acumulado: total)
            }
        }
    }

    private func responder(_ conexion: NWConnection, peticion: String) {
        let primera = peticion.split(separator: "\r\n", maxSplits: 1).first ?? ""
        let partes = primera.split(separator: " ")
        guard partes.count >= 2, partes[0] == "GET" || partes[0] == "HEAD" else {
            return enviar(conexion, estado: "405 Method Not Allowed", tipo: "text/plain", cuerpo: Data("405".utf8))
        }
        var ruta = String(partes[1])
        if let q = ruta.firstIndex(where: { $0 == "?" || $0 == "#" }) { ruta = String(ruta[..<q]) }
        ruta = ruta.removingPercentEncoding ?? ruta
        if ruta.hasSuffix("/") { ruta += "index.html" }

        let archivo = raiz.appending(path: String(ruta.drop(while: { $0 == "/" }))).standardizedFileURL
        // Nada fuera de Web.bundle
        guard archivo.path.hasPrefix(raiz.path + "/"), let cuerpo = try? Data(contentsOf: archivo) else {
            return enviar(conexion, estado: "404 Not Found", tipo: "text/plain", cuerpo: Data("404".utf8))
        }
        enviar(conexion, estado: "200 OK", tipo: Self.tipo(de: archivo.pathExtension), cuerpo: partes[0] == "HEAD" ? Data() : cuerpo, largo: cuerpo.count)
    }

    private func enviar(_ conexion: NWConnection, estado: String, tipo: String, cuerpo: Data, largo: Int? = nil) {
        let cabecera = "HTTP/1.1 \(estado)\r\nContent-Type: \(tipo)\r\nContent-Length: \(largo ?? cuerpo.count)\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n"
        var respuesta = Data(cabecera.utf8)
        respuesta.append(cuerpo)
        conexion.send(content: respuesta, completion: .contentProcessed { _ in conexion.cancel() })
    }

    private static func tipo(de ext: String) -> String {
        switch ext.lowercased() {
        case "html": "text/html; charset=utf-8"
        case "js", "mjs": "text/javascript; charset=utf-8"
        case "css": "text/css; charset=utf-8"
        case "json": "application/json"
        case "svg": "image/svg+xml"
        case "png": "image/png"
        case "jpg", "jpeg": "image/jpeg"
        case "glb": "model/gltf-binary"
        case "wasm": "application/wasm"
        default: "application/octet-stream"
        }
    }
}
