/* =====================================================================
   Uku · panel "Quién vino" (tecla P)
   Para Fran, cuando vuelve:
   - Visitas: quién se acercó mientras no estaba (foto, hora, cuánto se
     quedó). A quien no tiene nombre se le pone uno, o se junta con alguien
     que Uku ya conoce ("es Ana").
   - Mensajes: los recados que dejaron por voz ("dile que…").
   - Personas: las que Uku reconoce. Cambiar el nombre, marcar "Soy yo"
     (el dueño), borrar, o presentar a alguien a propósito frente a la cámara.
   - Estado: lo que Uku responde cuando preguntan por Fran (antes de irse).
   Al cerrar, las visitas y los mensajes quedan como vistos.
   ===================================================================== */
import * as caras from './caras.js?v=__BUILD__';
import * as visitas from './visitas.js?v=__BUILD__';
import * as atiende from './atiende.js?v=__BUILD__';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function cuando(ms) {
  const d = new Date(ms), hoy = new Date(), ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  const h = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  if (d.toDateString() === hoy.toDateString()) return 'hoy, ' + h;
  if (d.toDateString() === ayer.toDateString()) return 'ayer, ' + h;
  return d.getDate() + ' ' + MESES[d.getMonth()] + ', ' + h;
}
function duracion(ms) { const s = Math.round(ms / 1000); return s < 60 ? s + ' s' : Math.round(s / 60) + ' min'; }
function el(tag, attrs = {}, hijos = []) {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => { if (k === 'text') n.textContent = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v != null) n.setAttribute(k, v); });
  hijos.forEach(h => h && n.append(h));
  return n;
}
function foto(p) {
  return p && p.foto ? el('img', { class: 'mp-foto', src: p.foto, alt: '' }) : el('span', { class: 'mp-foto mp-foto--vacia', text: '?' });
}

export function crearPanel({ raiz, video, caja, alCambiar = () => {} }) {
  let pestana = 'visitas';
  const cuerpo = raiz.querySelector('.mp-cuerpo');
  const tabs = raiz.querySelectorAll('[data-tab]');
  tabs.forEach(t => t.addEventListener('click', () => { pestana = t.dataset.tab; pintar(); }));
  raiz.querySelector('[data-cerrar]').addEventListener('click', () => cerrar());

  function pintar() {
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === pestana)));
    const d = caras.dueno(), n = visitas.pendientes().filter(v => !d || v.personaId !== d.id).length;
    raiz.querySelector('[data-tab="visitas"] .mp-n').textContent = n ? n : '';
    const nm = atiende.mensajesNuevos().length;
    raiz.querySelector('[data-tab="mensajes"] .mp-n').textContent = nm ? nm : '';
    cuerpo.textContent = '';
    ({ visitas: pintarVisitas, mensajes: pintarMensajes, personas: pintarPersonas, estado: pintarEstado })[pestana]();
  }

  /* ---------- Visitas ---------- */
  function pintarVisitas() {
    const ps = caras.personas(), porId = Object.fromEntries(ps.map(p => [p.id, p]));
    // Las visitas de Fran (el dueño) no se muestran: son de él
    const l = visitas.lista().filter(v => porId[v.personaId] && !porId[v.personaId].dueno).reverse();
    if (!l.length) { cuerpo.append(el('p', { class: 'mp-vacio', text: 'Nadie se acercó todavía. Cuando alguien venga, Uku lo anota aquí.' })); return; }
    const conNombre = ps.filter(p => p.nombre);
    l.forEach(v => {
      const p = porId[v.personaId];
      const meta = cuando(v.desde) + ' · ' + duracion(v.hasta - v.desde) + (v.gestos ? ' · ' + v.gestos + (v.gestos === 1 ? ' gesto' : ' gestos') : '');
      const fila = el('article', { class: 'mp-visita' + (v.visto ? '' : ' is-nueva') }, [
        foto(p),
        el('div', { class: 'mp-visita__txt' }, [
          el('b', { text: caras.nombreDe(p) + (p.dueno ? ' (tú)' : '') }),
          el('small', { text: meta })
        ]),
        v.visto ? null : el('span', { class: 'mp-chip', text: 'Nueva' })
      ]);
      if (!p.nombre) fila.append(formNombre(p, conNombre));
      cuerpo.append(fila);
    });
    cuerpo.append(el('div', { class: 'mp-pie' }, [
      el('button', { type: 'button', class: 'mp-btn mp-btn--terciario', text: 'Borrar historial', onclick: () => { visitas.borrarTodas(); pintar(); alCambiar(); } })
    ]));
  }
  // Ponerle nombre a alguien sin nombre, o decir que es alguien que Uku ya conoce
  function formNombre(p, conNombre) {
    const input = el('input', { type: 'text', placeholder: '¿Quién es?', 'aria-label': 'Nombre de ' + caras.nombreDe(p), maxlength: '30' });
    const f = el('form', { class: 'mp-nombrar' }, [input, el('button', { type: 'submit', class: 'mp-btn mp-btn--secundario', text: 'Guardar' })]);
    f.addEventListener('submit', (e) => { e.preventDefault(); if (!input.value.trim()) return input.focus(); caras.renombrar(p.id, input.value); pintar(); alCambiar(); });
    if (conNombre.length) {
      const sel = el('select', { 'aria-label': 'Es alguien que Uku ya conoce' }, [el('option', { value: '', text: 'Es…' })].concat(conNombre.map(c => el('option', { value: c.id, text: c.nombre }))));
      sel.addEventListener('change', () => { if (!sel.value) return; caras.juntar(p.id, sel.value); visitas.moverPersona(p.id, sel.value); atiende.moverPersona(p.id, sel.value); pintar(); alCambiar(); });
      f.append(sel);
    }
    return f;
  }

  /* ---------- Mensajes ---------- */
  function pintarMensajes() {
    const porId = Object.fromEntries(caras.personas().map(p => [p.id, p]));
    const l = atiende.mensajes().slice().reverse();
    if (!l.length) { cuerpo.append(el('p', { class: 'mp-vacio', text: 'No hay mensajes. Si alguien dice «déjale un mensaje» o «dile que…», Uku lo anota aquí.' })); return; }
    l.forEach(m => {
      const p = porId[m.personaId];
      cuerpo.append(el('article', { class: 'mp-visita mp-mensaje' + (m.visto ? '' : ' is-nueva') }, [
        foto(p),
        el('div', { class: 'mp-visita__txt' }, [
          el('b', { text: '«' + m.texto + '»' }),
          el('small', { text: (p ? caras.nombreDe(p) : 'Alguien') + ' · ' + cuando(m.fecha) })
        ]),
        m.visto ? null : el('span', { class: 'mp-chip', text: 'Nuevo' }),
        el('button', { type: 'button', class: 'mp-btn mp-btn--mini mp-btn--peligro', text: 'Borrar', onclick: () => { atiende.borrarMensaje(m.id); pintar(); alCambiar(); } })
      ]));
    });
  }

  /* ---------- Estado: qué responde Uku cuando preguntan por Fran ---------- */
  function pintarEstado() {
    const e = atiende.estado(), d = caras.dueno(), dueno = d ? d.nombre : 'Fran';
    const prev = el('p', { class: 'mp-previa' });
    const texto = el('input', { type: 'text', placeholder: 'Ej.: Fran fue al médico, vuelve a las 4', value: e.texto || '', maxlength: '120', 'aria-label': 'Dónde está (texto propio)' });
    const vuelve = el('input', { type: 'text', placeholder: 'Ej.: en 10 minutos · a las 15:00 (opcional)', value: e.vuelve || '', maxlength: '40', 'aria-label': 'Cuándo vuelve' });
    const previa = () => {
      const s = atiende.estado(), E = atiende.ESTADOS[s.tipo];
      prev.textContent = 'Si preguntan, Uku dirá: «' + E.donde.replace(/\{dueno\}/g, dueno).replace('{texto}', s.texto || dueno + ' no está ahora.') + (s.vuelve ? ' Vuelve ' + s.vuelve + '.' : '') + '»';
      texto.parentElement.hidden = s.tipo !== 'propio';
    };
    const opciones = el('div', { class: 'mp-estados', role: 'radiogroup', 'aria-label': 'Dónde estás' }, Object.entries(atiende.ESTADOS).map(([k, E]) => {
      const b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(e.tipo === k), class: 'mp-estado', text: E.t });
      b.addEventListener('click', () => { atiende.setEstado({ tipo: k }); opciones.querySelectorAll('[role=radio]').forEach(x => x.setAttribute('aria-checked', String(x === b))); previa(); if (k === 'propio') texto.focus(); });
      return b;
    }));
    texto.addEventListener('input', () => { atiende.setEstado({ texto: texto.value.trim() }); previa(); });
    vuelve.addEventListener('input', () => { atiende.setEstado({ vuelve: vuelve.value.trim() }); previa(); });
    cuerpo.append(
      el('p', { class: 'mp-sub', text: `Antes de irte, dile a Uku dónde estás. Lo responde cuando alguien pregunta «¿dónde está ${dueno}?» o «¿cuándo vuelve?».` }),
      opciones,
      el('label', { class: 'mp-campo' }, [el('span', { text: 'Dónde estás' }), texto]),
      el('label', { class: 'mp-campo' }, [el('span', { text: 'Cuándo vuelves' }), vuelve]),
      prev
    );
    previa();
  }

  /* ---------- Personas ---------- */
  function pintarPersonas() {
    const vs = visitas.lista();
    const ps = caras.personas().sort((a, b) => (!!b.nombre - !!a.nombre) || (b.visto || 0) - (a.visto || 0));
    cuerpo.append(formPresentar());
    if (!ps.length) { cuerpo.append(el('p', { class: 'mp-vacio', text: 'Uku todavía no conoce a nadie.' })); return; }
    const grid = el('div', { class: 'mp-personas' });
    ps.forEach(p => {
      const n = vs.filter(v => v.personaId === p.id).length;
      const nombre = el('b', { text: caras.nombreDe(p) });
      const tarjeta = el('article', { class: 'mp-persona' + (p.dueno ? ' is-dueno' : '') }, [
        foto(p),
        nombre,
        el('small', { text: (p.dueno ? 'Dueño · ' : '') + (n === 1 ? '1 visita' : n + ' visitas') + (p.visto ? ' · ' + cuando(p.visto) : '') }),
        el('div', { class: 'mp-persona__acciones' }, [
          el('button', { type: 'button', class: 'mp-btn mp-btn--mini', text: p.nombre ? 'Renombrar' : 'Ponerle nombre', onclick: () => {
            const input = el('input', { type: 'text', value: p.nombre || '', maxlength: '30', 'aria-label': 'Nombre' });
            const f = el('form', { class: 'mp-nombrar' }, [input, el('button', { type: 'submit', class: 'mp-btn mp-btn--mini', text: 'Guardar' })]);
            f.addEventListener('submit', (e) => { e.preventDefault(); caras.renombrar(p.id, input.value); pintar(); alCambiar(); });
            nombre.replaceWith(f); input.focus(); input.select();
          } }),
          p.nombre ? el('button', { type: 'button', class: 'mp-btn mp-btn--mini', text: p.dueno ? 'No soy yo' : 'Soy yo', onclick: () => { caras.marcarDueno(p.id); pintar(); alCambiar(); } }) : null,
          el('button', { type: 'button', class: 'mp-btn mp-btn--mini mp-btn--peligro', text: 'Borrar', onclick: () => { caras.borrar(p.id); visitas.borrarDePersona(p.id); pintar(); alCambiar(); } })
        ])
      ]);
      grid.append(tarjeta);
    });
    cuerpo.append(grid);
  }
  // Presentar a alguien a propósito: mira a la cámara unos segundos
  function formPresentar() {
    const input = el('input', { type: 'text', placeholder: 'Nombre', 'aria-label': 'Nombre de quien está frente a la cámara', maxlength: '30', autocomplete: 'off' });
    const btn = el('button', { type: 'submit', class: 'mp-btn mp-btn--secundario', text: 'Presentar' });
    const msj = el('p', { class: 'mp-msj', role: 'status' });
    const f = el('form', { class: 'mp-presentar' }, [
      el('p', { class: 'mp-sub', text: 'Presenta a alguien que está frente a la cámara (solo, con buena luz). Si eres tú, después toca «Soy yo».' }),
      el('div', { class: 'mp-form' }, [input, btn]), msj
    ]);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = input.value.trim();
      if (!nombre) { msj.textContent = 'Escribe el nombre.'; return; }
      if (!video.srcObject) { msj.textContent = 'Primero enciende la cámara (Empezar).'; return; }
      btn.disabled = true; msj.textContent = 'Preparando… mira a la cámara.';
      try {
        await caras.registrar(nombre, video, (n, t) => { msj.textContent = `Mira a la cámara y mueve un poco la cabeza… ${n} de ${t}`; }, caja);
        msj.textContent = `¡Listo! Uku ya conoce a ${nombre}.`;
        input.value = ''; alCambiar();
        setTimeout(pintar, 1200);
      } catch (x) {
        msj.textContent = x.message === 'sin-cara' ? 'No vi bien la cara. Acércate a la cámara con buena luz.' : 'No pude cargar el reconocimiento. Revisa la conexión.';
      } finally { btn.disabled = false; }
    });
    return f;
  }

  function abrir(tab) { if (tab) pestana = tab; raiz.hidden = false; pintar(); }
  function cerrar() {
    if (raiz.hidden) return;
    raiz.hidden = true;
    visitas.marcarVistas(); // Fran ya las vio
    atiende.marcarMensajesVistos();
    alCambiar();
  }
  // Si algo cambia con el panel abierto (llega alguien nuevo), se repinta
  ['mimo:visitas', 'mimo:personas', 'mimo:mensajes'].forEach(ev => document.addEventListener(ev, () => { if (!raiz.hidden && !raiz.contains(document.activeElement)) pintar(); }));
  return { abrir, cerrar, get abierto() { return !raiz.hidden; }, alternar(tab) { raiz.hidden ? abrir(tab) : cerrar(); } };
}
