import SwiftUI

/// La ventana de Uku: el mundo 3D a pantalla completa, con la barra, el inicio y «Quién vino» nativos encima.
struct ContentView: View {
    @Bindable var uku: Uku
    @State private var url: URL?
    @State private var servidor: ServidorLocal? // se guarda para que el servidor siga vivo
    @State private var error: String?

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Group {
                if let url {
                    MundoView(url: url, puente: uku.puente)
                } else if let error {
                    ContentUnavailableView("No pude despertar a Uku", systemImage: "exclamationmark.triangle", description: Text(error))
                } else {
                    ProgressView("Despertando a Uku…")
                }
            }
            .ignoresSafeArea()

            if uku.datos.empezado {
                EstadoView(datos: uku.datos)
                    .padding(20)
            }
            if uku.webLista && uku.datos.inicio {
                InicioView(uku: uku)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .transition(.opacity.combined(with: .scale(scale: 0.97)))
            }
        }
        .animation(.smooth, value: uku.datos.inicio)
        .frame(minWidth: 900, minHeight: 600)
        .toolbar { BarraUku(uku: uku) }
        .toolbarBackgroundVisibility(.hidden, for: .windowToolbar)
        .inspector(isPresented: $uku.panelAbierto) {
            QuienVinoView(uku: uku)
                .inspectorColumnWidth(min: 340, ideal: 400, max: 560)
        }
        .sheet(isPresented: $uku.ayudaAbierta) { AyudaView() }
        .task { await arrancar() }
    }

    private func arrancar() async {
        guard url == nil else { return }
        guard let raiz = Bundle.main.url(forResource: "Web", withExtension: "bundle") else {
            error = "Falta Web.bundle en la app"
            return
        }
        do {
            let servidor = ServidorLocal(raiz: raiz)
            self.servidor = servidor
            url = try await servidor.arrancar()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// Abajo a la izquierda: qué está haciendo Uku y si está escuchando (en vidrio).
private struct EstadoView: View {
    let datos: DatosWeb

    var body: some View {
        GlassEffectContainer(spacing: 8) {
            HStack(spacing: 8) {
                if !datos.estado.texto.isEmpty {
                    Label(datos.estado.texto, systemImage: datos.estado.tipo == "error" ? "exclamationmark.triangle.fill" : "eye")
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .glassEffect(datos.estado.tipo == "error" ? .regular.tint(.red.opacity(0.35)) : .regular)
                }
                if datos.oido.visible {
                    Label(datos.oido.texto.replacingOccurrences(of: "🎙️", with: "").trimmingCharacters(in: .whitespaces), systemImage: "waveform")
                        .symbolEffect(.variableColor.iterative, isActive: datos.mic)
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .glassEffect()
                }
            }
            .font(.callout.weight(.medium))
        }
        .animation(.smooth, value: datos.estado.texto)
    }
}

#Preview {
    ContentView(uku: Uku(puente: Puente()))
}
