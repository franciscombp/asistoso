/* =====================================================================
   Uku · cartel «X días sin accidentes»
   El cartel del escenario (assets/bosque3d.js › setCartel) cuenta los días
   desde el último accidente. El número sube solo cada día; Uku lo cambia
   cuando se lo piden con un gesto o con la voz:
   - mas(): un día más sin accidentes (🙏 manos juntas, tecla B).
   - accidente(): vuelve a cero y guarda el récord (❌ brazos cruzados, tecla 0).
   - poner(n): lo deja en n días («pon el cartel en 15»).
   Se guarda en este equipo (localStorage: mimo_cartel con la fecha del
   último accidente y el récord).
   ===================================================================== */
const KEY = 'mimo_cartel';
const dia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());           // medianoche local
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const deIso = (t) => { const [y, m, d] = String(t).split('-').map(Number); return new Date(y, m - 1, d); };
const diasEntre = (a, b) => Math.round((dia(b) - dia(a)) / 864e5);
const hoy = () => new Date();
const restar = (n) => { const d = dia(hoy()); d.setDate(d.getDate() - n); return d; };

function leer() {
  try { const e = JSON.parse(localStorage.getItem(KEY) || 'null'); if (e && e.desde) return { desde: e.desde, record: +e.record || 0 }; } catch (x) {}
  return { desde: iso(restar(7)), record: 0 }; // la primera vez ya lleva una semana
}
let est = leer();
function guardar() { try { localStorage.setItem(KEY, JSON.stringify(est)); } catch (x) {} }

export function dias() { return Math.max(0, Math.min(999, diasEntre(deIso(est.desde), hoy()))); }
export function record() { return Math.max(est.record, dias()); }
export function estado() { return { dias: dias(), record: est.record }; }
function avisar(animar = true) { guardar(); document.dispatchEvent(new CustomEvent('mimo:cartel', { detail: Object.assign(estado(), { animar }) })); }

export function mas() { const d = deIso(est.desde); d.setDate(d.getDate() - 1); est.desde = iso(d); avisar(); return dias(); }
export function accidente() { const antes = dias(); est.record = Math.max(est.record, antes); est.desde = iso(dia(hoy())); avisar(); return { antes, record: est.record }; }
export function poner(n) { n = Math.max(0, Math.min(999, Math.round(+n || 0))); est.desde = iso(restar(n)); est.record = Math.max(est.record, n); avisar(); return n; }

// El día cambia a medianoche: si el número es otro, el cartel lo voltea solo
let mostrado = dias();
export function vigilar() {
  setInterval(() => { const d = dias(); if (d !== mostrado) { mostrado = d; est.record = Math.max(est.record, d); guardar(); document.dispatchEvent(new CustomEvent('mimo:cartel', { detail: Object.assign(estado(), { animar: true }) })); } }, 30000);
}
document.addEventListener('mimo:cartel', (e) => { mostrado = e.detail.dias; });
