/* =====================================================================
   Uku · reloj y tiempo (hora y clima del lugar)
   - Reloj: la hora local y la fecha, arriba. (?hora=22 la fija, para probar.)
   - Clima: el de assets/clima.js (Open-Meteo con la ubicación;
     sin permiso o sin red, Quito). Muestra el cielo y los grados; Uku se
     viste según el clima (paraguas con lluvia, gorro con frío, sombrero y
     gafas con sol…) y, con lluvia, llueve. (?clima=gye|uio-rain|uio-cold|
     cuenca|tena fija un escenario, para probar.)
   - El entorno sigue la hora: día, atardecer (17:30) y noche (19:00); con
     lluvia, llueve. Si alguien elige un entorno a mano, se respeta.
   ===================================================================== */
const Q = new URLSearchParams(location.search);
const ICONOS = { rainy: '🌧️', ac_unit: '❄️', wb_sunny: '☀️', partly_cloudy_day: '⛅', cloud: '☁️', foggy: '🌫️', thunderstorm: '⛈️', wb_cloudy: '☁️' };

export function ahora() {
  const d = new Date(), h = Q.get('hora');
  if (h != null && /^\d{1,2}(:\d{2})?$/.test(h)) { const [hh, mm] = h.split(':').map(Number); d.setHours(hh, mm || 0, 0, 0); }
  return d;
}
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/* Reloj: { hora, fecha } son elementos; se repinta cada segundo (los dos puntos parpadean) */
export function iniciarReloj({ hora, fecha }) {
  const pintar = () => {
    const d = ahora(), on = d.getSeconds() % 2 === 0;
    hora.innerHTML = String(d.getHours()).padStart(2, '0') + `<i style="opacity:${on ? 1 : .25}">:</i>` + String(d.getMinutes()).padStart(2, '0');
    fecha.textContent = cap(d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' }));
  };
  pintar(); setInterval(pintar, 1000);
}

/* Clima: alCambiar(c) recibe { look, text, temp, city, rain, icon } cuando se sabe (y cada 30 min) */
export async function iniciarClima(chip, alCambiar) {
  if (!window.Clima) return null;
  const preset = Q.get('clima');
  const actualizar = async () => {
    try { if (preset) await Clima.set(preset); } catch (e) {}
    const c = await Clima.get().catch(() => null);
    if (!c) { chip.hidden = true; return null; }
    const noche = ahora().getHours() >= 19 || ahora().getHours() < 6;
    const ic = c.icon === 'wb_sunny' && noche ? '🌙' : ICONOS[c.icon] || '⛅';
    chip.hidden = false; chip.textContent = `${ic} ${c.temp}°${c.city ? ' · ' + c.city : ''}`;
    chip.title = c.text;
    alCambiar(c);
    return c;
  };
  const c = await actualizar();
  setInterval(actualizar, 30 * 60 * 1000);
  return c;
}
export const clima = () => (window.Clima && Clima.last()) || null;

// El entorno que le toca ahora: lluvia si llueve; si no, día, atardecer o noche según la hora
export function entornoReal(c = clima(), d = ahora()) {
  if (c && c.rain) return 'lluvia';
  const h = d.getHours() + d.getMinutes() / 60;
  return h >= 19 || h < 6 ? 'noche' : h >= 17.5 ? 'atardecer' : 'dia';
}
