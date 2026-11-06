import SwiftUI

/// «Quién vino»: las visitas, los mensajes, las personas que Uku reconoce, dónde está Fran y el diario de Uku.
struct QuienVinoView: View {
    @Bindable var uku: Uku

    var body: some View {
        VStack(spacing: 0) {
            Picker("Sección", selection: $uku.pestana) {
                ForEach(Uku.Pestana.allCases) { p in
                    Label(p.titulo, systemImage: p.simbolo).tag(p)
                }
            }
            .pickerStyle(.segmented)
            .labelStyle(.iconOnly)
            .padding()

            Group {
                switch uku.pestana {
                case .visitas: VisitasLista(uku: uku)
                case .mensajes: MensajesLista(uku: uku)
                case .personas: PersonasLista(uku: uku)
                case .estado: EstadoFranView(uku: uku)
                case .diario: DiarioView(uku: uku)
                }
            }
            .frame(maxHeight: .infinity)
        }
        .navigationTitle(uku.pestana.titulo)
    }
}

/// La foto chica de una persona (o un círculo con su inicial).
struct FotoPersona: View {
    let uku: Uku
    let id: String
    var lado: CGFloat = 44

    var body: some View {
        Group {
            if let img = uku.personas.foto(id) {
                Image(nsImage: img).resizable().scaledToFill()
            } else {
                Image(systemName: "person.fill").foregroundStyle(.secondary).frame(maxWidth: .infinity, maxHeight: .infinity).background(.quaternary)
            }
        }
        .frame(width: lado, height: lado)
        .clipShape(.circle)
        .accessibilityHidden(true)
    }
}

// MARK: - Visitas

private struct VisitasLista: View {
    let uku: Uku

    private var visitas: [DatosWeb.Visita] {
        let dueno = uku.personas.dueno?.id
        return uku.datos.visitas.filter { $0.personaId != dueno && uku.personas.persona($0.personaId) != nil }.reversed()
    }

    var body: some View {
        List {
            if visitas.isEmpty {
                ContentUnavailableView("Nadie todavía", systemImage: "person.2.slash", description: Text("Cuando alguien se acerque, Uku lo anota aquí con su foto."))
            }
            ForEach(visitas) { v in
                VisitaFila(uku: uku, visita: v)
            }
        }
        .safeAreaInset(edge: .bottom) {
            if !visitas.isEmpty {
                Button("Borrar historial", role: .destructive) { uku.borrarVisitas() }
                    .buttonStyle(.glass).padding()
            }
        }
    }
}

private struct VisitaFila: View {
    let uku: Uku
    let visita: DatosWeb.Visita
    @State private var nombre = ""

    var body: some View {
        let p = uku.personas.persona(visita.personaId)
        HStack(alignment: .top, spacing: 12) {
            FotoPersona(uku: uku, id: visita.personaId)
            VStack(alignment: .leading, spacing: 4) {
                Text(p?.nombreVisible ?? "Alguien").font(.headline)
                Text(detalle).font(.caption).foregroundStyle(.secondary)
                if let p, p.nombre == nil {
                    HStack {
                        TextField("¿Quién es?", text: $nombre)
                            .textFieldStyle(.roundedBorder)
                            .onSubmit { uku.renombrar(p.id, nombre) }
                        let conocidas = uku.personas.lista.filter { $0.nombre != nil && $0.id != p.id }
                        if !conocidas.isEmpty {
                            Menu("Es…") {
                                ForEach(conocidas) { c in
                                    Button(c.nombreVisible) { uku.juntar(p.id, en: c.id) }
                                }
                            }
                            .fixedSize()
                        }
                    }
                }
            }
            Spacer(minLength: 0)
            if visita.visto != true { Circle().fill(.tint).frame(width: 8, height: 8).accessibilityLabel("Nueva") }
        }
        .padding(.vertical, 4)
    }

    private var detalle: String {
        var partes = [visita.inicio.formatted(.relative(presentation: .named))]
        if visita.duracion >= 5 {
            partes.append("se quedó " + Duration.seconds(visita.duracion).formatted(.units(allowed: [.hours, .minutes, .seconds], width: .wide, maximumUnitCount: 1)))
        }
        if let g = visita.gestos, g > 0 { partes.append("\(g) \(g == 1 ? "gesto" : "gestos")") }
        return partes.joined(separator: " · ")
    }
}

// MARK: - Mensajes, recordatorios y post-its

private struct MensajesLista: View {
    let uku: Uku

    var body: some View {
        let d = uku.datos
        List {
            Section("Mensajes para \(d.dueno)") {
                if d.mensajes.isEmpty {
                    Text("Sin mensajes. Si alguien dice «dile que…» o «déjale un mensaje», Uku lo guarda aquí.").foregroundStyle(.secondary)
                }
                ForEach(d.mensajes.reversed()) { m in
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("«\(m.texto)»")
                            Text("\(uku.nombre(de: m.personaId)) · \(m.cuando.formatted(.relative(presentation: .named)))")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button("Borrar", systemImage: "trash", role: .destructive) { uku.borrarMensaje(m.id) }
                            .labelStyle(.iconOnly).buttonStyle(.borderless)
                    }
                }
            }
            Section("Recordatorios") {
                if d.tareas.recordatorios.isEmpty { Text("«Uku, recuérdame en 10 minutos tomar agua»").foregroundStyle(.secondary) }
                ForEach(d.tareas.recordatorios) { r in
                    HStack {
                        Label(r.texto, systemImage: "alarm")
                        Spacer()
                        Text(r.cuando, style: .time).foregroundStyle(.secondary)
                        Button("Quitar", systemImage: "xmark.circle.fill") { uku.quitarRecordatorio(r.id) }
                            .labelStyle(.iconOnly).buttonStyle(.borderless)
                    }
                }
            }
            Section("Post-its") {
                if d.tareas.postits.isEmpty { Text("«Uku, pon un post-it que diga comprar pan»").foregroundStyle(.secondary) }
                ForEach(d.tareas.postits) { n in
                    HStack {
                        Label(n.texto, systemImage: "note.text")
                        Spacer()
                        Button("Quitar", systemImage: "xmark.circle.fill") { uku.quitarPostit(n.id) }
                            .labelStyle(.iconOnly).buttonStyle(.borderless)
                    }
                }
            }
        }
    }
}

// MARK: - Personas

private struct PersonasLista: View {
    let uku: Uku
    @State private var nuevo = ""
    @State private var aviso = ""
    @State private var presentando = false
    @State private var aBorrar: Persona?

    private var personas: [Persona] {
        uku.personas.lista.sorted { a, b in
            (a.nombre != nil) != (b.nombre != nil) ? a.nombre != nil : a.visto > b.visto
        }
    }

    var body: some View {
        List {
            Section {
                HStack {
                    TextField("Nombre", text: $nuevo).textFieldStyle(.roundedBorder).onSubmit { Task { await presentar() } }
                    Button("Presentar") { Task { await presentar() } }
                        .buttonStyle(.glassProminent)
                        .disabled(nuevo.trimmingCharacters(in: .whitespaces).isEmpty || presentando)
                }
                if let (n, t) = uku.progresoRegistro {
                    ProgressView(value: Double(n), total: Double(t)) { Text("Mira a la cámara y mueve un poco la cabeza…") }
                } else if !aviso.isEmpty {
                    Text(aviso).font(.callout).foregroundStyle(.secondary)
                }
            } header: {
                Text("Presentar a alguien")
            } footer: {
                Text("Con la persona frente a la cámara: Uku toma cinco fotos de su cara. Marca «Soy yo» en tu tarjeta para que Uku sepa cuándo volviste.")
            }

            Section("Personas que Uku reconoce") {
                if personas.isEmpty { Text("Nadie todavía.").foregroundStyle(.secondary) }
                ForEach(personas) { p in
                    PersonaFila(uku: uku, persona: p) { aBorrar = p }
                }
            }
        }
        .confirmationDialog("¿Borrar a \(aBorrar?.nombreVisible ?? "")?", isPresented: Binding(get: { aBorrar != nil }, set: { if !$0 { aBorrar = nil } }), presenting: aBorrar) { p in
            Button("Borrar", role: .destructive) { uku.borrarPersona(p.id) }
        } message: { _ in
            Text("Uku olvida su cara y sus visitas.")
        }
    }

    private func presentar() async {
        let nombre = nuevo.trimmingCharacters(in: .whitespaces)
        guard !nombre.isEmpty else { return }
        presentando = true
        defer { presentando = false }
        aviso = ""
        if await uku.presentar(nombre) {
            aviso = "Listo: Uku ya reconoce a \(nombre)."
            nuevo = ""
        } else {
            aviso = "No vi bien la cara. Acércate a la cámara, con luz de frente, y prueba otra vez."
        }
    }
}

private struct PersonaFila: View {
    let uku: Uku
    let persona: Persona
    let borrar: () -> Void
    @State private var nombre = ""

    var body: some View {
        HStack(spacing: 12) {
            FotoPersona(uku: uku, id: persona.id, lado: 52)
            VStack(alignment: .leading, spacing: 4) {
                TextField(persona.nombre == nil ? "Visitante \(persona.numero)" : "Nombre", text: $nombre)
                    .textFieldStyle(.plain).font(.headline)
                    .onSubmit { uku.renombrar(persona.id, nombre) }
                Text(detalle).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            if persona.nombre != nil {
                Toggle("Soy yo", isOn: Binding(get: { persona.dueno }, set: { _ in uku.marcarDueno(persona.id) }))
                    .toggleStyle(.button)
            }
            Button("Borrar", systemImage: "trash", role: .destructive, action: borrar)
                .labelStyle(.iconOnly).buttonStyle(.borderless)
        }
        .onAppear { nombre = persona.nombre ?? "" }
        .onChange(of: persona.nombre) { nombre = persona.nombre ?? "" }
    }

    private var detalle: String {
        let visitas = uku.datos.visitas.filter { $0.personaId == persona.id }.count
        return "visto \(persona.visto.formatted(.relative(presentation: .named))) · \(visitas) \(visitas == 1 ? "visita" : "visitas")"
    }
}

// MARK: - Dónde está Fran

private struct EstadoFranView: View {
    let uku: Uku
    @State private var texto = ""
    @State private var vuelve = ""

    var body: some View {
        let f = uku.datos.fran
        Form {
            Section {
                Picker("Dónde estás", selection: Binding(get: { f.tipo }, set: { uku.setEstado(tipo: $0) })) {
                    ForEach(f.opciones) { Text($0.t).tag($0.k) }
                }
                .pickerStyle(.radioGroup)
                if f.tipo == "propio" {
                    TextField("Dónde estás", text: $texto, prompt: Text("Fran fue al médico, vuelve a las 4"))
                        .onChange(of: texto) { uku.setEstado(texto: texto) }
                }
                TextField("Cuándo vuelves", text: $vuelve, prompt: Text("en 10 minutos · a las 15:00 (opcional)"))
                    .onChange(of: vuelve) { uku.setEstado(vuelve: vuelve) }
            } footer: {
                Text("Antes de irte, dile a Uku dónde estás. Lo responde cuando alguien pregunta «¿dónde está \(uku.datos.dueno)?» o «¿cuándo vuelve?».")
            }
            Section("Si preguntan, Uku dirá") {
                Text("«\(f.previa)»").italic()
            }
        }
        .formStyle(.grouped)
        .onAppear { texto = f.texto; vuelve = f.vuelve }
    }
}

// MARK: - Diario y memoria

private struct DiarioView: View {
    let uku: Uku
    @State private var confirmar = false

    var body: some View {
        let m = uku.datos.memoria, dueno = uku.datos.dueno
        List {
            Section {
                Text("Han conversado \(m.relacion.dias) \(m.relacion.dias == 1 ? "día" : "días") (\(m.relacion.conversaciones) \(m.relacion.conversaciones == 1 ? "conversación" : "conversaciones")). Uku recuerda \(m.relacion.hechos) \(m.relacion.hechos == 1 ? "cosa" : "cosas") de \(dueno); con cada una, su claro crece.")
                    .foregroundStyle(.secondary)
            }
            Section("Diario de Uku") {
                if m.diario.isEmpty { Text("Cuando conversen y \(dueno) se vaya, Uku escribe aquí qué pasó y qué notó.").foregroundStyle(.secondary) }
                ForEach(m.diario) { e in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(e.texto)
                        Text([e.fecha, e.hora].compactMap { $0 }.joined(separator: ", ")).font(.caption).foregroundStyle(.secondary)
                    }
                    .contextMenu { Button("Borrar", role: .destructive) { uku.borrarDiario(e.id) } }
                }
            }
            Section("Lo que Uku sabe de \(dueno)") {
                if m.hechos.isEmpty { Text("Cuéntale cosas: a qué te dedicas, qué tienes esta semana, qué te gusta.").foregroundStyle(.secondary) }
                ForEach(m.hechos) { h in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(h.texto)
                            if h.seguimiento == true { Text("te preguntará cómo va").font(.caption).foregroundStyle(.tint) }
                        }
                        Spacer()
                        Button("Olvidar") { uku.olvidar(h.id) }.buttonStyle(.borderless)
                    }
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            Button("Que Uku olvide todo", role: .destructive) { confirmar = true }
                .buttonStyle(.glass).padding()
        }
        .confirmationDialog("¿Borrar el diario y todo lo que Uku recuerda?", isPresented: $confirmar) {
            Button("Olvidar todo", role: .destructive) { uku.olvidarTodo() }
        }
    }
}
