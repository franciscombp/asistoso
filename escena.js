/* =====================================================================
   Uku · escena
   El mundo de Uku (assets/bosque3d.js): el planeta redondeado, el claro con
   su casa, el lago, flores amarillas y guayacanes, y Uku con sus gestos, su
   paseo despacio, su mirada y las mariposas que se le posan en la mano.
   Este módulo solo lo adapta a la pantalla grande:
   - Plano general (se ve el horizonte curvo del planeta).
   - Sin nadie, Uku pasea por su cuenta (ambiente "walk"); cuando alguien
     llega, se detiene, se voltea hacia la cámara y saluda (setFront).
   - Entornos: el cielo se pinta detrás del lienzo (que es transparente);
     de noche y en la fiesta el mundo pasa a su paleta oscura; la lluvia
     es la de bosque3d (con paraguas); en el jardín florece todo.
   Paleta: solo azul gris y amarillo.
   ===================================================================== */
const ENTORNOS = {
  dia:       { cielo: ['#c9d3e6', '#f6f6f5'] },
  atardecer: { cielo: ['#f7d96b', '#fbf4dd'] },
  noche:     { cielo: ['#2b3446', '#1f1f1f'], oscuro: true, estrellas: true },
  lluvia:    { cielo: ['#aeb6c7', '#e4e7ec'], lluvia: true },
  fiesta:    { cielo: ['#3c4659', '#1f1f1f'], oscuro: true, estrellas: true, fiesta: true },
  jardin:    { cielo: ['#d6deec', '#fbf6e4'], flores: true }
};
export const NOMBRES_ENTORNO = Object.keys(ENTORNOS);
let vestuario = {}; // lo que Uku se pone según el clima real (assets/clima.js › look)

/* El claro de Fran: su casa con chimenea, flores en los canteros, dos guayacanes y cinco mariposas; y el
   escenario: el lago con sus patos, 24 árboles del bosque nublado, la tortuga de Galápagos en la orilla y el
   cartel de días sin accidentes (más la banca, el farol, el huerto, la cascada, el puente…). */
const MUNDO = { casa: true, flores: true, guayacanes: 2, mariposas: 5,
  escenario: { lago: 1.15, arboles: 24, tortuga: true, cartel: true } };
const FLORES = { normal: 45, jardin: 100 };
// Cuánto dura cada gesto de bosque3d (s), para no encimar reacciones
const DURA = { wave: 2.7, happy: 2.4, nod: 3.4, talk: 2.2, worried: 3.8, read: 16 };

let b3d = null, cont = null, entorno = 'dia', frenteDesde = 0, frente = false;
let estrellas = null, luces = null;

export async function iniciar(contenedor) {
  cont = contenedor;
  document.documentElement.setAttribute('data-theme', 'light');
  // Capas del cielo: detrás del lienzo las estrellas; encima, las luces de la fiesta
  estrellas = document.createElement('div'); estrellas.className = 'mimo-estrellas';
  cont.appendChild(estrellas);
  b3d = await import('./assets/bosque3d.js');
  if (!b3d.supported()) throw new Error('sin-webgl');
  await new Promise((listo) => b3d.attach(cont, { score: 85, onReady: listo, onTap: () => b3d.play('happy') }));
  luces = document.createElement('div'); luces.className = 'mimo-luces';
  cont.appendChild(luces);
  b3d.setClaro(MUNDO);
  b3d.setBloom(FLORES.normal);
  encuadre(false); // plano general: el planeta redondeado
  b3d.setShift(-.1, 0, true); // Uku un poco a la izquierda: el globo de texto va a su derecha
  libre();
  pintarCielo();
  return { b3d };
}

/* gesto(nombre): saluda (wave), contento (happy), asiente (nod), habla (talk),
   preocupado (worried). Devuelve cuánto dura (s). */
const ALIAS = { water: 'happy', plant: 'happy' }; // plantar agacha a Uku bajo el suelo: no se usa
export function gesto(nombre) {
  if (!b3d) return 0;
  const g = ALIAS[nombre] || nombre;
  if (!DURA[g]) return 0;
  b3d.play(g);
  return DURA[g];
}
export function ojos() {} // bosque3d pestañea y pone los ojos contentos con sus gestos

/* ---------- Pasear y venir a saludar ---------- */
/* Encuadre: sin nadie, plano general del planeta; con alguien, la cámara se
   acerca a Uku (bosque3d mueve la cámara con suavidad, nunca de golpe). */
function encuadre(cerca) {
  b3d.setPlano(!cerca);
  b3d.setZoom(cerca ? .8 : .85);
}
// libre(retraso, { cerca }): pasea por el claro y mira las mariposas y el paisaje.
// cerca = hay alguien pero no está jugando: pasea sin que la cámara se aleje.
export function libre(retraso, { cerca = false } = {}) {
  if (!b3d) return;
  frente = false;
  b3d.setFront(false);
  b3d.setAmbient('walk');
  encuadre(cerca);
}
// venir(alListo): se detiene, se voltea hacia la cámara y, ya de frente, llama a alListo
let venirTimer = 0;
export function venir(alListo) {
  if (!b3d) return;
  clearTimeout(venirTimer);
  if (frente && performance.now() - frenteDesde > 900) { if (alListo) alListo(); return; }
  if (!frente) { frente = true; frenteDesde = performance.now(); b3d.setAmbient(null); b3d.setFront(true); encuadre(true); }
  venirTimer = setTimeout(() => { if (alListo) alListo(); }, Math.max(0, 1100 - (performance.now() - frenteDesde)));
}
export function enCasa() { return frente && performance.now() - frenteDesde > 900; }

/* ---------- Entornos ---------- */
export function setEntorno(nombre) {
  const e = ENTORNOS[nombre];
  if (!e || nombre === entorno || !b3d) return false;
  entorno = nombre;
  document.documentElement.setAttribute('data-theme', e.oscuro ? 'dark' : 'light'); // bosque3d se repinta solo
  b3d.setLook({ rain: !!e.lluvia || !!vestuario.rain });
  b3d.setBloom(e.flores ? FLORES.jardin : FLORES.normal);
  pintarCielo();
  return true;
}
// El clima de verdad: Uku se viste para el lugar (paraguas, gorro, sombrero, gafas) y con lluvia llueve
export function setClima(look) {
  vestuario = look || {};
  if (b3d) b3d.setLook(Object.assign({}, vestuario, { rain: !!vestuario.rain || !!(ENTORNOS[entorno] && ENTORNOS[entorno].lluvia) }));
}
// El cartel «X días sin accidentes» del escenario: { dias, record, animar }
export function setCartel(c) { if (b3d) b3d.setCartel(c); }
// El claro crece con la relación (memoria.js › mundo()): lo que no venga, queda como en MUNDO
export function setClaro(c) { if (!b3d || !c) return; b3d.setClaro(Object.assign({}, MUNDO, c, { escenario: Object.assign({}, MUNDO.escenario, c.escenario || {}) })); }
// Ánimo que se queda un rato (feliz, tranquilo, pensativo) según el tono de la conversación
export function setAnimo(a) { if (b3d && b3d.setMood) b3d.setMood(a || null); }
export function getEntorno() { return entorno; }
function pintarCielo() {
  const e = ENTORNOS[entorno], b = document.body;
  b.dataset.entorno = entorno;
  b.style.setProperty('--cielo0', e.cielo[0]);
  b.style.setProperty('--cielo1', e.cielo[1]);
  b.style.setProperty('--sueno', e.cielo[1]); // los bordes se funden con el cielo
  estrellas.classList.toggle('is-on', !!e.estrellas);
  if (luces) luces.classList.toggle('is-on', !!e.fiesta);
}

/* ---------- Dónde está Uku en la pantalla ---------- */
// Punto junto a la cabeza (px), para ubicar el globo de texto
export function puntoCabeza() {
  const h = b3d && b3d.head();
  if (!h) return null;
  return { x: h.x + h.r * .6, y: h.y - h.r * .2 };
}
// ¿Se le ve? (para no hablar si quedó fuera de cuadro)
export function enEscena() { const q = puntoCabeza(); return !!q && q.x > 40 && q.x < cont.clientWidth - 40; }

// Para pruebas y depuración
// Manejar a Uku con el teclado (flechas): dir = { x, z } o null. Si estaba al frente, se suelta para que pasee
export function manejar(dir) {
  if (!b3d) return;
  if (dir && frente) { frente = false; b3d.setFront(false); b3d.setAmbient('walk'); }
  if (dir) { b3d.setAmbient('walk'); clearTimeout(venirTimer); }
  b3d.manejar(dir);
}
/* ---------- Guíame (el juego de Her): Uku se pierde y lo traes a casa ---------- */
// perderse(): Uku aparece lejos, a la entrada del bosque o tras el lago, quieto y sin pasear
export function perderse() {
  if (!b3d) return false;
  clearTimeout(venirTimer); frente = false; b3d.setFront(false); b3d.setAmbient(null);
  const sitios = ['cartel', 'cascada', 'lena', 'huerto'].filter(s => b3d.sitiosDePaseo().includes(s));
  const ok = sitios.length ? b3d.colocarEn(sitios[Math.floor(Math.random() * sitios.length)]) : false;
  encuadre(false);
  return ok;
}
// guiar(dir): lo empuja en esa dirección de pantalla ({ x, z } o null para que pare)
export function guiar(dir) { if (b3d) b3d.manejar(dir); }
export function distanciaACasa() { if (!b3d) return 99; const c = b3d.casa(); return b3d.distanciaA(c.x, c.z); }
export function dondeEsta() { return b3d ? b3d.dondeEsta() : null; }
// El módulo del mundo 3D (para dibujar efectos dentro de la escena)
export const mundo = () => b3d;
export function _debug() { return { b3d, entorno, frente }; }
