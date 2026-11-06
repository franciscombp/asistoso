import SwiftUI

/// El inicio: qué hace Uku y con qué empieza (las opciones son las de la web, que las recuerda).
struct InicioView: View {
    let uku: Uku

    private var o: DatosWeb.Opciones { uku.datos.opciones }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Uku cuida tu compu")
                    .font(.largeTitle.weight(.bold))
                Text("Mientras no estás, Uku atiende a quien se acerque: lo saluda, juega con sus gestos y reconoce su cara. Cuando vuelvas, te cuenta quién vino.")
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            VStack(alignment: .leading, spacing: 10) {
                opcion("voz", "Uku habla en voz alta", "speaker.wave.2", o.voz)
                opcion("mic", "Uku escucha y conversa por ti", "mic", o.mic)
                opcion("llamada", "Solo responde cuando le dicen «Uku» (para oficinas con ruido)", "person.wave.2", o.llamada)
                opcion("demo", "Modo demo: también juega y conversa contigo", "party.popper", o.demo)
                opcion("despierto", "Mantener la pantalla despierta", "sun.max", o.despierto)
                opcion("hud", "Mostrar los gestos y la cámara en pantalla", "hand.wave", o.hud)
            }
            .toggleStyle(.switch)

            if !uku.datos.nube.isEmpty {
                Label(uku.datos.nube.replacingOccurrences(of: "☁️", with: "").trimmingCharacters(in: .whitespaces), systemImage: "brain")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }

            HStack {
                Button("Probar sin cámara") { uku.empezar(conCamara: false) }
                    .buttonStyle(.glass)
                Spacer()
                Button("Empezar") { uku.empezar(conCamara: true) }
                    .buttonStyle(.glassProminent)
                    .keyboardShortcut(.defaultAction)
            }
            .controlSize(.large)

            Text("La cámara solo se usa en este Mac: no se graba video ni se envía nada. De cada persona que se acerca, Uku guarda aquí una foto pequeña y una huella numérica de su cara para reconocerla. Se borran desde «Quién vino».")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(28)
        .frame(width: 520)
        .glassEffect(.regular, in: .rect(cornerRadius: 28))
    }

    private func opcion(_ id: String, _ titulo: String, _ simbolo: String, _ valor: Bool) -> some View {
        Toggle(isOn: Binding(get: { valor }, set: { uku.opcion(id, $0) })) {
            Label(titulo, systemImage: simbolo)
        }
    }
}
