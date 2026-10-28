/* =====================================================================
   Uku · atiende por Fran
   - Estado de Fran (lo elige Fran antes de irse, en el panel): fue al baño,
     está en el Piso 10, en una reunión, almorzando o
     un texto propio, y cuándo vuelve.
   - entender(texto): qué quiere quien habla. Primero palabras clave (rápido
     y seguro); si no alcanza, el modelo de frases de oido.js compara el
     sentido con frases de ejemplo (así entiende "¿anda por aquí Fran?").
   - responder(intencion): la respuesta sale del estado que dejó Fran, nunca
     se inventa dónde está.
   - Recados: "déjale un mensaje" → Uku pide el mensaje y lo guarda; "dile
     que…" lo guarda de una. Fran los ve en el panel y Uku se los cuenta.
   - Conversación libre (mente.js, un modelo de lenguaje en el navegador):
     todo lo que no es una acción (guardar un mensaje, el cartel) lo
     contesta el modelo, con lo que Uku sabe y lo que se habló antes con
     esa persona. Sin el modelo, Uku responde con sus frases de siempre.
   - Respuestas al toque: lo que más preguntan (quién eres, qué puedes
     hacer, en cuánto regresa, cómo estás, un chiste…) se contesta al
     instante con frases de frases.js (CHARLA), sin esperar al modelo.
   localStorage: mimo_estado y mimo_mensajes.
   ===================================================================== */
import * as oido from './oido.js?v=__BUILD__';
import * as mente from './mente.js?v=__BUILD__';
import * as cartel from './cartel.js?v=__BUILD__';
import { charla, una, sacar, ADIVINANZAS } from './frases.js?v=__BUILD__';

/* ---------- Estado de Fran ---------- */
// donde/cuando: el dato tal cual (panel y modelo de lenguaje); dondes/cuandos: cómo lo cuenta Uku, con humor
export const ESTADOS = {
  bano: { t: 'Fue al baño', donde: '{dueno} fue al baño, ya mismo viene.', cuando: 'Ya mismo viene, en unos minutos.',
    dondes: ['{dueno} fue al baño. Asuntos oficiales, ya mismo viene.', '{dueno} salió un ratito al baño. No pregunté detalles.', 'Está en el baño. Hasta los jefes tienen que ir.'],
    cuandos: ['En unos minutos. Depende de la fila, supongo.', 'Ya mismo. Nadie se queda a vivir en el baño… espero.', 'Pronto. Le doy cinco minutos antes de preocuparme.'] },
  piso10: { t: 'En el Piso 10', donde: '{dueno} está en el Piso 10.', cuando: 'Regresa cuando termine en el Piso 10.',
    dondes: ['{dueno} subió al Piso 10. Allá arriba se deciden cosas importantes.', 'Está en el Piso 10. Si ves un ascensor, ahí va.', '{dueno} anda en el Piso 10, codeándose con las alturas.'],
    cuandos: ['Cuando termine en el Piso 10. Allá las reuniones son largas, pero las vistas son buenas.', 'Apenas baje del Piso 10. Diez pisos no se bajan volando.'] },
  reunion: { t: 'En una reunión', donde: '{dueno} está en una reunión.', cuando: 'Vuelve cuando termine la reunión.',
    dondes: ['{dueno} está en una reunión. De esas que pudieron ser un correo.', 'Está en una reunión, salvando al mundo. O eso dijo.', '{dueno} está reunido. Le guardo el puesto.'],
    cuandos: ['Cuando termine la reunión. Nadie sabe cuándo terminan las reuniones.', 'Apenas acabe la reunión. Crucemos los dedos.'] },
  almuerzo: { t: 'Salió a almorzar', donde: '{dueno} salió a almorzar.', cuando: 'Vuelve después del almuerzo.',
    dondes: ['{dueno} salió a almorzar. Ojalá traiga postre.', 'Está almorzando. Un jefe con hambre no rinde, dice la ciencia.', '{dueno} fue a comer. Yo me quedé con mi miel imaginaria.'],
    cuandos: ['Después del almuerzo. Si hay sobremesa, un poquito más.', 'Cuando termine de comer. Con suerte, sin siesta.'] },
  propio: { t: 'Otro…', donde: '{texto}', cuando: 'No sé exactamente cuándo vuelve.',
    dondes: ['{texto}'], cuandos: ['No sé exactamente cuándo vuelve. No me dejó horario.', 'Eso no me lo dijo. Los jefes y sus misterios.'] }
};
// Con hora de regreso (la que Fran escribió en el panel)
const CON_HORA = ['{dueno} vuelve {vuelve}. Yo le cuido la silla mientras tanto.', 'Dijo que vuelve {vuelve}. Le creo… casi siempre.', 'Según {dueno}, vuelve {vuelve}. Yo voy contando los minutos.'];
const al = (l) => l[Math.floor(Math.random() * l.length)];
const llenarCon = (t, d) => t.replace(/\{(\w+)\}/g, (m, k) => d[k] != null ? d[k] : m).replace(/\s+/g, ' ').trim();
// Dónde está y cuándo vuelve, como lo dice Uku (con humor); exacto: el dato sin adornos
export function decirDonde(dueno = 'Fran', { exacto = false } = {}) {
  const e = estado(), E = ESTADOS[e.tipo] || ESTADOS.bano, d = { dueno, texto: e.texto || dueno + ' no está ahora.', vuelve: e.vuelve };
  return llenarCon(exacto ? E.donde : al(E.dondes), d) + (e.vuelve ? ` Vuelve ${e.vuelve}.` : '');
}
export function decirCuando(dueno = 'Fran') {
  const e = estado(), E = ESTADOS[e.tipo] || ESTADOS.bano;
  return llenarCon(e.vuelve ? al(CON_HORA) : al(E.cuandos), { dueno, vuelve: e.vuelve });
}
const KE = 'mimo_estado', KM = 'mimo_mensajes';
export function estado() { try { return Object.assign({ tipo: 'bano', texto: '', vuelve: '' }, JSON.parse(localStorage.getItem(KE) || '{}')); } catch (e) { return { tipo: 'bano', texto: '', vuelve: '' }; } }
export function setEstado(e) { try { localStorage.setItem(KE, JSON.stringify(Object.assign(estado(), e))); } catch (x) {} document.dispatchEvent(new CustomEvent('mimo:estado')); }

/* ---------- Mensajes ---------- */
export function mensajes() { try { return JSON.parse(localStorage.getItem(KM) || '[]'); } catch (e) { return []; } }
function guardarMensajes(l) { try { localStorage.setItem(KM, JSON.stringify(l.slice(-100))); } catch (e) {} document.dispatchEvent(new CustomEvent('mimo:mensajes')); }
export function dejarMensaje(texto, personaId) { const l = mensajes(); l.push({ id: Date.now().toString(36), texto, personaId: personaId || null, fecha: Date.now(), visto: false }); guardarMensajes(l); }
export function mensajesNuevos() { return mensajes().filter(m => !m.visto); }
export function marcarMensajesVistos() { const l = mensajes(); l.forEach(m => { m.visto = true; }); guardarMensajes(l); }
export function borrarMensaje(id) { guardarMensajes(mensajes().filter(m => m.id !== id)); }
export function moverPersona(desde, hacia) { const l = mensajes(); l.forEach(m => { if (m.personaId === desde) m.personaId = hacia; }); guardarMensajes(l); }

/* ---------- Entender ---------- */
const norm = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,;:"«»]/g, ' ').replace(/\s+/g, ' ').trim();
// "dile que llegué", "avísale que vine", "dígale que lo llamé" → el recado viene incluido
const RECADO_DIRECTO = /\b(?:dile|digale|dígale|avisale|avísale|cuentale|cuéntale|comentale|coméntale)\s+(?:a\s+\w+\s+)?que\s+(.+)/i;
const CLAVES = [
  // Fran pregunta por lo suyo (a otros, Uku no les cuenta)
  ['visitas', /\b(quien (me )?vino|vino alguien|quienes vinieron|alguien (me )?(busco|vino|paso)|me buscaron|como estuvo el turno|alguna novedad|que paso mientras)\b/],
  ['misMensajes', /\b(tengo (algun )?(mensajes?|recados?)|me dejaron (algo|algun|mensajes?|recados?)|algun (mensaje|recado)|mis (mensajes|recados)|leeme)\b/],
  ['hora', /\b(que hora (es|son)|la hora|me das la hora|hora actual)\b/],
  ['fecha', /\b(que dia (es|estamos)|que fecha|fecha de hoy|dia de hoy|a cuanto estamos)\b/],
  ['repetir', /\b(repite|repitelo|repiteme|no te escuche|que dijiste|como dijiste|puedes repetir)\b/],
  ['otro', /^(otro|otra|otro mas|otra mas|dame otro|dime otro|dame otra|dime otra|otra vez|siguiente)\b|\b(otro|otra) (chiste|adivinanza|dato|cuento|secreto|consejo|tip)\b/],
  ['adivinanza', /\b(adivinanza|acertijo|adivina adivinador|ponme una adivinanza)\b/],
  ['cuento', /\b(cuento|historia|cuentame algo largo)\b/],
  ['secreto', /\b(secreto|confesion)\b/],
  ['dato', /\b(dato curioso|dato interesante|sabias que|dime un dato)\b/],
  ['tip', /\b(tip|consejo|un consejo|dame un consejo|recomendacion)\b/],
  ['canta', /\b(canta|cantame|una cancion|tararea|cantas)\b/],
  ['baila', /\b(baila|bailar|bailas|sabes bailar|un baile)\b/],
  ['cumple', /\b(cumpleanos|cumple|feliz cumple)\b/],
  ['insulto', /\b(eres (un |una |muy |bien )?(feo|tonto|torpe|inutil|bobo|burro|estupido|idiota|malo|aburrido|lento)|te odio|callate la boca|que asco|no sirves|estupido|idiota|imbecil)\b/],
  ['piropo', /\b(eres (un |una |el |muy |bien )?(lindo|bonito|guapo|tierno|genial|simpatico|gracioso|el mejor|un amor|divino|encantador|adorable)|te quiero|te amo|me caes bien|me gustas|que lindo|que tierno)\b/],
  ['hambre', /\b(tengo hambre|me muero de hambre|que (vas a )?comer|que comes|a almorzar|vamos a comer|que rico)\b/],
  ['cafe', /\b(un cafe|tomamos cafe|quieres cafe|cafecito|tinto)\b/],
  ['cansado', /\b(estoy cansad[oa]|tengo sueno|que sueno|estoy agotad[oa]|no doy mas|estoy rendid[oa])\b/],
  ['aburrido', /\b(estoy aburrid[oa]|me aburro|que aburrido|aburrimiento)\b/],
  ['triste', /\b(estoy triste|me siento mal|tuve un mal dia|estoy mal|estoy estresad[oa]|estoy deprimid[oa]|no me siento bien|tengo pena)\b/],
  ['feliz', /\b(estoy feliz|estoy contento|estoy contenta|que alegria|que felicidad|me siento bien|estoy de buenas)\b/],
  ['clima', /\b(clima|el tiempo|que tiempo|que calor|que frio|esta lloviendo|va a llover|hace calor|hace frio|temperatura)\b/],
  ['favoritos', /\b(color favorito|comida favorita|cancion favorita|que te gusta|tu favorito|tu hobby|que haces para divertirte)\b/],
  ['familia', /\b(tienes (novia|novio|pareja|familia|hermanos|hijos|mama|papa|amigos)|estas casado|eres soltero)\b/],
  ['sueldo', /\b(te pagan|tu sueldo|cuanto ganas|vacaciones|trabajas mucho|trabajas)\b/],
  ['ayuda', /\b(ayuda|que gestos|como juego|como se juega|como funciona|que gestos hay|instrucciones)\b/],
  ['silencio', /\b(callate|silencio|shh+|no hables|calladito)\b/],
  ['presente', /\b(estas ahi|me escuchas|me oyes|hay alguien|alo|aloo|donde estas tu)\b/],
  ['buenasNoches', /\b(buenas noches|hasta manana|que descanses|a dormir)\b/],
  ['nombre', /\b(como me llamo|sabes mi nombre|sabes quien soy|quien soy yo|me conoces|me recuerdas)\b/],
  ['quienEsDueno', /\b(quien es (fran|tu jefe|tu dueno)|como es (fran|tu jefe)|que hace (fran|tu jefe)|hablame de (fran|tu jefe)|cuentame de (fran|tu jefe))\b/],
  // Cartel «X días sin accidentes» (el de poner un número lo resuelve entender())
  ['cartelReset', /\b(hubo un accidente|tuvimos un accidente|ocurrio un accidente|paso un accidente|se accidento|reinicia\w* (el )?(cartel|letrero|contador)|(cartel|letrero|contador) (en|a) cero|pon\w* (el )?(cartel|letrero|contador) en cero)\b/],
  ['cartelMas', /\b(un dia mas|otro dia mas|suma\w* un dia|sumale un dia|un dia sin accidentes)\b/],
  ['cartel', /\b(cartel|letrero|dias sin accidentes?|cuantos dias llevamos|cuanto llevamos|record de dias|racha)\b/],
  ['mensaje', /\b(mensaje|recado|nota|avisale|dile|digale|dejarle|dejale|dejar dicho|encargo)\b/],
  ['puedes', /\b(que (puedes|sabes) hacer|que haces|para que sirves|en que (me )?(puedes )?ayudar|que mas (haces|puedes|sabes)|como funcionas|cual es tu trabajo|a que te dedicas)\b/],
  ['quien', /\b(quien eres|quien sos|como te llamas|cual es tu nombre|tu nombre|que eres|que cosa eres)\b/],
  ['real', /\b(eres (un )?(robot|real|de verdad|una ia|inteligencia artificial|humano|persona)|estas vivo)\b/],
  ['edad', /\b(cuantos anos tienes|que edad tienes|tu edad)\b/],
  ['chiste', /\b(chiste|algo gracioso|hazme reir|cuentame algo|dime algo)\b/],
  ['comoEstas', /\b(como estas|como te va|que tal estas|todo bien|como te sientes|que cuentas|como andas)\b/],
  ['cuando', /\b(cuando (vuelve|regresa|viene|llega)|en cuanto (vuelve|regresa|viene|llega|rato|tiempo)|a que hora|demora|tarda|falta mucho|ya viene|ya vuelve|vuelve pronto|regresa pronto|cuanto (tiempo|falta|se demora)|hasta que hora)\b/],
  ['donde', /\b(donde (esta|anda|se fue|fue|se metio)|esta (fran|el|ahi|aqui|tu jefe)|se encuentra|anda por|busco a|buscando a|vino hoy|no esta|esta en la oficina)\b/],
  ['llamar', /\b(llamar|llamarlo|telefono|celular|numero|whatsapp|escribirle|correo|email|contactarlo)\b/],
  ['gracias', /\b(gracias|muy amable|chevere|bacan)\b/],
  ['chao', /\b(chao|chau|adios|hasta luego|nos vemos|me voy)\b/],
  ['saludo', /^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|que tal|hey|epa)\b/]
];
// Frases de ejemplo para el modelo de frases (se comparan por sentido)
const EJEMPLOS = {
  donde: ['¿Dónde está Fran?', '¿Está Fran?', 'Busco a Fran', '¿Anda por aquí Fran?', '¿Fran vino a trabajar hoy?', '¿Sabes dónde se fue?', '¿Dónde está tu jefe?'],
  cuando: ['¿Cuándo vuelve?', '¿A qué hora regresa?', '¿Se va a demorar?', '¿Tardará mucho?', '¿Viene pronto?'],
  mensaje: ['Quiero dejarle un mensaje', '¿Le puedes dar un recado?', 'Avísale que vine', 'Dile que lo busqué', '¿Le dejo una nota?'],
  quien: ['¿Quién eres?', '¿Cómo te llamas?', '¿Qué eres tú?'],
  puedes: ['¿Qué puedes hacer?', '¿Para qué sirves?', '¿En qué me ayudas?'],
  comoEstas: ['¿Cómo estás?', '¿Qué tal te va?'],
  chiste: ['Cuéntame un chiste', 'Dime algo gracioso'],
  llamar: ['¿Tienes su número?', '¿Lo puedo llamar?', '¿Cómo lo contacto?'],
  gracias: ['Gracias', 'Muchas gracias, muy amable'],
  chao: ['Chao', 'Hasta luego, nos vemos'],
  saludo: ['Hola', 'Buenos días', '¿Qué tal?']
};
let ejemplos = null; // [{ intencion, vec }]
async function prepararEjemplos() {
  if (ejemplos) return ejemplos;
  const pares = Object.entries(EJEMPLOS).flatMap(([k, l]) => l.map(t => [k, t]));
  const vs = await oido.vectores(pares.map(p => p[1]));
  if (!vs) return null;
  ejemplos = pares.map((p, i) => ({ intencion: p[0], vec: vs[i] }));
  return ejemplos;
}
document.addEventListener('oido:sentido', () => { prepararEjemplos().catch(() => {}); });
const coseno = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

/* Cuentas: "2 + 2", "dos más dos", "cuánto es 15 por 3". Devuelve { cuenta, resultado } o { cero } o null. */
const NUMEROS = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, mil: 1000 };
export function aMate(t) {
  const n = t.split(' ').map(w => NUMEROS[w] !== undefined ? String(NUMEROS[w]) : w).join(' ');
  const m = n.match(/(\d+)\s*(\+|mas|-|menos|x|\*|por|multiplicado por|\/|entre|dividido entre|dividido por|dividido)\s*(\d+)/);
  if (!m) return null;
  const a = +m[1], b = +m[3], op = m[2];
  const suma = op === '+' || op === 'mas', resta = op === '-' || op === 'menos', mult = /^(x|\*|por|multiplicado por)$/.test(op);
  if (!suma && !resta && !mult && b === 0) return { cero: true };
  const r = suma ? a + b : resta ? a - b : mult ? a * b : a / b;
  const sim = suma ? '+' : resta ? '−' : mult ? '×' : '÷';
  return { cuenta: `${a} ${sim} ${b}`, resultado: Number.isInteger(r) ? String(r) : r.toFixed(2).replace('.', ',') };
}

/* entender(texto, dueno) → { intencion, recado?, confianza, por } */
export async function entender(texto, dueno = 'Fran') {
  const t = norm(texto);
  if (!t) return { intencion: null };
  const cuenta = aMate(t);
  if (cuenta) return { intencion: 'mate', cuenta, confianza: 1, por: 'claves' };
  // «pon el cartel en 15» (también «en quince»)
  const tn = t.split(' ').map(w => NUMEROS[w] !== undefined ? String(NUMEROS[w]) : w).join(' ');
  const np = /\b(cartel|letrero|contador)\b/.test(tn) && /\b(pon|poner|ponle|cambia|cambiar|actualiza|actualizar|deja|dejar)\w*\b/.test(tn) && tn.match(/\b(\d{1,3})\b/);
  if (np && !/\bcero\b/.test(tn)) return { intencion: 'cartelPon', numero: +np[1], confianza: 1, por: 'claves' };
  const r = (texto || '').match(RECADO_DIRECTO);
  if (r && r[1].trim().split(' ').length >= 2) return { intencion: 'mensaje', recado: limpiarRecado(r[1]), confianza: 1, por: 'claves' };
  const c = CLAVES.find(([, re]) => re.test(t));
  if (c) return { intencion: c[0], confianza: 1, por: 'claves' };
  // Solo nombran al dueño ("¿Fran?", "¿y Fran?"): lo están buscando
  if (new RegExp('\\b' + norm(dueno) + '\\b').test(t) && t.split(' ').length <= 4) return { intencion: 'donde', confianza: .9, por: 'claves' };
  const ej = await prepararEjemplos().catch(() => null);
  if (ej) {
    const [v] = await oido.vectores([texto]);
    let mejor = null, sim = -1;
    ej.forEach(e => { const s = coseno(v, e.vec); if (s > sim) { sim = s; mejor = e.intencion; } });
    if (sim >= .55) return { intencion: mejor, confianza: sim, por: 'modelo' };
  }
  return { intencion: null, confianza: 0, por: ej ? 'modelo' : 'claves' };
}
function limpiarRecado(t) { t = t.trim().replace(/[.\s]+$/, ''); return t.charAt(0).toUpperCase() + t.slice(1) + '.'; }

/* ---------- Responder ----------
   conversar(texto, { dueno, personaId, nombre, esDueno, visitas, alParcial })
   → { texto, gesto, intencion }.
   nombre: cómo se llama quien habla (null si no se sabe); esDueno: es Fran.
   visitas: nombres de quienes vinieron (solo para Fran). alParcial(texto):
   la respuesta del modelo mientras se escribe.
   Recuerda si está esperando un mensaje (20 s) y lo que se habló (historial). */
let esperando = 0, historial = [];
// Quien llega empieza una conversación nueva (Uku no mezcla lo que le dijo otra persona)
export function nuevaConversacion() { historial = []; esperando = 0; }
function anotar(usuario, uku) { historial.push({ role: 'user', content: usuario }, { role: 'assistant', content: uku }); historial = historial.slice(-12); }
let ultimaIntencion = null, ultimoTexto = '', adivinanza = null;
// Las que se pueden repetir con «otro»
const REPETIBLES = new Set(['chiste', 'dato', 'cuento', 'secreto', 'adivinanza', 'tip', 'piropo', 'canta', 'baila', 'comoEstas']);
export async function conversar(texto, opciones = {}) {
  const r = await conversarSinAnotar(texto, opciones);
  if (r.intencion !== 'libre') anotar(texto, r.texto);
  if (r.texto) ultimoTexto = r.texto;
  if (REPETIBLES.has(r.intencion)) ultimaIntencion = r.intencion;
  return r;
}
// Las que Uku contesta al toque (sin el modelo): son las que más preguntan
const AL_TOQUE = new Set(['donde', 'cuando', 'quien', 'puedes', 'real', 'edad', 'chiste', 'comoEstas', 'llamar', 'gracias', 'chao', 'saludo', 'visitas', 'misMensajes',
  'mate', 'hora', 'fecha', 'adivinanza', 'cuento', 'secreto', 'dato', 'tip', 'canta', 'baila', 'cumple', 'insulto', 'piropo', 'hambre', 'cafe', 'cansado', 'aburrido', 'triste', 'feliz', 'clima',
  'favoritos', 'familia', 'sueldo', 'ayuda', 'silencio', 'presente', 'buenasNoches', 'nombre', 'quienEsDueno', 'cartel', 'cartelMas', 'cartelReset', 'cartelPon']);
// Lo que acompaña a cada respuesta en pantalla: efecto de emojis, movimiento de la escena o entorno
const EXTRA = {
  chiste: { efecto: 'risa', fx: 'salto' }, piropo: { efecto: 'beso', fx: 'salto' }, insulto: { efecto: 'sorpresa', fx: 'tiembla' }, hambre: { efecto: 'hambre' }, cafe: { efecto: 'cafe' },
  cansado: { efecto: 'sueno' }, aburrido: { efecto: 'estrellas' }, triste: { efecto: 'abrazo' }, feliz: { efecto: 'sonrisa', fx: 'salto' }, cumple: { efecto: 'cumple', entorno: 'fiesta', fx: 'salto' },
  canta: { efecto: 'musica', fx: 'baile' }, baila: { efecto: 'musica', entorno: 'fiesta', fx: 'baile' }, buenasNoches: { efecto: 'sueno', entorno: 'noche' }, clima: { efecto: 'estrellas' },
  secreto: { efecto: 'sorpresa' }, adivinanza: { efecto: 'estrellas' }, mate: { efecto: 'estrellas' }, dato: { efecto: 'estrellas' }
};
async function conversarSinAnotar(texto, ctx) {
  const { dueno = 'Fran', personaId = null, esDueno = false, visitas = [], duenoAqui = false } = ctx;
  const d = { dueno };
  // Si Uku pidió el mensaje, lo que digan ahora es el mensaje
  if (esperando && Date.now() < esperando) {
    esperando = 0;
    const m = limpiarRecado(texto);
    dejarMensaje(m, personaId);
    return { intencion: 'mensaje-guardado', gesto: 'nod', texto: charla('mensajeGuardado', { dueno, mensaje: m }) };
  }
  // Una adivinanza pendiente: lo que digan ahora es la respuesta
  if (adivinanza && Date.now() < adivinanza.hasta && !/adivinanza|acertijo/.test(norm(texto))) { // si pide otra, se olvida la pendiente
    const t = norm(texto), A = adivinanza;
    if (A.r.test(t)) { adivinanza = null; return { intencion: 'adivinanza-bien', gesto: 'happy', texto: charla('adivinanzaAcierta', d), efecto: 'trofeo' }; }
    if (/\b(me rindo|no se|no lo se|dime|cual es|la respuesta|rendirme|ni idea)\b/.test(t) || ++A.intentos >= 3) { adivinanza = null; return { intencion: 'adivinanza-rinde', gesto: 'nod', texto: charla('adivinanzaRinde', { respuesta: A.a }) }; }
    return { intencion: 'adivinanza-falla', gesto: 'nod', texto: charla('adivinanzaFalla', d) };
  }
  adivinanza = null;
  const q = await entender(texto, dueno);
  if (q.intencion === 'otro') {
    if (!ultimaIntencion) return { intencion: 'otro-nada', gesto: 'nod', texto: charla('otroNada', d) };
    q.intencion = ultimaIntencion;
  }
  if (q.intencion === 'repetir') return { intencion: 'repetir', gesto: 'nod', texto: ultimoTexto || charla('repetirNada', d) };
  if (q.intencion === 'mensaje') {
    if (q.recado) { dejarMensaje(q.recado, personaId); return { intencion: 'mensaje-guardado', gesto: 'nod', texto: charla('mensajeGuardado', { dueno, mensaje: q.recado }) }; }
    esperando = Date.now() + 20000;
    return { intencion: 'mensaje-pedido', gesto: 'happy', texto: charla('pedirMensaje', d) };
  }
  if (AL_TOQUE.has(q.intencion)) return Object.assign({ intencion: q.intencion }, EXTRA[q.intencion] || {}, alToque(q.intencion, { dueno, esDueno, visitas, nombre: ctx.nombre, cuenta: q.cuenta, numero: q.numero, duenoAqui }));
  // Lo demás lo conversa el modelo de lenguaje (si está)
  if (mente.lista()) {
    const mensajes = [{ role: 'system', content: sistema(ctx) }, ...historial, { role: 'user', content: texto }];
    const t = await mente.responder(mensajes, ctx.alParcial).catch(err => { console.warn('Uku: la mente falló', err); return null; });
    if (t) {
      anotar(texto, t);
      // Si Uku pidió el mensaje, lo siguiente que digan se guarda
      if (/(dime|cu[eé]ntame|dicta(me)?)\b.{0,25}\b(mensaje|recado)|qu[eé] (mensaje|recado) (le )?(quieres|deseas)|cu[aá]l es (tu|el) (mensaje|recado)|qu[eé] le digo/i.test(t)) esperando = Date.now() + 25000;
      return { intencion: 'libre', gesto: /¡/.test(t) ? 'happy' : /\?/.test(t) ? 'nod' : 'talk', texto: t };
    }
  }
  return { intencion: null, gesto: 'worried', texto: charla('noEntendi', d) };
}
// Respuestas al toque: con Fran, sobre lo suyo; con otros, sobre Fran (sin datos privados)
function alToque(i, { dueno, esDueno, visitas, nombre, cuenta, numero, duenoAqui }) {
  const d = { dueno };
  // Fran está en cámara y le preguntan por él a otra persona
  if (duenoAqui && !esDueno) {
    if (i === 'donde') return { gesto: 'wave', texto: charla('dondeAqui', d) };
    if (i === 'cuando') return { gesto: 'happy', texto: charla('cuandoAqui', d) };
    if (i === 'saludo') return { gesto: 'wave', texto: charla('saludoAqui', d) };
  }
  // El clima de verdad (assets/clima.js), si se pudo saber
  if (i === 'clima' && window.Clima && Clima.last()) return { gesto: 'nod', texto: Clima.last().text, efecto: 'estrellas' };
  // Respuesta con su extra de pantalla (efecto, movimiento, entorno)
  const nuevo = (clave, texto, arg, gesto) => Object.assign({ gesto: gesto || 'happy', texto: texto(arg) }, EXTRA[clave] || {});
  switch (i) {
    case 'donde': return esDueno ? { gesto: 'happy', texto: charla('dondeDueno', d) }
      : { gesto: 'nod', texto: decirDonde(dueno) + (Math.random() < .5 ? ' ¿Le dejas un mensaje?' : '') };
    case 'cuando': return { gesto: 'nod', texto: esDueno ? '¿Tú? Ya volviste, jefe. Llegas justo a tiempo.' : decirCuando(dueno) };
    case 'quien': return { gesto: 'wave', texto: charla(esDueno ? 'quienDueno' : 'quien', d) };
    case 'puedes': return { gesto: 'happy', texto: charla(esDueno ? 'puedesDueno' : 'puedes', d) };
    case 'real': return { gesto: 'happy', texto: charla('real', d) };
    case 'edad': return { gesto: 'happy', texto: charla('edad', d) };
    case 'chiste': return { gesto: 'happy', texto: charla('chiste', d) };
    case 'comoEstas': return { gesto: 'happy', texto: charla('comoEstas', d) };
    case 'llamar': return { gesto: 'nod', texto: esDueno ? 'Tu número ya lo sabes tú, jefe.' : charla('llamar', d) };
    case 'gracias': return { gesto: 'happy', texto: charla('gracias', d) };
    case 'chao': return { gesto: 'wave', texto: esDueno ? '¡Chao, jefe! Yo cuido tu compu.' : charla('chao', d) };
    case 'saludo': return { gesto: 'wave', texto: esDueno ? charla('saludoDueno', d) : charla('saludo', { dueno, donde: decirDonde(dueno) }) };
    // El cartel de días sin accidentes: Uku lo cambia (la pizarra gira) y cuenta cómo quedó
    case 'cartel': return Object.assign({ gesto: 'nod', texto: charla('cartel', { dias: cartel.dias(), record: cartel.record() }) });
    case 'cartelMas': { const n = cartel.mas(); return { gesto: 'happy', texto: charla('cartelMas', { dias: n }), efecto: 'estrellas', fx: 'salto' }; }
    case 'cartelReset': { const x = cartel.accidente(); return { gesto: 'worried', texto: charla('cartelReset', x), fx: 'tiembla' }; }
    case 'cartelPon': { const n = cartel.poner(numero); return { gesto: 'happy', texto: charla('cartelPon', { dias: n }), efecto: 'estrellas' }; }
    case 'mate': return nuevo(i, c => c && c.cero ? charla('mateCero', d) : charla('mateBien', c), cuenta);
    case 'hora': return nuevo(i, () => charla('hora', { hora: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) }));
    case 'fecha': return nuevo(i, () => charla('fecha', { fecha: new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' }) }));
    case 'adivinanza': {
      const A = ADIVINANZAS[sacar('adivinanzas', ADIVINANZAS)];
      adivinanza = { r: A.r, a: A.a, hasta: Date.now() + 45000, intentos: 0 };
      return nuevo(i, () => A.p + ' Tienes tres intentos.');
    }
    case 'tip': return nuevo(i, () => una('tipIntro') + ' ' + una('tip'), null, 'nod');
    case 'nombre': return nuevo(i, () => nombre ? `Claro que sé quién eres: ${nombre}. Tengo muy buena memoria para las caras.` : `Todavía no sé cómo te llamas, pero tienes cara de buena gente. Pídele a ${dueno} que te presente en «Quién vino».`);
    case 'quienEsDueno': return nuevo(i, () => charla(esDueno ? 'dondeDueno' : 'quienEsDueno', d));
    case 'visitas':
      if (!esDueno) return { gesto: 'nod', texto: charla('visitasPrivado', d) };
      if (!visitas.length) return { gesto: 'happy', texto: 'Nadie, jefe. Turno tranquilo, ni una mosca.' };
      return { gesto: 'nod', texto: `Vino${visitas.length > 1 ? 'ron' : ''} ${listar(visitas)}. En «Quién vino» les pones nombre.` };
    case 'misMensajes': {
      if (!esDueno) return { gesto: 'nod', texto: charla('visitasPrivado', d) };
      const ms = mensajesNuevos();
      if (!ms.length) return { gesto: 'happy', texto: 'Ningún mensaje nuevo. Estás al día.' };
      return { gesto: 'nod', texto: (ms.length === 1 ? 'Tienes 1 mensaje: ' : `Tienes ${ms.length} mensajes. `) + ms.slice(-3).map(m => '«' + m.texto + '»').join(' ') };
    }
  }
  // Las demás son solo una frase de CHARLA con su extra
  if (CHARLA_SIMPLE.has(i)) return nuevo(i, () => charla(i, d), null, i === 'triste' ? 'nod' : i === 'insulto' ? 'worried' : 'happy');
  return { gesto: 'nod', texto: charla('noEntendi', d) };
}
const CHARLA_SIMPLE = new Set(['cuento', 'secreto', 'dato', 'canta', 'baila', 'cumple', 'insulto', 'piropo', 'hambre', 'cafe', 'cansado', 'aburrido', 'triste', 'feliz', 'clima', 'favoritos', 'familia', 'sueldo', 'ayuda', 'silencio', 'presente', 'buenasNoches']);
const listar = (l) => l.length <= 1 ? (l[0] || '') : l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1];

/* Lo que Uku sabe, para el modelo de lenguaje. Solo con Fran van sus visitas
   y sus mensajes: a nadie más se le pasa nada de eso. */
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
function sistema({ dueno = 'Fran', nombre = null, esDueno = false, visitas = [] }) {
  const ahora = new Date(), hora = ahora.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const l = [
    `Eres Uku, un osito de peluche digital con gafas amarillas y bufanda azul. Eres el asistente de ${dueno}: vives en la pantalla de su computadora y, cuando ${dueno} no está, atiendes a quien se acerca.`,
    'Tu estilo: español de Ecuador, de tú, cálido y gracioso, con humor blanco. Te encanta la miel, las mariposas y que nadie toque el teclado. Puedes inventar cosas graciosas sobre ti mismo.',
    'Responde SIEMPRE en una o dos frases cortas (menos de 30 palabras): tu respuesta se lee en voz alta. Sin emojis, sin listas, sin formato.',
    'Nunca inventes datos reales de nadie. Si no sabes algo, dilo con gracia.',
    `Hoy es ${DIAS[ahora.getDay()]} y son las ${hora}.`
  ];
  if (esDueno) {
    l.push(`Quien te habla es ${dueno}, tu jefe. Ya volvió y le tienes cariño.`);
    l.push(visitas.length ? `Mientras no estaba vinieron: ${visitas.join(', ')}.` : 'Mientras no estaba no vino nadie.');
    const ms = mensajesNuevos();
    l.push(ms.length ? `Le dejaron estos mensajes: ${ms.map(m => '«' + m.texto + '»').join(' ')}` : 'No tiene mensajes nuevos.');
  } else {
    l.push(nombre ? `Quien te habla es ${nombre}; ya lo conoces.` : 'Quien te habla es alguien que todavía no conoces.');
    l.push(`Dónde está ${dueno}: ${decirDonde(dueno, { exacto: true })} No digas otra cosa sobre dónde está ni cuándo vuelve.`);
    l.push(`Si quieren dejarle un mensaje a ${dueno}, responde: «Claro, dime tu mensaje y se lo paso».`);
    l.push(`Nunca des el teléfono, el correo ni datos personales de ${dueno}.`);
  }
  // Ejemplos del tono (se imitan mejor que las instrucciones)
  l.push('Ejemplos de tu tono:',
    'Persona: ¿Te gusta tu trabajo? → Uku: ¡Me encanta! Cuido una compu, veo mariposas y nadie me pide horas extra.',
    'Persona: ¿Qué hora es? → Uku: Son las ' + hora + '. Hora perfecta para un poquito de miel.',
    'Persona: Estoy cansado. → Uku: Uy, te entiendo. Respira hondo, estírate un poquito y sigue, que tú puedes.');
  return l.join('\n');
}

export function esperandoMensaje() { return !!esperando && Date.now() < esperando; }
