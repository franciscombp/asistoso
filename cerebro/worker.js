/* Uku, el asistente de Fran · cerebro: un Worker de Cloudflare entre la página y Groq (LEEME.md › Cerebro en la nube).
   La key vive como secreto del Worker (GROQ_API_KEY): nunca llega al navegador ni al repo.

   GET  /         → { listo, proveedor, modelo }: si la key está puesta y qué modelo usa
   GET  /modelos  → los modelos de chat que ofrece Groq con esa key
   POST /         { mensajes: [{ role: system|user|assistant, content }] } → texto plano por trozos (streaming)

   Variables: GROQ_API_KEY (secreto), GROQ_MODEL (opcional: si no está, elige uno de los que ofrece Groq), ORIGENES (opcional:
   quién puede llamarlo, separados por coma). Para pasar a Claude: PROVEEDOR = anthropic y el secreto ANTHROPIC_API_KEY
   (opcional ANTHROPIC_MODEL; por defecto claude-haiku-5-5). El prompt (quién es Uku, dónde está Fran, con quién habla) lo arma
   la página (atiende.js › sistema) y viene como primer mensaje. */

const GROQ = 'https://api.groq.com/openai/v1';
const ORIGENES = 'https://franciscombp.github.io,http://localhost:8765,http://127.0.0.1:8765';
// Topes amplios, para uso libre y sin abuso: contexto corto, respuestas breves y cupo diario por IP y en total (por instancia)
const MAX_MENSAJES = 10, MAX_LARGO = 500, MAX_SISTEMA = 6000, MAX_TOKENS = 160, POR_MINUTO = 20, POR_DIA_IP = 400, POR_DIA_TOTAL = 3000;
// Interruptor de cuotas: por defecto apagado (uso libre). Para limitar: variable LIMITES = on en el Worker (Settings › Variables).
// Cambiarla no requiere volver a subir el código.
const cuotasOn = (env) => String(env.LIMITES || '').toLowerCase() === 'on';
const dia = () => new Date().toISOString().slice(0, 10);
const cupoDia = { dia: dia(), total: 0, ip: new Map() };
function cupoDeHoy(ip) {
  if (cupoDia.dia !== dia()) { cupoDia.dia = dia(); cupoDia.total = 0; cupoDia.ip = new Map(); }
  const n = (cupoDia.ip.get(ip) || 0) + 1; cupoDia.ip.set(ip, n); cupoDia.total++;
  if (cupoDia.ip.size > 5000) cupoDia.ip.clear();
  return n <= POR_DIA_IP && cupoDia.total <= POR_DIA_TOTAL;
}

// Un límite sencillo por IP, mientras dura la instancia: alcanza para una prueba de concepto
const visitas = new Map();
function demasiadas(ip) {
  const ahora = Date.now(), v = (visitas.get(ip) || []).filter((t) => ahora - t < 60000);
  v.push(ahora); visitas.set(ip, v);
  if (visitas.size > 5000) visitas.clear();
  return v.length > POR_MINUTO;
}
function cors(req, env) {
  const o = req.headers.get('Origin') || '', ok = (env.ORIGENES || ORIGENES).split(',').map((s) => s.trim());
  return { permitido: ok.includes(o), h: { 'Access-Control-Allow-Origin': ok.includes(o) ? o : ok[0], 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } };
}
function json(obj, status, h) { return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, h) }); }
const proveedor = (env) => (env.PROVEEDOR || 'groq').toLowerCase();
const clave = (env) => proveedor(env) === 'anthropic' ? env.ANTHROPIC_API_KEY : env.GROQ_API_KEY;

async function groq(env, ruta, cuerpo) {
  const r = await fetch(GROQ + ruta, { method: cuerpo ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + env.GROQ_API_KEY, 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw Object.assign(new Error((d.error && d.error.message) || 'Groq respondió ' + r.status), { status: r.status }); }
  return r;
}
// Los modelos de chat (sin voz, transcripción ni moderación), del de más contexto y más grande al más chico
const NO_CHAT = /whisper|tts|playai|orpheus|guard|safeguard|distil|compound/i;
async function modelos(env) {
  const d = await (await groq(env, '/models')).json();
  const tam = (id) => { const m = String(id).match(/(\d+)b\b/i); return m ? +m[1] : 0; };
  return (d.data || []).filter((m) => m.active !== false && !NO_CHAT.test(m.id))
    .sort((a, b) => (b.context_window || 0) - (a.context_window || 0) || tam(b.id) - tam(a.id))
    .map((m) => ({ id: m.id, de: m.owned_by, contexto: m.context_window }));
}
let elegido = null;
async function modelo(env) {
  if (proveedor(env) === 'anthropic') return env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
  if (env.GROQ_MODEL) return env.GROQ_MODEL;
  if (!elegido) { const l = await modelos(env); if (!l.length) throw new Error('Groq no ofrece modelos de chat con esta key'); elegido = l[0].id; }
  return elegido;
}
// Solo roles válidos, textos acotados y un único mensaje de sistema al principio
function limpiar(ms) {
  if (!Array.isArray(ms) || !ms.length) return null;
  const out = [];
  for (const m of ms.slice(-MAX_MENSAJES)) {
    if (!m || typeof m.content !== 'string' || !['system', 'user', 'assistant'].includes(m.role)) continue;
    if (m.role === 'system') { if (out.length) continue; out.push({ role: 'system', content: m.content.slice(0, MAX_SISTEMA) }); }
    else out.push({ role: m.role, content: m.content.slice(0, MAX_LARGO) });
  }
  return out.some((m) => m.role === 'user') ? out : null;
}
// Lee un flujo SSE ("data: {...}") y deja pasar solo el texto que saca `texto(json)`
function sse(cuerpo, texto) {
  const dec = new TextDecoder(), enc = new TextEncoder();
  let resto = '';
  return cuerpo.pipeThrough(new TransformStream({
    transform(chunk, ctl) {
      resto += dec.decode(chunk, { stream: true });
      const lineas = resto.split('\n'); resto = lineas.pop();
      for (const l of lineas) {
        if (!l.startsWith('data:')) continue;
        const d = l.slice(5).trim();
        if (!d || d === '[DONE]') continue;
        const t = texto(d); if (t) ctl.enqueue(enc.encode(t));
      }
    }
  }));
}
async function conGroq(env, mensajes, id) {
  const r = await groq(env, '/chat/completions', { model: id, messages: mensajes, max_tokens: MAX_TOKENS, temperature: .8, stream: true });
  return sse(r.body, (ev) => { try { const j = JSON.parse(ev); return (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content) || ''; } catch (e) { return ''; } });
}
// Claude: API de mensajes (el sistema va aparte), en streaming
async function conClaude(env, mensajes, id) {
  const sistema = mensajes.filter((m) => m.role === 'system').map((m) => m.content).join('\n'), resto = mensajes.filter((m) => m.role !== 'system');
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: id, max_tokens: MAX_TOKENS, system: sistema, messages: resto, output_config: { effort: 'low' }, stream: true }) });
  if (!r.ok) throw Object.assign(new Error('Claude respondió ' + r.status + ': ' + (await r.text()).slice(0, 200)), { status: r.status });
  return sse(r.body, (ev) => { try { const j = JSON.parse(ev); return j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta' ? j.delta.text : ''; } catch (e) { return ''; } });
}

export default {
  async fetch(req, env) {
    const c = cors(req, env), url = new URL(req.url), p = proveedor(env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: c.h });
    if (!clave(env)) return json({ listo: false, proveedor: p, error: 'Falta el secreto ' + (p === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GROQ_API_KEY') + ' en el Worker' }, 503, c.h);
    try {
      if (req.method === 'GET' && url.pathname === '/modelos') return json({ modelos: p === 'anthropic' ? [{ id: await modelo(env), de: 'anthropic' }] : await modelos(env) }, 200, c.h);
      if (req.method === 'GET') return json({ listo: true, proveedor: p, modelo: await modelo(env) }, 200, c.h);
      if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, c.h);
      // Solo la POC (y localhost) conversa; desde otro origen, nada
      if (!c.permitido) return json({ error: 'Origen no permitido' }, 403, c.h);
      const ip = req.headers.get('CF-Connecting-IP') || 'x';
      if (cuotasOn(env)) {
        if (demasiadas(ip)) return json({ error: 'Demasiadas preguntas seguidas' }, 429, c.h);
        if (!cupoDeHoy(ip)) return json({ error: 'Cupo de hoy agotado' }, 429, c.h);
      }
      const b = await req.json().catch(() => ({}));
      const mensajes = limpiar(b.mensajes);
      if (!mensajes) return json({ error: 'Faltan los mensajes' }, 400, c.h);
      const id = await modelo(env);
      const flujo = p === 'anthropic' ? await conClaude(env, mensajes, id) : await conGroq(env, mensajes, id);
      return new Response(flujo, { headers: Object.assign({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Modelo': id }, c.h) });
    } catch (e) {
      if (e.status === 404 || e.status === 400) elegido = null; // el modelo elegido ya no está: se vuelve a elegir
      return json({ error: String(e.message || e) }, e.status === 429 ? 429 : 502, c.h);
    }
  }
};
