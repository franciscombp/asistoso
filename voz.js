/* =====================================================================
   Uku · voz
   - hablar(texto): Uku dice sus frases con la voz del sistema en español
     (speechSynthesis). Se puede apagar.
   - comandoDe(texto): palabras de juego en lo que se dijo ("fiesta",
     "lluvia", "globos"…). Lo que se escucha lo transcribe oido.js (Whisper,
     en el navegador); estaHablando() evita que Uku se escuche a sí mismo.
   - boca(): cuánto abre Uku la boca ahora mismo ({ a, r } o null): cada
     vocal es una sílaba que abre según la vocal (a mucho; e, o medio; i, u
     poco; o, u redondas) y vuelve a cerrar. Con voz, cada palabra que
     anuncia el navegador (onboundary) resincroniza; mover(texto) hace lo
     mismo en silencio, al ritmo de lectura, cuando la voz está apagada.
   ===================================================================== */
const COMANDOS = [
  [/\b(hola|holi|buenas|buenos d[ií]as|buenas tardes)\b/, 'saludo'],
  [/\b(ok|okey|okay|oki|vale|listo|dale)\b/, 'ok'],
  [/\bgracias\b/, 'gracias'],
  [/\b(tip|consejo)\b/, 'tip'],
  [/\b(chao|chau|adi[oó]s|nos vemos)\b/, 'chao'],
  [/\b(te quiero|coraz[oó]n)\b/, 'corazon'],
  [/\bglobos?\b/, 'globos'],
  [/\bconfeti\b/, 'confeti'],
  [/\b(baila\w*|bailemos)\b/, 'baile'],
  [/\bfiesta\b/, 'fiesta'],
  [/\b(lluvia|llueve|llueva|llover)\b/, 'lluvia'],
  [/\b(nieve|nevar|fr[ií]o)\b/, 'nieve'],
  [/\bnoche\b/, 'entorno:noche'],
  [/\batardecer\b/, 'entorno:atardecer'],
  [/\b(jard[ií]n|flores)\b/, 'entorno:jardin'],
  [/\bsol\b/, 'sol'],
  [/\bmiel\b/, 'miel'],
  [/\bestrellas?\b/, 'estrellas'],
  [/\b(aplausos?|aplaude\w*)\b/, 'aplausos'],
  [/\b(beso|besito|besos)\b/, 'beso'],
  [/\b(m[uú]sica|canci[oó]n)\b/, 'musica'],
  [/\b(cumplea[nñ]os)\b/, 'cumple'],
  [/\b(caf[eé])\b/, 'cafe'],
  [/\b(abrazo|abr[aá]zame)\b/, 'abrazo'],
  [/\b(jaja\w*|risa|re[ií]r)\b/, 'risa'],
  [/\b(dormir|sue[nñ]o)\b/, 'sueno'],
  [/(c[oó]mo te llamas|qui[eé]n eres)/, 'quien']
];
export function comandoDe(texto) {
  const t = (texto || '').toLowerCase();
  const c = COMANDOS.find(([re]) => re.test(t));
  return c ? c[1] : null;
}

let voz = null, hablando = false, hastaSilencio = 0, activa = false; // apagada por defecto (se enciende en el inicio o con M)
function elegirVoz() {
  const vs = speechSynthesis.getVoices().filter(v => /^es/i.test(v.lang));
  const pref = ['es-EC', 'es-419', 'es-US', 'es-MX', 'es-CO', 'es-ES'];
  voz = pref.map(l => vs.find(v => v.lang === l)).find(Boolean) || vs[0] || null;
}
if ('speechSynthesis' in window) { elegirVoz(); speechSynthesis.onvoiceschanged = elegirVoz; }

export function setVoz(on) { activa = on; if (!on && 'speechSynthesis' in window) speechSynthesis.cancel(); }
export function vozActiva() { return activa && 'speechSynthesis' in window; }
export function hablar(texto) {
  if (!vozActiva() || !texto) return;
  speechSynthesis.cancel();
  const limpio = texto.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, '');
  const u = new SpeechSynthesisUtterance(limpio);
  if (voz) u.voice = voz;
  u.lang = voz ? voz.lang : 'es-419';
  u.rate = 1.04; u.pitch = 1.15;
  hablando = true;
  u.onstart = () => { plan = planDe(limpio, performance.now(), u.rate); };
  u.onboundary = (e) => { if (e.name === 'word' || e.name == null) plan = planDe(limpio.slice(e.charIndex || 0), performance.now(), u.rate); };
  u.onend = u.onerror = () => { hablando = false; plan = null; hastaSilencio = performance.now() + 700; };
  speechSynthesis.speak(u);
}

/* ---------- La boca ---------- */
const VOCAL = { a: [1, 0], á: [1, 0], e: [.7, 0], é: [.7, 0], i: [.42, 0], í: [.42, 0], o: [.8, .9], ó: [.8, .9], u: [.48, 1], ú: [.48, 1], ü: [.48, 1] };
const SILABA = 165; // ms por sílaba a velocidad 1 (unas 6 por segundo)
let plan = null;    // { t0, pasos: [{ t, d, a, r }], fin }
function planDe(texto, desde, rate = 1) {
  const pasos = [], sil = SILABA / rate;
  let t = 0, antes = false;
  for (const ch of (texto || '').toLowerCase()) {
    const v = VOCAL[ch];
    if (v) { if (!antes) { pasos.push({ t, d: sil, a: v[0], r: v[1] }); t += sil; } antes = true; continue; } // diptongo: una sílaba
    antes = false;
    if (/[,;:]/.test(ch)) t += 200 / rate; else if (/[.!?…]/.test(ch)) t += 360 / rate;
  }
  return { t0: desde, pasos, fin: desde + t };
}
// Uku mueve la boca sin sonido (la voz apagada: el globo de texto es lo que «dice»)
export function mover(texto) { if (!hablando && texto) plan = planDe(String(texto).slice(0, 180), performance.now(), 1.15); }
export function boca() {
  if (!plan) return null;
  const ahora = performance.now(), t = ahora - plan.t0;
  if (ahora > plan.fin) {
    // la voz va más lenta que el cálculo: sigue moviendo la boca hasta que termine
    if (hablando) return { a: Math.max(0, Math.sin(ahora / 1000 * 12)) * .55, r: 0 };
    plan = null; return null;
  }
  // la sílaba que toca (los pasos están en orden)
  let p = null;
  for (const q of plan.pasos) { if (q.t > t) break; p = q; }
  if (!p || t > p.t + p.d) return { a: 0, r: 0 };
  const f = Math.sin(Math.PI * (t - p.t) / p.d);
  return { a: p.a * Math.pow(Math.max(0, f), .8) * .9, r: p.r };
}

export function estaHablando() { return hablando || performance.now() < hastaSilencio; }
