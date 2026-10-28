/* =====================================================================
   Uku · oído. Dos formas de pasar la voz a texto:
   - «navegador» (por defecto donde existe, Chrome y Edge): el
     reconocimiento de voz del propio navegador. Entiende mucho mejor el
     español, muestra lo que va oyendo mientras hablas y no descarga nada,
     pero el audio lo procesa el servicio del navegador (Google/Microsoft).
   - «whisper»: todo en este equipo con Transformers.js de Hugging Face:
   - Micrófono con detección de voz propia: graba solo mientras alguien
     habla (con un poco antes y hasta 0,7 s de silencio después).
   - Whisper (onnx-community/whisper-base) pasa lo que escuchó a texto, en
     español. Con WebGPU usa la tarjeta gráfica; sin ella, WebAssembly.
   - Un modelo de frases multilingüe (paraphrase-multilingual-MiniLM-L12-v2)
     convierte textos en vectores para entender lo que se dijo aunque se
     diga de otra forma (atiende.js compara con frases de ejemplo).
   Nada se envía a un servidor: los modelos se descargan una vez del Hub de
   Hugging Face, quedan en la caché del navegador y corren aquí.
   Para probar sin descargar: ?oido=simulado (Mimo.oir("texto") hace de voz).
   ===================================================================== */
import * as descargas from './descargas.js?v=__BUILD__';
const Q = new URLSearchParams(location.search);
export const TF = Q.get('tf') || 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6/dist/transformers.min.js';
// Con tarjeta gráfica, Whisper small (entiende bastante mejor); sin ella, base (más liviano)
const MODELO_VOZ = Q.get('whisper');
const MODELO_SENTIDO = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
export const SIMULADO = Q.get('oido') === 'simulado';

const Reconocedor = window.SpeechRecognition || window.webkitSpeechRecognition;
export const HAY_NAVEGADOR = !!Reconocedor;
let modo = HAY_NAVEGADOR ? 'navegador' : 'whisper';
export function setModo(m) { modo = m === 'navegador' && HAY_NAVEGADOR ? 'navegador' : 'whisper'; }
export function getModo() { return modo; }

let tf = null, asr = null, emb = null, dispositivo = 'wasm', modeloVoz = '';
export function info() { return { modo, dispositivo, modeloVoz, voz: !!asr || modo === 'navegador', sentido: !!emb, simulado: SIMULADO }; }

/* cargar(alAvance, { sentido }): con «whisper», Whisper primero (sin él no hay
   oído). El modelo de frases (solo si no hay conversación libre) va después,
   sin bloquear: si falla, atiende.js entiende con palabras clave.
   Cada modelo muestra su descarga en la tarjeta de descargas.js. */
export async function cargar(alAvance = () => {}, { sentido = true } = {}) {
  if (SIMULADO) { alAvance(100); return; }
  if (modo === 'whisper') descargas.empezar('voz', 'Oído', 'Whisper: de voz a texto en español');
  if (sentido) descargas.empezar('sentido', 'Sentido', 'MiniLM multilingüe: entiende lo que se dijo');
  if (modo === 'whisper' || sentido) {
    try { tf = await import(TF); }
    catch (e) { descargas.fallo('voz', 'No se pudo bajar Transformers.js'); descargas.fallo('sentido', 'No se pudo bajar Transformers.js'); throw e; }
    tf.env.allowLocalModels = false;
  }
  const progreso = (id, alPorcentaje) => (p) => {
    if (p.status !== 'progress' || !p.total) return;
    descargas.avance(id, p.file, p.loaded, p.total);
    if (alPorcentaje) alPorcentaje(descargas.porcentaje(id));
  };
  if (modo === 'whisper') {
    const gpu = navigator.gpu && await navigator.gpu.requestAdapter().catch(() => null);
    dispositivo = gpu ? 'webgpu' : 'wasm';
    modeloVoz = MODELO_VOZ || (gpu ? 'onnx-community/whisper-small' : 'onnx-community/whisper-base');
    const donde = gpu ? 'en la tarjeta gráfica (WebGPU)' : 'en WebAssembly';
    try {
      asr = await tf.pipeline('automatic-speech-recognition', modeloVoz, {
        device: dispositivo,
        dtype: gpu ? { encoder_model: gpu.features.has('shader-f16') ? 'fp16' : 'fp32', decoder_model_merged: 'q4' } : 'q8',
        progress_callback: progreso('voz', alAvance)
      });
    } catch (e) { descargas.fallo('voz', 'Revisa la conexión con huggingface.co'); descargas.fallo('sentido', 'Espera al oído'); throw e; }
    descargas.listo('voz', modeloVoz.split('/').pop() + ' · ' + donde);
  }
  if (sentido) tf.pipeline('feature-extraction', MODELO_SENTIDO, { device: 'wasm', dtype: 'q8', progress_callback: progreso('sentido') })
    .then(p => { emb = p; descargas.listo('sentido', 'MiniLM multilingüe · en WebAssembly'); document.dispatchEvent(new CustomEvent('oido:sentido')); })
    .catch(e => { descargas.fallo('sentido', 'Uku entiende solo con palabras clave'); console.warn('Uku: sin modelo de frases, entiende con palabras clave', e); });
}

// Audio (16 kHz, mono) → texto en español
export async function transcribir(audio) {
  if (!asr) return '';
  const r = await asr(audio, { language: 'spanish', task: 'transcribe' });
  return (r && r.text || '').trim();
}
// Textos → vectores normalizados (para comparar sentidos con el coseno)
export async function vectores(textos) {
  if (!emb) return null;
  const out = await emb(textos, { pooling: 'mean', normalize: true });
  return out.tolist();
}

/* ---------- Escuchar ----------
   escuchar({ alTexto(texto), alParcial(texto), alPensando(), alNivel(0..1), callado() }):
   alTexto recibe cada frase dicha ya en texto; alParcial, lo que va oyendo
   (solo con el navegador). callado() devuelve true mientras Uku habla (para
   no escucharse a sí mismo) o el panel está abierto. */
export async function escuchar(o) {
  if (modo === 'navegador') return escucharNavegador(o);
  return escucharWhisper(Object.assign({}, o, {
    alOir: async (audio) => { (o.alPensando || (() => {}))(); o.alTexto(await transcribir(audio).catch(() => '')); }
  }));
}

/* Reconocimiento del navegador: continuo, con resultados parciales. Se pausa
   mientras Uku habla y se reinicia solo cuando el navegador lo corta. */
let rec = null, vigia = 0;
function escucharNavegador({ alTexto, alParcial = () => {}, alNivel = () => {}, callado = () => false, alError = () => {} }) {
  return new Promise((listo, fallo) => {
    rec = new Reconocedor();
    rec.lang = Q.get('idioma') || 'es-EC'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    let activo = false, quiero = true, empezo = false;
    rec.onstart = () => { activo = true; if (!empezo) { empezo = true; listo(); } };
    rec.onend = () => { activo = false; alNivel(0); };
    rec.onsoundstart = () => alNivel(.7);
    rec.onsoundend = () => alNivel(0);
    rec.onresult = (e) => {
      let parcial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) alTexto(r[0].transcript.trim()); else parcial += r[0].transcript;
      }
      if (parcial.trim()) alParcial(parcial.trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        quiero = false; clearInterval(vigia);
        const err = new Error(e.error === 'not-allowed' ? 'NotAllowed' : 'sin-servicio');
        if (!empezo) fallo(err); else alError(err);
      } else if (e.error === 'network') alError(new Error('sin-red'));
    };
    vigia = setInterval(() => {
      const c = callado();
      if (c && activo) rec.abort();
      else if (!c && !activo && quiero) { try { rec.start(); } catch (x) {} }
    }, 250);
    try { rec.start(); } catch (x) {}
    stream = true;
  });
}

let ctx = null, stream = null, nodo = null;
async function escucharWhisper({ alOir, alNivel = () => {}, callado = () => false }) {
  stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  ctx = new AudioContext({ sampleRate: 16000 });
  const fuente = ctx.createMediaStreamSource(stream);
  nodo = ctx.createScriptProcessor(2048, 1, 1); // 128 ms por bloque a 16 kHz
  const BLOQUE = 2048 / 16000, PREVIO = 3, SILENCIO = .7, MIN = .45, MAX = 12;
  let ruido = .01, hablando = false, partes = [], previos = [], silencio = 0;
  nodo.onaudioprocess = (e) => {
    const d = e.inputBuffer.getChannelData(0);
    let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
    const rms = Math.sqrt(s / d.length), umbral = Math.max(.012, ruido * 3);
    alNivel(Math.min(1, rms / (umbral * 2)));
    if (callado()) { hablando = false; partes = []; previos = []; return; }
    const copia = new Float32Array(d);
    if (!hablando) {
      ruido = ruido * .95 + rms * .05; // el piso de ruido se ajusta solo cuando nadie habla
      previos.push(copia); if (previos.length > PREVIO) previos.shift();
      if (rms > umbral) { hablando = true; partes = previos.slice(); previos = []; silencio = 0; }
      return;
    }
    partes.push(copia);
    silencio = rms > umbral * .7 ? 0 : silencio + BLOQUE;
    const dura = partes.length * BLOQUE;
    if (silencio >= SILENCIO || dura >= MAX) {
      hablando = false;
      const audio = new Float32Array(partes.reduce((n, p) => n + p.length, 0));
      let o = 0; partes.forEach(p => { audio.set(p, o); o += p.length; });
      partes = [];
      if (dura - silencio >= MIN) alOir(audio);
    }
  };
  fuente.connect(nodo); nodo.connect(ctx.destination);
}
export function dejarDeEscuchar() {
  clearInterval(vigia);
  if (rec) { rec.onend = null; try { rec.abort(); } catch (x) {} rec = null; }
  if (nodo) nodo.disconnect();
  if (stream && stream.getTracks) stream.getTracks().forEach(t => t.stop());
  if (ctx) ctx.close().catch(() => {});
  ctx = stream = nodo = null;
}
export function escuchando() { return !!stream; }
