/* =====================================================================
   Uku · tareas por voz: recordatorios y post-its virtuales
   Se activan con la palabra «Uku» al principio de lo que se dice:
   «Uku, recuérdame en 10 minutos tomar agua», «Uku, a las 15:30 llamar a Ana»,
   «Uku, pon un post-it que diga comprar pan», «Uku, qué recordatorios tengo»,
   «Uku, borra los post-its». Lo que no es una tarea sigue como conversación.
   Todo queda en este navegador (localStorage 'mimo_tareas'): no sale nada.
   parsear(texto) → null | { tipo, … }; con la palabra «Uku» ya quitada.
   ===================================================================== */
const KEY = 'mimo_tareas';

const NUM = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60 };
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const cifra = (s) => /^\d+$/.test(s) ? +s : NUM[s] != null ? NUM[s] : null;

// «Uku» al principio (y variantes que suele escribir el reconocedor). Devuelve lo que sigue o null.
const LLAMADA = /^\s*[¡¿]?(uku|uko|ucu|juku|huku)\b[\s,.:;…!?¡¿-]*/i;
export function llamada(texto) {
  const m = String(texto || '').match(LLAMADA);
  return m ? { resto: String(texto).slice(m[0].length).trim() } : null;
}

/* Hora: «en 10 minutos», «dentro de una hora», «a las 15:30», «a las 3 y media», «a las 7 de la noche».
   Trabaja sobre el texto normalizado y dice qué parte ocupó (i, L) para quitarla del texto original. */
function cuandoDe(t, ahora) {
  let m = t.match(/\b(?:en|dentro de) (\d+|[a-z]+) (segundos?|minutos?|min|horas?|h)\b/);
  if (m) {
    const n = cifra(m[1]); if (n == null) return null;
    const u = m[2], mult = /^seg/.test(u) ? 1000 : /^h/.test(u) ? 3600000 : 60000;
    return { ms: ahora + n * mult, i: m.index, L: m[0].length };
  }
  m = t.match(/\bdentro de (una|un) hora\b/);
  if (m) return { ms: ahora + 3600000, i: m.index, L: m[0].length };
  m = t.match(/\ba las (\d{1,2})(?::(\d{2}))?( y media)?(?: (?:de la |en la )?(manana|tarde|noche|madrugada))?\b/);
  if (m) {
    let h = +m[1], min = m[2] ? +m[2] : m[3] ? 30 : 0;
    const franja = m[4];
    if ((franja === 'tarde' || franja === 'noche') && h < 12) h += 12;
    if (h > 23 || min > 59) return null;
    const d = new Date(ahora); d.setHours(h, min, 0, 0);
    if (d.getTime() <= ahora) d.setDate(d.getDate() + 1); // ya pasó hoy: mañana
    return { ms: d.getTime(), i: m.index, L: m[0].length };
  }
  return null;
}

// Palabras del texto original (con sus tildes y mayúsculas) y el mismo texto normalizado, palabra por palabra
function palabras(original) { const w = original.split(/\s+/).filter(Boolean); return { w, n: w.map(norm) }; }
// Marca como quitadas las palabras que ocupa el tramo [i, i+L) del texto normalizado (unido con espacios)
function quitar(mascara, n, i, L) {
  const j = n.join(' '), antes = j.slice(0, i).trim(), hasta = j.slice(0, i + L).trim();
  const sw = antes ? antes.split(' ').length : 0, ew = hasta.split(' ').length - 1;
  for (let k = sw; k <= ew; k++) mascara[k] = true;
}
function resto(p, mascara) { return p.w.filter((_, k) => !mascara[k]).join(' ').replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '').trim(); }

export function parsear(texto, ahora = Date.now()) {
  const original = String(texto || '').trim(), t = norm(original);
  if (!t) return null;
  const p = palabras(original), mask = [];

  // Recordatorio: «recuérdame …», «recordatorio …», «avísame …»
  const disparo = t.match(/^(?:recuerdame|recuerda me|pon(?:me)? un recordatorio|recordatorio|avisame)\b\s*(?:de |que |para |sobre )?/);
  if (disparo) {
    quitar(mask, p.n, 0, disparo[0].length);
    const c = cuandoDe(t, ahora);
    if (!c) return { tipo: 'recordatorio-sin-hora' };
    quitar(mask, p.n, c.i, c.L);
    const que = resto(p, mask);
    if (!que) return { tipo: 'recordatorio-sin-que' };
    return { tipo: 'recordatorio', ms: c.ms, texto: que };
  }
  // Post-it o nota: «pon un post-it que diga …», «pega una nota …», «anota que …»
  const pi = t.match(/^(?:(?:pon|pega|deja|crea|haz|escribe)(?:me)? )?(?:un |una |el |la )?(?:post[- ]?its?|postits?|notas?|notita)\b\s*(?:que diga|con|para|de|:)?\s*/)
    || t.match(/^(?:anota|apunta)(?:me)?\b\s*(?:que |:)?/);
  if (pi) {
    quitar(mask, p.n, 0, pi[0].length);
    const que = resto(p, mask);
    return que ? { tipo: 'postit', texto: que } : { tipo: 'postit-sin-texto' };
  }
  // Listar: «qué recordatorios tengo», «mis post-its», «qué notas hay»
  if (/\b(recordatorios?|post[- ]?its?|notas?)\b/.test(t) && /^(que|cuales|cuantos|mis|ver|lista|dime|tengo|hay)\b/.test(t) && !/^(borra|elimina|quita)/.test(t)) {
    return { tipo: 'listar', que: /recordatorio/.test(t) ? 'recordatorios' : 'postits' };
  }
  // Borrar: «borra los post-its», «borra los recordatorios», «borra todo»
  if (/^(borra|borrate|elimina|quita|limpia)\b/.test(t)) {
    if (/recordatorio/.test(t)) return { tipo: 'borrar', que: 'recordatorios' };
    if (/post[- ]?its?|postits?|notas?/.test(t)) return { tipo: 'borrar', que: 'postits' };
    if (/\btodo\b/.test(t)) return { tipo: 'borrar', que: 'todo' };
  }
  return null;
}

/* ---------- almacén (solo en este navegador) ---------- */
function leer() {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && Array.isArray(d.recordatorios) && Array.isArray(d.notas)) return d; } catch (e) {}
  return { recordatorios: [], notas: [] };
}
function guardar(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} document.dispatchEvent(new CustomEvent('mimo:tareas')); }
export function recordatorios() { return leer().recordatorios.slice().sort((a, b) => a.ms - b.ms); }
export function postits() { return leer().notas; }
export function anotarRecordatorio(texto, ms) { const d = leer(); d.recordatorios.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), texto, ms }); guardar(d); }
export function anotarPostit(texto) { const d = leer(); d.notas.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), texto: texto.slice(0, 140), color: ['amarillo', 'azul', 'verde', 'rosa'][d.notas.length % 4], fecha: Date.now() }); guardar(d); }
export function quitarPostit(id) { const d = leer(); d.notas = d.notas.filter(n => n.id !== id); guardar(d); }
export function quitarRecordatorio(id) { const d = leer(); d.recordatorios = d.recordatorios.filter(r => r.id !== id); guardar(d); }
export function borrar(que) { const d = leer(); if (que === 'recordatorios' || que === 'todo') d.recordatorios = []; if (que === 'postits' || que === 'todo') d.notas = []; guardar(d); }

/* Vence un recordatorio: se saca de la lista y se avisa una vez. avisar(texto) lo dice Uku. */
let vigilando = null;
export function vigilar(avisar) {
  if (vigilando) return;
  vigilando = setInterval(() => {
    const d = leer(), ahora = Date.now(), venc = d.recordatorios.filter(r => r.ms <= ahora);
    if (!venc.length) return;
    d.recordatorios = d.recordatorios.filter(r => r.ms > ahora); guardar(d);
    venc.forEach(r => avisar(r.texto));
  }, 5000);
}
export function formatoHora(ms) { const d = new Date(ms), hoy = new Date(); const mismoDia = d.toDateString() === hoy.toDateString(); return (mismoDia ? '' : 'mañana o después, ') + d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
