import SwiftUI

/// Cómo se juega con Uku: gestos, voz y atajos.
struct AyudaView: View {
    @Environment(\.dismiss) private var cerrar

    private let gestos: [(String, String)] = [
        ("👋", "Saluda moviendo la mano abierta"), ("👍", "Me gusta · 👍👍 fuegos artificiales"), ("👎👎", "Lluvia"),
        ("✌️", "Globos · ✌️✌️ confeti"), ("🤟", "Fiesta"), ("👌", "OK"), ("🫶", "Corazón con las dos manos"),
        ("☝️", "Un consejo de oso"), ("✊", "Crece un jardín"), ("🙌", "Los dos brazos arriba: sale el sol"),
        ("🙏", "Manos juntas: un día más sin accidentes"), ("❌", "Brazos cruzados: hubo un accidente"),
        ("✋", "Levanta una mano, como en clase"), ("😝", "Lengua, beso, guiño, bostezo, sorpresa, sonrisa"),
        ("🙂‍↕️", "Sí o no con la cabeza")
    ]
    private let voz: [String] = [
        "«Uku, ¿dónde está Fran?» · «¿cuándo vuelve?»",
        "«Dile que lo busqué» · «déjale un mensaje»",
        "«Uku, recuérdame en 10 minutos tomar agua»",
        "«Uku, pon un post-it que diga comprar pan»",
        "«Jugamos» (piedra, papel o tijera) · «guíame al lago»",
        "«Un día más» · «hubo un accidente» · «pon el cartel en 15»",
        "Y de lo que sea: Apple Intelligence conversa; lo complejo lo piensa Groq."
    ]
    private let teclas: [(String, String)] = [
        ("P", "Quién vino"), ("N", "Guardián / demo"), ("M", "Voz"), ("V", "Micrófono"), ("S", "Pantalla despierta"),
        ("X", "Gestos y cámara en pantalla"), ("K · O · E · 8", "Control · vista · espejo · decorar"),
        ("← ↑ → ↓", "Manejar a Uku"), ("1–6", "Día, atardecer, noche, lluvia, fiesta, jardín"),
        ("G · 7 · Z", "Jugar · guíame · travesura"), ("D", "Depurar la cámara")
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("Con las manos y la cara") {
                    ForEach(gestos, id: \.1) { g in
                        LabeledContent { Text(g.1) } label: { Text(g.0).font(.title3) }
                    }
                }
                Section("Con la voz") {
                    ForEach(voz, id: \.self) { Text($0) }
                }
                Section("Teclado (con la ventana de Uku activa)") {
                    ForEach(teclas, id: \.0) { t in
                        LabeledContent(t.1) { Text(t.0).font(.body.monospaced()).foregroundStyle(.secondary) }
                    }
                }
                Section("Guardián y demo") {
                    Text("En guardián, cuando quien está enfrente eres tú, Uku solo te saluda, te cuenta quién vino y sigue en lo suyo. En demo juega y conversa con todos.")
                }
            }
            .formStyle(.grouped)
            .navigationTitle("Cómo se juega")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Listo") { cerrar() } }
            }
        }
        .frame(width: 560, height: 640)
    }
}

#Preview {
    AyudaView()
}
