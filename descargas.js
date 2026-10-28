/* =====================================================================
   Uku · estado de descarga de su IA
   Una tarjeta con cada modelo que Uku baja (visión, caras, oído y
   sentido): cuánto lleva en MB y %, dónde corre y si ya está listo.
   La primera vez son ~120 MB; luego salen de la caché del navegador y
   se ve "Listo" casi al instante. Se esconde sola cuando todo terminó;
   la tecla A la vuelve a mostrar.
   ===================================================================== */
const items = new Map(); // id → { nombre, detalle, archivos: { archivo: [cargado, total] }, estado }
let raiz = null, lista = null, ocultarTimer = 0;

export function montar(el) {
  raiz = el; lista = el.querySelector('.md-lista');
  el.querySelector('[data-cerrar]').addEventListener('click', () => mostrar(false));
  pintar();
}
export function mostrar(on = true) { if (raiz) raiz.hidden = !on; if (on) pintar(); }
export function alternar() { mostrar(raiz && raiz.hidden); }

export function empezar(id, nombre, detalle = '') {
  items.set(id, { nombre, detalle, archivos: {}, estado: 'cargando' });
  clearTimeout(ocultarTimer);
  if (raiz) raiz.hidden = false;
  pintar();
}
export function detalle(id, texto) { const it = items.get(id); if (it) { it.detalle = texto; pintar(); } }
export function avance(id, archivo, cargado, total) {
  const it = items.get(id);
  if (!it || !total) return;
  it.archivos[archivo] = [cargado, total];
  pintar();
}
export function listo(id, texto) { terminar(id, 'listo', texto); }
export function fallo(id, texto) { terminar(id, 'error', texto); }
function terminar(id, estado, texto) {
  const it = items.get(id);
  if (!it) return;
  it.estado = estado;
  if (texto) it.detalle = texto;
  pintar();
  // Cuando ya nada carga y nada falló, la tarjeta se va sola
  const todos = [...items.values()];
  if (todos.every(x => x.estado === 'listo')) { clearTimeout(ocultarTimer); ocultarTimer = setTimeout(() => mostrar(false), 4000); }
}
export function porcentaje(id) {
  const it = items.get(id);
  if (!it) return 0;
  if (it.estado === 'listo') return 100;
  const [c, t] = suma(it);
  return t ? Math.round(c / t * 100) : 0;
}
export function resumen() { return Object.fromEntries([...items].map(([id, it]) => [id, { estado: it.estado, porcentaje: porcentaje(id), mb: +(suma(it)[1] / 1048576).toFixed(1) }])); }

/* bajar(url, id): descarga un archivo contando los bytes (para los modelos de MediaPipe) */
export async function bajar(url, id) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  const total = +r.headers.get('content-length') || 0, archivo = url.split('/').pop();
  if (!r.body || !total) { const b = new Uint8Array(await r.arrayBuffer()); avance(id, archivo, b.length, b.length); return b; }
  const lector = r.body.getReader(), partes = [];
  let cargado = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    partes.push(value); cargado += value.length;
    avance(id, archivo, cargado, total);
  }
  const b = new Uint8Array(cargado);
  let o = 0; partes.forEach(p => { b.set(p, o); o += p.length; });
  return b;
}

const suma = (it) => Object.values(it.archivos).reduce((a, [c, t]) => [a[0] + c, a[1] + t], [0, 0]);
const mb = (b) => (b / 1048576).toLocaleString('es-EC', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
let pintando = 0;
function pintar() {
  if (!lista || pintando) return;
  pintando = requestAnimationFrame(() => {
    pintando = 0;
    lista.innerHTML = [...items].map(([id, it]) => {
      const [c, t] = suma(it), p = it.estado === 'listo' ? 100 : t ? Math.round(c / t * 100) : 0;
      const cifras = it.estado === 'listo' ? (t ? `Listo · ${mb(t)} MB` : 'Listo')
        : it.estado === 'error' ? 'No se pudo cargar'
        : t ? `${mb(c)} de ${mb(t)} MB · ${p}%` : 'Preparando…';
      return `<li class="md-item is-${it.estado}" data-id="${id}">
        <div class="md-fila"><b>${it.nombre}</b><span>${cifras}</span></div>
        <div class="md-barra${!t && it.estado === 'cargando' ? ' is-indefinida' : ''}"><i style="width:${p}%"></i></div>
        ${it.detalle ? `<small>${it.detalle}</small>` : ''}
      </li>`;
    }).join('');
  });
}
