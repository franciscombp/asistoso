import SwiftUI

@main struct MyApp: App {
    @State private var uku = Uku(puente: Puente())

    var body: some Scene {
        Window("Uku", id: "uku") {
            ContentView(uku: uku)
        }
        .windowToolbarStyle(.unified)
        .defaultSize(width: 1280, height: 800)
        .commands { ComandosUku(uku: uku) }

        Settings {
            AjustesView()
        }
    }
}

/// Los atajos de Uku también en la barra de menús.
struct ComandosUku: Commands {
    let uku: Uku

    var body: some Commands {
        CommandMenu("Uku") {
            Button("Quién vino") { uku.panelAbierto.toggle() }
                .keyboardShortcut("i", modifiers: .command)
            Button("Cómo se juega") { uku.ayudaAbierta = true }
            Divider()
            Button("Modo guardián / demo") { uku.tecla("n") }
            Button("Voz encendida / apagada") { uku.alternarVoz() }
            Button("Micrófono encendido / apagado") { uku.alternarMic() }
            Button("Pantalla despierta") { uku.alternarDespierto() }
            Button("Mostrar gestos y cámara") { uku.alternarHud() }
            Divider()
            Button("Jugar piedra, papel o tijera") { uku.tecla("g") }
            Button("Guíame") { uku.tecla("7") }
            Button("Travesura al azar") { uku.tecla("z") }
            Divider()
            Button("Depurar la cámara") { uku.tecla("d") }
        }
    }
}
