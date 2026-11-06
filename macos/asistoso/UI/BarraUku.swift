import SwiftUI

/// La barra de la ventana (vidrio, del sistema): modo, voz, oído, cámaras y «Quién vino».
struct BarraUku: ToolbarContent {
    let uku: Uku

    private var datos: DatosWeb { uku.datos }

    var body: some ToolbarContent {
        ToolbarItem(placement: .navigation) {
            Picker("Modo", selection: Binding(get: { datos.modo == "demo" }, set: { uku.setModo($0) })) {
                Label("Guardián", systemImage: "shield").tag(false)
                Label("Demo", systemImage: "party.popper").tag(true)
            }
            .pickerStyle(.segmented)
            .help("Guardián: con Fran enfrente, Uku solo saluda y sigue en lo suyo. Demo: juega y conversa con todos (N)")
        }

        ToolbarSpacer(.flexible)

        ToolbarItemGroup {
            Button(datos.voz ? "Voz encendida" : "Voz apagada", systemImage: datos.voz ? "speaker.wave.2.fill" : "speaker.slash") { uku.alternarVoz() }
                .help("Uku habla en voz alta (M)")
            Button(datos.mic ? "Micrófono encendido" : "Micrófono apagado", systemImage: datos.mic ? "mic.fill" : "mic.slash") { uku.alternarMic() }
                .help("Uku escucha y conversa (V)")
            Button(datos.despierto ? "Pantalla despierta" : "Pantalla puede dormir", systemImage: datos.despierto ? "sun.max.fill" : "moon.zzz") { uku.alternarDespierto() }
                .help("Que el Mac no apague la pantalla mientras Uku cuida (S)")
        }

        ToolbarSpacer(.fixed)

        ToolbarItemGroup {
            Menu("Cámara", systemImage: camaraSimbolo) {
                Toggle("Control en tercera persona", systemImage: "gamecontroller", isOn: Binding(get: { datos.camara.control }, set: { _ in uku.boton("btn-control") }))
                Toggle("Vista de pájaro", systemImage: "map", isOn: Binding(get: { datos.camara.pajaro }, set: { _ in uku.boton("btn-pajaro") }))
                Toggle("Espejo", systemImage: "person.and.background.dotted", isOn: Binding(get: { datos.camara.espejo }, set: { _ in uku.boton("btn-espejo") }))
                Toggle("Decorar el claro", systemImage: "camera.macro", isOn: Binding(get: { datos.camara.decorar }, set: { _ in uku.boton("btn-decorar") }))
                Divider()
                Button("Volver a Uku", systemImage: "location") { uku.boton("btn-ubicar") }
                Divider()
                Toggle("Mostrar gestos y cámara", systemImage: "hand.wave", isOn: Binding(get: { datos.hud }, set: { _ in uku.alternarHud() }))
                Button("Depurar la cámara", systemImage: "ladybug") { uku.tecla("d") }
            }
            .help("Cámaras del mundo de Uku")
            Menu("Jugar", systemImage: "gamecontroller.fill") {
                Button("Piedra, papel o tijera", systemImage: "hand.raised") { uku.tecla("g") }
                Button("Guíame", systemImage: "point.topleft.down.to.point.bottomright.curvepath") { uku.tecla("7") }
                Button("Travesura al azar", systemImage: "sparkles") { uku.tecla("z") }
            }
        }

        ToolbarSpacer(.fixed)

        ToolbarItemGroup {
            Button {
                uku.pestana = .visitas
                uku.panelAbierto.toggle()
            } label: {
                Label("Quién vino", systemImage: datos.pendientes > 0 ? "person.2.badge.plus.fill" : "person.2")
            }
            .badge(datos.pendientes)
            .help("Quién vino, mensajes, personas, dónde estás y el diario de Uku (P)")
            Button("Ayuda", systemImage: "questionmark.circle") { uku.ayudaAbierta = true }
        }
    }

    private var camaraSimbolo: String {
        if datos.camara.control { return "gamecontroller" }
        if datos.camara.pajaro { return "map" }
        if datos.camara.espejo { return "person.and.background.dotted" }
        if datos.camara.decorar { return "camera.macro" }
        return "video"
    }
}
