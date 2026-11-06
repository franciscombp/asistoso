import Foundation

/// La foto de lo que vive en la web (nativo.js › UkuUI.datos): lo que muestran el inicio, la barra y «Quién vino».
/// Las personas no vienen aquí: viven en Swift (`Personas`).
struct DatosWeb: Decodable, Sendable {
    struct Opciones: Decodable, Sendable, Equatable {
        var voz = false, hud = false, demo = false, despierto = true, mic = true, llamada = true
    }
    struct Estado: Decodable, Sendable { var texto = ""; var tipo = "" }
    struct OidoUI: Decodable, Sendable { var visible = false; var texto = "" }
    struct Camara: Decodable, Sendable { var control = false, espejo = false, pajaro = false, decorar = false }
    struct Visita: Decodable, Sendable, Identifiable {
        var id: String
        var personaId: String
        var desde: Double
        var hasta: Double?
        var visto: Bool?
        var gestos: Int?

        var inicio: Date { Date(timeIntervalSince1970: desde / 1000) }
        var duracion: TimeInterval { ((hasta ?? desde) - desde) / 1000 }
    }
    struct Recado: Decodable, Sendable, Identifiable {
        var id: String
        var texto: String
        var personaId: String?
        var fecha: Double
        var visto: Bool?

        var cuando: Date { Date(timeIntervalSince1970: fecha / 1000) }
    }
    struct Fran: Decodable, Sendable {
        struct Opcion: Decodable, Sendable, Identifiable { var k: String; var t: String; var id: String { k } }
        var tipo = "bano", texto = "", vuelve = "", previa = ""
        var opciones: [Opcion] = []
    }
    struct Memoria: Decodable, Sendable {
        struct Relacion: Decodable, Sendable { var dias = 0, conversaciones = 0, hechos = 0 }
        struct Entrada: Decodable, Sendable, Identifiable { var id: String; var texto: String; var fecha: String; var hora: String? }
        struct Hecho: Decodable, Sendable, Identifiable { var id: String; var texto: String; var fecha: String; var veces: Int?; var seguimiento: Bool? }
        var relacion = Relacion()
        var diario: [Entrada] = []
        var hechos: [Hecho] = []
    }
    struct Tareas: Decodable, Sendable {
        struct Recordatorio: Decodable, Sendable, Identifiable { var id: String; var texto: String; var ms: Double; var cuando: Date { Date(timeIntervalSince1970: ms / 1000) } }
        struct Postit: Decodable, Sendable, Identifiable { var id: String; var texto: String; var color: String? }
        var recordatorios: [Recordatorio] = []
        var postits: [Postit] = []
    }

    var empezado = false
    var inicio = true
    var opciones = Opciones()
    var nube = ""
    var estado = Estado()
    var oido = OidoUI()
    var modo = "guardian"
    var voz = false
    var mic = false
    var despierto = false
    var hud = false
    var camara = Camara()
    var pendientes = 0
    var dueno = "Fran"
    var visitas: [Visita] = []
    var mensajes: [Recado] = []
    var fran = Fran()
    var memoria = Memoria()
    var tareas = Tareas()

    init() {}

    /// Decodifica la foto; nil si la web todavía no arrancó (`listo: false`).
    static func desde(_ json: String) -> DatosWeb? {
        struct Listo: Decodable { var listo: Bool }
        let datos = Data(json.utf8)
        guard (try? JSONDecoder().decode(Listo.self, from: datos))?.listo == true else { return nil }
        do { return try JSONDecoder().decode(DatosWeb.self, from: datos) } catch {
            print("Uku: no pude leer los datos de la web: \(error)")
            return nil
        }
    }
}
