/* =====================================================================
   Uku · orquestador
   Uku es el asistente de Fran: cuando Fran deja su computadora, Uku vive en
   la pantalla y atiende a quien se acerque por la webcam.
   - Reconoce caras por su cuenta: a quien ya conoce lo saluda por su
     nombre; a quien no, lo anota como visitante (con una foto pequeña).
   - Cuando Fran vuelve, Uku le cuenta cuántas personas vinieron y abre el
     panel "Quién vino" (tecla P) para ponerles nombre.
   - Mientras tanto juega: reacciona a gestos de las manos con efectos y
     cambios de entorno, y a ratos comparte un consejo de oso.
   - Escucha con IA en el navegador (oido.js: Whisper con Transformers.js) y
     responde por Fran (atiende.js): dónde está, cuándo vuelve, y toma
     mensajes que luego le cuenta. Conversa libremente con un modelo de
     lenguaje en el navegador (mente.js) si el equipo tiene WebGPU. La descarga de cada modelo se ve en la
     tarjeta «La IA de Uku» (descargas.js, tecla A).
   - Como Tolan: Uku recuerda lo que Fran le cuenta (memoria.js), le pregunta
     después cómo le fue, escribe su diario al despedirse (P › Diario), lee
     el tono de cada frase (tono.js) y su claro crece con la relación.
   Atajos de teclado para quien opera la demo: tecla H.
   ===================================================================== */
import * as escena from './escena.js?v=__BUILD__';
import { iniciarVision } from './vision.js?v=__BUILD__';
import { crearGestos } from './gestos.js?v=__BUILD__';
import { crearEfectos } from './efectos.js?v=__BUILD__';
import * as caras from './caras.js?v=__BUILD__';
import * as visitas from './visitas.js?v=__BUILD__';
import { crearPanel } from './panel.js?v=__BUILD__';
import * as oido from './oido.js?v=__BUILD__';
import * as atiende from './atiende.js?v=__BUILD__';
import * as voz from './voz.js?v=__BUILD__';
import * as descargas from './descargas.js?v=__BUILD__';
import * as mente from './mente.js?v=__BUILD__';
import * as despierto from './despierto.js?v=__BUILD__';
import * as cartel from './cartel.js?v=__BUILD__';
import * as tiempo from './tiempo.js?v=__BUILD__';
import { crearSueno } from './sueno.js?v=__BUILD__';
import { crearEfectos3d } from './efectos3d.js?v=__BUILD__';
import { una } from './frases.js?v=__BUILD__';
import * as tareas from './tareas.js?v=__BUILD__';
import * as memoria from './memoria.js?v=__BUILD__';

const $ = (s) => document.querySelector(s);
const ui = {
  inicio: $('#inicio'), empezar: $('#empezar'), sinCamara: $('#sin-camara'), optVoz: $('#opt-voz'), optMic: $('#opt-mic'), optHud: $('#opt-hud'), optDemo: $('#opt-demo'), modo: $('#modo'), optDespierto: $('#opt-despierto'), despierto: $('#despierto'),
  escena: $('#escena'), efectos: $('#efectos'), globo: $('#globo'), globoT: $('#globo-t'),
  pistas: $('#pistas'), estado: $('#estado'), camara: $('#camara'), video: $('#video'), marcas: $('#marcas'),
  panel: $('#personas'), ayuda: $('#ayuda'), mic: $('#mic'), oido: $('#oido'), aviso: $('#btn-visitas'), avisoN: $('#btn-visitas .mimo-visitas__n')
};
/* Los efectos viven en el mundo 3D (efectos3d.js). Mientras la escena carga, o si no hay WebGL, se usa la capa 2D. */
const efectos2d = crearEfectos(ui.efectos);
let efectos3d = null;
const efectos = { lanzar: (t, o) => (efectos3d || efectos2d).lanzar(t, o), get activos() { return (efectos3d || efectos2d).activos; } };

/* ---------- Modo: guardián o demo ----------
   Guardián (por defecto): Uku atiende a los demás. Cuando quien está enfrente
   es Fran (su dueño), solo lo saluda, le cuenta quién vino y sigue en lo suyo:
   no reacciona a sus gestos, no le contesta ni le habla.
   Demo: Uku interactúa con cualquiera, también con Fran (para mostrar o probar). */
const MODO_KEY = 'mimo_modo';
let modo = (() => { const q = new URLSearchParams(location.search).get('modo'); if (q) return q === 'demo' ? 'demo' : 'guardian'; try { return localStorage.getItem(MODO_KEY) === 'demo' ? 'demo' : 'guardian'; } catch (e) { return 'guardian'; } })();
function setModo(m) {
  modo = m === 'demo' ? 'demo' : 'guardian';
  try { localStorage.setItem(MODO_KEY, modo); } catch (e) {}
  ui.modo.textContent = modo === 'demo' ? '🎉 Modo demo' : '🛡️ Modo guardián';
  ui.modo.setAttribute('aria-pressed', String(modo === 'demo'));
  ui.modo.title = modo === 'demo' ? 'Demo: Uku juega y conversa con todos, también contigo. Clic o tecla N para volver a guardián.'
    : 'Guardián: con Fran enfrente, Uku solo saluda y sigue en lo suyo. Clic o tecla N para el modo demo.';
  ui.optDemo.checked = modo === 'demo';
}
// Fran enfrente en modo guardián: Uku no interactúa
const callandoPorDueno = () => modo === 'guardian' && st.presente && !!(st.persona && st.persona.dueno);
const st = {
  vision: null, corriendo: false, presente: false, persona: null, visita: null, saludado: false, interactuo: false,
  tracks: [], nTrack: 0, saludados: new Set(), analizador: null, ultimaOida: -1e9, ultimoSolo: performance.now(), proxSolo: 35000, ultimaActividad: performance.now(), ultimoAtraer: 0, ultimaPista: 0, pistaN: 0, reconociendo: false, ultimoReconocer: 0,
  vacioDesde: performance.now(), eventos: [], ultimo: null, debug: new URLSearchParams(location.search).has('debug')
};

/* ---------- Globo de texto (encima de Uku, a su derecha) ---------- */
let globoTimer = 0;
function decir(texto, ms = 4200, { hablar = true } = {}) {
  if (!texto) return;
  ui.globo.classList.remove('is-pensando', 'is-escribiendo');
  ui.globoT.textContent = texto;
  ui.globo.classList.remove('is-visible'); void ui.globo.offsetWidth;
  ui.globo.classList.add('is-visible');
  clearTimeout(globoTimer);
  globoTimer = setTimeout(() => ui.globo.classList.remove('is-visible'), ms);
  if (hablar && voz.vozActiva()) voz.hablar(texto); else voz.mover(texto); // sin voz, mueve la boca al ritmo del globo
}
// Mientras escuchas o Uku piensa: el globo con tres puntos (desde cuándo, para no contestar de golpe)
let pensandoDesde = 0;
function pensar() {
  if (!ui.globo.classList.contains('is-pensando')) pensandoDesde = performance.now();
  if (!ui.globo.classList.contains('is-visible')) { ui.globo.classList.remove('is-visible'); void ui.globo.offsetWidth; }
  ui.globo.classList.remove('is-escribiendo');
  ui.globo.classList.add('is-visible', 'is-pensando');
  clearTimeout(globoTimer);
  globoTimer = setTimeout(() => ui.globo.classList.remove('is-visible', 'is-pensando'), 8000);
}
// Mientras el modelo escribe: el globo crece sin reiniciar la animación ni hablar
function decirEnVivo(texto) {
  ui.globoT.textContent = texto;
  ui.globo.classList.remove('is-pensando');
  ui.globo.classList.add('is-visible', 'is-escribiendo');
  clearTimeout(globoTimer);
  globoTimer = setTimeout(() => ui.globo.classList.remove('is-visible', 'is-escribiendo'), 15000);
}
function ubicarGlobo() {
  const p = escena.puntoCabeza();
  if (!p) return;
  // El foco del sueño sigue a Uku: nítido él, desenfocado lo que lo rodea (mimo.css › .mimo-sueno)
  const rs = document.documentElement.style;
  rs.setProperty('--ux', p.x.toFixed(0) + 'px'); rs.setProperty('--uy', (p.y + 120).toFixed(0) + 'px');
  const w = ui.globo.offsetWidth, h = ui.globo.offsetHeight, W = innerWidth;
  // A la derecha de la cabeza, con la colita a la altura de la boca; nunca bajo la barra de arriba
  const x = Math.max(24, Math.min(W - w - 24, p.x + 24)), y = Math.max(84, p.y - h * .55);
  ui.globo.style.transform = `translate(${x}px, ${y}px)`;
}

function estado(texto, tipo = '') { ui.estado.textContent = texto; ui.estado.dataset.tipo = tipo; }

// Frases con el nombre del dueño (el de quien marcó "Soy yo"; Fran si nadie lo hizo)
function dueno() { const d = caras.dueno(); return d ? d.nombre : 'Fran'; }
function frase(clave, datos) { return una(clave, Object.assign({ dueno: dueno() }, datos)); }
const conocido = () => st.persona && st.persona.nombre ? st.persona.nombre : null;

/* ---------- Reacciones ---------- */
const REACCION = {
  like: { efecto: 'like', gesto: 'happy', frase: 'like' },
  fuegos: { efecto: 'fuegos', gesto: 'happy', frase: 'fuegos', entorno: 'noche' },
  nomegusta: { efecto: 'nomegusta', gesto: 'nod', frase: 'nomegusta' },
  lluvia: { gesto: 'nod', frase: 'lluvia', entorno: 'lluvia' },
  globos: { efecto: 'globos', gesto: 'happy', frase: 'globos' },
  confeti: { efecto: 'confeti', gesto: 'happy', frase: 'confeti' },
  fiesta: { efecto: 'confeti', gesto: 'happy', frase: 'fiesta', entorno: 'fiesta' },
  ok: { efecto: 'ok', gesto: 'nod', frase: 'ok' },
  corazon: { efecto: 'corazon', gesto: 'happy', frase: 'corazon' },
  jardin: { efecto: 'jardin', gesto: 'happy', frase: 'jardin', entorno: 'jardin' },
  sol: { efecto: 'sol', gesto: 'happy', frase: 'sol', entorno: 'dia' },
  saludo: { gesto: 'wave' },
  tip: { gesto: 'nod' },
  gracias: { gesto: 'happy', frase: 'gracias' },
  chao: { gesto: 'wave' },
  quien: { gesto: 'wave', frase: 'quienSoy' },
  // De la forma de la mano, la cara y el cuerpo (gestos.js)
  dedo: { efecto: 'censura', gesto: 'happy', frase: 'dedo', fx: 'tiembla' },
  rock: { efecto: 'rock', gesto: 'happy', frase: 'rock', fx: 'cabeceo', entorno: 'fiesta' },
  shaka: { efecto: 'surf', gesto: 'happy', frase: 'shaka', entorno: 'atardecer' },
  poquito: { efecto: 'poquito', gesto: 'nod', frase: 'poquito' },
  tres: { efecto: 'tres', gesto: 'nod', frase: 'tres' },
  cuatro: { efecto: 'cuatro', gesto: 'nod', frase: 'cuatro' },
  choca: { efecto: 'choca', gesto: 'wave', frase: 'choca', fx: 'salto' },
  aplauso: { efecto: 'aplausos', gesto: 'happy', frase: 'aplauso', fx: 'salto' },
  // 🙏 suma un día al cartel de días sin accidentes; ❌ brazos cruzados = accidente: el cartel vuelve a cero
  rezo: { efecto: 'rezo', gesto: 'happy', frase: 'rezo', accion: 'cartelMas', fx: 'salto' },
  cruzados: { efecto: 'cruzados', gesto: 'worried', frase: 'cruzados', accion: 'cartelReset', fx: 'tiembla' },
  mano: { efecto: 'mano', gesto: 'wave', frase: 'mano' },
  lengua: { efecto: 'lengua', gesto: 'happy', frase: 'lengua', fx: 'salto' },
  beso: { efecto: 'beso', gesto: 'happy', frase: 'beso' },
  sorpresa: { efecto: 'sorpresa', gesto: 'worried', frase: 'sorpresa', fx: 'tiembla' },
  bostezo: { efecto: 'bostezo', gesto: 'nod', frase: 'bostezo' },
  guino: { efecto: 'guino', gesto: 'happy', frase: 'guino' },
  sonrisa: { efecto: 'sonrisa', gesto: 'happy', frase: 'sonrisa' },
  enojo: { efecto: 'enojo', gesto: 'worried', frase: 'enojo' },
  si: { efecto: 'si', gesto: 'nod', frase: 'si' },
  no: { efecto: 'no', gesto: 'nod', frase: 'no' },
  // Palabras y travesuras
  miel: { efecto: 'miel', gesto: 'happy', frase: 'miel' },
  estrellas: { efecto: 'estrellas', gesto: 'happy', frase: 'estrellas' },
  aplausos: { efecto: 'aplausos', gesto: 'happy', frase: 'aplauso', fx: 'salto' },
  musica: { efecto: 'musica', gesto: 'happy', frase: 'musica', fx: 'baile' },
  nieve: { efecto: 'nieve', gesto: 'worried', frase: 'nieve' },
  cumple: { efecto: 'cumple', gesto: 'happy', frase: 'cumple', entorno: 'fiesta', fx: 'salto' },
  baile: { efecto: 'musica', gesto: 'happy', frase: 'baile', entorno: 'fiesta', fx: 'baile' },
  cafe: { efecto: 'cafe', gesto: 'happy', frase: 'cafe' },
  abrazo: { efecto: 'abrazo', gesto: 'happy', frase: 'abrazo' },
  risa: { efecto: 'risa', gesto: 'happy', frase: 'risa', fx: 'salto' },
  sueno: { efecto: 'sueno', gesto: 'nod', frase: 'sueno', entorno: 'noche' }
};
// Las que se sacan al azar con la tecla Z (travesuras)
const TRAVESURAS = ['dedo', 'rock', 'shaka', 'poquito', 'choca', 'aplauso', 'lengua', 'beso', 'sorpresa', 'bostezo', 'guino', 'miel', 'estrellas', 'musica', 'nieve', 'cumple', 'baile', 'cafe', 'abrazo', 'risa', 'sueno', 'tres', 'cuatro'];

/* Movimiento de toda la escena (tiembla, salta, baila, cabecea): clases de mimo.css */
const FX_DURA = { tiembla: 900, salto: 800, baile: 2600, cabeceo: 1900 };
let fxTimer = 0;
function fx(nombre) {
  const c = ui.escena;
  Object.keys(FX_DURA).forEach(n => c.classList.remove('fx-' + n));
  void c.offsetWidth; c.classList.add('fx-' + nombre);
  clearTimeout(fxTimer); fxTimer = setTimeout(() => c.classList.remove('fx-' + nombre), FX_DURA[nombre] || 1000);
}
let reaccionPendiente = null;
function reaccionar(tipo, pos = {}, { yaVino = false } = {}) {
  const r = REACCION[tipo];
  if (!r) return;
  st.ultimaActividad = performance.now(); st.interactuo = true;
  if (!yaVino && st.visita) visitas.seguir(st.visita, { gesto: true });
  if (!yaVino) {
    // Los efectos y el entorno responden al instante
    if (r.efecto) efectos.lanzar(r.efecto, pos);
    if (r.fx) fx(r.fx);
    if (r.entorno) escena.setEntorno(r.entorno);
    marcarPista(tipo);
    // Si Uku anda paseando, primero viene al centro y ahí contesta (gana la última reacción)
    if (!escena.enCasa()) {
      const ya = !!reaccionPendiente;
      reaccionPendiente = { tipo, pos };
      if (!ya) escena.venir(() => { const p = reaccionPendiente; reaccionPendiente = null; if (p) reaccionar(p.tipo, p.pos, { yaVino: true }); });
      return;
    }
  }
  // Mientras dura esta reacción no entra otra (el árbitro de arriba)
  ultimaReaccion = performance.now(); reaccionHasta = ultimaReaccion + 3500;
  // El cartel de días sin accidentes: Uku lo cambia y la frase cuenta cómo quedó
  const datos = { dias: cartel.dias(), record: cartel.record() };
  if (r.accion === 'cartelMas') { cartel.mas(); datos.dias = cartel.dias(); datos.record = cartel.record(); }
  else if (r.accion === 'cartelReset') { const x = cartel.accidente(); Object.assign(datos, { antes: x.antes, record: x.record, dias: 0 }); }
  if (r.gesto) escena.gesto(r.gesto);
  if (tipo === 'happy' || r.gesto === 'happy') { escena.ojos('happy'); }
  if (tipo === 'tip') decir(frase('tipIntro') + ' ' + frase('tip'), 7500);
  else if (tipo === 'saludo') decir(conocido() ? frase('saludoNombre', { nombre: conocido() }) : frase('saludo'));
  else if (tipo === 'chao') decir(conocido() ? frase('chaoNombre', { nombre: conocido() }) : frase('chao'));
  else if (r.frase) decir(frase(r.frase, datos));
}
function marcarPista(tipo) {
  const chip = ui.pistas.querySelector(`[data-g~="${tipo}"]`);
  if (!chip) return;
  chip.classList.remove('is-on'); void chip.offsetWidth; chip.classList.add('is-on');
}

/* ---------- Llega / se va ---------- */
let saludoTimer = 0;
function llega() {
  modoDueno(false);
  atiende.nuevaConversacion();
  st.presente = true; st.saludado = false; st.persona = null; st.visita = null; st.interactuo = false;
  st.tracks = []; st.saludados = new Set();
  st.ultimaActividad = performance.now(); st.ultimoReconocer = 0;
  estado('Te estoy viendo', 'ok');
  document.body.classList.add('hay-alguien');
  // Uku deja lo que estaba haciendo y viene a saludar; espera un momento a reconocer la cara
  clearTimeout(saludoTimer); clearTimeout(irseTimer);
  escena.venir(() => { saludoTimer = setTimeout(saludar, st.persona ? 0 : 1600); });
}
const hayDueno = () => st.tracks.some(t => t.persona && t.persona.dueno);
const hayVisita = () => st.tracks.some(t => t.persona && !t.persona.dueno);
function saludar() {
  if (!st.presente || st.saludado) return;
  const p = st.persona;
  if (p) st.saludados.add(p.id);
  if (p && p.dueno) return regreso(p);
  escena.gesto('wave'); escena.ojos('happy');
  if (p && p.nombre) { st.saludado = true; decir(frase(hayDueno() ? 'holaNombreConDueno' : 'holaNombre', { nombre: p.nombre }), 6000); return; }
  st.saludado = 'general';
  // Si llegó haciendo un gesto, la reacción es el saludo (no se tapa con otro globo)
  if (!st.interactuo) decir(frase('hola'), 6500);
}
// Fran volvió: Uku le cuenta quién vino y le abre el panel para ponerles nombre
function regreso(p = st.persona) {
  st.saludado = true;
  st.ultimaActividad = performance.now();
  refrescarModoDueno();
  escena.gesto('happy'); escena.ojos('happy');
  const quienes = quienesVinieron(), recados = atiende.mensajesNuevos().length;
  const nombre = p.nombre;
  if (!quienes && !recados) { decir(frase('regresoSinNada', { nombre }), 5000); return; }
  let cuenta = quienes ? (quienes === 1 ? 'vino 1 persona' : 'vinieron ' + quienes + ' personas') : 'no vino nadie';
  if (recados) cuenta += (quienes ? ' y ' : ', pero ') + (recados === 1 ? 'te dejaron 1 mensaje' : 'te dejaron ' + recados + ' mensajes');
  decir(frase('regreso', { nombre, visitas: cuenta }), 6500);
  setTimeout(() => { if (st.presente && hayDueno() && !hayVisita()) panel.abrir(recados ? 'mensajes' : 'visitas'); }, 3200);
  setTimeout(() => abrirTema(), 9500);
}
/* ---------- Uku saca el tema (como Tolan: no espera a que le hablen) ----------
   Al rato de saludar a Fran, Uku trae algo de su memoria: cómo le fue con lo que tenía pendiente, cuánto hace que
   no hablan, o, por la mañana, qué es lo único que tiene que salir hoy. Si sabe poco de él, le pregunta algo. */
const CONOCER = ['Oye, todavía no sé a qué te dedicas. ¿Qué haces cuando no estás frente a esta compu?', '¿Quién es la persona con la que más hablas en el día?', '¿Qué trae el día de hoy? Dime una sola cosa.', '¿Qué te pone de buen humor? Para saber cuándo sacar los globos.', 'Cuéntame algo tuyo que un oso no sabría. Lo guardo.'];
let temaDicho = 0;
function abrirTema({ forzar = false } = {}) {
  if (!st.presente || !hayDueno() || hayVisita() || callandoPorDueno() || panel.abierto) return false;
  if (!forzar && performance.now() - temaDicho < 90000) return false;
  const h = new Date().getHours(), sin = memoria.diasSinHablar(), pend = memoria.pendientes();
  let texto = null;
  if (pend.length) { const p = pend[0]; memoria.cerrarSeguimiento(p.id); texto = preguntaPor(p.texto); }
  else if (sin >= 2) texto = `Hace ${sin} días que no conversamos. ¿Qué me perdí?`;
  else if (h >= 6 && h < 12 && memoria.relacion().ultimoDia !== new Date().toISOString().slice(0, 10)) texto = '¿Qué es lo único que tiene que salir hoy sí o sí? Dime una cosa y la anoto.';
  else if (memoria.cuantos() < 3) texto = CONOCER[Math.floor(Math.random() * CONOCER.length)];
  if (!texto) return false;
  temaDicho = performance.now(); st.ultimaActividad = performance.now();
  escena.gesto('nod'); decir(texto, Math.max(5000, texto.length * 70)); prestarAtencion();
  return true;
}
// De un hecho con seguimiento («Tiene pendiente: mañana tengo la reunión con Ana») a una pregunta
function preguntaPor(hecho) {
  const t = hecho.replace(/^(tiene pendiente:|está|esta|quiere|hoy estaba \w+ por)\s*/i, '').replace(/^(mañana|manana|esta semana|la próxima semana|esta tarde|esta noche|el \w+)\s+(tiene|va a|le toca|es)\s+/i, '').replace(/\.$/, '');
  const l = ['Oye, ¿y cómo te fue con ' + t + '?', '¿Cómo va ' + t + '? Me quedé pensando en eso.', 'Antes de otra cosa: ' + t + '. ¿Cómo salió?'];
  return l[Math.floor(Math.random() * l.length)];
}
/* ---------- Al despedirse de Fran: Uku aprende y escribe su diario ---------- */
async function cerrarConversacionConFran() {
  const historial = atiende.historialActual();
  if (!historial.length) return;
  const vis = nombresDeQuienesVinieron();
  const nuevos = await memoria.aprender(historial).catch(() => []);
  await memoria.redactarDiario(historial, { nombre: dueno(), nuevos, visitas: vis }).catch(() => null);
  escena.setClaro(memoria.mundo());
}
let irseTimer = 0;
function seVa() {
  st.presente = false;
  st.vacioDesde = performance.now();
  estado('Acércate a la cámara', '');
  document.body.classList.remove('hay-alguien');
  st.tracks.forEach(t => { if (t.visita) visitas.seguir(t.visita); });
  const p = st.persona;
  if (escena.enCasa() && (st.interactuo || p)) {
    decir(p && p.dueno ? frase('chaoDueno', { nombre: p.nombre }) : p && p.nombre ? frase('chaoNombre', { nombre: p.nombre }) : frase('chao'));
    escena.gesto('wave');
  }
  const conFran = !!(p && p.dueno) && atiende.turnosDeEstaConversacion() > 0;
  st.persona = null; st.visita = null; st.tracks = []; st.saludados = new Set();
  modoDueno(false);
  if (conFran) cerrarConversacionConFran().finally(() => atiende.nuevaConversacion()); else atiende.nuevaConversacion();
  // Se despide y, un rato después, vuelve a pasear por el claro
  clearTimeout(irseTimer);
  irseTimer = setTimeout(() => { if (!st.presente) escena.libre(0); }, 3500);
}

/* ---------- Fran enfrente ----------
   Con Fran enfrente y nadie más, Uku le habla de lo suyo (quién vino, sus mensajes). */
let conDueno = false;
function modoDueno(on) {
  if (on === conDueno) return;
  conDueno = on;
  document.body.classList.toggle('es-dueno', on);
}
function refrescarModoDueno() { modoDueno(hayDueno() && !hayVisita()); }

/* ---------- Reconocer a cada persona (hasta cuatro caras a la vez) ----------
   Cada cara que se ve tiene su «pista» (se empareja por cercanía de un cuadro al siguiente). Uku
   identifica de a una, cada ~0,9 s: primero las que no conoce y luego revisa las viejas. Si no se
   parece a nadie, queda como visitante nuevo con su foto. Funciona aunque Fran esté en cámara: quien
   llegue después también se reconoce, se anota y se saluda. Las visitas del dueño no se anotan. */
const AUSENTE_MS = 3000, REVISAR_MS = 20000;
function seguirCaras(r) {
  const ahora = performance.now(), vistas = (r && r.caras) || [];
  const libres = st.tracks.slice();
  vistas.forEach(c => {
    const cx = (c.caja.x0 + c.caja.x1) / 2, cy = (c.caja.y0 + c.caja.y1) / 2, ancho = c.caja.x1 - c.caja.x0;
    let mejor = null, md = Infinity;
    libres.forEach(t => { const d = Math.hypot(t.cx - cx, t.cy - cy); if (d < md) { md = d; mejor = t; } });
    if (mejor && md < Math.max(.12, ancho * 1.2)) { libres.splice(libres.indexOf(mejor), 1); Object.assign(mejor, { cx, cy, caja: c.caja, visto: ahora }); }
    else st.tracks.push({ id: ++st.nTrack, cx, cy, caja: c.caja, visto: ahora, creado: ahora, persona: null, visita: null, chequeo: 0 });
  });
  // Las que no se ven hace un rato se fueron
  const antes = st.tracks.length;
  st.tracks = st.tracks.filter(t => { if (ahora - t.visto <= AUSENTE_MS) return true; terminarPista(t); return false; });
  if (st.tracks.length !== antes) { elegirFoco(); refrescarModoDueno(); }
  if (!st.presente || st.reconociendo || ahora - st.ultimoReconocer < 900) return;
  const aun = (t) => ahora - t.visto < 800;
  const t = st.tracks.filter(x => !x.persona && aun(x)).sort((a, b) => a.chequeo - b.chequeo)[0] || st.tracks.find(x => x.persona && aun(x) && ahora - x.chequeo > REVISAR_MS);
  if (t) reconocerPista(t, ahora);
}
function reconocerPista(t, ahora) {
  st.reconociendo = true; st.ultimoReconocer = ahora; t.chequeo = ahora;
  Promise.resolve((st.analizador || caras.analizar)(ui.video, t.caja)).then(a => {
    if (!a || !st.presente || !st.tracks.includes(t)) return;
    const { persona: p, nueva } = caras.identificar(a), antes = t.persona;
    t.persona = p;
    if (!antes || antes.id !== p.id) alIdentificar(t, p, nueva, antes);
  }).catch(() => {}).finally(() => { st.reconociendo = false; });
}
function terminarPista(t) {
  if (t.visita) visitas.seguir(t.visita);
  // Una visita que se va mientras otras siguen: se despide (si se van todos, lo hace seVa)
  const p = t.persona;
  if (p && !p.dueno && st.presente && st.tracks.some(x => x !== t) && escena.enCasa()) decir(p.nombre ? frase('chaoNombre', { nombre: p.nombre }) : frase('chao'), 3800);
}
// El foco de Uku: quien no es Fran (a esa persona se atiende); si solo está Fran, él
function elegirFoco() {
  const vis = st.tracks.filter(t => t.persona && !t.persona.dueno).sort((a, b) => b.visto - a.visto)[0];
  const f = vis || st.tracks.find(t => t.persona && t.persona.dueno);
  if (f) { st.persona = f.persona; st.visita = f.visita; }
}
function alIdentificar(t, p, nueva, antes) {
  if (antes && t.visita) { visitas.seguir(t.visita); t.visita = null; }
  if (!p.dueno) t.visita = visitas.empezar(p.id);
  const primera = !st.persona;
  elegirFoco(); refrescarModoDueno(); pintarAviso();
  if (primera) { // la primera persona de esta llegada: el saludo de siempre
    if (st.saludado === 'general') { // ya saludó sin saber quién era
      st.saludados.add(p.id);
      if (p.dueno) regreso(p);
      else if (p.nombre) { decir(frase(hayDueno() ? 'holaNombreConDueno' : 'ahEres', { nombre: p.nombre, dueno: dueno() }), 5000); escena.gesto('wave'); st.saludado = true; }
    } else if (!st.saludado && escena.enCasa()) { clearTimeout(saludoTimer); saludar(); }
    return;
  }
  // Alguien más (o otra vez la misma persona): si es nueva en esta llegada, Uku viene y la saluda
  if (st.saludados.has(p.id)) return;
  st.saludados.add(p.id); st.interactuo = true; st.ultimaActividad = performance.now();
  escena.venir(() => {
    escena.gesto('wave'); escena.ojos('happy');
    if (p.dueno) regreso(p);
    else decir(frase(p.nombre ? (hayDueno() ? 'holaNombreConDueno' : 'holaNombre') : (hayDueno() ? 'holaConDueno' : 'hola'), { nombre: p.nombre, dueno: dueno() }), 6500);
  });
}
// Mientras alguien sigue ahí, su visita se alarga
setInterval(() => { if (st.presente) st.tracks.forEach(t => { if (t.visita) visitas.seguir(t.visita); }); }, 5000);

/* ---------- Panel "Quién vino" y su aviso en la barra ---------- */
// Cuántas personas distintas vinieron y Fran no ha visto (sin contarlo a él)
function quienesVinieron() {
  const d = caras.dueno(), existe = new Set(caras.personas().map(p => p.id));
  return new Set(visitas.pendientes().map(v => v.personaId).filter(id => existe.has(id) && (!d || id !== d.id))).size;
}
// Sus nombres (o "Visitante 3"), para que Uku se lo cuente a Fran conversando
function nombresDeQuienesVinieron() {
  const d = caras.dueno(), ids = new Set(visitas.pendientes().map(v => v.personaId));
  return caras.personas().filter(p => ids.has(p.id) && (!d || p.id !== d.id)).map(p => caras.nombreDe(p));
}
const panel = crearPanel({ raiz: ui.panel, video: ui.video, caja: () => st.ultimo && st.ultimo.cara && st.ultimo.cara.caja, alCambiar: () => pintarAviso() });
function pintarAviso() {
  const n = quienesVinieron() + atiende.mensajesNuevos().length;
  ui.avisoN.textContent = n ? n : '';
  ui.aviso.classList.toggle('is-nuevo', n > 0);
  ui.aviso.setAttribute('aria-label', n ? `Quién vino: ${n} sin ver` : 'Quién vino');
}
ui.aviso.addEventListener('click', () => panel.alternar('visitas'));
document.addEventListener('mimo:visitas', pintarAviso);
document.addEventListener('mimo:mensajes', pintarAviso);
pintarAviso();

/* ---------- Depuración: cámara con los puntos ---------- */
/* ---------- Depurar la cámara (tecla D): qué ve y qué entiende ----------
   Sobre el video en espejo: el esqueleto del cuerpo (hombros, codos, muñecas), los 21 puntos de cada mano con su gesto y
   su confianza, la caja de cada cara con quién es (o «?»), y los puntos clave de la cara más grande. Al lado, un texto con
   los cuadros por segundo de la visión, las expresiones (pestañeo, sonrisa, boca), la cabeza (giro, cabeceo, inclinación),
   lo que entró al espejo y lo que sale del control por manos. */
let debugFps = { n: 0, t: performance.now(), v: 0 };
function dibujarMarcas(r) {
  const c = ui.marcas, x = c.getContext('2d'), txt = $('#debug-texto');
  if (!st.debug || !r) { x.clearRect(0, 0, c.width, c.height); if (txt) txt.hidden = true; return; }
  if (++debugFps.n >= 10) { const ahora = performance.now(); debugFps.v = Math.round(10000 / (ahora - debugFps.t)); debugFps.t = ahora; debugFps.n = 0; }
  c.width = ui.camara.clientWidth; c.height = ui.camara.clientHeight;
  const P = (p) => [(1 - p.x) * c.width, p.y * c.height];
  const linea = (a, b, col) => { if (!a || !b) return; x.strokeStyle = col; x.lineWidth = 2; x.beginPath(); x.moveTo(...P(a)); x.lineTo(...P(b)); x.stroke(); };
  // Cuerpo: hombros, codos, muñecas y el torso
  if (r.pose) {
    const q = r.pose.puntos;
    [[11, 13], [13, 15], [12, 14], [14, 16], [11, 12], [11, 23], [12, 24], [23, 24]].forEach(([a, b]) => linea(q[a], q[b], '#ffdd00'));
    x.fillStyle = '#ffdd00'; [11, 12, 13, 14, 15, 16].forEach(i => { const [a, b] = P(q[i]); x.beginPath(); x.arc(a, b, 4, 0, 6.3); x.fill(); });
  }
  // Manos: puntos, dedos y el gesto con su confianza
  r.manos.forEach(m => {
    [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [0, 9, 10, 11, 12], [0, 13, 14, 15, 16], [0, 17, 18, 19, 20]].forEach(d => { for (let i = 1; i < d.length; i++) linea(m.puntos[d[i - 1]], m.puntos[d[i]], '#7fa6e8'); });
    x.fillStyle = '#7fa6e8'; m.puntos.forEach(p => { const [a, b] = P(p); x.fillRect(a - 2, b - 2, 4, 4); });
    const [a, b] = P(m.puntos[0]); x.font = '600 13px sans-serif'; x.fillStyle = '#ffffff'; x.fillText(`${m.lado === 'Left' ? 'izq' : m.lado === 'Right' ? 'der' : ''} ${m.gesto} ${Math.round((m.score || 0) * 100)}%`, a - 30, b + 18);
  });
  // Caras: la caja de cada una con quién es; la más grande, sus puntos clave
  (r.caras || []).forEach((f, i) => {
    const [x0, y0] = P({ x: f.caja.x1, y: f.caja.y0 }), [x1, y1] = P({ x: f.caja.x0, y: f.caja.y1 });
    const tr = st.tracks.find(t => t.cara === f || (t.caja && Math.abs(t.caja.x0 - f.caja.x0) < .03 && Math.abs(t.caja.y0 - f.caja.y0) < .03));
    x.strokeStyle = i === 0 ? '#2e9d4a' : '#ffffff'; x.lineWidth = 2; x.strokeRect(x0, y0, x1 - x0, y1 - y0);
    x.fillStyle = '#ffffff'; x.font = '600 13px sans-serif'; x.fillText(tr && tr.persona ? caras.nombreDe(tr.persona) + (tr.persona.dueno ? ' (dueño)' : '') : tr ? 'reconociendo…' : '?', x0 + 4, y0 - 6);
    if (i === 0 && f.clave) { x.fillStyle = '#2e9d4a'; Object.values(f.clave).forEach(p => { const [a, b] = P(p); x.beginPath(); x.arc(a, b, 3, 0, 6.3); x.fill(); }); }
  });
  if (!txt) return;
  const f = r.cara && r.cara.forma, n = (v) => (v == null ? '–' : Math.round(v * 100) + '%');
  const l = [`visión ${debugFps.v} fps · manos ${r.manos.length} · caras ${(r.caras || []).length} · cuerpo ${r.pose ? 'sí' : 'no'}`];
  if (f) l.push(`pestañeo ${n(f.eyeBlinkLeft)}/${n(f.eyeBlinkRight)} · sonrisa ${n(((f.mouthSmileLeft || 0) + (f.mouthSmileRight || 0)) / 2)} · boca ${n(f.jawOpen)} · cejas ${n(f.browInnerUp)}`);
  if (espejoUltimo) l.push(`espejo: giro ${espejoUltimo.cabeza.yaw.toFixed(2)} · cabeceo ${espejoUltimo.cabeza.pitch.toFixed(2)} · inclinación ${espejoUltimo.cabeza.roll.toFixed(2)}${espejoUltimo.brazos ? ' · brazos sí' : ' · brazos no'}`);
  if (modoControl) l.push(`control: avance ${controlUltimo.avance.toFixed(2)} · giro ${controlUltimo.giro.toFixed(2)}`);
  l.push('pistas: ' + (st.tracks.map(t => (t.persona ? caras.nombreDe(t.persona) : '?')).join(', ') || 'ninguna') + ' · último evento: ' + (st.eventos[st.eventos.length - 1] || '–'));
  txt.textContent = l.join('\n'); txt.hidden = false;
}

/* ---------- Bucle de visión ---------- */
/* ---------- Árbitro de reacciones: Uku atiende un gesto a la vez ----------
   Antes hacía caso a todo y las reacciones se pisaban (un globo tapaba al otro, un gesto cortaba al anterior). Ahora:
   - mientras reacciona o habla (unos 3,5 s desde la última reacción, o mientras suena la voz) no toma gestos nuevos;
   - las caras y la cabeza (sonrisa, bostezo, sí/no…) solo si lleva 8 s sin reaccionar a nada y nadie le habló en 7 s;
   - en modo control y en espejo las manos no son gestos; en el juego solo cuenta la jugada. */
let reaccionHasta = 0, ultimaReaccion = -1e9;
const ocupado = () => performance.now() < reaccionHasta || voz.estaHablando() || ui.globo.classList.contains('is-pensando') || ui.globo.classList.contains('is-escribiendo');
const gestos = crearGestos((e) => {
  st.eventos.push(e.tipo); if (st.eventos.length > 40) st.eventos.shift(); // historial (depuración y pruebas)
  if (e.tipo === 'llega') return llega();
  if (e.tipo === 'se_va') return seVa();
  if (callandoPorDueno()) return;                                                      // Fran enfrente en modo guardián: Uku sigue en lo suyo
  if (jugando || guiando || modoControl || modoEspejo) return;                         // en el juego solo cuenta la jugada; manejándolo o imitando, las manos no son gestos
  if (ocupado()) return;                                                               // una reacción a la vez
  if (!e.manos && (performance.now() - st.ultimaOida < 7000 || performance.now() - ultimaReaccion < 8000)) return; // las caras no interrumpen
  reaccionar(e.tipo, e);
});
function procesar(r) {
  st.ultimo = r;
  if (modoEspejo) imitar(r);
  if (modoControl) controlPorMano(r);
  if (!modoEspejo) gestos.procesar(r); else gestos.procesar(Object.assign({}, r, { manos: [] })); // imitando, las manos no son gestos
  seguirCaras(r);
  dibujarMarcas(r);
}

/* ---------- Modos: control (tercera persona), vista de pájaro y espejo ----------
   Control (🎮, tecla K): la cámara va detrás de Uku y lo manejas con la mano frente a la cámara (arriba = adelante,
   abajo = atrás, a un lado = gira) o con las flechas. Vista (🗺️, tecla O): el claro desde arriba; se arrastra con el
   mouse o el dedo y hace zoom con la rueda o el pellizco; Uku sigue en lo suyo; 📍 vuelve a él. Espejo (🪞, tecla E):
   Uku imita tu cabeza, tus ojos y tus brazos, como un Memoji. */
let modoControl = false, modoEspejo = false, vistaPajaro = false;
const btnModo = { control: $('#btn-control'), espejo: $('#btn-espejo'), pajaro: $('#btn-pajaro'), ubicar: $('#btn-ubicar') };
const pintarModos = () => { btnModo.control.setAttribute('aria-pressed', String(modoControl)); btnModo.espejo.setAttribute('aria-pressed', String(modoEspejo)); btnModo.pajaro.setAttribute('aria-pressed', String(vistaPajaro)); btnModo.ubicar.hidden = !vistaPajaro; document.body.classList.toggle('modo-control', modoControl); document.body.classList.toggle('modo-espejo', modoEspejo); };
function setControl(on) {
  if (on === modoControl) return;
  modoControl = on;
  if (on) { if (modoEspejo) setEspejo(false); if (vistaPajaro) { vistaPajaro = false; } if (guiando) terminarGuia('rindo'); escena.setCamara('tercera'); decir('Modo control: me manejas tú. La mano arriba, adelante; abajo, atrás; a un lado, giro.', 5000, { hablar: false }); }
  else { escena.controlar(null); escena.setCamara(vistaPajaro ? 'pajaro' : 'libre'); escena.libre(0); }
  st.ultimaActividad = performance.now(); pintarModos();
}
function setPajaro(on) {
  if (on === vistaPajaro) return;
  vistaPajaro = on;
  if (on && modoControl) setControl(false);
  if (on && modoEspejo) setEspejo(false);
  if (!on && decorando) setDecorar(false);
  escena.setCamara(on ? 'pajaro' : 'libre');
  document.body.classList.toggle('vista-pajaro', on); // sin el desenfoque del sueño: se ve el claro entero
  if (on) estado('Vista de pájaro: arrastra para moverte, rueda o pellizco para el zoom', '');
  pintarModos();
}
function setEspejo(on) {
  if (on === modoEspejo) return;
  modoEspejo = on;
  if (on) { if (modoControl) setControl(false); if (vistaPajaro) { vistaPajaro = false; escena.setCamara('libre'); } espejoBase = null; espejoUltimo = null; escena.espejo({ cabeza: { yaw: 0, pitch: 0, roll: 0 }, cara: null }); decir('Modo espejo: haz lo que quieras, que yo te copio.', 4500, { hablar: false }); }
  else escena.espejo(null);
  st.ultimaActividad = performance.now(); pintarModos();
}
/* ---------- Decorar (como en Tolan): pones las cosas tú, de a una ----------
   En la vista de pájaro, tocar el suelo pone lo elegido ahí (si el sitio está libre); tocar algo ya puesto lo elige. Con
   ◀ ▶ se cambia qué es, ↻ lo gira, 🗑 lo quita y ✓ lo deja. Un aro punteado marca lo elegido. Se guarda en este equipo
   (bosque3d › mimo_decoracion). */
let decorando = null; // { k, actual }
const dec = { barra: $('#decorar-barra'), aro: $('#decorar-aro'), que: $('#decorar-que'), btn: $('#btn-decorar') };
const B3 = () => escena.mundo();
function setDecorar(on) {
  if (!!decorando === on) return;
  if (on) { if (!vistaPajaro) setPajaro(true); decorando = { k: 'flor', actual: null }; decir('Toca el suelo y pongo lo que elijas. Si no te gusta, lo giro o lo quito.', 5000, { hablar: false }); }
  else decorando = null;
  document.body.classList.toggle('decorando', !!decorando);
  dec.barra.hidden = !decorando; dec.btn.setAttribute('aria-pressed', String(!!decorando));
  pintarDecorar();
}
function pintarDecorar() {
  if (!decorando) { dec.aro.hidden = true; return; }
  const D = B3().DECORABLES, k = decorando.actual ? (B3().decoracionLista().find(d => d.id === decorando.actual) || {}).k || decorando.k : decorando.k;
  dec.que.textContent = D[k] ? D[k].nombre : k;
  dec.barra.querySelector('[data-d="girar"]').disabled = dec.barra.querySelector('[data-d="quitar"]').disabled = !decorando.actual;
}
// El aro sigue a lo elegido (la cámara se mueve); y de lejos, en la vista de pájaro, el cielo es el espacio
setInterval(() => {
  document.body.classList.toggle('espacio', !!(vistaPajaro && B3() && B3().enElEspacio()));
  if (!decorando || !decorando.actual) { dec.aro.hidden = true; return; }
  const d = B3().decoracionLista().find(x => x.id === decorando.actual);
  const p = d && B3().pantallaDe(d.x, d.z, .05);
  if (!p) { dec.aro.hidden = true; return; }
  dec.aro.hidden = false; dec.aro.style.left = p.x + 'px'; dec.aro.style.top = p.y + 'px';
}, 60);
// Toque en el suelo (sin arrastrar): poner o elegir
let toque = null;
ui.escena.addEventListener('pointerdown', (e) => { toque = { x: e.clientX, y: e.clientY, t: performance.now() }; });
ui.escena.addEventListener('pointerup', (e) => {
  if (!decorando || !toque || Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > 8 || performance.now() - toque.t > 600) return;
  const b = B3(), p = b.puntoDeSuelo(e.clientX, e.clientY);
  if (!p) return;
  const cerca = b.decoracionLista().map(d => ({ d, dist: Math.hypot(d.x - p.x, d.z - p.z) })).filter(x => x.dist < .25).sort((a, c) => a.dist - c.dist)[0];
  if (cerca) { decorando.actual = cerca.d.id; decorando.k = cerca.d.k; pintarDecorar(); return; }
  if (!b.sitioLibre(p.x, p.z)) { estado('Ahí no cabe: prueba en un sitio libre', 'error'); return; }
  const nuevo = b.ponerDecoracion(decorando.k, p.x, p.z, Math.random() * 6.28);
  if (nuevo) { decorando.actual = nuevo.id; efectos.lanzar('ok', { x: e.clientX / innerWidth, y: e.clientY / innerHeight }); st.ultimaActividad = performance.now(); }
  pintarDecorar();
});
dec.barra.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-d]'); if (!btn || !decorando) return;
  const b = B3(), ks = Object.keys(b.DECORABLES), i = ks.indexOf(decorando.k);
  if (btn.dataset.d === 'antes' || btn.dataset.d === 'despues') {
    decorando.k = ks[(i + (btn.dataset.d === 'antes' ? -1 : 1) + ks.length) % ks.length];
    if (decorando.actual) b.cambiarDecoracion(decorando.actual, decorando.k); // lo elegido cambia de cosa
  }
  if (btn.dataset.d === 'girar' && decorando.actual) b.girarDecoracion(decorando.actual);
  if (btn.dataset.d === 'quitar' && decorando.actual) { b.quitarDecoracion(decorando.actual); decorando.actual = null; }
  if (btn.dataset.d === 'listo') { decorando.actual = null; }
  pintarDecorar();
});
dec.btn.addEventListener('click', () => setDecorar(!decorando));
btnModo.control.addEventListener('click', () => setControl(!modoControl));
btnModo.pajaro.addEventListener('click', () => setPajaro(!vistaPajaro));
btnModo.espejo.addEventListener('click', () => setEspejo(!modoEspejo));
btnModo.ubicar.addEventListener('click', () => { escena.centrarEnUku(); estado('La cámara vuelve a Uku', 'ok'); });
pintarModos();
// Control por mano: la mano más alta manda. Arriba (y < .4) avanza, abajo (y > .6) retrocede; a los lados, gira.
let controlUltimo = { avance: 0, giro: 0 }, controlSinMano = 0;
function controlPorMano(r) {
  const m = (r.manos || []).filter(h => h.puntos && h.puntos.length === 21).sort((a, b) => a.puntos[9].y - b.puntos[9].y)[0];
  if (!m) { if (++controlSinMano === 6 && !flechas.size) { controlUltimo = { avance: 0, giro: 0 }; escena.controlar(null); } return; }
  controlSinMano = 0;
  const x = 1 - m.puntos[9].x, y = m.puntos[9].y;
  const avance = y < .4 ? Math.min(1, (.4 - y) / .25) : y > .62 ? -Math.min(1, (y - .62) / .25) : 0;
  const giro = x < .4 ? -Math.min(1, (.4 - x) / .25) : x > .6 ? Math.min(1, (x - .6) / .25) : 0;
  controlUltimo = { avance, giro };
  escena.controlar(avance || giro ? controlUltimo : null);
  if (avance || giro) { st.ultimaActividad = performance.now(); st.interactuo = true; }
}
/* Espejo: de los puntos de la cara y del cuerpo a lo que imita Uku. La cabeza se calcula con la nariz respecto al centro de la
   cara (giro y cabeceo) y la línea de los ojos (inclinación), siempre respecto a cómo estabas al encender el espejo (así no
   hace falta mirar a la cámara exacto). Las expresiones vienen de MediaPipe (pestañeo, sonrisa). Los brazos, de los hombros,
   codos y muñecas, en espejo: tu izquierda es su derecha. La imagen está en espejo, así que x de pantalla = 1 - x. */
let espejoBase = null, espejoUltimo = null;
const ESPEJO_K = { yaw: 3.4, pitch: 3.2 };
function imitar(r) {
  const c = r.cara && r.cara.clave;
  let cabeza = espejoUltimo ? espejoUltimo.cabeza : { yaw: 0, pitch: 0, roll: 0 };
  if (c) {
    const aspecto = (ui.video.videoWidth || 16) / (ui.video.videoHeight || 9);
    const anchoCara = Math.hypot((c.mejI.x - c.mejD.x) * aspecto, c.mejI.y - c.mejD.y) || .1, altoCara = Math.hypot((c.menton.x - c.frente.x) * aspecto, c.menton.y - c.frente.y) || .1;
    const yawRaw = (c.nariz.x - (c.mejI.x + c.mejD.x) / 2) * aspecto / anchoCara, pitchRaw = (c.nariz.y - (c.frente.y + c.menton.y) / 2) / altoCara;
    const rollRaw = Math.atan2(c.ojoI.y - c.ojoD.y, (c.ojoI.x - c.ojoD.x) * aspecto);
    // Los primeros cuadros fijan el «cero» (tu postura al encender)
    if (!espejoBase) espejoBase = { yaw: yawRaw, pitch: pitchRaw, roll: rollRaw, n: 1 };
    else if (espejoBase.n < 15) { const n = ++espejoBase.n; espejoBase.yaw += (yawRaw - espejoBase.yaw) / n; espejoBase.pitch += (pitchRaw - espejoBase.pitch) / n; espejoBase.roll += (rollRaw - espejoBase.roll) / n; }
    // En la pantalla (espejo): tu izquierda queda a la izquierda. La nariz hacia la derecha de la imagen cruda es tu izquierda:
    // Uku gira hacia la izquierda de la pantalla (su +x). El cabeceo hacia abajo baja la cabeza. La inclinación va invertida.
    cabeza = { yaw: (yawRaw - espejoBase.yaw) * ESPEJO_K.yaw, pitch: -(pitchRaw - espejoBase.pitch) * ESPEJO_K.pitch, roll: -(rollRaw - espejoBase.roll) };
  }
  const f = r.cara && r.cara.forma, cara = f ? { blink: Math.max(f.eyeBlinkLeft || 0, f.eyeBlinkRight || 0), smile: ((f.mouthSmileLeft || 0) + (f.mouthSmileRight || 0)) / 2 } : null;
  let brazos = null;
  if (r.pose && r.pose.puntos) {
    const q = r.pose.puntos, aspecto = (ui.video.videoWidth || 16) / (ui.video.videoHeight || 9), ok = (i) => q[i] && (q[i].visibility == null || q[i].visibility > .5);
    // dirección de a hacia b en pantalla: la derecha de la imagen cruda es la izquierda de la pantalla (espejo); y arriba; un
    // poco hacia la cámara
    const d = (a, b) => ok(a) && ok(b) ? [(q[b].x - q[a].x) * aspecto, q[a].y - q[b].y, .15] : null;
    // tu brazo izquierdo (11 → 13 → 15) es el derecho de Uku, y al revés
    brazos = { R: { arm: d(11, 13), fore: d(13, 15) }, L: { arm: d(12, 14), fore: d(14, 16) } };
    if (!brazos.R.arm && !brazos.L.arm) brazos = null;
  }
  espejoUltimo = { cabeza, cara, brazos };
  escena.espejo(espejoUltimo);
}
function bucleVision() {
  if (!st.corriendo) return;
  requestAnimationFrame(bucleVision);
  const r = st.vision && st.vision.detectar(ui.video);
  if (r) procesar(r);
}

/* ---------- Mientras nadie juega, o alguien está quieto ---------- */
setInterval(() => {
  const ahora = performance.now();
  ubicarGlobo();
  if (!st.presente) {
    // Invita a acercarse solo cuando se le ve (paseando puede andar fuera de la escena)
    if (ahora - st.ultimoAtraer > 14000 && ahora - st.ultimaActividad > 14000 && escena.enEscena()) { // no interrumpe una conversación
      st.ultimoAtraer = ahora;
      decir(frase('atraer'), 4200, { hablar: false });
    }
    // Sin nadie, de vez en cuando piensa en voz alta o hace una travesura
    if (ahora - st.ultimoSolo > st.proxSolo && ahora - st.ultimaActividad > 20000 && escena.enEscena()) {
      st.ultimoSolo = ahora; st.proxSolo = 35000 + Math.random() * 35000;
      decir(frase('solo'), 5200, { hablar: false });
      if (Math.random() < .5) escena.gesto(['happy', 'nod', 'wave'][Math.floor(Math.random() * 3)]);
    }
    // Sin nadie por un minuto, vuelve el ambiente de la hora (día, atardecer, noche o lluvia)
    if (ahora - st.vacioDesde > 60000) { const e = tiempo.entornoReal(); if (escena.setEntorno(e)) entornoAuto = e; }
    // Sin nadie, después de reaccionar vuelve a pasear (salvo que lo estén manejando o imitando)
    if (!modoControl && !modoEspejo && escena.enCasa() && ahora - st.ultimaActividad > 10000) escena.libre();
  } else if (!modoControl && !modoEspejo && ahora - st.ultimaActividad > (callandoPorDueno() ? 8000 : 12000) && escena.enCasa()) { // con Fran, a los 8 s de saludar sigue en lo suyo
    escena.libre(0, { cerca: true });
  }
  if (st.presente && !callandoPorDueno() && ahora - st.ultimaActividad > 16000 && ahora - st.ultimaPista > 16000) {
    st.ultimaPista = ahora;
    // Con Fran, Uku saca un tema de su memoria; con los demás, pistas de gestos y, de vez en cuando, un consejo de oso
    if (hayDueno() && !hayVisita() && abrirTema()) return;
    if (st.pistaN++ % 3 !== 2) decir(frase('pistas'));
    else { decir(frase('tipIntro') + ' ' + frase('tip'), 7500); escena.gesto('nod'); }
  }
}, 500);
(function seguirGlobo() { ubicarGlobo(); requestAnimationFrame(seguirGlobo); })();

/* ---------- Arranque ---------- */
// Pantalla completa solo cuando ya se resolvieron los permisos: si se pide antes, el navegador tapa su aviso de permiso.
// Si el navegador exige un gesto, entra con el siguiente toque.
function pantallaCompleta() {
  if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  document.documentElement.requestFullscreen().catch(() => {
    document.addEventListener('pointerdown', () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); }, { once: true });
  });
}
// Pide el micrófono (y se suelta enseguida): así el aviso de permiso sale ahora, no cuando Uku carga el oído
async function pedirMicrofono() {
  try { const m = await navigator.mediaDevices.getUserMedia({ audio: true }); m.getTracks().forEach(t => t.stop()); return true; } catch (e) { return false; }
}
async function empezar({ conCamara = true } = {}) {
  ui.inicio.classList.add('is-oculto');
  alternarHud(ui.optHud.checked);
  voz.setVoz(ui.optVoz.checked);
  if (ui.optDespierto.checked) despierto.activar();
  if (!conCamara) {
    if (ui.optMic.checked) await pedirMicrofono();
    pantallaCompleta();
    if (ui.optMic.checked) activarOido(true);
    estado('Modo sin cámara · tecla H para los atajos', ''); decir('¡Hola! Sin cámara no veo quién viene, pero podemos jugar. Toca H.'); return;
  }
  try {
    estado('Encendiendo la cámara…');
    const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
    ui.video.srcObject = s; await ui.video.play();
    document.body.classList.add('con-camara');
  } catch (e) {
    estado('Sin permiso para la cámara', 'error');
    decir('Necesito la cámara para ver quién viene. Dale permiso y vuelve a intentar.', 9000);
    ui.inicio.classList.remove('is-oculto');
    return;
  }
  if (ui.optMic.checked) await pedirMicrofono();
  pantallaCompleta();
  if (ui.optMic.checked) activarOido(true);
  try {
    st.vision = await iniciarVision({ alAvance: (t) => { estado(t); } });
  } catch (e) {
    console.error(e);
    descargas.fallo('vision', 'Revisa la conexión a internet');
    estado('No pude cargar la visión', 'error');
    decir('No pude cargar mi visión. Revisa la conexión a internet.', 9000);
    return;
  }
  estado('Acércate a la cámara');
  st.corriendo = true;
  bucleVision();
  caras.cargar().catch(() => estado('No pude cargar el reconocimiento de caras', 'error')); // reconoce desde el inicio
}

/* ---------- Juego: guíame (el Alien Child de «Her», al revés) ----------
   En Her, el personaje del juego vive en la sala, tiene su propio carácter y te guía por los túneles
   mientras te insulta con gracia. Aquí Uku se pierde a la entrada del bosque y eres tú quien lo trae a
   casa: con la voz («izquierda», «derecha», «sigue», «arriba», «para») o señalando con la mano (la mano
   a la izquierda o a la derecha de la cámara lo lleva para allá; arriba, al fondo). Uku comenta el
   camino, se queja si lo dejas plantado y celebra al llegar. Tecla 7 o decir «guíame» / «te guío». */
let guiando = null;
const GUIA_DIR = { izquierda: [-1, 0], derecha: [1, 0], arriba: [0, -1], fondo: [0, -1], atras: [0, -1], atrás: [0, -1], abajo: [0, 1], adelante: [0, 1], sigue: null, para: 'para', alto: 'para', quieto: 'para', espera: 'para' };
const GUIA_DESTINOS = { casa: 'mi casa', lago: 'el lago', banca: 'la banca', letrero: 'el letrero del bosque', cascada: 'la cascada', puente: 'el puente' };
const GUIA_FRASES = {
  inicio: ['¡Ay! Me fui a mirar las mariposas y ya no sé por dónde queda {a}. ¿Me guías? Dime izquierda, derecha, arriba o sigue, o señala con la mano. Mejor por los senderos.', '¡Me perdí! Esto me pasa por distraerme. Llévame a {a}: izquierda, derecha, arriba… o apunta con la mano. Los senderos ayudan.'],
  cambio: ['Ah, ¿mejor a {a}? Bueno, vamos.', 'Cambio de plan: a {a}. Guíame.'],
  andando: ['¿Seguro que es por aquí?', 'Voy, voy. No me apures.', 'Confío en ti. Más o menos.', 'Si me llevas al lago, nado. Pero no me gusta.', 'Ya huelo la chimenea… o es el deseo.', '¿Y si mejor me cargas?'],
  trabado: ['Por ahí no paso: hay algo. ¿Por otro lado?', 'Choqué. ¿Me rodeas eso, porfa?', 'Ahí hay un bicho o un árbol. Dame otra dirección.', 'No avanzo. ¿Izquierda o derecha?'],
  quieto: ['¿Hola? ¿Me vas a dejar aquí parado?', 'Sigo perdido, por si no te diste cuenta.', 'Un oso solo en el bosque. Qué drama.', 'Dime algo: izquierda, derecha… lo que sea.'],
  cerca: ['¡Ahí está {a}! Ya casi.', '¡Ya veo {a}! Un pasito más.'],
  llego: ['¡Llegué a {a}! Eres mejor guía que las mariposas. Y gratis.', '¡{A}! Gracias. Te debo una miel.', '¡Llegamos! Esto sí fue trabajo en equipo. Yo caminé, eso cuenta.'],
  rindo: ['Bueno, me quedo a vivir aquí. Ya me acostumbré.', 'Se me acabó la paciencia de oso. Vuelvo solo, pero conste.']
};
const gf = (k) => { const a = guiando ? GUIA_DESTINOS[guiando.destino] : 'mi casa'; return GUIA_FRASES[k][Math.floor(Math.random() * GUIA_FRASES[k].length)].replace(/\{a\}/g, a).replace(/\{A\}/g, a.charAt(0).toUpperCase() + a.slice(1)).replace(/\ba el\b/g, 'al'); };
const destinoEn = (t) => Object.keys(GUIA_DESTINOS).find(k => new RegExp('\\b' + (k === 'casa' ? 'casa|casita' : k === 'letrero' ? 'letrero|cartel|bosque' : k) + '\\b').test(t));
function guiarme(destino) {
  if (guiando || jugando) return;
  const ks = Object.keys(GUIA_DESTINOS);
  destino = GUIA_DESTINOS[destino] ? destino : ks[Math.floor(Math.random() * ks.length)];
  if (!escena.perderse(destino)) return decir('Hoy no me puedo perder: la escena no está lista.', 4000);
  guiando = { desde: performance.now(), ultimoEmpuje: 0, ultimaFrase: performance.now(), cerca: false, dir: null, destino };
  st.ultimaActividad = performance.now(); st.interactuo = true; prestarAtencion();
  decir(gf('inicio'), 8000); escena.gesto('worried');
  guiando.timer = setInterval(() => {
    if (!guiando) return;
    const ahora = performance.now(), d = escena.distanciaA(guiando.destino);
    // La mano, a un lado de la cámara, lo lleva para allá (la imagen está en espejo: x ya viene invertida)
    const m = st.ultimo && st.ultimo.manos && st.ultimo.manos[0];
    if (m && m.puntos && m.puntos.length === 21) {
      const x = 1 - m.puntos[9].x, y = m.puntos[9].y;
      const dir = x < .35 ? [-1, 0] : x > .65 ? [1, 0] : y < .3 ? [0, -1] : null;
      if (dir) { guiando.dir = dir; guiando.ultimoEmpuje = ahora; }
    }
    // Un empuje dura un par de segundos (así «izquierda» de voz lo mueve un tramo)
    if (guiando.dir && ahora - guiando.ultimoEmpuje < 2200) escena.guiar({ x: guiando.dir[0], z: guiando.dir[1] });
    else { escena.guiar(null); guiando.dir = null; }
    // Si lo empujas y no se mueve, algo le cierra el paso (el lago, la tortuga, un árbol): lo dice
    const w = escena.dondeEsta();
    if (w) {
      const quieto = guiando.pos && Math.hypot(w.x - guiando.pos.x, w.z - guiando.pos.z) < .005;
      guiando.pos = { x: w.x, z: w.z };
      guiando.trabado = guiando.dir && quieto ? (guiando.trabado || 0) + 1 : 0;
      if (guiando.trabado === 6) { guiando.ultimaFrase = ahora; decir(gf('trabado'), 4000); escena.gesto('worried'); }
    }
    if (d < .4) return terminarGuia('llego');
    if (d < .9 && !guiando.cerca) { guiando.cerca = true; decir(gf('cerca'), 4000); guiando.ultimaFrase = ahora; escena.gesto('happy'); }
    if (ahora - guiando.ultimaFrase > 9000) { guiando.ultimaFrase = ahora; decir(gf(guiando.dir ? 'andando' : 'quieto'), 4500); if (!guiando.dir) escena.gesto('worried'); }
    if (ahora - guiando.desde > 120000) terminarGuia('rindo');
  }, 250);
}
function terminarGuia(como) {
  if (!guiando) return;
  const texto = gf(como === 'llego' ? 'llego' : 'rindo');
  clearInterval(guiando.timer); guiando = null; escena.guiar(null);
  st.ultimaActividad = performance.now();
  if (como === 'llego') { decir(texto, 6000); escena.gesto('happy'); efectos.lanzar('confeti', { x: .5, y: .5 }); fx('salto'); }
  else { decir(texto, 5000); escena.libre(0); }
}
// Lo que se dice durante el juego: izquierda, derecha, arriba, sigue, para… (o «ya no juego»)
function guiarPorVoz(texto) {
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/\b(ya no|basta|dejalo|me rindo|cancela|salir)\b/.test(t)) return terminarGuia('rindo');
  // «Llévame al lago», «mejor a la banca»: cambia adónde va
  const nd = /\b(llevame|vamos|mejor|quiero ir|ve)\b/.test(t) && destinoEn(t);
  if (nd && nd !== guiando.destino) { guiando.destino = nd; guiando.cerca = false; decir(gf('cambio'), 4000); return; }
  const k = Object.keys(GUIA_DIR).find(w => new RegExp('\\b' + w + '\\b').test(t));
  if (!k) return;
  const v = GUIA_DIR[k];
  if (v === 'para') { guiando.dir = null; escena.guiar(null); escena.gesto('nod'); return; }
  guiando.dir = v || guiando.dir || [0, -1]; guiando.ultimoEmpuje = performance.now();
}

/* ---------- Juego: piedra, papel o tijera ----------
   Uku cuenta, lee tu mano (puño = piedra, palma = papel, V = tijera) o lo que
   dijiste, y juega. Tecla G o decir «jugamos». */
let jugando = null;
const JUGADAS = ['piedra', 'papel', 'tijera'], DE_GESTO = { Closed_Fist: 'piedra', Open_Palm: 'papel', Victory: 'tijera' };
const GANA = { piedra: 'tijera', papel: 'piedra', tijera: 'papel' }; // quién le gana a quién
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
async function jugar() {
  if (jugando) return;
  jugando = { voz: null };
  st.ultimaActividad = performance.now(); st.interactuo = true;
  try {
    if (!escena.enCasa()) await new Promise(r => escena.venir(r));
    escena.gesto('wave');
    decir(frase('juegoInicio'), 3600);
    await esperar(3700);
    for (const t of ['Piedra…', 'Papel…', '¡o tijera!']) { st.ultimaActividad = performance.now(); decir(t, 900, { hablar: voz.vozActiva() }); await esperar(850); }
    decir('¡YA!', 1200);
    // Lee la mano durante un segundo: manda lo que más se vio
    const votos = {}, fin = performance.now() + 1000;
    while (performance.now() < fin) {
      ((st.ultimo && st.ultimo.manos) || []).forEach(m => { const j = DE_GESTO[m.gesto]; if (j && m.score > .5) votos[j] = (votos[j] || 0) + 1; });
      await esperar(60);
    }
    const tu = (Object.entries(votos).sort((a, b) => b[1] - a[1])[0] || [])[0] || jugando.voz;
    if (!tu) { escena.gesto('worried'); decir(frase('juegoSinMano'), 4200); return; }
    const uku = JUGADAS[Math.floor(Math.random() * 3)];
    efectos.lanzar(uku, { x: .62, y: .5 });
    await esperar(500);
    const datos = { uku, tu };
    if (tu === uku) { escena.gesto('nod'); decir(frase('juegoEmpata', datos), 5500); }
    else if (GANA[uku] === tu) { escena.gesto('happy'); escena.ojos('happy'); fx('salto'); efectos.lanzar('risa', { x: .62, y: .5 }); decir(frase('juegoGana', datos), 5500); }
    else { escena.gesto('worried'); efectos.lanzar('trofeo', { x: .5, y: .5 }); decir(frase('juegoPierde', datos), 5500); }
  } finally { jugando = null; st.ultimaActividad = performance.now(); }
}

/* ---------- Pantalla despierta ---------- */
document.addEventListener('mimo:despierto', (e) => {
  const m = e.detail;
  ui.despierto.hidden = m === 'apagado';
  ui.despierto.textContent = m === 'no' ? '☀️ La pantalla puede dormirse' : '☀️ Pantalla despierta';
  ui.despierto.dataset.tipo = m === 'no' ? 'error' : '';
  ui.despierto.title = m === 'wakelock' ? 'La computadora no apagará la pantalla mientras Uku cuida (Wake Lock). Tecla S para apagarlo.'
    : m === 'video' ? 'Se mantiene despierta con un video diminuto. Tecla S para apagarlo.' : 'El navegador no permitió mantenerla despierta: revisa Energía en tu sistema.';
});

/* ---------- Oído: escuchar y conversar (IA en el navegador) ---------- */
// Whisper a veces "oye" frases de subtítulos en el silencio: se descartan
const ALUCINA = /(subt[ií]tulos|amara\.org|gracias por ver|suscr[ií]bete|m[uú]sica|^\W*$)/i;
let oyendo = false;
async function activarOido(on) {
  if (!on) { oido.dejarDeEscuchar(); ui.mic.hidden = true; return; }
  if (oyendo || oido.escuchando()) return;
  oyendo = true;
  try {
    ui.mic.hidden = false; ui.mic.textContent = '🎙️ Preparando el oído…';
    // Con conversación libre no hace falta el modelo de frases (entiende el modelo de lenguaje)
    await oido.cargar((p) => { ui.mic.textContent = `🎙️ Cargando el oído de Uku… ${p}%`; }, { sentido: false });
    if (!oido.SIMULADO) await oido.escuchar({
      alTexto: (t) => { ui.mic.textContent = '🎙️ Te escucho'; oir(t); },
      alParcial: (t) => { if (callandoPorDueno()) return; mostrarOido(t, true); pensar(); },
      alPensando: () => { ui.mic.textContent = '🎙️ Pensando…'; if (!callandoPorDueno()) pensar(); },
      alNivel: (n) => ui.mic.style.setProperty('--nivel', n.toFixed(2)),
      alError: (e) => estado(e.message === 'sin-red' ? 'El reconocimiento del navegador necesita internet' : 'El micrófono se detuvo', 'error'),
      callado: () => voz.estaHablando() || panel.abierto
    });
    const i = oido.info();
    ui.mic.textContent = '🎙️ Te escucho';
    ui.mic.title = i.simulado ? 'Oído simulado (Mimo.oir)' : i.modo === 'navegador' ? 'Reconocimiento de voz del navegador'
      : `${i.modeloVoz.split('/').pop()} en ${i.dispositivo === 'webgpu' ? 'la tarjeta gráfica (WebGPU)' : 'WebAssembly'}`;
  } catch (e) {
    console.error(e);
    ui.mic.hidden = true;
    descargas.mostrar(true);
    estado(/Permission|NotAllowed/i.test(e.name + e.message) ? 'Sin permiso para el micrófono' : 'No pude cargar el oído de Uku', 'error');
  } finally { oyendo = false; }
  // Solo para pruebas (?llm=…): el modelo local después del oído; si falla, Uku responde con sus frases
  if (mente.LOCAL) mente.cargar().catch((e) => console.warn('Uku: sin conversación libre', e));
}
function mostrarOido(texto, parcial = false) {
  ui.oido.textContent = parcial ? texto + '…' : '«' + texto + '»';
  ui.oido.classList.toggle('is-parcial', parcial);
  ui.oido.classList.add('is-visible'); clearTimeout(subTimer);
  subTimer = setTimeout(() => ui.oido.classList.remove('is-visible'), parcial ? 3000 : 5000);
}
/* ---------- Tareas por voz (tareas.js): recordatorios y post-its ---------- */
const hablaHora = (ms) => tareas.formatoHora(ms);
function tarea(t) {
  escena.gesto('nod');
  if (t.tipo === 'recordatorio') { tareas.anotarRecordatorio(t.texto, t.ms); return decir('Listo. Te recuerdo «' + t.texto + '» ' + hablaHora(t.ms) + '.', 6000); }
  if (t.tipo === 'recordatorio-sin-hora') return decir('¿Cuándo? Dime, por ejemplo: recuérdame en diez minutos tomar agua, o a las tres y media llamar a Ana.', 6000);
  if (t.tipo === 'recordatorio-sin-que') return decir('¿Qué te recuerdo? Dime la hora y lo que sea.', 4000);
  if (t.tipo === 'postit') { tareas.anotarPostit(t.texto); efectos.lanzar('ok', { x: .85, y: .25 }); return decir('Listo, lo pegué en el muro.', 3500); }
  if (t.tipo === 'postit-sin-texto') return decir('¿Qué digo en el post-it?', 3500);
  if (t.tipo === 'listar') {
    const l = t.que === 'recordatorios' ? tareas.recordatorios() : tareas.postits();
    if (!l.length) return decir(t.que === 'recordatorios' ? 'No tienes recordatorios pendientes.' : 'No hay post-its en el muro.', 3500);
    const cuenta = l.slice(0, 5).map((x, i) => t.que === 'recordatorios' ? x.texto + ' ' + hablaHora(x.ms) : x.texto).join('. ');
    return decir((l.length > 5 ? 'Tienes ' + l.length + '. Los primeros: ' : '') + cuenta + '.', Math.max(5000, cuenta.length * 70));
  }
  if (t.tipo === 'borrar') { tareas.borrar(t.que); return decir(t.que === 'todo' ? 'Listo, borré recordatorios y post-its.' : 'Listo, borré ' + (t.que === 'recordatorios' ? 'los recordatorios.' : 'los post-its.'), 3500); }
}
// El muro de post-its: una tira arriba a la derecha, cada uno con su × (sin sombras: bordes y color)
let muroEl = null;
function pintarPostits() {
  if (!muroEl) { muroEl = document.createElement('div'); muroEl.className = 'mimo-muro'; muroEl.setAttribute('aria-label', 'Post-its de Uku'); document.body.appendChild(muroEl); }
  // Recordatorios pendientes (con su hora, hasta que vencen) y post-its: se ven aunque Fran no esté
  const recs = tareas.recordatorios().map(r => ({ tipo: 'rec', id: r.id, texto: r.texto, ms: r.ms })), notas = tareas.postits().map(n => ({ tipo: 'nota', id: n.id, texto: n.texto, color: n.color }));
  const todo = recs.concat(notas);
  muroEl.hidden = !todo.length;
  muroEl.replaceChildren(...todo.map(n => {
    const d = document.createElement('div');
    d.className = n.tipo === 'rec' ? 'mimo-postit mimo-postit--reloj' : 'mimo-postit mimo-postit--' + n.color;
    const p = document.createElement('p');
    if (n.tipo === 'rec') { const h = document.createElement('small'); h.textContent = '⏰ ' + tareas.formatoHora(n.ms); p.append(h, document.createElement('br'), document.createTextNode(n.texto)); }
    else p.textContent = n.texto;
    const x = document.createElement('button'); x.type = 'button'; x.className = 'mimo-postit__x'; x.setAttribute('aria-label', n.tipo === 'rec' ? 'Quitar este recordatorio' : 'Quitar este post-it'); x.textContent = '×';
    x.addEventListener('click', () => (n.tipo === 'rec' ? tareas.quitarRecordatorio : tareas.quitarPostit)(n.id));
    d.append(p, x); return d;
  }));
}
document.addEventListener('mimo:tareas', pintarPostits); pintarPostits();
tareas.vigilar((texto) => { escena.gesto('happy'); efectos.lanzar('ok', { x: .62, y: .5 }); decir('¡Recordatorio! ' + texto, 9000); });

// Lo que se dijo (ya en texto): conversación por Fran o, si no, palabras de juego
let subTimer = 0;
/* Oficina con ruido: con «Solo responde cuando le dicen Uku» (opción del inicio, recordada), lo que no empieza por «Uku»
   se ignora, salvo durante los 25 s siguientes a una respuesta suya (así se sigue la conversación sin repetir su nombre).
   Lo que se oye mientras Uku habla tampoco cuenta: es su propia voz o gente hablando encima. */
const KLL = 'mimo_llamada';
try { const v = localStorage.getItem(KLL); if (v !== null) $('#opt-llamada').checked = v === '1'; } catch (e) {}
$('#opt-llamada').addEventListener('change', (e) => { try { localStorage.setItem(KLL, e.target.checked ? '1' : '0'); } catch (x) {} });
const soloLlamada = () => $('#opt-llamada').checked;
let atentoHasta = 0; // hasta cuándo escucha sin que le digan «Uku»
const ATENCION_MS = 25000;
function prestarAtencion() { atentoHasta = performance.now() + ATENCION_MS; }
async function oir(texto) {
  texto = (texto || '').trim();
  if (!texto || ALUCINA.test(texto) || texto.length < 2) return;
  if (voz.estaHablando()) return; // mientras habla Uku, lo que entra es él mismo o gente encima
  if (guiando) { mostrarOido(texto); st.ultimaActividad = performance.now(); prestarAtencion(); return guiarPorVoz(texto); } // en «guíame», todo lo que se dice es para guiar
  // «Uku…» al principio: recordatorios, post-its y lo demás es para Uku (antes del modo guardián: son de quien lo dice)
  const ll = tareas.llamada(texto);
  if (ll) {
    mostrarOido(texto); st.ultimaActividad = performance.now(); st.interactuo = true; prestarAtencion();
    if (!ll.resto) { escena.gesto('nod'); decir('Dime.', 2500); return; }
    const t = tareas.parsear(ll.resto);
    if (t) return tarea(t);
    texto = ll.resto; // no era una tarea: sigue como conversación
  } else if (soloLlamada() && !jugando) {
    if (performance.now() > atentoHasta) { mostrarOido(texto, true); return; } // no es para Uku: se ve en gris y no responde
    if (texto.split(/\s+/).length < 2) return; // un suelto («sí», «ya») en medio del ruido no cuenta
    prestarAtencion();
  }
  if (callandoPorDueno()) return;      // con Fran enfrente (modo guardián) no se le contesta
  mostrarOido(texto);
  st.ultimaActividad = performance.now(); st.interactuo = true; st.ultimaOida = performance.now();
  // Piedra, papel o tijera: «jugamos» empieza; durante el juego lo que digan es la jugada
  const jugada = (texto.toLowerCase().match(/\b(piedra|papel|tijeras?)\b/) || [])[1];
  if (jugando) { if (jugada) jugando.voz = jugada.replace(/s$/, ''); return; }
  if (/\b(gu[ií]ame|te gu[ií]o|est[aá]s perdido|pi[eé]rdete)\b/i.test(texto)) return guiarme(destinoEn(texto.toLowerCase()));
  if (/\b(modo control|te controlo|te manejo|d[eé]jame manejarte)\b/i.test(texto)) return setControl(true);
  if (/\b(vista de p[aá]jaro|desde arriba|modo vista)\b/i.test(texto)) return setPajaro(true);
  if (/\b(modo espejo|im[ií]tame|c[oó]piame|haz lo que yo)\b/i.test(texto)) return setEspejo(true);
  if (/\b(modo normal|vista normal|ya no (me imites|te controlo)|deja de imitar|su[eé]ltate|libre)\b/i.test(texto)) { setControl(false); setPajaro(false); setEspejo(false); return decir('Listo, sigo en lo mío.', 3000); }
  if (/\b(jugamos|juguemos|jugar|piedra,? papel)/i.test(texto)) return jugar();
  if (st.visita) visitas.seguir(st.visita);
  // Palabras de juego dichas solas ("¡fiesta!", "globos") mueven el mundo; lo demás se conversa
  const juego = voz.comandoDe(texto);
  if (juego && !['saludo', 'gracias', 'chao', 'ok', 'quien'].includes(juego) && texto.split(/\s+/).length <= 3) {
    if (juego.startsWith('entorno:')) { escena.setEntorno(juego.slice(8)); escena.gesto('happy'); } else reaccionar(juego, { x: .5, y: .5 });
    return;
  }
  const p = st.persona, esDueno = !!(p && p.dueno && conDueno);
  // Uku viene (si andaba paseando) y muestra que está pensando; el modelo escribe en el globo
  pensar();
  if (!escena.enCasa()) escena.venir();
  let enVivo = false;
  const alParcial = (t) => { enVivo = true; decirEnVivo(t); };
  const hoyMs = new Date().setHours(23, 59, 59, 999);
  const r = await atiende.conversar(texto, {
    dueno: dueno(), personaId: p && p.id, nombre: p && p.nombre, esDueno, duenoAqui: hayDueno(),
    visitas: esDueno ? nombresDeQuienesVinieron() : [], alParcial,
    pendientes: esDueno ? tareas.recordatorios().filter(x => x.ms < hoyMs).map(x => x.texto + ' ' + tareas.formatoHora(x.ms)).concat(tareas.postits().map(n => n.texto)) : []
  });
  if (esDueno && atiende.turnosDeEstaConversacion() === 1) { memoria.anotarConversacion(); escena.setClaro(memoria.mundo()); }
  if (!r.intencion) {
    const c = voz.comandoDe(texto);
    if (c) { if (c.startsWith('entorno:')) { escena.setEntorno(c.slice(8)); escena.gesto('happy'); } else reaccionar(c, { x: .5, y: .5 }); return; }
  }
  const responder = () => {
    prestarAtencion(); // tras responder, sigue atento un rato sin que repitan «Uku»
    if (r.gesto) escena.gesto(r.gesto);
    if (r.animo !== undefined) escena.setAnimo(r.animo);
    if (r.intencion === 'mensaje-guardado') efectos.lanzar('ok', { x: .62, y: .5 });
    if (r.efecto) efectos.lanzar(r.efecto, { x: .62, y: .5 });
    if (r.fx) fx(r.fx);
    if (r.entorno) escena.setEntorno(r.entorno);
    decir(r.texto, Math.max(4500, r.texto.length * 70));
  };
  if (enVivo) return responder();
  // Las respuestas al toque esperan un instante con los puntos: se siente natural, no de golpe
  const espera = Math.max(0, 450 - (performance.now() - pensandoDesde));
  setTimeout(() => (escena.enCasa() ? responder() : escena.venir(responder)), espera);
}

// El cerebro (el Worker con Groq) se muestra como lo que es: un estado (listo con su modelo, o por qué no)
const notaNube = (n) => {
  const el = $('#nube-estado'); if (!el) return;
  if (!mente.cerebro()) { el.textContent = '☁️ Cerebro: apagado (uku-cerebro-url = off). Uku responde con sus frases.'; return; }
  if (n.lista) { el.textContent = '☁️ Cerebro: listo · Uku conversa con ' + n.modelo + '.'; el.dataset.tipo = 'ok'; return; }
  el.textContent = n.error ? '☁️ Cerebro: no responde (' + n.error + '). Uku responde con sus frases.' : '☁️ Cerebro: comprobando…';
  el.dataset.tipo = n.error ? 'error' : '';
};
document.addEventListener('mimo:cerebro', (e) => notaNube(e.detail)); notaNube(mente.estadoNube());
ui.modo.addEventListener('click', () => setModo(modo === 'demo' ? 'guardian' : 'demo'));
ui.optDemo.addEventListener('change', () => setModo(ui.optDemo.checked ? 'demo' : 'guardian'));
setModo(modo);
/* HUD: por defecto oculto (body.solo-uku). X o tocar el reloj lo muestra u oculta. */
function alternarHud(ver) { document.body.classList.toggle('solo-uku', ver === undefined ? !document.body.classList.contains('solo-uku') : !ver); }
$('#reloj').addEventListener('click', (e) => { alternarHud(); e.currentTarget.blur(); });
$('#reloj').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); alternarHud(); } });
ui.empezar.addEventListener('click', () => empezar());
ui.sinCamara.addEventListener('click', () => empezar({ conCamara: false }));

$('#btn-ayuda').addEventListener('click', () => { ui.ayuda.hidden = !ui.ayuda.hidden; });
ui.ayuda.querySelector('[data-cerrar]').addEventListener('click', () => { ui.ayuda.hidden = true; });

/* ---------- Teclado (para quien opera la demo) ---------- */
const TECLAS_GESTO = { b: 'rezo', q: 'like', w: 'globos', e: 'corazon', r: 'ok', y: 'saludo', u: 'sol', i: 'jardin', o: 'fiesta', j: 'fuegos', k: 'lluvia', l: 'confeti', t: 'tip' };
const TECLAS_ENTORNO = ['dia', 'atardecer', 'noche', 'lluvia', 'fiesta', 'jardin'];
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea, select')) { if (e.key === 'Escape') panel.cerrar(); return; }
  const k = e.key.toLowerCase();
  if (TECLAS_GESTO[k]) return reaccionar(TECLAS_GESTO[k], { x: .62, y: .55 });
  if (k === '0') return reaccionar('cruzados', { x: .62, y: .55 });
  if (/^[1-6]$/.test(k)) return escena.setEntorno(TECLAS_ENTORNO[+k - 1]);
  if (k === 'f') return document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  if (k === 'p') return panel.alternar('visitas');
  if (k === 'h' || k === '?') { ui.ayuda.hidden = !ui.ayuda.hidden; return; }
  if (k === 'd') { st.debug = !st.debug; document.body.classList.toggle('debug', st.debug); return; }
  if (k === 'c') return document.body.classList.toggle('sin-pip');
  if (k === 'k') return setControl(!modoControl);
  if (k === 'o') return setPajaro(!vistaPajaro);
  if (k === 'e') return setEspejo(!modoEspejo);
  if (k === '8') return setDecorar(!decorando);
  if (k === 'x') return alternarHud(); // muestra u oculta los controles (quedan el globo, el reloj y el clima)
  if (k === 'm') { voz.setVoz(!voz.vozActiva()); estado(voz.vozActiva() ? 'Voz encendida' : 'Voz apagada'); return; }
  if (k === 'v') return activarOido(!oido.escuchando());
  if (k === 'a') return descargas.alternar();
  if (k === 'n') return setModo(modo === 'demo' ? 'guardian' : 'demo');
  if (k === 'g') return jugar();
  if (k === '7') return guiando ? terminarGuia('rindo') : guiarme();
  if (k === 'z') return reaccionar(TRAVESURAS[Math.floor(Math.random() * TRAVESURAS.length)], { x: .62, y: .55 });
  if (k === 's') return despierto.activo() ? despierto.desactivar() : despierto.activar();
  if (k === 'escape') { panel.cerrar(); ui.ayuda.hidden = true; }
});

/* Flechas: manejar a Uku por su claro. Las direcciones son las de la pantalla (arriba = hacia el fondo).
   Mientras se maneja no vuelve solo al centro; al soltar sigue paseando. */
const flechas = new Set();
const FLECHA = { arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0] };
function empujar() {
  let x = 0, z = 0; flechas.forEach(k => { x += FLECHA[k][0]; z += FLECHA[k][1]; });
  const n = Math.hypot(x, z) || 1;
  // En modo control las flechas son relativas a Uku (arriba = adelante, izquierda = gira a su izquierda)
  if (modoControl) { controlUltimo = { avance: -z, giro: x }; escena.controlar(x || z ? controlUltimo : null); if (x || z) { st.ultimaActividad = performance.now(); st.interactuo = true; } return; }
  escena.manejar(x || z ? { x: x / n, z: z / n } : null);
  if (x || z) { st.ultimaActividad = performance.now(); st.interactuo = true; }
}
addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (!FLECHA[k] || (e.target.closest && e.target.closest('input, textarea, select'))) return; e.preventDefault(); if (!flechas.has(k)) { flechas.add(k); empujar(); } });
addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (!FLECHA[k]) return; flechas.delete(k); empujar(); });
addEventListener('blur', () => { flechas.clear(); empujar(); });

// El cursor se esconde cuando no se usa (pantalla de exhibición)
let cursorTimer = 0;
addEventListener('mousemove', () => { document.body.classList.remove('sin-cursor'); clearTimeout(cursorTimer); cursorTimer = setTimeout(() => document.body.classList.add('sin-cursor'), 3000); });

/* ---------- Escena ---------- */
document.body.classList.toggle('debug', st.debug);
descargas.montar($('#descargas'));
/* Reloj y clima del lugar. El entorno sigue la hora mientras nadie lo cambie a mano. */
let entornoAuto = null;
function ambienteReal() {
  const nuevo = tiempo.entornoReal(), actual = escena.getEntorno();
  if (entornoAuto === null || actual === entornoAuto) { escena.setEntorno(nuevo); entornoAuto = nuevo; }
}
tiempo.iniciarReloj({ hora: $('#reloj-h'), fecha: $('#reloj-f') });
setInterval(() => { if (document.body.classList.contains('lista')) ambienteReal(); }, 5 * 60 * 1000);
// El cartel gira cuando cambia el número (un gesto, la voz, la tecla o la medianoche)
document.addEventListener('mimo:cartel', (e) => escena.setCartel(e.detail));
escena.iniciar(ui.escena).then(async () => {
  if (new URLSearchParams(location.search).get('sueno') !== '0') { try { crearSueno(escena.mundo()); } catch (e) { console.warn('Uku: sin atmósfera de sueño', e); } }
  if (escena.mundo().setBoca) escena.mundo().setBoca(voz.boca); // la boca de Uku sigue su voz
  try { efectos3d = crearEfectos3d(escena.mundo()); ui.efectos.style.display = 'none'; } catch (e) { console.warn('Uku: efectos 3D no disponibles, uso la capa 2D', e); }
  // El clima de verdad: Uku se viste para el lugar y el entorno sigue la hora (con lluvia, llueve)
  tiempo.iniciarClima($('#reloj-c'), (c) => { escena.setClima(c.look); ambienteReal(); }).then(() => ambienteReal());
  escena.setCartel(Object.assign(cartel.estado(), { animar: false }));
  escena.setClaro(memoria.mundo()); // el claro crece con la relación
  cartel.vigilar();
  document.body.classList.add('lista');
  decir(frase('quienSoy'), 4500, { hablar: false });
}).catch((e) => { console.error(e); estado('No pude cargar a Uku', 'error'); });

// Cada cosa nueva que Uku aprende de Fran hace florecer el claro (la «energía» del planeta de Tolan)
document.addEventListener('mimo:aprendio', () => { if (document.body.classList.contains('lista')) { efectos.lanzar('jardin', { x: .62, y: .55 }); escena.setClaro(memoria.mundo()); } });

// Para pruebas y para operar desde la consola
window.Mimo = { alternarHud, tiempo, ambienteReal, seguirCaras, hayDueno, hayVisita, cartel, setModo, get modo() { return modo; }, callandoPorDueno, despierto, jugar, fx, REACCION, mente, escena, reaccionar, procesar, decir, efectos, caras, visitas, atiende, panel, st, gestos, oir, oido, descargas, modoDueno, memoria, abrirTema, cerrarConversacionConFran, guiarme, get guiando() { return !!guiando; }, setControl, setPajaro, setEspejo, setDecorar, imitar, get espejo() { return espejoUltimo; } };
