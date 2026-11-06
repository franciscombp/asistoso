import AVFoundation
import SwiftUI

/// Claves de UserDefaults (la key de Groq va en el Llavero, no aquí).
nonisolated enum Ajustes {
    static let cerebroPreferencia = "cerebro.preferencia"
    static let groqModelo = "groq.modelo"
    static let voz = "voz.identificador"
}

/// Ajustes › Cerebro y Voz (⌘,).
struct AjustesView: View {
    var body: some View {
        TabView {
            Tab("Cerebro", systemImage: "brain") { CerebroAjustes() }
            Tab("Voz", systemImage: "waveform") { VozAjustes() }
        }
        .frame(width: 520)
        .scenePadding()
    }
}

private struct CerebroAjustes: View {
    @AppStorage(Ajustes.cerebroPreferencia) private var preferencia = "auto"
    @AppStorage(Ajustes.groqModelo) private var modeloFijo = ""
    @State private var key = Llavero.leer(Llavero.groq) ?? ""
    @State private var modelos: [String] = []
    @State private var prueba = ""
    @State private var probando = false

    var body: some View {
        Form {
            Section {
                LabeledContent("Apple Intelligence", value: Cerebro.compartido.appleEstado)
                Picker("Quién contesta", selection: $preferencia) {
                    Text("Automático: Apple Intelligence y Groq para lo complejo").tag("auto")
                    Text("Solo Apple Intelligence (nada sale del Mac)").tag("apple")
                    Text("Solo Groq").tag("groq")
                }
            } footer: {
                Text("En automático, la charla la responde Apple Intelligence en el Mac. Las preguntas largas, de conocimiento, explicar, redactar o calcular, y la memoria y el diario de Uku, van a Groq. Si uno falla, prueba con el otro.")
                    .font(.footnote).foregroundStyle(.secondary)
            }

            Section("Groq") {
                SecureField("API key", text: $key, prompt: Text("gsk_…"))
                    .onSubmit(guardarKey)
                HStack {
                    Button("Guardar en el Llavero", action: guardarKey)
                    Link("Conseguir una key", destination: URL(string: "https://console.groq.com/keys")!)
                    Spacer()
                    Button("Probar") { Task { await probar() } }
                        .disabled(key.isEmpty || probando)
                }
                Picker("Modelo", selection: $modeloFijo) {
                    Text("Automático (el de más contexto)").tag("")
                    ForEach(modelos, id: \.self) { Text($0).tag($0) }
                    if !modeloFijo.isEmpty && !modelos.contains(modeloFijo) { Text(modeloFijo).tag(modeloFijo) }
                }
                .onChange(of: modeloFijo) { Task { await Groq.compartido.reiniciar() } }
                if !prueba.isEmpty {
                    Text(prueba).font(.footnote).foregroundStyle(.secondary).textSelection(.enabled)
                }
            }
        }
        .formStyle(.grouped)
        .task { await cargarModelos() }
    }

    private func guardarKey() {
        Llavero.guardar(key, en: Llavero.groq)
        Task {
            await Groq.compartido.reiniciar()
            await cargarModelos()
        }
    }

    private func cargarModelos() async {
        guard Groq.compartido.configurado else { modelos = []; return }
        modelos = (try? await Groq.compartido.modelos()) ?? []
    }

    private func probar() async {
        guardarKey()
        probando = true
        defer { probando = false }
        do {
            let r = try await Groq.compartido.responder([Mensaje(role: "user", content: "Di hola en cinco palabras.")], maxTokens: 30) { _ in }
            prueba = "✓ \(r.modelo): \(r.texto)"
        } catch {
            prueba = "✗ \(error.localizedDescription)"
        }
    }
}

private struct VozAjustes: View {
    @AppStorage(Ajustes.voz) private var vozElegida = ""
    @State private var voz = Voz()

    var body: some View {
        Form {
            Picker("Voz de Uku", selection: $vozElegida) {
                Text("Automática (la mejor en español)").tag("")
                ForEach(Voz.vocesEnEspanol(), id: \.identifier) { v in
                    Text("\(v.name) · \(v.language)\(v.quality == .premium ? " · premium" : v.quality == .enhanced ? " · mejorada" : "")").tag(v.identifier)
                }
            }
            Button("Escuchar") { voz.hablar("¡Hola! Soy Uku. Cuido la compu de Fran cuando no está.") }
            Text("Para voces más naturales: Ajustes del Sistema › Accesibilidad › Contenido leído › Voz del sistema › Gestionar voces, y baja una voz en español «mejorada» o «premium».")
                .font(.footnote).foregroundStyle(.secondary)
        }
        .formStyle(.grouped)
    }
}

#Preview {
    AjustesView()
}
