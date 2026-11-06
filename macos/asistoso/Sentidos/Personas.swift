import AppKit
import Foundation
import Observation

/// Una persona que Uku reconoce (con nombre o como «Visitante N»).
struct Persona: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var nombre: String?
    var numero: Int
    var muestras: [[Float]]
    var calidadFoto: Float
    var creado: Date
    var visto: Date
    var dueno: Bool = false

    var nombreVisible: String { nombre ?? "Visitante \(numero)" }

    /// Lo que la web necesita (sin huellas ni foto).
    var paraWeb: [String: Any] {
        ["id": id, "nombre": nombre ?? NSNull(), "numero": numero, "dueno": dueno,
         "creado": creado.timeIntervalSince1970 * 1000, "visto": visto.timeIntervalSince1970 * 1000]
    }
}

/// Las personas que Uku reconoce. Viven en este Mac (Application Support/Uku): las huellas en `personas.json` y una foto
/// chica de cada una en `fotos/`. Nada sale del equipo.
@MainActor @Observable
final class Personas {
    /// Distancia máxima entre huellas de la misma persona (FaceNet con norma 1).
    static let umbral: Float = 0.95
    /// Más allá de esto (pero dentro del umbral) se guarda la huella nueva: así aprende a la persona en otras luces y ángulos.
    static let aprender: Float = 0.55
    static let muestrasMax = 10
    static let sinNombreMax = 40

    private(set) var lista: [Persona] = []
    /// Para que la web y las vistas se enteren de los cambios.
    var alCambiar: () -> Void = {}

    private let carpeta: URL
    private var archivo: URL { carpeta.appending(path: "personas.json") }
    private var fotos: URL { carpeta.appending(path: "fotos") }

    init() {
        let base = (try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true))
            ?? FileManager.default.temporaryDirectory
        carpeta = base.appending(path: "Uku")
        try? FileManager.default.createDirectory(at: carpeta.appending(path: "fotos"), withIntermediateDirectories: true)
        if let datos = try? Data(contentsOf: archivo), let l = try? JSONDecoder().decode([Persona].self, from: datos) { lista = l }
    }

    var dueno: Persona? { lista.first { $0.dueno } }
    func persona(_ id: String) -> Persona? { lista.first { $0.id == id } }
    func urlFoto(_ id: String) -> URL { fotos.appending(path: "\(id).jpg") }
    func foto(_ id: String) -> NSImage? { NSImage(contentsOf: urlFoto(id)) }

    // MARK: - Reconocer

    /// La persona más parecida (con o sin nombre). Si nadie se parece, nace un visitante nuevo con su foto.
    func identificar(_ a: Caras.Analisis) -> (persona: Persona, nueva: Bool) {
        var mejor: Int?, dmin = Float.infinity
        for (i, p) in lista.enumerated() {
            for m in p.muestras {
                let d = Caras.distancia(a.huella, m)
                if d < dmin { dmin = d; mejor = i }
            }
        }
        let ahora = Date()
        if let i = mejor, dmin < Self.umbral {
            if dmin > Self.aprender { lista[i].muestras = Array((lista[i].muestras + [a.huella]).suffix(Self.muestrasMax)) }
            if a.calidad > lista[i].calidadFoto { guardarFoto(a.foto, de: lista[i].id); lista[i].calidadFoto = a.calidad }
            lista[i].visto = ahora
            guardar()
            return (lista[i], false)
        }
        let numero = (lista.map(\.numero).max() ?? 0) + 1
        let p = Persona(id: UUID().uuidString.lowercased().prefix(10).description, nombre: nil, numero: numero,
                        muestras: [a.huella], calidadFoto: a.calidad, creado: ahora, visto: ahora)
        lista.append(p)
        guardarFoto(a.foto, de: p.id)
        // Se olvidan los visitantes sin nombre más viejos
        let sinNombre = lista.filter { $0.nombre == nil }.sorted { $0.visto < $1.visto }
        if sinNombre.count > Self.sinNombreMax, let viejo = sinNombre.first { borrar(viejo.id, avisar: false) }
        guardar()
        return (p, true)
    }

    /// Presentar a alguien a propósito: varias tomas de su cara con un nombre.
    func registrar(_ nombre: String, tomas: [Caras.Analisis]) -> Persona? {
        guard let primera = tomas.first else { return nil }
        let (p, _) = identificar(primera)
        guard let i = lista.firstIndex(where: { $0.id == p.id }) else { return nil }
        lista[i].nombre = nombre.trimmingCharacters(in: .whitespaces)
        lista[i].muestras = Array((lista[i].muestras + tomas.dropFirst().map(\.huella)).suffix(Self.muestrasMax))
        if let mejor = tomas.max(by: { $0.calidad < $1.calidad }) { guardarFoto(mejor.foto, de: p.id); lista[i].calidadFoto = mejor.calidad }
        guardar()
        return lista[i]
    }

    // MARK: - Editar (desde «Quién vino»)

    func renombrar(_ id: String, _ nombre: String) {
        guard let i = lista.firstIndex(where: { $0.id == id }) else { return }
        let n = nombre.trimmingCharacters(in: .whitespaces)
        lista[i].nombre = n.isEmpty ? nil : n
        guardar()
    }

    /// Marca (o desmarca) al dueño: solo puede haber uno.
    func marcarDueno(_ id: String) {
        for i in lista.indices { lista[i].dueno = lista[i].id == id ? !lista[i].dueno : false }
        guardar()
    }

    func borrar(_ id: String, avisar: Bool = true) {
        lista.removeAll { $0.id == id }
        try? FileManager.default.removeItem(at: urlFoto(id))
        if avisar { guardar() }
    }

    func borrarTodas() {
        for p in lista { try? FileManager.default.removeItem(at: urlFoto(p.id)) }
        lista = []
        guardar()
    }

    /// Eran la misma persona: las huellas de `desde` pasan a `hacia`.
    func juntar(_ desde: String, en hacia: String) {
        guard desde != hacia, let a = persona(desde), let j = lista.firstIndex(where: { $0.id == hacia }) else { return }
        lista[j].muestras = Array((lista[j].muestras + a.muestras).suffix(Self.muestrasMax))
        lista[j].visto = max(lista[j].visto, a.visto)
        if a.calidadFoto > lista[j].calidadFoto, let f = try? Data(contentsOf: urlFoto(desde)) { guardarFoto(f, de: hacia); lista[j].calidadFoto = a.calidadFoto }
        borrar(desde, avisar: false)
        guardar()
    }

    // MARK: - Disco

    private func guardarFoto(_ datos: Data, de id: String) {
        guard !datos.isEmpty else { return }
        try? datos.write(to: urlFoto(id), options: .atomic)
    }

    private func guardar() {
        if let datos = try? JSONEncoder().encode(lista) { try? datos.write(to: archivo, options: .atomic) }
        alCambiar()
    }
}
