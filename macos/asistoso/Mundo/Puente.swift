import AppKit
import Foundation
import WebKit

/// El puente entre el mundo 3D (la web en WKWebView) y lo nativo.
/// La web pide con `UkuNativo.pedir(tipo, datos)` (nativo.js) y recibe la respuesta como Promise;
/// lo que Swift avisa por su cuenta (trozos del cerebro, el oído, la voz, la visión) llega con `UkuNativo._evento`.
@MainActor
final class Puente: NSObject, WKScriptMessageHandlerWithReply {
    weak var webView: WKWebView?
    /// La UI nativa: se entera de los cambios de la web y de los pedidos de abrir paneles.
    weak var uku: Uku?

    let oido = Oido()
    let voz = Voz()
    let despierto = Despierto()
    let ojos = Ojos()
    let caras = Caras()
    let personas = Personas()

    override init() {
        super.init()
        oido.voz = voz
        oido.alEvento = { [weak self] e in
            switch e {
            case .texto(let t): self?.avisar("oido", ["tipo": "texto", "texto": t])
            case .parcial(let t): self?.avisar("oido", ["tipo": "parcial", "texto": t])
            case .error(let t): self?.avisar("oido", ["tipo": "error", "texto": t])
            }
        }
        // Cada frase que empieza a sonar (la boca de Uku la sigue) y el final (interrumpido = le hablaron encima)
        voz.alEvento = { [weak self] e in
            switch e {
            case .frase(let t): self?.avisar("voz", ["tipo": "frase", "texto": t])
            case .fin(let interrumpido): self?.avisar("voz", ["tipo": "fin", "interrumpido": interrumpido])
            }
        }
        // Manos y cuerpo de cada cuadro → la web (vision.js), ya en el formato de MediaPipe
        // (El puente vive lo que dura la app: se captura directo)
        ojos.alCuadro = { [self] cuadro in
            guard let json = try? JSONSerialization.data(withJSONObject: cuadro), let texto = String(data: json, encoding: .utf8) else { return }
            Task { @MainActor in self.avisarJSON("vision", texto) }
        }
        personas.alCambiar = { [weak self] in self?.enviarPersonas() }
        voz.precalentar()
    }

    /// Manda un evento a la web (nativo.js › _evento).
    func avisar(_ evento: String, _ datos: Any) {
        guard let json = try? JSONSerialization.data(withJSONObject: datos, options: [.fragmentsAllowed]),
              let texto = String(data: json, encoding: .utf8) else { return }
        avisarJSON(evento, texto)
    }

    private func avisarJSON(_ evento: String, _ json: String) {
        webView?.evaluateJavaScript("window.UkuNativo && UkuNativo._evento(\(Self.literal(evento)), \(json))")
    }

    /// Ejecuta JavaScript en la web y devuelve el resultado como texto (para la UI nativa).
    func js(_ codigo: String) async -> String? {
        guard let webView else { return nil }
        return try? await webView.evaluateJavaScript(codigo) as? String
    }

    /// Ejecuta una acción en la web, sin esperar resultado.
    func ejecutar(_ codigo: String) {
        webView?.evaluateJavaScript("try { \(codigo) } catch (e) { console.error(e) }; void 0")
    }

    /// Ejecuta un atajo de la web (las mismas teclas de mimo.js).
    func tecla(_ k: String) {
        ejecutar("window.dispatchEvent(new KeyboardEvent('keydown', { key: \(Self.literal(k)), bubbles: true }))")
    }

    /// Un texto como literal de JavaScript (con comillas y escapes).
    static func literal(_ s: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: s, options: [.fragmentsAllowed])
        return data.flatMap { String(data: $0, encoding: .utf8) } ?? "\"\""
    }

    private func enviarPersonas() {
        avisar("caras.personas", personas.lista.map(\.paraWeb))
    }

    // MARK: - WKScriptMessageHandlerWithReply

    func userContentController(_ controller: WKUserContentController, didReceive mensaje: WKScriptMessage) async -> (Any?, String?) {
        guard let cuerpo = mensaje.body as? [String: Any], let tipo = cuerpo["tipo"] as? String else { return (nil, "mensaje sin tipo") }
        let datos = cuerpo["datos"] as? [String: Any] ?? [:]
        switch tipo {
        // Cerebro
        case "cerebro.estado":
            return (await Cerebro.compartido.estado(), nil)
        case "cerebro.responder":
            let id = datos["id"] as? Int ?? 0
            let crudo = datos["crudo"] as? Bool ?? false
            let mensajes = (datos["mensajes"] as? [[String: Any]] ?? []).compactMap { m -> Mensaje? in
                guard let role = m["role"] as? String, let content = m["content"] as? String else { return nil }
                return Mensaje(role: role, content: content)
            }
            // Con voz, Uku empieza a decir la primera frase apenas el modelo la escribe (no espera la respuesta entera)
            let hablar = !crudo && datos["voz"] as? Bool == true
            let dicha = hablar ? voz.nuevaRespuesta() : nil
            let r = await Cerebro.compartido.responder(mensajes, crudo: crudo) { [weak self] parcial in
                self?.avisar("cerebro.parcial", ["id": id, "texto": parcial])
                if let dicha { self?.voz.avanzarRespuesta(dicha, parcial) }
            }
            if let dicha, let t = r.texto { voz.avanzarRespuesta(dicha, t, final: true) }
            var salida: [String: Any] = ["via": r.via?.rawValue ?? "", "modelo": r.modelo, "motivo": r.motivo, "error": r.error]
            if let t = r.texto { salida["texto"] = t }
            return (salida, nil)

        // Oído y voz
        case "oido.escuchar":
            do {
                try await oido.escuchar(idioma: datos["idioma"] as? String ?? "es-EC")
                return (["ok": true], nil)
            } catch {
                return (["error": error.localizedDescription], nil)
            }
        case "oido.callado":
            oido.callado = datos["valor"] as? Bool ?? false
            return (["ok": true], nil)
        case "oido.parar":
            oido.parar()
            return (["ok": true], nil)
        case "voz.hablar":
            voz.hablar(datos["texto"] as? String ?? "")
            return (["ok": true], nil)
        case "voz.callar":
            voz.callar()
            return (["ok": true], nil)

        // Visión (manos y cuerpo con Vision)
        case "vision.encender":
            do {
                try await ojos.encender()
                return (["ok": true], nil)
            } catch {
                return (["error": error.localizedDescription], nil)
            }

        // Caras (Vision + FaceNet en Core ML) y personas
        case "caras.personas":
            return (personas.lista.map(\.paraWeb), nil)
        case "caras.reconocer":
            return (await reconocer(caja: Self.caja(datos["caja"])), nil)
        case "caras.registrar":
            return (await registrar(datos["nombre"] as? String ?? ""), nil)
        case "caras.renombrar":
            personas.renombrar(datos["id"] as? String ?? "", datos["nombre"] as? String ?? "")
            return (["ok": true], nil)
        case "caras.dueno":
            personas.marcarDueno(datos["id"] as? String ?? "")
            return (["ok": true], nil)
        case "caras.borrar":
            personas.borrar(datos["id"] as? String ?? "")
            return (["ok": true], nil)
        case "caras.borrarTodas":
            personas.borrarTodas()
            return (["ok": true], nil)
        case "caras.juntar":
            personas.juntar(datos["desde"] as? String ?? "", en: datos["hacia"] as? String ?? "")
            return (["ok": true], nil)

        // Sistema
        case "despierto":
            if datos["on"] as? Bool == true { return (["ok": despierto.activar()], nil) }
            despierto.desactivar()
            return (["ok": true], nil)
        case "pantallaCompleta":
            if let ventana = webView?.window {
                let yaEsta = ventana.styleMask.contains(.fullScreen)
                if datos["alternar"] as? Bool == true || !yaEsta { ventana.toggleFullScreen(nil) }
            }
            return (["ok": true], nil)

        case "log":
            print("Uku · \(datos["texto"] as? String ?? "")")
            return (["ok": true], nil)

        // UI nativa
        case "ui.cambio":
            await uku?.refrescar()
            return (["ok": true], nil)
        case "ui.panel":
            uku?.pedidoDePanel(abrir: datos["abrir"] as? Bool, alternar: datos["alternar"] as? Bool == true, tab: datos["tab"] as? String)
            return (["ok": true], nil)
        case "ui.ayuda":
            uku?.ayudaAbierta.toggle()
            return (["ok": true], nil)

        default:
            return (nil, "tipo desconocido: \(tipo)")
        }
    }

    // MARK: - Reconocer

    private static func caja(_ valor: Any?) -> CGRect? {
        guard let c = valor as? [String: Any], let x0 = c["x0"] as? Double, let y0 = c["y0"] as? Double,
              let x1 = c["x1"] as? Double, let y1 = c["y1"] as? Double else { return nil }
        return CGRect(x: x0, y: y0, width: x1 - x0, height: y1 - y0)
    }

    /// Analiza la cara en un hilo aparte (Vision + Core ML) e identifica en el hilo principal.
    private func reconocer(caja: CGRect?) async -> [String: Any] {
        guard let pixeles = ojos.cuadroActual() else { return ["persona": NSNull()] }
        let caras = self.caras
        let analisis = await Task.detached(priority: .userInitiated) { caras.analizar(pixeles, caja: caja) }.value
        guard let analisis else { return ["persona": NSNull()] }
        let (p, nueva) = personas.identificar(analisis)
        return ["persona": p.paraWeb, "nueva": nueva]
    }

    /// Presentar a alguien: 5 tomas claras de la cara más grande (moviendo un poco la cabeza queda mejor).
    func registrar(_ nombre: String) async -> [String: Any] {
        let nombre = nombre.trimmingCharacters(in: .whitespaces)
        guard !nombre.isEmpty else { return ["error": "Falta el nombre"] }
        if !ojos.corriendo { try? await ojos.encender() }
        var tomas: [Caras.Analisis] = []
        let caras = self.caras
        for _ in 0..<40 where tomas.count < 5 {
            if let pixeles = ojos.cuadroActual(),
               let a = await Task.detached(priority: .userInitiated, operation: { caras.analizar(pixeles, caja: nil) }).value {
                tomas.append(a)
                avisar("caras.progreso", ["n": tomas.count, "total": 5])
                uku?.progresoRegistro = (tomas.count, 5)
            }
            try? await Task.sleep(for: .milliseconds(350))
        }
        uku?.progresoRegistro = nil
        guard tomas.count >= 3, let p = personas.registrar(nombre, tomas: tomas) else { return ["error": "sin-cara"] }
        return ["persona": p.paraWeb]
    }
}
