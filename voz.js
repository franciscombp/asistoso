/* =====================================================================
   Uku · voz
   - hablar(texto): Uku dice sus frases con la voz del sistema en español
     (speechSynthesis). Se puede apagar.
   - comandoDe(texto): palabras de juego en lo que se dijo ("fiesta",
     "lluvia", "globos"…). Lo que se escucha lo transcribe oido.js (Whisper,
     en el navegador); estaHablando() evita que Uku se escuche a sí mismo.
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
  const u = new SpeechSynthesisUtterance(texto.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, ''));
  if (voz) u.voice = voz;
  u.lang = voz ? voz.lang : 'es-419';
  u.rate = 1.04; u.pitch = 1.15;
  hablando = true;
  u.onend = u.onerror = () => { hablando = false; hastaSilencio = performance.now() + 700; };
  speechSynthesis.speak(u);
}

export function estaHablando() { return hablando || performance.now() < hastaSilencio; }
