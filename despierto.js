/* =====================================================================
   Uku · pantalla despierta
   Para que la computadora no entre en reposo ni apague la pantalla
   mientras Uku cuida:
   1. Screen Wake Lock API (Chrome, Edge, Safari 16.4+; solo en https).
      Se vuelve a pedir cuando la pestaña vuelve a estar visible (el
      navegador la suelta al ocultarla).
   2. Si el navegador no la tiene o la rechaza: un video diminuto en bucle
      (como NoSleep.js), que el sistema trata como "viendo un video".
   No puede con lo que decida el sistema por política (bloqueo por
   inactividad de la empresa, cerrar la tapa, bloqueo manual): para eso
   está `caffeinate -d` en Mac o Ajustes › Energía en Windows (LEEME.md).
   estado() → 'wakelock' | 'video' | 'no' | 'apagado'
   ===================================================================== */
let quiero = false, lock = null, video = null, modo = 'apagado';
const avisar = () => document.dispatchEvent(new CustomEvent('mimo:despierto', { detail: modo }));
export function estado() { return modo; }
export function activo() { return quiero; }

async function pedirWakeLock() {
  if (!('wakeLock' in navigator)) return false;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => { lock = null; if (quiero && modo === 'wakelock') { modo = 'no'; avisar(); } });
    return true;
  } catch (e) { return false; }
}
// Un lienzo animado, capturado como video: el navegador lo considera "reproducción" y el sistema no duerme la pantalla
function iniciarVideo() {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const x = c.getContext('2d');
    let n = 0;
    const pintar = () => { x.fillStyle = n++ % 2 ? '#000' : '#010101'; x.fillRect(0, 0, 16, 16); };
    pintar(); setInterval(pintar, 1000);
    video = document.createElement('video');
    video.muted = true; video.loop = true; video.playsInline = true; video.setAttribute('aria-hidden', 'true');
    Object.assign(video.style, { position: 'fixed', width: '2px', height: '2px', right: '0', bottom: '0', opacity: '.01', pointerEvents: 'none' });
    video.srcObject = c.captureStream(2);
    document.body.appendChild(video);
    return video.play().then(() => true, () => false);
  } catch (e) { return Promise.resolve(false); }
}

export async function activar() {
  quiero = true;
  if (lock) return;
  if (await pedirWakeLock()) modo = 'wakelock';
  else if (video ? !video.paused : await iniciarVideo()) modo = 'video';
  else modo = 'no';
  avisar();
}
export function desactivar() {
  quiero = false;
  if (lock) { lock.release().catch(() => {}); lock = null; }
  if (video) video.pause();
  modo = 'apagado'; avisar();
}
// Al volver a la pestaña el navegador ya soltó el bloqueo: se pide de nuevo
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !quiero) return;
  if (modo === 'wakelock' || modo === 'no') { lock = null; activar(); }
  else if (video && video.paused) video.play().catch(() => {});
});
