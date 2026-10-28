/* =====================================================================
   Uku · visitas
   Quién se acercó a la computadora de Fran mientras no estaba: una visita
   por cada vez que alguien llega (con su persona de caras.js), desde y
   hasta cuándo, y si Fran ya la vio. Si la misma persona vuelve en menos
   de 2 minutos, sigue siendo la misma visita.
   localStorage, en este equipo.
   ===================================================================== */
const KEY = 'mimo_visitas', MAX = 200, MISMA_VISITA = 2 * 60 * 1000;

export function lista() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
function guardar(l) {
  try { localStorage.setItem(KEY, JSON.stringify(l.slice(-MAX))); } catch (e) {}
  document.dispatchEvent(new CustomEvent('mimo:visitas'));
}

/* empezar(personaId) → id de la visita (nueva, o la anterior si volvió enseguida) */
export function empezar(personaId) {
  const l = lista(), ahora = Date.now();
  const previa = [...l].reverse().find(v => v.personaId === personaId);
  if (previa && ahora - (previa.hasta || previa.desde) < MISMA_VISITA) { previa.hasta = ahora; previa.visto = false; guardar(l); return previa.id; }
  const v = { id: ahora.toString(36), personaId, desde: ahora, hasta: ahora, visto: false, gestos: 0 };
  l.push(v); guardar(l);
  return v.id;
}
// Mientras la persona sigue ahí (y lo que hizo: cuántos gestos)
export function seguir(id, { gesto = false } = {}) {
  const l = lista(), v = l.find(x => x.id === id);
  if (!v) return;
  v.hasta = Date.now(); if (gesto) v.gestos = (v.gestos || 0) + 1;
  guardar(l);
}
export function pendientes() { return lista().filter(v => !v.visto); }
export function marcarVistas() { const l = lista(); l.forEach(v => { v.visto = true; }); guardar(l); }
export function borrarTodas() { guardar([]); }
// Al juntar o borrar personas, sus visitas se mueven o se van con ellas
export function moverPersona(desde, hacia) { const l = lista(); l.forEach(v => { if (v.personaId === desde) v.personaId = hacia; }); guardar(l); }
export function borrarDePersona(id) { guardar(lista().filter(v => v.personaId !== id)); }
