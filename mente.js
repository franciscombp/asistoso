/* =====================================================================
   Uku · mente (conversación libre con un modelo de lenguaje en el navegador)
   Qwen3 (onnx-community) con Transformers.js sobre WebGPU: conversa de
   lo que sea, con lo que Uku sabe en el mensaje de sistema (dónde está
   Fran, con quién habla y, solo con Fran, quién vino). Responde corto
   porque se lee en voz alta. Sin WebGPU no se carga: Uku vuelve a sus
   respuestas de siempre (atiende.js).
   ?llm=onnx-community/Qwen3-0.6B-ONNX elige otro modelo; ?mente=simulada
   responde un eco para probar sin descargar.
   Cerebro en la nube: con ?cerebro=https://uku-cerebro.<cuenta>.workers.dev
   (se recuerda en este navegador; ?cerebro= vacío lo olvida) o con
   CEREBRO_DEFECTO, Uku conversa con el Worker de cerebro/worker.js
   (Groq gratis, Gemini o Claude; la clave queda en el Worker) y no hace
   falta descargar nada ni tener tarjeta gráfica. Si la nube falla, sigue
   con el modelo local si está, o con sus frases.
   ===================================================================== */
import * as descargas from './descargas.js?v=__BUILD__';
import { TF } from './oido.js?v=__BUILD__';

const Q = new URLSearchParams(location.search);
// El primero que cargue: el de 1,7B conversa mejor; el de 0,6B baja la mitad
const MODELOS = Q.get('llm') ? [Q.get('llm')] : ['onnx-community/Qwen3-1.7B-ONNX', 'onnx-community/Qwen3-0.6B-ONNX'];
export const SIMULADA = Q.get('mente') === 'simulada';
/* Cerebro en la nube: el Worker uku-cerebro (cerebro/worker.js).
   localStorage 'uku-cerebro-url' cambia la dirección ('off' lo apaga); ?cerebro=URL la guarda (?cerebro= vacío la borra).
   Al cargar se le pregunta si está listo (GET → { listo }): sin key o sin red, Uku sigue con el modelo local o sus frases. */
const CEREBRO_DEFECTO = 'https://uku-cerebro.francisco-a86.workers.dev/';
const KC = 'uku-cerebro-url';
let CEREBRO = CEREBRO_DEFECTO, nube = { lista: false, modelo: '', error: '' };
try {
  if (Q.has('cerebro')) { const u = Q.get('cerebro').trim(); if (u) localStorage.setItem(KC, u); else localStorage.removeItem(KC); }
  CEREBRO = localStorage.getItem(KC) || CEREBRO_DEFECTO;
} catch (e) {}
if (CEREBRO === 'off') CEREBRO = '';
export function cerebro() { return CEREBRO; }
export function setCerebro(url) { CEREBRO = (url || '').trim(); try { if (CEREBRO) localStorage.setItem(KC, CEREBRO); else localStorage.removeItem(KC); } catch (e) {} if (CEREBRO === 'off') CEREBRO = ''; return comprobar(); }
export function comprobar() {
  nube = { lista: false, modelo: '', error: '' };
  if (!CEREBRO) return Promise.resolve(nube);
  const ctl = new AbortController(), tope = setTimeout(() => ctl.abort(), 6000);
  return fetch(CEREBRO, { signal: ctl.signal }).then(r => r.json()).then(j => { nube = { lista: !!j.listo, modelo: j.modelo || '', error: j.error || '' }; })
    .catch(e => { nube.error = String(e.message || e); }).finally(() => { clearTimeout(tope); document.dispatchEvent(new CustomEvent('mimo:cerebro', { detail: nube })); return nube; });
}
export function estadoNube() { return nube; }
comprobar();

let tf = null, tok = null, modelo = null, nombre = '', cargando = null, ocupada = false;
export function lista() { return SIMULADA || nube.lista || !!modelo; }
export function info() { return { modelo: nube.lista ? nube.modelo + ' (nube)' : nombre, lista: lista(), simulada: SIMULADA, cerebro: CEREBRO, nube }; }
export async function hayGPU() { return !!(navigator.gpu && await navigator.gpu.requestAdapter().catch(() => null)); }

export function cargar() {
  if (SIMULADA) return Promise.resolve();
  if (!cargando) cargando = (async () => {
    descargas.empezar('mente', 'Conversación', 'Qwen3: un modelo de lenguaje que conversa');
    const gpu = navigator.gpu && await navigator.gpu.requestAdapter().catch(() => null);
    if (!gpu) { descargas.fallo('mente', 'Necesita WebGPU (Chrome o Edge con tarjeta gráfica)'); throw new Error('sin-webgpu'); }
    const dtype = gpu.features.has('shader-f16') ? 'q4f16' : 'q4';
    tf = await import(TF);
    tf.env.allowLocalModels = false;
    const progreso = (p) => { if (p.status === 'progress' && p.total) descargas.avance('mente', p.file, p.loaded, p.total); };
    let error = null;
    for (const id of MODELOS) {
      try {
        tok = await tf.AutoTokenizer.from_pretrained(id, { progress_callback: progreso });
        modelo = await tf.AutoModelForCausalLM.from_pretrained(id, { dtype, device: 'webgpu', progress_callback: progreso });
        nombre = id.split('/').pop().replace('-ONNX', '');
        break;
      } catch (e) { error = e; tok = modelo = null; console.warn('Uku: no cargó', id, e); }
    }
    if (!modelo) { descargas.fallo('mente', 'Revisa la conexión con huggingface.co'); throw error; }
    // Un primer paso en vacío compila los shaders: la primera respuesta real ya sale rápida
    descargas.detalle('mente', nombre + ' · preparando la tarjeta gráfica…');
    await modelo.generate({ ...tok('a'), max_new_tokens: 1 }).catch(() => {});
    descargas.listo('mente', nombre + ' · en la tarjeta gráfica (WebGPU)');
  })().catch(e => { cargando = null; throw e; });
  return cargando;
}

/* responder(mensajes, alParcial): mensajes [{ role: system|user|assistant, content }].
   alParcial(texto) recibe la respuesta mientras se escribe. Devuelve el texto final. */
let vistos = null; // lo último que se le pasó al modelo (para revisar el contexto desde la consola)
export function ultimosMensajes() { return vistos; }
export async function responder(mensajes, alParcial = () => {}) {
  vistos = mensajes;
  if (SIMULADA) { // eco palabra por palabra, con un respiro antes (para ver los puntos y el texto en vivo)
    const t = 'Te escuché: ' + mensajes[mensajes.length - 1].content;
    await new Promise(r => setTimeout(r, 600));
    const ps = t.split(' ');
    for (let i = 1; i <= ps.length; i++) { alParcial(ps.slice(0, i).join(' ')); await new Promise(r => setTimeout(r, 60)); }
    return t;
  }
  if (ocupada) return null;
  if (CEREBRO && nube.lista && cuotaLibre()) {
    ocupada = true;
    try { anotarUso(); const t = await pedirNube(recortar(mensajes), alParcial); if (t) return t; }
    catch (e) { console.warn('Uku: el cerebro en la nube falló', e); }
    finally { ocupada = false; }
    if (!modelo) return null; // sin modelo local, Uku responde con sus frases
  }
  if (!modelo || !cuotaLibre()) return null;
  ocupada = true;
  try {
    const entrada = tok.apply_chat_template(mensajes, { add_generation_prompt: true, return_dict: true, enable_thinking: false });
    let texto = '';
    // Corta apenas tiene dos frases: Uku responde corto y no hace esperar
    const parar = new tf.InterruptableStoppingCriteria();
    const streamer = new tf.TextStreamer(tok, {
      skip_prompt: true, skip_special_tokens: true,
      callback_function: (t) => {
        texto += t;
        const l = limpiar(texto);
        if (l) alParcial(l);
        if ((l.match(/[.!?…](\s|$)/g) || []).length >= 2 && /[.!?…]\s*$/.test(l)) parar.interrupt();
      }
    });
    await modelo.generate({ ...entrada, max_new_tokens: 72, do_sample: true, temperature: .75, top_p: .9, repetition_penalty: 1.1, streamer, stopping_criteria: parar });
    return limpiar(texto);
  } finally { ocupada = false; }
}
// Sin el bloque de pensamiento de Qwen3 ni formato que no se puede decir en voz alta
function limpiar(t) {
  return t.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').replace(/[*_#`]/g, '').replace(/\s+/g, ' ').trim();
}
/* El Worker devuelve texto plano por trozos: se va mostrando en el globo mientras llega. 15 s de tope. */
/* Cuotas para no quemar tokens si alguien se pone a jugar: por navegador, respuestas del modelo al día y en
   pocos minutos. Pasado el tope, Uku responde con sus frases (atiende.js). Las del Worker son otra capa. */
// Interruptor: false = sin cuotas (uso libre). Para volver a limitar, poner true (también se puede con ?cuotas=on en la dirección).
const CUOTAS_ACTIVAS = new URLSearchParams(location.search).get('cuotas') === 'on';
const CUOTA = { dia: 300, rafaga: 25, ventanaMs: 10 * 60 * 1000 }, KQ = 'mimo_ia_cuota';
function cuota() { try { const c = JSON.parse(localStorage.getItem(KQ) || 'null'); if (c && Array.isArray(c.usos)) return c; } catch (e) {} return { dia: '', usos: [] }; }
export function cuotaLibre() {
  if (!CUOTAS_ACTIVAS) return true;
  const ahora = Date.now(), hoy = new Date().toDateString(), c = cuota();
  const usos = c.dia === hoy ? c.usos : [];
  const ultimos = usos.filter(t => ahora - t < CUOTA.ventanaMs);
  return usos.length < CUOTA.dia && ultimos.length < CUOTA.rafaga;
}
function anotarUso() { const ahora = Date.now(), hoy = new Date().toDateString(), c = cuota(); const usos = (c.dia === hoy ? c.usos : []).concat(ahora).slice(-CUOTA.dia); try { localStorage.setItem(KQ, JSON.stringify({ dia: hoy, usos })); } catch (e) {} }
// Lo que va al modelo: las últimas pocas frases y cada una corta (el modelo responde en dos frases de todos modos)
function recortar(mensajes) {
  const sis = mensajes.find(m => m.role === 'system'), resto = mensajes.filter(m => m.role !== 'system').slice(-8);
  return (sis ? [{ role: 'system', content: sis.content.slice(0, 2500) }] : []).concat(resto.map(m => ({ role: m.role, content: String(m.content).slice(0, 400) })));
}
async function pedirNube(mensajes, alParcial) {
  const ctl = new AbortController(), tope = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(CEREBRO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensajes }), signal: ctl.signal });
    if (!r.ok) throw new Error('cerebro ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 120));
    const rd = r.body.getReader(), dec = new TextDecoder();
    let texto = '';
    for (;;) { const { value, done } = await rd.read(); if (done) break; texto += dec.decode(value, { stream: true }); const l = limpiar(texto); if (l) alParcial(l); }
    return limpiar(texto);
  } finally { clearTimeout(tope); }
}
