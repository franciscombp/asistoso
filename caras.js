/* =====================================================================
   Uku · caras
   Uku reconoce a quien se acerca, aunque nadie le haya dicho quién es:
   - analizar(): de la cara en cámara saca una "huella" (128 números, con
     face-api) y una foto pequeña (96 px) para que Fran la vea después.
   - identificar(): la compara con todas las personas guardadas, con nombre
     o sin él. Si no se parece a nadie, nace una persona sin nombre
     ("Visitante 3"); cuando vuelve, Uku sabe que es la misma.
   - Fran (el dueño) le pone nombre, junta dos personas que son la misma o
     borra a quien quiera, desde el panel (panel.js).
   Todo vive en este equipo (localStorage), nada sale del navegador.
   ===================================================================== */
import * as descargas from './descargas.js?v=__BUILD__';
const Q = new URLSearchParams(location.search);
export const FA = Q.get('faceapi') || 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15';
const KEY = 'mimo_personas';
const UMBRAL = .5;          // distancia máxima entre huellas de la misma persona
const MUESTRAS_MAX = 6;     // huellas que se guardan por persona (de distintos momentos)
const SIN_NOMBRE_MAX = 40;  // visitantes sin nombre que se conservan (se olvidan los más viejos)

let fa = null, cargando = null;
export function cargar() {
  if (fa) return Promise.resolve(fa);
  if (!cargando) cargando = (async () => {
    descargas.empezar('caras', 'Caras', 'face-api: detector y huella de 128 números (~7 MB)');
    const m = await import(FA + '/dist/face-api.esm.js');
    await m.tf.setBackend('webgl').catch(() => {}); // en escritorio, con la GPU
    await m.tf.ready();
    const base = FA + '/model';
    await Promise.all([
      m.nets.tinyFaceDetector.loadFromUri(base),
      m.nets.faceLandmark68TinyNet.loadFromUri(base),
      m.nets.faceRecognitionNet.loadFromUri(base)
    ]);
    fa = m;
    descargas.listo('caras', `face-api: detector y huella de 128 números · ${m.tf.getBackend() === 'webgl' ? 'en la tarjeta gráfica' : 'en la CPU'}`);
    return m;
  })().catch(e => { cargando = null; descargas.fallo('caras', 'Revisa la conexión a internet'); throw e; });
  return cargando;
}

/* ---------- Personas guardadas ----------
   { id, nombre (null = sin nombre), numero (n.º de visitante), muestras: [[128]],
     foto (data URL), creado, visto (última vez, ms), dueno (true para Fran) } */
export function personas() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
function guardar(l) {
  try { localStorage.setItem(KEY, JSON.stringify(l)); }
  catch (e) { // sin espacio: se olvidan los visitantes sin nombre más viejos y se reintenta
    const sin = l.filter(p => !p.nombre).sort((a, b) => a.visto - b.visto);
    if (!sin.length) return;
    guardar(l.filter(p => p !== sin[0]));
  }
  document.dispatchEvent(new CustomEvent('mimo:personas'));
}
export function persona(id) { return personas().find(p => p.id === id) || null; }
export function hay() { return personas().some(p => p.nombre); }
export function dueno() { return personas().find(p => p.dueno) || null; }
export function nombreDe(p) { return p ? (p.nombre || 'Visitante ' + p.numero) : ''; }
function cambiar(id, fn) { const l = personas(), p = l.find(x => x.id === id); if (p) { fn(p, l); guardar(l); } return p; }
export function renombrar(id, nombre) { return cambiar(id, p => { p.nombre = (nombre || '').trim() || null; }); }
export function marcarDueno(id) { const l = personas(); l.forEach(p => { p.dueno = p.id === id ? !p.dueno : false; }); guardar(l); }
export function borrar(id) { guardar(personas().filter(p => p.id !== id)); }
export function borrarTodas() { guardar([]); }
// juntar(desde, hacia): eran la misma persona. Las huellas y la foto se suman a "hacia".
export function juntar(desde, hacia) {
  const l = personas(), a = l.find(p => p.id === desde), b = l.find(p => p.id === hacia);
  if (!a || !b || a === b) return;
  b.muestras = b.muestras.concat(a.muestras).slice(-MUESTRAS_MAX);
  if (!b.foto) b.foto = a.foto;
  b.visto = Math.max(b.visto || 0, a.visto || 0);
  guardar(l.filter(p => p !== a));
}

/* ---------- Analizar la cara de la cámara ----------
   La cara ocupa poco del cuadro de la webcam: se recorta donde MediaPipe ya la
   encontró (caja 0–1, con margen) y face-api trabaja sobre ese recorte. */
const recorte = document.createElement('canvas'), mini = document.createElement('canvas');
function recortar(video, caja) {
  const W = video.videoWidth, H = video.videoHeight;
  if (!caja || !W) return video;
  const cx = (caja.x0 + caja.x1) / 2 * W, cy = (caja.y0 + caja.y1) / 2 * H;
  const lado = Math.max((caja.x1 - caja.x0) * W, (caja.y1 - caja.y0) * H) * 1.7;
  recorte.width = recorte.height = 256;
  recorte.getContext('2d').drawImage(video, cx - lado / 2, cy - lado / 2, lado, lado, 0, 0, 256, 256);
  return recorte;
}
// Foto pequeña de la cara, en espejo (como la persona se ve a sí misma)
function foto(fuente, det) {
  const b = det.box, m = Math.max(b.width, b.height) * .35, lado = Math.max(b.width, b.height) + m * 2;
  mini.width = mini.height = 96;
  const x = mini.getContext('2d');
  x.save(); x.translate(96, 0); x.scale(-1, 1);
  x.drawImage(fuente, b.x + b.width / 2 - lado / 2, b.y + b.height / 2 - lado / 2, lado, lado, 0, 0, 96, 96);
  x.restore();
  return mini.toDataURL('image/jpeg', .72);
}
/* analizar(video, caja) → { huella, foto, calidad } | null. Solo caras claras (calidad ≥ .55). */
export async function analizar(video, caja) {
  const m = await cargar();
  const fuente = recortar(video, caja);
  const r = await m.detectSingleFace(fuente, new m.TinyFaceDetectorOptions({ inputSize: fuente === video ? 416 : 224, scoreThreshold: .4 }))
    .withFaceLandmarks(true).withFaceDescriptor();
  if (!r || r.detection.score < .55) return null;
  return { huella: Array.from(r.descriptor, v => Math.round(v * 1e4) / 1e4), foto: foto(fuente, r.detection), calidad: r.detection.score };
}

const dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return Math.sqrt(s); };
/* identificar(analisis): la persona más parecida (con o sin nombre). Si nadie se
   parece, la guarda como visitante nuevo. Devuelve { persona, nueva }. */
export function identificar(a) {
  const l = personas();
  let mejor = null, dmin = Infinity;
  l.forEach(p => p.muestras.forEach(mu => { const d = dist(a.huella, mu); if (d < dmin) { dmin = d; mejor = p; } }));
  const ahora = Date.now();
  if (mejor && dmin < UMBRAL) {
    // Cada vez que la ve, aprende un poco más (huellas de distintos momentos) y renueva la foto si es mejor
    if (dmin > .25) mejor.muestras = mejor.muestras.concat([a.huella]).slice(-MUESTRAS_MAX);
    if (!mejor.foto || (a.calidad || 0) > (mejor.calidadFoto || 0)) { mejor.foto = a.foto; mejor.calidadFoto = a.calidad; }
    mejor.visto = ahora;
    guardar(l);
    return { persona: mejor, nueva: false };
  }
  const numero = l.reduce((n, p) => Math.max(n, p.numero || 0), 0) + 1;
  const p = { id: ahora.toString(36) + Math.random().toString(36).slice(2, 5), nombre: null, numero, muestras: [a.huella], foto: a.foto, calidadFoto: a.calidad, creado: ahora, visto: ahora };
  let nueva = l.concat([p]);
  const sin = nueva.filter(x => !x.nombre);
  if (sin.length > SIN_NOMBRE_MAX) { const viejo = sin.sort((x, y) => x.visto - y.visto)[0]; nueva = nueva.filter(x => x !== viejo); }
  guardar(nueva);
  return { persona: p, nueva: true };
}

/* registrar(nombre, video, alAvance, caja): Fran presenta a alguien a propósito.
   Toma 5 huellas (moviendo un poco la cabeza entre una y otra queda mejor). */
export async function registrar(nombre, video, alAvance = () => {}, caja = () => null) {
  await cargar();
  const tomas = [];
  let intentos = 0;
  while (tomas.length < 5 && intentos < 40) {
    intentos++;
    const a = await analizar(video, caja());
    if (a) { tomas.push(a); alAvance(tomas.length, 5); }
    await new Promise(r => setTimeout(r, 350));
  }
  if (tomas.length < 3) throw new Error('sin-cara');
  // Si ya la conocía (con o sin nombre), se le pone el nombre a esa persona
  const { persona: p } = identificar(tomas[0]);
  const l = personas(), q = l.find(x => x.id === p.id);
  q.nombre = nombre.trim();
  q.muestras = q.muestras.concat(tomas.slice(1).map(t => t.huella)).slice(-MUESTRAS_MAX);
  const mejor = tomas.reduce((a, b) => (b.calidad > a.calidad ? b : a));
  q.foto = mejor.foto; q.calidadFoto = mejor.calidad;
  guardar(l);
  return q;
}
