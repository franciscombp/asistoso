/* =====================================================================
   Uku · memoria (lo que Uku sabe de Fran y de cada persona)
   Como en Tolan, la memoria es la pieza central, no un historial:
   - HECHOS: cosas que Uku aprendió conversando («Fran tiene una hermana,
     Ana», «Está preparando una presentación para el jueves», «No le gusta
     el café»). Cada hecho tiene de quién es, cuándo se aprendió, cuántas
     veces salió y si es algo para preguntar después (seguimiento).
   - DIARIO: al terminar cada conversación con Fran, Uku escribe dos o tres
     frases desde su punto de vista (qué pasó, qué notó). Fran lo lee en
     P › Diario.
   - RELACIÓN: cuántos días han conversado, cuántas conversaciones, cuántos
     hechos sabe. De eso crece su claro (mundo()): más flores, guayacanes,
     mariposas, el lago más grande, la tortuga… como el planeta de Tolan.
   - Aprende con el modelo de lenguaje (si está) o con reglas sencillas
     («me llamo», «mi hermana», «mañana tengo», «me encanta», «odio»).
   - recordar(texto): los hechos que vienen al caso para esta frase (por
     palabras en común), más los de perfil, para el prompt del modelo.
   Todo en este navegador (localStorage mimo_memoria). Nada sale, salvo lo
   que viaja al modelo cuando Fran conversa.
   ===================================================================== */
import * as mente from './mente.js?v=__BUILD__';

const K = 'mimo_memoria', MAX_HECHOS = 120, MAX_DIARIO = 60;
const vacio = () => ({ hechos: [], diario: [], dias: [], conversaciones: 0, perfil: {} });
function leer() { try { return Object.assign(vacio(), JSON.parse(localStorage.getItem(K) || '{}')); } catch (e) { return vacio(); } }
function guardar(d) { try { localStorage.setItem(K, JSON.stringify(d)); } catch (e) {} document.dispatchEvent(new CustomEvent('mimo:memoria')); }
const hoy = () => new Date().toISOString().slice(0, 10);
const norm = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const VACIAS = new Set('el la los las un una unos unas de del al a en con por para y o que se su sus mi mis tu tus le lo es son esta estan hay fue ser hoy ayer manana muy mas pero como cuando donde yo tu el ella nos me te si no ya un uno dos tres tiene tengo tienes hacer hago vas voy ir era'.split(' '));
const palabras = (t) => norm(t).split(' ').filter(w => w.length > 2 && !VACIAS.has(w));

/* ---------- Hechos ---------- */
export function hechos(de = 'dueno') { return leer().hechos.filter(h => h.de === de); }
export function todos() { return leer().hechos; }
export function cuantos() { return leer().hechos.length; }
// anotar(texto, { de, seguimiento, fuente }): guarda un hecho si no es casi igual a otro (si lo es, lo refuerza)
export function anotar(texto, { de = 'dueno', seguimiento = false, fuente = 'reglas' } = {}) {
  texto = (texto || '').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
  if (texto.length < 6 || texto.length > 160) return null;
  const d = leer(), ps = new Set(palabras(texto));
  const igual = d.hechos.find(h => h.de === de && (norm(h.texto) === norm(texto) || parecido(ps, new Set(palabras(h.texto))) > .7));
  if (igual) { igual.veces = (igual.veces || 1) + 1; igual.ultima = hoy(); if (seguimiento) igual.seguimiento = true; guardar(d); return igual; }
  const h = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), texto, de, fecha: hoy(), ultima: hoy(), veces: 1, seguimiento, fuente };
  d.hechos.push(h);
  if (d.hechos.length > MAX_HECHOS) d.hechos = d.hechos.sort((a, b) => (b.veces - a.veces) || (b.ultima > a.ultima ? 1 : -1)).slice(0, MAX_HECHOS);
  guardar(d);
  document.dispatchEvent(new CustomEvent('mimo:aprendio', { detail: h }));
  return h;
}
export function olvidar(id) { const d = leer(); d.hechos = d.hechos.filter(h => h.id !== id); guardar(d); }
export function olvidarTodo() { const d = leer(); d.hechos = []; d.diario = []; d.dias = []; d.conversaciones = 0; d.perfil = {}; guardar(d); }
export function cerrarSeguimiento(id) { const d = leer(); const h = d.hechos.find(x => x.id === id); if (h) { h.seguimiento = false; guardar(d); } }
function parecido(a, b) { if (!a.size || !b.size) return 0; let n = 0; a.forEach(w => { if (b.has(w)) n++; }); return n / Math.min(a.size, b.size); }

/* recordar(texto, { de, n }): los hechos que vienen al caso (por palabras en común con lo que se dijo y lo
   último que se habló), más los más repetidos (perfil) y los pendientes de preguntar. Para el prompt. */
export function recordar(texto, { de = 'dueno', n = 10, contexto = '' } = {}) {
  const l = hechos(de);
  if (!l.length) return [];
  const q = new Set(palabras(texto + ' ' + contexto));
  const punt = (h) => { const p = new Set(palabras(h.texto)); let s = 0; p.forEach(w => { if (q.has(w)) s += 2; }); s += Math.min(3, (h.veces || 1) - 1) * .5; if (h.seguimiento) s += 1; if (h.ultima === hoy()) s += .5; return s; };
  return l.map(h => ({ h, s: punt(h) })).sort((a, b) => b.s - a.s).slice(0, n).map(x => x.h);
}
// Lo pendiente de preguntar («¿cómo te fue con…?»): hechos marcados como seguimiento, los más viejos primero
export function pendientes(de = 'dueno') { return hechos(de).filter(h => h.seguimiento).sort((a, b) => a.fecha < b.fecha ? -1 : 1); }

/* ---------- Aprender de una conversación ---------- */
// Reglas sencillas, sin red: frases en primera persona que dicen algo de quien habla
const REGLAS = [
  [/\bme llamo (\w+)/i, (m) => `Se llama ${cap(m[1])}`],
  [/\bmi (hermana|hermano|mama|mamá|papa|papá|esposa|esposo|novia|novio|hija|hijo|jefe|jefa|perro|perra|gato|gata|amiga|amigo|abuela|abuelo|prima|primo|tía|tia|tío|tio) (?:se llama |es |)(\w+)/i, (m) => `Su ${m[1].toLowerCase()} se llama ${cap(m[2])}`],
  [/\b(?:me encanta|me gusta mucho|amo|adoro) (?:el |la |los |las |)([^,.!?]{3,40})/i, (m) => `Le encanta ${m[1].trim()}`],
  [/\b(?:odio|detesto|no soporto|no me gusta) (?:el |la |los |las |)([^,.!?]{3,40})/i, (m) => `No le gusta ${m[1].trim()}`],
  [/\b(?:mañana|manana|el (?:lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)|esta semana|la proxima semana|la próxima semana|esta tarde|esta noche) (?:tengo|voy a|me toca|es) ([^,.!?]{4,60})/i, (m) => ({ texto: `Tiene pendiente: ${tercera(m[0].trim())}`, seguimiento: true })],
  [/\b(?:estoy|ando) (?:preparando|trabajando en|terminando|armando|escribiendo|estudiando) ([^,.!?]{4,60})/i, (m) => ({ texto: `Está ${tercera(m[0].replace(/^(estoy|ando)\s+/i, ''))}`, seguimiento: true })],
  [/\b(?:estoy|me siento) (?:muy |un poco |bien |re |súper |super |)(cansad[oa]|estresad[oa]|nervios[oa]|triste|preocupad[oa]|feliz|content[oa]|emocionad[oa]|agotad[oa]|ansios[oa])(?: por | con | porque )?([^,.!?]{0,50})/i, (m) => ({ texto: `Hoy estaba ${m[1]}${m[2] ? ' por ' + tercera(m[2].trim()) : ''}`, seguimiento: /cansad|estresad|nervios|triste|preocupad|agotad|ansios/.test(m[1]) && !m[2] })],
  [/\btrabajo (?:en|como|de) ([^,.!?]{3,50})/i, (m) => `Trabaja ${m[0].slice(8).trim()}`],
  [/\bvivo en ([^,.!?]{3,40})/i, (m) => `Vive en ${m[1].trim()}`],
  [/\btengo (\d{1,2}) años/i, (m) => `Tiene ${m[1]} años`],
  [/\bmi cumpleaños es (?:el )?([^,.!?]{3,30})/i, (m) => `Su cumpleaños es el ${m[1].trim()}`],
  [/\b(?:quiero|me gustaría|me gustaria|mi meta es|mi objetivo es) ([^,.!?]{5,60})/i, (m) => ({ texto: `Quiere ${tercera(m[1].trim())}`, seguimiento: true })],
  [/\bme (?:fue|salió|salio) (bien|mal|regular|genial|fatal|excelente)(?: (?:en|con) ([^,.!?]{3,50}))?/i, (m) => `Le fue ${m[1]}${m[2] ? ' en ' + tercera(m[2].trim()) : ''}`]
];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
// De lo que dijo («mañana tengo la reunión con mi jefe») a cómo lo recuerda Uku («mañana tiene la reunión con su jefe»)
const TERCERA = [[/\btengo\b/g, 'tiene'], [/\bvoy a\b/g, 'va a'], [/\bme toca\b/g, 'le toca'], [/\bestoy\b/g, 'está'], [/\bquiero\b/g, 'quiere'], [/\bdebo\b/g, 'debe'], [/\bpuedo\b/g, 'puede'],
  [/\bmis\b/g, 'sus'], [/\bmi\b/g, 'su'], [/\bme\b/g, 'le'], [/\bconmigo\b/g, 'con él'], [/\byo\b/g, 'él'], [/\bsoy\b/g, 'es'], [/\bando\b/g, 'anda'], [/\bnecesito\b/g, 'necesita']];
const tercera = (t) => TERCERA.reduce((s, [re, r]) => s.replace(re, r), t);
export function aprenderConReglas(texto, de = 'dueno') {
  const out = [];
  for (const [re, f] of REGLAS) {
    const m = texto.match(re);
    if (!m) continue;
    const r = f(m), h = anotar(typeof r === 'string' ? r : r.texto, { de, seguimiento: !!(r && r.seguimiento), fuente: 'reglas' });
    if (h) out.push(h);
  }
  return out;
}
/* aprender(historial, { de, nombre }): al cerrar una conversación, le pide al modelo los hechos nuevos (si hay modelo);
   si no, se queda con los de las reglas (que ya se anotaron turno a turno). Devuelve los hechos nuevos. */
export async function aprender(historial, { de = 'dueno', nombre = 'Fran' } = {}) {
  const dichos = (historial || []).filter(m => m.role === 'user').map(m => m.content).filter(t => t && t.split(' ').length >= 3);
  if (!dichos.length || !mente.lista()) return [];
  const ya = hechos(de).slice(-25).map(h => '- ' + h.texto).join('\n');
  const sistema = [
    `Eres la memoria de Uku, un osito asistente. Lee lo que dijo ${nombre} y anota los HECHOS nuevos sobre su vida que valga la pena recordar en otra conversación: personas, trabajo, planes, gustos, preocupaciones, logros.`,
    'Responde SOLO con una lista, un hecho por línea, cada línea empieza con "- " y, si es algo por lo que conviene preguntar después (un plan, un problema, algo que estaba preparando), termina con " [seguir]".',
    'Frases cortas en tercera persona ("Tiene una reunión con Ana el jueves [seguir]"). Máximo 5 líneas. Nada de opiniones ni de lo que dijo Uku. Si no hay nada nuevo, responde "- nada".',
    ya ? 'Ya sabes esto (no lo repitas):\n' + ya : ''
  ].filter(Boolean).join('\n');
  const t = await mente.responder([{ role: 'system', content: sistema }, { role: 'user', content: dichos.slice(-12).join('\n') }], () => {}, { crudo: true }).catch(() => null);
  if (!t) return [];
  const out = [];
  t.split(/\n|(?=- )/).map(l => l.replace(/^[\s\-•*]+/, '').trim()).filter(l => l && !/^nada\b/i.test(l)).forEach(l => {
    const seg = /\[seguir\]/i.test(l);
    const h = anotar(l.replace(/\s*\[seguir\]\s*/ig, ''), { de, seguimiento: seg, fuente: 'modelo' });
    if (h) out.push(h);
  });
  return out;
}

/* ---------- Diario ---------- */
export function diario() { return leer().diario.slice().reverse(); }
export function escribirDiario(texto, fecha = hoy()) {
  texto = (texto || '').replace(/\s+/g, ' ').trim();
  if (texto.length < 10) return null;
  const d = leer(), e = { id: Date.now().toString(36), fecha, hora: new Date().toTimeString().slice(0, 5), texto };
  d.diario.push(e); if (d.diario.length > MAX_DIARIO) d.diario = d.diario.slice(-MAX_DIARIO);
  guardar(d); return e;
}
export function borrarDiario(id) { const d = leer(); d.diario = d.diario.filter(e => e.id !== id); guardar(d); }
/* redactarDiario(historial, { nombre, nuevos, visitas }): dos o tres frases desde el punto de vista de Uku. Con el
   modelo; si no, una entrada hecha con lo que hay (qué hablaron, qué aprendió). */
export async function redactarDiario(historial, { nombre = 'Fran', nuevos = [], visitas = [] } = {}) {
  const dichos = (historial || []).filter(m => m.role === 'user').map(m => m.content);
  if (!dichos.length && !nuevos.length) return null;
  let texto = null;
  if (mente.lista() && dichos.length) {
    const sistema = [
      `Eres Uku, un osito de peluche digital que vive en la pantalla de ${nombre} y cuida su compu. Acabas de conversar con ${nombre}. Escribe la entrada de tu diario de hoy: dos o tres frases, en primera persona, desde tu punto de vista de oso.`,
      'Cuenta qué pasó y qué notaste de él (cómo estaba, qué le preocupa o le alegra), con cariño y una pizca de humor. Sin listas, sin emojis, sin comillas. Máximo 50 palabras. No inventes nada que no esté abajo.',
      nuevos.length ? 'Hoy aprendiste: ' + nuevos.map(h => h.texto).join('; ') + '.' : ''
    ].filter(Boolean).join('\n');
    texto = await mente.responder([{ role: 'system', content: sistema }, { role: 'user', content: 'Lo que me dijo ' + nombre + ':\n' + dichos.slice(-12).join('\n') }], () => {}, { crudo: true }).catch(() => null);
  }
  if (!texto) {
    const partes = [];
    if (dichos.length) partes.push(`Hoy conversé con ${nombre} un rato` + (dichos.length > 4 ? ', largo y tendido.' : '.'));
    if (nuevos.length) partes.push('Aprendí algo nuevo: ' + nuevos.slice(0, 2).map(h => h.texto.charAt(0).toLowerCase() + h.texto.slice(1)).join(' y ') + '.');
    if (visitas.length) partes.push(`Mientras no estaba vinieron ${visitas.join(', ')}.`);
    partes.push(['Me quedé mirando las mariposas.', 'Un buen día para un oso.', 'Nadie tocó el teclado. Misión cumplida.'][Math.floor(Math.random() * 3)]);
    texto = partes.join(' ');
  }
  return escribirDiario(texto);
}

/* ---------- Relación y el claro que crece ---------- */
// Cada conversación con Fran cuenta; cada día distinto, también
export function anotarConversacion() { const d = leer(); if (!d.dias.includes(hoy())) d.dias.push(hoy()); d.conversaciones++; guardar(d); }
export function relacion() { const d = leer(); return { dias: d.dias.length, conversaciones: d.conversaciones, hechos: d.hechos.length, ultimoDia: d.dias[d.dias.length - 1] || null, diario: d.diario.length }; }
export function diasSinHablar() { const r = relacion(); if (!r.ultimoDia) return null; return Math.round((new Date(hoy()) - new Date(r.ultimoDia)) / 864e5); }
/* El claro crece con la relación (como el planeta de Tolan): se empieza con brotes y el lago chico; con las
   conversaciones salen las flores, con los días los guayacanes y los árboles, con lo que sabe las mariposas;
   la casa aparece al segundo día, la tortuga a la semana, y las banderas por cada meta que recuerda. */
export function mundo() {
  const r = relacion(), metas = hechos().filter(h => /^(quiere|su meta|planea|está preparando|esta preparando)/i.test(h.texto)).length;
  const nivel = Math.min(10, r.dias + Math.floor(r.conversaciones / 3));
  return {
    brotes: r.conversaciones === 0, flores: r.conversaciones > 0, casa: r.dias >= 2,
    guayacanes: Math.min(4, Math.floor(r.dias / 2)), mariposas: 2 + Math.min(4, Math.floor(r.hechos / 4)),
    escenario: { lago: .8 + Math.min(.3, nivel * .03), arboles: Math.min(14, 6 + nivel), tortuga: r.dias >= 7, banderas: Math.min(2, metas), cartel: true },
    nivel
  };
}
// Para probar: Mimo.memoria.simular(dias, conversaciones) deja la relación en ese punto
export function simular(dias = 7, conversaciones = 20) { const d = leer(); d.dias = Array.from({ length: dias }, (_, i) => new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)); d.conversaciones = conversaciones; guardar(d); }
export function perfil() { return leer().perfil; }
export function setPerfil(p) { const d = leer(); d.perfil = Object.assign(d.perfil, p); guardar(d); }
