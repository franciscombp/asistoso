import Foundation
import Observation

/// El estado de la UI nativa: lo que la web informa (DatosWeb), las personas (Swift) y qué paneles están abiertos.
/// Las acciones llaman a `window.Mimo` en la web, que sigue llevando la lógica de Uku.
@MainActor @Observable
final class Uku {
    enum Pestana: String, CaseIterable, Identifiable {
        case visitas, mensajes, personas, estado, diario
        var id: String { rawValue }
        var titulo: String {
            switch self {
            case .visitas: "Visitas"
            case .mensajes: "Mensajes"
            case .personas: "Personas"
            case .estado: "Dónde estoy"
            case .diario: "Diario"
            }
        }
        var simbolo: String {
            switch self {
            case .visitas: "person.2"
            case .mensajes: "envelope"
            case .personas: "person.crop.square"
            case .estado: "mappin.and.ellipse"
            case .diario: "book"
            }
        }
    }

    let puente: Puente
    var personas: Personas { puente.personas }

    private(set) var datos = DatosWeb()
    private(set) var webLista = false
    var panelAbierto = false {
        didSet { if panelAbierto != oldValue { puente.ejecutar("window.UkuUI && UkuUI.panel(\(panelAbierto))") } }
    }
    var pestana: Pestana = .visitas
    var ayudaAbierta = false
    /// Mientras se presenta a alguien: tomas hechas de cuántas.
    var progresoRegistro: (Int, Int)?

    init(puente: Puente) {
        self.puente = puente
        puente.uku = self
    }

    /// Vuelve a leer la foto de la web (la web avisa cuando algo cambia).
    func refrescar() async {
        guard let json = await puente.js("window.UkuUI ? UkuUI.datos() : '{\"listo\":false}'"),
              let d = DatosWeb.desde(json) else { return }
        datos = d
        #if DEBUG
        if !webLista { print("Uku · web lista: inicio=\(d.inicio), modo=\(d.modo), opciones de Fran=\(d.fran.opciones.count), nube=\(d.nube)") }
        #endif
        webLista = true
    }

    /// La web pidió abrir o cerrar «Quién vino» (tecla P, botón o cuando vuelve Fran).
    func pedidoDePanel(abrir: Bool?, alternar: Bool, tab: String?) {
        if let tab, let p = Pestana(rawValue: tab) { pestana = p }
        if alternar { panelAbierto.toggle() } else if let abrir { panelAbierto = abrir }
    }

    // MARK: - Acciones (en la web)

    private func mimo(_ codigo: String) {
        puente.ejecutar("window.Mimo && (\(codigo))")
        Task { await refrescar() }
    }
    private func lit(_ s: String) -> String { Puente.literal(s) }

    // Inicio
    func opcion(_ id: String, _ valor: Bool) {
        puente.ejecutar("{ const i = document.getElementById(\(lit("opt-" + id))); if (i) { i.checked = \(valor); i.dispatchEvent(new Event('change')); } }")
        Task { await refrescar() }
    }
    func empezar(conCamara: Bool) {
        puente.ejecutar("document.getElementById(\(lit(conCamara ? "empezar" : "sin-camara"))).click()")
    }

    // Barra
    func setModo(_ demo: Bool) { mimo("Mimo.setModo(\(lit(demo ? "demo" : "guardian")))") }
    func alternarVoz() { puente.tecla("m"); Task { await refrescar() } }
    func alternarMic() { puente.ejecutar("document.getElementById('btn-mic').click()") }
    func alternarDespierto() { puente.tecla("s") }
    func alternarHud() { mimo("Mimo.alternarHud()") }
    func boton(_ id: String) { puente.ejecutar("document.getElementById(\(lit(id))).click()") }
    func tecla(_ k: String) { puente.tecla(k) }

    // Estado de Fran
    func setEstado(tipo: String? = nil, texto: String? = nil, vuelve: String? = nil) {
        var partes: [String] = []
        if let tipo { partes.append("tipo: \(lit(tipo))") }
        if let texto { partes.append("texto: \(lit(texto))") }
        if let vuelve { partes.append("vuelve: \(lit(vuelve))") }
        mimo("Mimo.atiende.setEstado({ \(partes.joined(separator: ", ")) })")
    }

    // Visitas y mensajes
    func borrarVisitas() { mimo("Mimo.visitas.borrarTodas()") }
    func borrarMensaje(_ id: String) { mimo("Mimo.atiende.borrarMensaje(\(lit(id)))") }

    // Personas (viven en Swift; las visitas y los mensajes que las nombran, en la web)
    func renombrar(_ id: String, _ nombre: String) { personas.renombrar(id, nombre) }
    func marcarDueno(_ id: String) { personas.marcarDueno(id) }
    func borrarPersona(_ id: String) {
        personas.borrar(id)
        mimo("Mimo.visitas.borrarDePersona(\(lit(id)))")
    }
    func juntar(_ desde: String, en hacia: String) {
        personas.juntar(desde, en: hacia)
        mimo("Mimo.visitas.moverPersona(\(lit(desde)), \(lit(hacia))), Mimo.atiende.moverPersona(\(lit(desde)), \(lit(hacia)))")
    }
    func presentar(_ nombre: String) async -> Bool {
        let r = await puente.registrar(nombre)
        return r["persona"] != nil
    }

    // Memoria y tareas
    func borrarDiario(_ id: String) { mimo("Mimo.memoria.borrarDiario(\(lit(id)))") }
    func olvidar(_ id: String) { mimo("Mimo.memoria.olvidar(\(lit(id)))") }
    func olvidarTodo() { mimo("Mimo.memoria.olvidarTodo()") }
    func quitarRecordatorio(_ id: String) { mimo("Mimo.tareas.quitarRecordatorio(\(lit(id)))") }
    func quitarPostit(_ id: String) { mimo("Mimo.tareas.quitarPostit(\(lit(id)))") }

    func nombre(de personaId: String?) -> String {
        guard let personaId, let p = personas.persona(personaId) else { return "Alguien" }
        return p.nombreVisible
    }
}
