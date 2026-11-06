/* =====================================================================
   Uku · puente con la app nativa de Mac
   Dentro de la app (WKWebView) existe window.webkit.messageHandlers.uku:
   entonces el cerebro (Apple Intelligence + Groq), el oído (SpeechAnalyzer),
   la voz (AVSpeechSynthesizer) y la pantalla despierta los hace Swift.
   En un navegador normal no hay puente y todo sigue como siempre.
   - UkuNativo.pedir(tipo, datos) → Promise con la respuesta de Swift.
   - UkuNativo.on(evento, fn): lo que Swift avisa por su cuenta
     ('cerebro.parcial', 'oido', 'voz', 'tecla').
   ===================================================================== */
(function () {
  const h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.uku;
  if (!h) return;
  const oyentes = {};
  window.UkuNativo = {
    pedir(tipo, datos) { return h.postMessage({ tipo, datos: datos || {} }); },
    on(evento, fn) { (oyentes[evento] = oyentes[evento] || []).push(fn); },
    // Swift llama esto con evaluateJavaScript
    _evento(evento, datos) { (oyentes[evento] || []).forEach(fn => { try { fn(datos); } catch (e) { console.error(e); } }); }
  };
  document.documentElement.classList.add('nativo');
  // Los errores de la web aparecen en la consola de Xcode
  const log = (t) => h.postMessage({ tipo: 'log', datos: { texto: String(t).slice(0, 600) } }).catch(() => {});
  addEventListener('error', (e) => log('JS: ' + e.message + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')'));
  addEventListener('unhandledrejection', (e) => log('JS (promesa): ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));

  /* ---------- La UI nativa (SwiftUI) ----------
     Swift dibuja el inicio, la barra y «Quién vino»; la web solo el mundo, el globo y el reloj.
     UkuUI.datos() es la foto de lo que muestran las vistas nativas; cuando algo cambia, se avisa 'ui.cambio'
     (Swift vuelve a pedir la foto). Las acciones las hace Swift llamando a window.Mimo. */
  const $ = (s) => document.querySelector(s);
  const presionado = (s) => { const b = $(s); return !!b && b.getAttribute('aria-pressed') === 'true'; };
  let tCambio = 0;
  const cambio = () => { clearTimeout(tCambio); tCambio = setTimeout(() => window.UkuNativo.pedir('ui.cambio').catch(() => {}), 120); };
  window.UkuUI = {
    datos() {
      const M = window.Mimo;
      if (!M) return JSON.stringify({ listo: false });
      const d = M.caras.dueno(), dueno = d ? d.nombre : 'Fran', E = M.atiende.ESTADOS, e = M.atiende.estado();
      const previa = (E[e.tipo] || E.bano).donde.replace(/\{dueno\}/g, dueno).replace('{texto}', e.texto || dueno + ' no está ahora.') + (e.vuelve ? ' Vuelve ' + e.vuelve + '.' : '');
      const opt = (id) => !!($('#' + id) && $('#' + id).checked);
      return JSON.stringify({
        listo: true,
        empezado: document.body.classList.contains('empezado'),
        inicio: !!$('#inicio') && !$('#inicio').classList.contains('is-oculto'),
        opciones: { voz: opt('opt-voz'), hud: opt('opt-hud'), demo: opt('opt-demo'), despierto: opt('opt-despierto'), mic: opt('opt-mic'), llamada: opt('opt-llamada') },
        nube: ($('#nube-estado') || {}).textContent || '',
        estado: { texto: ($('#estado') || {}).textContent || '', tipo: ($('#estado') || { dataset: {} }).dataset.tipo || '' },
        oido: { visible: !!$('#mic') && !$('#mic').hidden, texto: ($('#mic') || {}).textContent || '' },
        modo: M.modo, voz: M.voz.vozActiva(), mic: presionado('#btn-mic'), despierto: M.despierto.activo(),
        hud: !document.body.classList.contains('solo-uku'),
        camara: { control: presionado('#btn-control'), espejo: presionado('#btn-espejo'), pajaro: presionado('#btn-pajaro'), decorar: presionado('#btn-decorar') },
        pendientes: +(($('#btn-visitas .mimo-visitas__n') || {}).textContent || 0) || 0,
        dueno,
        visitas: M.visitas.lista(),
        mensajes: M.atiende.mensajes(),
        fran: { tipo: e.tipo, texto: e.texto || '', vuelve: e.vuelve || '', previa, opciones: Object.entries(E).map(([k, x]) => ({ k, t: x.t })) },
        memoria: { relacion: M.memoria.relacion(), diario: M.memoria.diario().slice(0, 40), hechos: M.memoria.hechos('dueno').slice().reverse() },
        tareas: { recordatorios: M.tareas.recordatorios(), postits: M.tareas.postits() }
      });
    },
    // El panel nativo se abrió o se cerró (mientras está abierto Uku no escucha, como con el panel web)
    panel(abierto) { panelNativo = !!abierto; if (!abierto && window.Mimo) { window.Mimo.visitas.marcarVistas(); window.Mimo.atiende.marcarMensajesVistos(); } cambio(); }
  };
  let panelNativo = false;
  window.UkuUI.panelAbierto = () => panelNativo;

  ['mimo:visitas', 'mimo:personas', 'mimo:mensajes', 'mimo:memoria', 'mimo:estado', 'mimo:despierto', 'mimo:cerebro', 'mimo:tareas']
    .forEach(ev => document.addEventListener(ev, cambio));
  document.addEventListener('DOMContentLoaded', () => {
    const obs = new MutationObserver(cambio);
    ['#estado', '#mic', '#modo', '#btn-mic', '#btn-visitas', '#inicio', '#nube-estado', '#btn-control', '#btn-espejo', '#btn-pajaro', '#btn-decorar']
      .forEach(s => { const el = $(s); if (el) obs.observe(el, { attributes: true, childList: true, characterData: true, subtree: true }); });
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    document.querySelectorAll('#inicio input').forEach(i => i.addEventListener('change', cambio));
    cambio();
  });
})();
