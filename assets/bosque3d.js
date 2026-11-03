/* =====================================================================
   El mundo 3D de Uku (módulo ES).

   - Un único renderer WebGL que se "muda" al contenedor activo.
   - Uku (assets/oso/uku-rig-v2.glb, ver uku-rig.js) con sus gestos hechos por
     código, más lentas y con menos amplitud (calm): saluda sin exagerar,
     respira, pestañea (los ojos están pintados en la textura y se cambian por
     variantes), mira a su alrededor y a las mariposas. Puede sostener
     objetos en la mano derecha y los accesorios van en la cabeza.
   - El planeta es una esfera, pero solo se ve (y se recorre) el claro
     alrededor de Uku: pasea despacio por ahí y vuelve.
   - Lo que hay en el claro lo dice setClaro(): su casa, flores amarillas en
     los canteros, guayacanes en flor que sueltan pétalos, brotes, cuántas
     mariposas vuelan y, con escenario, el lago, la cascada, la banca, el
     cartel y las cosas de todos los días.
   - Mariposas amarillas vuelan, se posan en flores y brotes y, si Uku está
     quieto, en su mano. Con flores o brotes, a ratos planta un brote.
   - setMood() le da un ánimo que se queda: contento, tranquilo o pensativo.
   - Pausa el render cuando no se ve y respeta prefers-reduced-motion.
   - setLook() viste a Uku según el clima (assets/clima.js): en la costa
     palmeras y guayabera; sombrero de paja toquilla, gafas de sol, gorro
     de lana o paraguas (con lluvia).
   ===================================================================== */
import * as THREE from './vendor/three/three.module.min.js';
import { mergeGeometries } from './vendor/three/jsm/utils/BufferGeometryUtils.js';
// El oso: el de siempre (uku-rig.js) o el de respaldo hecho por código (uku-rig-nuevo.js, con ?oso=nuevo o
// localStorage uku_oso = nuevo) para probarlo
export const OSO = (() => { try { const q = new URLSearchParams(location.search).get('oso'), v = q || localStorage.getItem('uku_oso'); return v === 'nuevo' ? 'nuevo' : v === 'clasico' ? 'clasico' : v === 'v2' ? 'v2' : 'v3'; } catch (e) { return 'v3'; } })();

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

let renderer, scene, bearScene, shadow, camera, clock, host = null, raf = 0, visible = true;
let bear = null, readyFns = [], rig = null, bones = {}, forest, garden = null, held = null, ground, stage = null;
let ambient = null, focus = false, ambFocus = null;
let focusAmt = 0, shiftTo = { x: 0, y: 0 }, shiftCur = { x: 0, y: 0 }, zoomTo = 1, zoomCur = 1, front = false, frontAmt = 1, folCur = 1, plano = false, planoAmt = 0;
const camVel = { x: 0, y: 0, z: 0 }; // velocidad del encuadre (resorte amortiguado: arranca y frena suave)
// Resorte críticamente amortiguado: sigue un destino que puede moverse (hoja que sube, globo que entra) sin tirones
function spring(cur, to, velKey, dt) {
  const w = 8, v0 = camVel[velKey], d = cur - to;
  const v = (v0 - w * w * d * dt) / Math.pow(1 + w * dt, 2);
  camVel[velKey] = v; return cur + v * dt;
} // la cámara se acerca y se corre suavemente, nunca de golpe // focus: Uku sale del mundo y se acerca a conversar // ambient: lo que Uku hace cuando no hay gesto (p. ej. pasear)
// Mundo: un planeta esférico de radio PLANET_R; su punto más alto (0, 0, 0) es el centro del claro de Uku.
// Con 12 m el suelo se curva lo justo: desde cualquier cámara se ve el piso hasta ~2,5 m detrás de Uku, así nada
// queda detrás del horizonte con la base escondida (antes, con 3 m, todo lo de atrás parecía flotar).
const PLANET_R = 5.5, PLANET_C = new THREE.Vector3(0, -PLANET_R, 0), FOG_NEAR = 4;
let score = 50; // cuántos árboles tiene el bosque sin escenario (0–100)
let target = null, loadAt = 0, ambLight = null, moodTint = new THREE.Color('#ffffff'); // mientras carga, el bosque crece hasta target; mood tiñe la luz
// bloom: flores amarillas del campo (0–100); mood: ánimo que se queda (feliz, tranquilo, pensativo)
let bloom = null, mood = null;
// Lo que hay en el claro (setClaro): brotes por todas partes, flores en los canteros, guayacanes, su casa y mariposas
let claro = { brotes: false, flores: false, guayacanes: 0, casa: false, mariposas: null };
let gesture = null, gestureT = 0, onTap = null;
let yaw = 0, yawTo = 0, camDist = 3.6, drag = null, idleAt = 0; // giro con el dedo
const CAM_H = 1.3; // altura de la cámara sobre los pies de Uku

/* ---------- Colores (claro / oscuro) ---------- */
let look = { region: 'sierra', shirt: 'sueter', hat: null, shades: false, rain: false };
function palette() { const p = paletteBase(); if (esc && !(document.documentElement.getAttribute('data-theme') === 'dark')) Object.assign(p, ESC_PAL); return p; }
// Con escenario (la POC de Uku) el suelo es gris cálido, no blanco (parecía nieve), más claro y menos azul que el
// pelaje de Uku (#89919e); los realces (piedras, pasto, florcitas, polvo) van en blanco para que se lean encima
const ESC_PAL = { ground: '#b9bfc9', rock: '#f3f4f7', grass: '#e6e9ee', dust: '#ffffff' };
function paletteBase() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (look.region === 'costa') return dark ? {
    bg: '#1f1f1f', ground: '#353329', trunk: '#4c5262', pine: ['#3c4659', '#434d61'], palm: ['#41506a', '#4a5872'],
    round: ['#465066', '#4e586e'], rock: '#3b3e46', grass: '#434b5c', flower: '#f2d64b', guaya: ['#f2d64b', '#e6c13d', '#f7e07a'], sprout: ['#f2d64b', '#d8bc3a'], dust: '#ffffff'
  } : {
    bg: '#f6f6f5', ground: '#f6efd6', trunk: '#b9c0cf', pine: ['#d2dae8', '#c5cfe2'], palm: ['#a9bad6', '#9aaed0', '#b6c5de'],
    round: ['#d8dfeb', '#cdd5e4'], rock: '#e3e5ea', grass: '#d0d8e6', flower: '#f2c94c', guaya: ['#f2c94c', '#f7d96b', '#e8b93a'], sprout: ['#f2c94c', '#f7dc7f'], dust: '#ffffff'
  };
  // Ilustración: grises y blancos, tonos lavados para que el oso (que conserva sus colores) sea lo
  // nítido de la escena; el amarillo queda para lo que crece (brotes, flores, guayacanes, mariposas)
  return dark ? {
    bg: '#1f1f1f', ground: '#2b2d33', trunk: '#4a4f5c', pine: ['#3c4659', '#434d61', '#4a5468'],
    round: ['#465066', '#4e586e'], rock: '#3a3c43', grass: '#434b5c', flower: '#f2d64b', guaya: ['#f2d64b', '#e6c13d', '#f7e07a'], sprout: ['#f2d64b', '#d8bc3a'], dust: '#ffffff'
  } : {
    bg: '#f6f6f5', ground: '#eef0f4', trunk: '#aeb6c7', pine: ['#c9d3e6', '#b9c6de', '#d6deec'],
    round: ['#c3cee3', '#d2dbea'], rock: '#d9dce4', grass: '#c4cee1', flower: '#f2c94c', guaya: ['#f2c94c', '#f7d96b', '#e8b93a'], sprout: ['#f2c94c', '#f7dc7f'], dust: '#ffffff'
  };
}
// Colores de la ropa de Uku (gorro, paraguas, sombrero), que repiten la casa, el farol, la banca y los patos
const CREMA = '#efe9df', AZUL = '#2c4f9e', MARINO = '#1b2a4e', AMARILLO = '#ffd200', CARTON = '#e9dcb2';
/* ---------- Estilo ilustración 2D ----------
   Colores planos, sin sombreado (solo luz ambiente) y sin contornos: los
   elementos se separan por el tono, como en una ilustración vectorial. */

/* ---------- El claro de Uku ----------
   Todo se ubica con coordenadas locales en metros: x a los lados y z hacia la cámara (z < 0 queda
   detrás de él). Posiciones fijas (semilla) para que el claro no "salte" entre visitas. */
function rng(s) { return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const _sp = new THREE.Vector3(), _nrm = new THREE.Vector3(0, 1, 0), _yaw = new THREE.Quaternion();
// Normal del planeta bajo (x, z): conserva la distancia medida sobre la superficie
function surf(x, z, out) { const d = Math.hypot(x, z), a = d / PLANET_R, k = d ? Math.sin(a) / d : 0; return out.set(x * k, Math.cos(a), z * k); }
// Pone un objeto sobre la esfera en (x, z) y lo alinea con su normal; rot lo gira alrededor de ella
function placeAt(g, x, z, rot) {
  surf(x, z, _sp); g.position.copy(PLANET_C).addScaledVector(_sp, PLANET_R);
  g.quaternion.setFromUnitVectors(_nrm, _sp);
  if (rot) g.quaternion.multiply(_yaw.setFromAxisAngle(_nrm, rot));
  return g;
}
// Altura del suelo bajo un punto (x, z) de la escena
const groundY = (x, z) => Math.sqrt(Math.max(0, PLANET_R * PLANET_R - x * x - z * z)) - PLANET_R;
/* Toda la esfera: lo de afuera del claro se ubica con las mismas coordenadas de arco (x, z) que usa surf, de modo que
   un punto cualquiera del planeta (hasta la antípoda, a π·R = 17,3 m del centro del claro) se nombra igual. */
// Normal unitaria de un punto polar: a = ángulo desde el claro (rad), b = azimut desde +z hacia +x
function polar(a, b, out) { return out.set(Math.sin(a) * Math.sin(b), Math.cos(a), Math.sin(a) * Math.cos(b)); }
// Inversa de surf: de una normal unitaria a coordenadas de arco { x, z }. La antípoda queda en { 0, π·R }
export function arcoDe(n, out = {}) {
  const h = Math.hypot(n.x, n.z), a = Math.acos(clamp(n.y, -1, 1)), d = a * PLANET_R;
  if (h < 1e-6) { out.x = 0; out.z = n.y > 0 ? 0 : Math.PI * PLANET_R; return out; }
  out.x = n.x / h * d; out.z = n.z / h * d; return out;
}
// Distancia sobre la superficie (metros de arco) entre dos puntos en coordenadas de arco
const _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _X = new THREE.Vector3(1, 0, 0);
export function distEsf(x1, z1, x2, z2) { surf(x1, z1, _d1); surf(x2, z2, _d2); return PLANET_R * Math.acos(clamp(_d1.dot(_d2), -1, 1)); }
// n puntos uniformes (en área) en la corona esférica de centro n0 (normal) y radios de arco r0..r1 en metros;
// ok(x, z) descarta los que no sirven y gap (metros de arco) los separa. Semilla fija: el planeta es el mismo cada vez.
function scatterEsf(seed, n, n0, r1, ok, gap, r0 = 0) {
  const r = rng(seed), out = [], e1 = new THREE.Vector3().crossVectors(n0, Math.abs(n0.y) < .9 ? _nrm : _X).normalize(), e2 = new THREE.Vector3().crossVectors(n0, e1), p = new THREE.Vector3(), c0 = Math.cos(r0 / PLANET_R), c1 = Math.cos(r1 / PLANET_R);
  for (let i = 0; out.length < n && i < n * 40; i++) {
    const t = Math.acos(c0 - r() * (c0 - c1)), f = r() * 6.2832;
    p.copy(n0).multiplyScalar(Math.cos(t)).addScaledVector(e1, Math.cos(f) * Math.sin(t)).addScaledVector(e2, Math.sin(f) * Math.sin(t));
    const q = arcoDe(p, { rot: r() * 6.28, s: r(), v: Math.floor(r() * 3), t: r() });
    if ((ok && !ok(q.x, q.z)) || (gap && out.some(o => distEsf(o.x, o.z, q.x, q.z) < gap))) continue;
    out.push(q);
  }
  return out;
}
// Puntos al azar en un anillo alrededor de Uku; ok(x, z) descarta los que no sirven y gap los separa
function scatter(seed, n, r0, r1, ok, gap) {
  const r = rng(seed), out = [];
  for (let i = 0; out.length < n && i < n * 40; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r0 * r0 + r() * (r1 * r1 - r0 * r0)), x = Math.sin(a) * d, z = Math.cos(a) * d;
    const p = { x, z, s: r(), rot: r() * 6.28, v: Math.floor(r() * 3), t: r() };
    if ((ok && !ok(x, z)) || (gap && out.some(q => Math.hypot(q.x - x, q.z - z) < gap))) continue;
    out.push(p);
  }
  return out;
}
// Lo alto (árboles, casas) va siempre detrás de Uku: nunca queda algo delante de la cámara
const TALL = (x, z) => z < -.4;
// Todo se apoya donde se ve el suelo: la base de cada cosa tiene que verse desde las cámaras de la app (libre, en
// primer plano, el plano general y alejada, de frente y girada). Si la normal del suelo en ese
// punto no mira hacia alguna de ellas, el punto está detrás del horizonte y lo que se ponga ahí parecería flotar.
const CAMS = [[0, .96, 3.14], [0, .78, 2.24], [0, 1.35, 4.26], [0, 1.2, 5.5], [1.4, .96, 2.8], [-1.4, .96, 2.8]];
const _vn = new THREE.Vector3(), _vp = new THREE.Vector3(), _vc = new THREE.Vector3();
function VISIBLE(x, z) {
  surf(x, z, _vn); _vp.copy(PLANET_C).addScaledVector(_vn, PLANET_R);
  return CAMS.every(c => _vc.set(c[0], c[1], c[2]).sub(_vp).normalize().dot(_vn) > .01);
}
/* Zonas del claro: cada cosa tiene su lugar fijo, así el paisaje se lee de un vistazo.
   · a la izquierda, la casa de Uku
   · a la derecha, los guayacanes en flor (si no hay, un arbolito por crecer)
   · delante de Uku, los dos canteros de flores (vacíos, con su letrero)
   · al fondo, el bosque */
const ZONA = {
  hogar: [[-.5, -1.1], [-1.05, -.95], [-.2, -1.65], [-.95, -1.65]].filter(([x, z]) => VISIBLE(x, z - .25)),
  guayacanes: [[.5, -1.15], [1.05, -.95], [.25, -1.7], [1, -1.7]].filter(([x, z]) => VISIBLE(x, z - .25)),
  canteros: [[-.56, .32], [.56, .32]]
};
const BED_R = .24, BIG = ZONA.hogar.concat(ZONA.guayacanes);
const awayBig = (d) => (x, z) => BIG.every(([bx, bz]) => Math.hypot(x - bx, z - bz) > d);
const outBeds = (d) => (x, z) => ZONA.canteros.every(([bx, bz]) => Math.hypot(x - bx, z - bz) > BED_R + d);
// El bosque va atrás de todo (o en los costados lejanos): nunca tapa la casa ni los guayacanes
const TREES = scatter(11, 24, 1.3, 2.4, (x, z) => (z < -1.25 || Math.abs(x) > 1.6) && TALL(x, z) && VISIBLE(x, z - .3) && awayBig(.6)(x, z), .5);
// Flores: dentro de los canteros, repartidas entre los dos para que crezcan parejo
const FLOWERS = (() => {
  const r = rng(71), out = [[], []];
  ZONA.canteros.forEach(([cx, cz], b) => {
    for (let i = 0; out[b].length < 24 && i < 900; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * BED_R * .82, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (out[b].some(q => Math.hypot(q.x - x, q.z - z) < .068)) continue;
      out[b].push({ x, z, s: r(), rot: r() * 6.28, v: Math.floor(r() * 3), t: r() });
    }
  });
  return out[0].flatMap((p, i) => [p, out[1][i]].filter(Boolean));
})();
// Brotes: por todo el claro a la vista, menos donde va lo grande
const SEEN = (x, z) => z < 1.1 && Math.abs(x) < 1.5 + Math.max(0, -z) * .5;
const SPROUTS = scatter(37, 52, .3, 1.9, (x, z) => SEEN(x, z) && VISIBLE(x, z) && awayBig(.35)(x, z), .09);
const DECO = {
  tufts: scatter(5, 70, .35, 2.6, (x, z) => z < .4 && VISIBLE(x, z) && outBeds(.08)(x, z) && awayBig(.4)(x, z), .14), rocks: scatter(17, 6, .9, 2.4, (x, z) => VISIBLE(x, z) && outBeds(.1)(x, z) && awayBig(.5)(x, z), .5),
  bushes: scatter(23, 8, 1.1, 2.4, (x, z) => TALL(x, z) && VISIBLE(x, z - .15) && awayBig(.6)(x, z), .5), daisies: scatter(43, 24, .35, 2.4, (x, z) => VISIBLE(x, z) && outBeds(.06)(x, z) && awayBig(.35)(x, z), .12)
};

/* ---------- Piezas ----------
   Cada objeto es una sola malla con colores por vértice (una llamada de dibujo por objeto, no una por
   pieza); las geometrías se comparten entre objetos iguales y se rehacen al cambiar el tema. */
let LAMB = null, GEO = {};
/* Dibujo vectorial plano: cada objeto lleva su color exacto donde le da la luz y un solo tono de sombra, un poco más
   oscuro y más frío, con el borde nítido (MeshToonMaterial con un degradado de dos pasos, sin filtrar). No hay
   degradados ni brillos. La luz sigue a la cámara (arriba a la izquierda), así la sombra cae siempre del mismo lado,
   como en una ilustración. AMB + SOL = blanco: lo iluminado queda del color exacto; SOMBRA es cuánto oscurece. */
const SOMBRA = .16;
const AMB = new THREE.Color(1 - SOMBRA * 1.05, 1 - SOMBRA, 1 - SOMBRA * .7), SOL = new THREE.Color(SOMBRA * 1.05, SOMBRA, SOMBRA * .7);
const LUZ_CAM = new THREE.Vector3(-.55, .7, .45).normalize(); // de dónde viene la luz, en el espacio de la cámara
const GRAD = (() => { const t = new THREE.DataTexture(new Uint8Array([0, 255]), 2, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; })();
function toon(o) { const { flatShading, ...resto } = o || {}; return new THREE.MeshToonMaterial(Object.assign({ gradientMap: GRAD }, resto)); }
let solMundo = null, solUku = null;
const _luz = new THREE.Vector3();
function seguirLuz() { if (!camera) return; _luz.copy(LUZ_CAM).applyQuaternion(camera.quaternion).multiplyScalar(10); if (solMundo) solMundo.position.copy(_luz); if (solUku) solUku.position.copy(_luz); }
const _p4 = new THREE.Vector3(), _q4 = new THREE.Quaternion(), _e4 = new THREE.Euler(), _s4 = new THREE.Vector3(), _c4 = new THREE.Color();
const TRS = (p, r, s) => new THREE.Matrix4().compose(_p4.set(...(p || [0, 0, 0])), _q4.setFromEuler(_e4.set(...(r || [0, 0, 0]))), typeof s === 'number' ? _s4.setScalar(s) : _s4.set(...(s || [1, 1, 1])));
// Una pieza: la geometría ya ubicada (p puede ser una Matrix4) y pintada de un color
function pc(geo, color, p, r, s) {
  const g = geo.index ? geo.toNonIndexed() : geo; if (g !== geo) geo.dispose();
  g.deleteAttribute('uv'); g.applyMatrix4(p && p.isMatrix4 ? p : TRS(p, r, s));
  _c4.set(color); const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = _c4.r; c[i * 3 + 1] = _c4.g; c[i * 3 + 2] = _c4.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
function kit(parts) { const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); return g; }
function geo(key, make) { return GEO[key] || (GEO[key] = kit(make())); }
function clearGeo() { Object.values(GEO).forEach(g => g.dispose()); GEO = {}; }
const CYL = (rt, rb, h, n) => new THREE.CylinderGeometry(rt, rb, h, n || 6);

const PARTS = {
  pino: (pal, v) => [pc(CYL(.035, .05, .35), pal.trunk, [0, .17, 0]), ...[[.32, .5, .45], [.25, .42, .72], [.17, .32, .95]].map(([r, h, y]) => pc(new THREE.ConeGeometry(r, h, 7), pal.pine[v % pal.pine.length], [0, y, 0], [0, v, 0]))],
  copa: (pal, v) => [pc(CYL(.04, .055, .45), pal.trunk, [0, .22, 0]), pc(new THREE.IcosahedronGeometry(.3, 0), pal.round[v % pal.round.length], [0, .64, 0], [0, v, 0], [1, 1.1, 1]),
    pc(new THREE.IcosahedronGeometry(.17, 0), pal.round[(v + 1) % pal.round.length], [.17, .5, .1], [v, 0, 0])],
  // Palmera: tronco curvo en segmentos y hojas largas que caen
  palma: (pal, v) => {
    const out = [], lean = .05 + v * .03; let x = 0, y = 0;
    for (let i = 0; i < 6; i++) { x += lean * i * .12; y += .15; out.push(pc(CYL(.03 - i * .002, .036 - i * .002, .16), pal.trunk, [x, y - .07, 0], [0, 0, -lean * i * .7])); }
    for (let i = 0; i < 7; i++) out.push(pc(new THREE.ConeGeometry(.06, .5, 3), pal.palm[v % pal.palm.length], TRS([x, y + .02, 0], [0, i / 7 * Math.PI * 2, 0]).multiply(TRS([.2, -.08, 0], [0, 0, Math.PI / 2 + .55], [1, 1, .25]))));
    [[.03, 0], [-.025, .02], [0, -.03]].forEach(([dx, dz]) => out.push(pc(new THREE.SphereGeometry(.025, 6, 5), pal.trunk, [x + dx, y - .03, dz])));
    return out;
  },
  // Guayacán en flor: un tronco que se abre en ramas, la copa amarilla en racimos y pétalos en el suelo
  guaya: (pal, v) => {
    const r = rng(91 + v), out = [pc(CYL(.04, .06, .5), pal.trunk, [0, .25, 0], [0, 0, .05])];
    [[-.5, .3], [.55, -.2], [.1, .6]].forEach(([a, b]) => out.push(pc(CYL(.022, .032, .36), pal.trunk, [Math.sin(a) * .1, .6, Math.sin(b) * .08], [b * .6, 0, -a * .9])));
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + r(), d = .12 + r() * .2; out.push(pc(new THREE.IcosahedronGeometry(.13 + r() * .08, 0), pal.guaya[i % pal.guaya.length], [Math.cos(a) * d, .82 + r() * .22, Math.sin(a) * d], [r(), r(), 0], [1, .8, 1])); }
    for (let i = 0; i < 16; i++) { const a = r() * 6.28, d = .12 + r() * .45; out.push(pc(new THREE.CircleGeometry(.024, 5), pal.guaya[i % 2], [Math.cos(a) * d, .006, Math.sin(a) * d], [-Math.PI / 2, 0, r() * 6])); }
    return out;
  },
  flor: (pal, v) => {
    // la corola mira hacia adelante y arriba (no de canto): así se ve entera desde la cámara
    const c = v === 1 ? pal.guaya[1] : pal.flower, H = TRS([0, .105, 0], [.95, 0, 0]), out = [pc(CYL(.005, .006, .105, 4), pal.grass, [0, .052, 0]), pc(new THREE.ConeGeometry(.014, .045, 3), pal.grass, [.014, .035, 0], [0, 0, -.9], [1, 1, .35])];
    if (v === 2) out.push(pc(new THREE.SphereGeometry(.024, 7, 5), c, [0, .115, 0], 0, [1, .85, 1]), ...[0, 1, 2].map(i => pc(new THREE.SphereGeometry(.012, 5, 4), c, [Math.cos(i * 2.1) * .018, .133, Math.sin(i * 2.1) * .018])));
    else { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; out.push(pc(new THREE.SphereGeometry(.017, 6, 4), c, H.clone().multiply(TRS([Math.cos(a) * .022, 0, Math.sin(a) * .022], [0, -a, 0], [1.25, .45, .8])))); } out.push(pc(new THREE.SphereGeometry(.011, 6, 4), pal.trunk, H.clone().multiply(TRS([0, .006, 0])))); }
    return out;
  },
  // Brote: un tallito y dos hojas amarillas que se abren
  brote: (pal, v) => {
    const L = pal.sprout, h = .05 + v * .014;
    return [pc(CYL(.005, .006, h, 4), pal.grass, [0, h / 2, 0]),
      pc(new THREE.SphereGeometry(.024, 7, 5), L[0], [-.02, h + .008, 0], [0, 0, -.85], [1, .4, .7]),
      pc(new THREE.SphereGeometry(.024, 7, 5), L[1], [.02, h + .01, 0], [0, 0, .85], [1, .4, .7]),
      pc(new THREE.SphereGeometry(.009, 5, 4), L[0], [0, h + .012, 0])];
  },
  // Cantero: tierra con un borde de piedritas (las flores crecen adentro)
  cantero: pal => {
    const o = [pc(CYL(BED_R, BED_R + .01, .022, 28), pal.trunk, [0, .006, 0])], r = rng(5);
    for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28; o.push(pc(new THREE.DodecahedronGeometry(.026, 0), pal.rock, [Math.cos(a) * (BED_R + .012), .014, Math.sin(a) * (BED_R + .012)], [r(), r(), 0], [1, .6, 1])); }
    return o;
  },
  // Letrero clavado en el cantero vacío: aquí florecerá algo
  letrero: pal => [pc(CYL(.007, .007, .16, 5), CARTON, [0, .08, 0]), pc(new THREE.BoxGeometry(.11, .07, .012), CREMA, [0, .15, 0]), pc(new THREE.CircleGeometry(.018, 10), pal.flower, [0, .15, .007])],
  // Arbolito por crecer (aún sin guayacanes): un guayacán chiquito atado a su tutor, con su letrero
  arbolito: pal => [pc(CYL(.012, .018, .2, 6), pal.trunk, [0, .1, 0]), pc(new THREE.IcosahedronGeometry(.05, 0), pal.sprout[1], [0, .22, 0], [.3, 0, 0], [1, .8, 1]), pc(new THREE.IcosahedronGeometry(.035, 0), pal.sprout[0], [.04, .19, .02]),
    pc(CYL(.006, .006, .26, 5), CARTON, [-.05, .13, -.01]), pc(new THREE.TorusGeometry(.03, .004, 4, 10), CARTON, [-.025, .14, 0], [Math.PI / 2, 0, 0], [1, .6, 1]),
    pc(CYL(.006, .006, .14, 5), CARTON, [.12, .07, .06]), pc(new THREE.BoxGeometry(.1, .065, .012), CREMA, [.12, .14, .06]), pc(new THREE.CircleGeometry(.016, 10), pal.guaya[0], [.12, .14, .067])],
  // Casa hobbit: un montículo de pasto con puerta redonda, ventanitas con luz, chimenea de piedra y un caminito
  casa: pal => {
    const A = .4, H = .29, Z = .36, on = (x, y, k) => { // un punto del frente del montículo, mirando hacia afuera
      const z = Z * Math.sqrt(Math.max(0, 1 - (x / A) ** 2 - (y / H) ** 2)), n = new THREE.Vector3(x / (A * A), y / (H * H), z / (Z * Z)).normalize();
      return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z).addScaledVector(n, k), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n), new THREE.Vector3(1, 1, 1));
    };
    const door = new THREE.Matrix4().compose(new THREE.Vector3(0, .11, .336), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    const o = [pc(new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), pal.pine[1 % pal.pine.length], [0, 0, 0], 0, [A, H, Z]),
      pc(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), pal.trunk, [0, .2, -.02], 0, [.27, .1, .24]), // el lomo, un poco más oscuro
      pc(new THREE.TorusGeometry(.108, .018, 8, 28), CARTON, door), pc(new THREE.CircleGeometry(.1, 28), AZUL, door.clone().multiply(TRS([0, 0, .004]))),
      pc(new THREE.BoxGeometry(.005, .19, .004), MARINO, door.clone().multiply(TRS([0, 0, .007]))), pc(new THREE.SphereGeometry(.012, 8, 6), AMARILLO, door.clone().multiply(TRS([.055, 0, .012])))];
    [-1, 1].forEach(sx => { o.push(pc(new THREE.TorusGeometry(.05, .011, 6, 20), CREMA, on(sx * .215, .135, .004)), pc(new THREE.CircleGeometry(.047, 20), pal.flower, on(sx * .215, .135, .006)), pc(new THREE.BoxGeometry(.094, .006, .004), CREMA, on(sx * .215, .135, .009))); });
    o.push(pc(CYL(.034, .04, .15, 8), pal.rock, [.14, .3, -.05]), pc(CYL(.044, .044, .022, 8), pal.trunk, [.14, .38, -.05]));
    [[0, .44, .07], [.03, .55, .06], [-.01, .66, .055]].forEach(([x, z, r]) => o.push(pc(CYL(r, r, .016, 9), pal.rock, [x, .004, z], [0, x * 20, 0], [1, 1, .75])));
    [[-.18, .24, .1], [.05, .27, -.17], [.25, .17, .02], [-.08, .28, -.05]].forEach(([x, y, z]) => o.push(pc(new THREE.ConeGeometry(.013, .06, 3), pal.trunk, [x, y, z], [z, 0, x])));
    return o;
  }
};
/* ---------- Escenario (opcional: setClaro({ escenario })) ----------
   Un lago con muelle y patos, y cosas de la vida diaria alrededor. */
const AGUA = (pal) => pal.bg === '#1f1f1f' ? '#3b4d78' : '#b6cbee';
Object.assign(PARTS, {
  // Lago: orilla de piedritas, agua, ondas, nenúfares con su flor, juncos y un muelle de tablas
  lago: pal => {
    const R = .5, o = [pc(CYL(R + .03, R + .045, .02, 40), pal.rock, [0, .004, 0]), pc(CYL(R, R, .03, 40), AGUA(pal), [0, .008, 0])], r = rng(33);
    for (let i = 0; i < 26; i++) { const a = i / 26 * 6.28 + r() * .1; o.push(pc(new THREE.DodecahedronGeometry(.03 + r() * .015, 0), pal.rock, [Math.cos(a) * (R + .03), .018, Math.sin(a) * (R + .03)], [r(), r(), 0], [1, .65, 1])); }
    [[.2, .5], [.34, .5], [.14, .3]].forEach(([d, w]) => o.push(pc(new THREE.TorusGeometry(R * d * 1.7, .004, 4, 28), '#dfe9f8', [0, .025, 0], [Math.PI / 2, 0, 0], [1, 1, 1])));
    [[.18, -.12], [-.1, .22], [.05, .05], [-.22, -.08], [.26, .17]].forEach(([x, z], i) => { o.push(pc(CYL(.055, .055, .008, 12), '#8aa0c6', [x, .027, z])); if (i % 2 === 0) o.push(pc(new THREE.SphereGeometry(.014, 6, 4), AMARILLO, [x + .01, .04, z], 0, [1, .7, 1])); });
    for (let i = 0; i < 9; i++) { const a = 2.2 + i * .13, d = R - .01, h = .16 + r() * .1; o.push(pc(CYL(.004, .006, h, 4), pal.trunk, [Math.cos(a) * d, h / 2 + .01, Math.sin(a) * d], [r() * .2, 0, r() * .25 - .12])); if (i % 3 === 0) o.push(pc(CYL(.009, .009, .05, 5), pal.trunk, [Math.cos(a) * d, h + .02, Math.sin(a) * d])); }
    // el muelle sale de la orilla izquierda hacia adentro
    for (let i = 0; i < 6; i++) o.push(pc(new THREE.BoxGeometry(.05, .012, .17), i % 2 ? CARTON : pal.trunk, [-R - .1 + i * .062, .045, -.02]));
    [[-R - .08, .09], [-R - .08, -.13], [-R + .22, .09], [-R + .22, -.13]].forEach(([x, z]) => o.push(pc(CYL(.012, .012, .09, 5), pal.trunk, [x, .02, z])));
    return o;
  },
  pato: pal => [pc(new THREE.SphereGeometry(.045, 9, 6), AMARILLO, [0, .035, 0], 0, [1.35, .85, 1]), pc(new THREE.SphereGeometry(.03, 8, 6), AMARILLO, [.05, .09, 0]),
    pc(new THREE.ConeGeometry(.012, .035, 4), '#f29a2e', [.09, .085, 0], [0, 0, -Math.PI / 2]), pc(new THREE.SphereGeometry(.026, 6, 5), CREMA, [-.015, .05, .03], 0, [1.5, .6, .5]),
    pc(new THREE.SphereGeometry(.026, 6, 5), CREMA, [-.015, .05, -.03], 0, [1.5, .6, .5]), pc(new THREE.ConeGeometry(.018, .04, 4), AMARILLO, [-.07, .06, 0], [0, 0, Math.PI / 2 + .5]),
    pc(new THREE.SphereGeometry(.007, 5, 4), MARINO, [.065, .1, .02]), pc(new THREE.SphereGeometry(.007, 5, 4), MARINO, [.065, .1, -.02])],
  // Farol: un poste azul marino con la luz amarilla
  farol: pal => [pc(CYL(.012, .018, .5, 6), MARINO, [0, .25, 0]), pc(CYL(.03, .02, .04, 6), MARINO, [0, .5, 0]), pc(new THREE.SphereGeometry(.05, 10, 8), AMARILLO, [0, .56, 0], 0, [1, 1.2, 1]),
    pc(new THREE.ConeGeometry(.055, .05, 6), MARINO, [0, .65, 0]), pc(CYL(.03, .035, .03, 6), MARINO, [0, .01, 0])],
  // Banca de parque: dos listones de asiento y dos de respaldo sobre patas de hierro azul marino; Uku se sienta a leer
  banca: pal => [...[.05, -.03].map(z => pc(new THREE.BoxGeometry(.46, .022, .07), CARTON, [0, .15, z])),
    ...[.2, .27].map(y => pc(new THREE.BoxGeometry(.46, .05, .018), CARTON, [0, y, -.085], [-.14, 0, 0])),
    ...[-.19, .19].flatMap(x => [pc(new THREE.BoxGeometry(.016, .15, .016), MARINO, [x, .075, .05]), pc(new THREE.BoxGeometry(.016, .32, .016), MARINO, [x, .16, -.08], [-.14, 0, 0]), pc(new THREE.BoxGeometry(.016, .016, .15), MARINO, [x, .14, -.015])])],
  // Cerca de madera con un par de travesaños
  cerca: pal => [...[0, 1, 2, 3, 4, 5, 6].map(i => pc(CYL(.011, .013, .15, 5), pal.trunk, [-.3 + i * .1, .075, 0])), pc(new THREE.BoxGeometry(.64, .016, .012), CARTON, [0, .1, 0]), pc(new THREE.BoxGeometry(.64, .016, .012), CARTON, [0, .05, 0])],
  // Huerto: un cuadro de tierra con plantitas en hileras
  huerto: pal => { const o = [pc(new THREE.BoxGeometry(.4, .03, .26), pal.trunk, [0, .015, 0])], r = rng(8);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const x = -.15 + i * .1, z = -.08 + j * .08; o.push(pc(CYL(.004, .005, .05, 4), pal.grass, [x, .055, z]), pc(new THREE.SphereGeometry(.026, 6, 5), pal.sprout[(i + j) % 2], [x, .09, z], [r(), r(), 0], [1, .8, 1])); }
    return o; },
  buzon: pal => [pc(CYL(.012, .014, .24, 5), pal.trunk, [0, .12, 0]), pc(new THREE.BoxGeometry(.1, .07, .07), AZUL, [0, .27, 0]), pc(new THREE.SphereGeometry(.035, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), AZUL, [0, .305, 0], [0, 0, 0], [1.4, .8, 1]),
    pc(new THREE.BoxGeometry(.012, .06, .012), AMARILLO, [.06, .31, 0]), pc(new THREE.BoxGeometry(.035, .02, .012), AMARILLO, [.075, .335, 0])],
  // Hongos de sombrero amarillo con lunares
  hongos: pal => [[0, 0, 1], [.09, .05, .7], [-.06, .07, .55]].flatMap(([x, z, k]) => [pc(CYL(.012 * k + .005, .016 * k + .005, .07 * k, 6), CREMA, [x, .035 * k, z]),
    pc(new THREE.SphereGeometry(.05 * k, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), pal.guaya[0], [x, .07 * k, z], 0, [1, .7, 1]), pc(new THREE.SphereGeometry(.009 * k, 5, 4), CREMA, [x + .02 * k, .095 * k, z + .015 * k])]),
  lena: pal => [[-.07, .02, 0], [.0, .02, 0], [.07, .02, 0], [-.035, .075, 0], [.035, .075, 0], [0, .125, 0]].flatMap(([x, y]) => [pc(CYL(.032, .032, .22, 8), pal.trunk, [x, y + .03, 0], [Math.PI / 2, 0, 0]), pc(CYL(.026, .026, .004, 8), CARTON, [x, y + .03, .111], [Math.PI / 2, 0, 0])]),
  // Tortuga de Galápagos: caparazón azul con placas amarillas
  tortuga: pal => [pc(new THREE.SphereGeometry(.09, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), '#6f87b8', [0, .03, 0], 0, [1.15, .8, 1]), ...[[0, 0], [.05, .03], [-.05, .03], [.05, -.03], [-.05, -.03]].map(([x, z]) => pc(CYL(.022, .022, .006, 6), AMARILLO, [x, .1 - Math.abs(x) * .3, z], 0, 1)),
    pc(new THREE.SphereGeometry(.035, 8, 6), CREMA, [.12, .05, 0], 0, [1.2, 1, 1]), ...[[.06, .07], [.06, -.07], [-.06, .07], [-.06, -.07]].map(([x, z]) => pc(new THREE.SphereGeometry(.024, 6, 5), CREMA, [x, .02, z], 0, [1.2, .7, 1]))],
  // Cartel de pizarra: dos postes y un marco azul marino; la pizarra (un lienzo con el número) se pone encima
  // Letrero de bosque: dos postes cortos de madera y una tabla con las puntas redondeadas, a la altura de la vista de Uku
  cartel: pal => [pc(CYL(.016, .02, .3, 6), pal.trunk, [-.19, .15, -.025]), pc(CYL(.016, .02, .3, 6), pal.trunk, [.19, .15, -.025]),
    pc(new THREE.BoxGeometry(.5, .2, .028), CARTON, [0, .3, 0]), pc(CYL(.1, .1, .028, 16), CARTON, [-.25, .3, 0], [Math.PI / 2, 0, 0]), pc(CYL(.1, .1, .028, 16), CARTON, [.25, .3, 0], [Math.PI / 2, 0, 0]),
    pc(new THREE.BoxGeometry(.54, .012, .032), pal.trunk, [0, .405, 0]), // el canto de arriba, más oscuro
    ...[[-.19, .3], [.19, .3]].map(([x, y]) => pc(CYL(.01, .01, .006, 8), pal.trunk, [x, y + .07, .016], [Math.PI / 2, 0, 0]))],
  /* ---- Bosque nublado del Chocó Andino (Mindo) ---- */
  // Árbol de copa amplia y en capas, con musgo colgando de las ramas y una bromelia en el tronco
  nublado: (pal, v) => {
    const r = rng(120 + v), o = [pc(CYL(.045, .07, .62), pal.trunk, [0, .31, 0]), pc(CYL(.02, .03, .3), pal.trunk, [.12, .55, .04], [0, 0, -.9]), pc(CYL(.018, .028, .26), pal.trunk, [-.1, .6, -.03], [.3, 0, .8])];
    const copa = pal.round.concat(pal.pine);
    for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28 + r() * .6, d = .1 + r() * .22, y = .66 + r() * .3; o.push(pc(new THREE.IcosahedronGeometry(.15 + r() * .12, 0), copa[i % copa.length], [Math.cos(a) * d, y, Math.sin(a) * d], [r(), r(), 0], [1.25, .62, 1.1])); }
    for (let i = 0; i < 5; i++) { const a = r() * 6.28, d = .12 + r() * .18, h = .12 + r() * .16; o.push(pc(CYL(.006, .004, h, 4), pal.grass, [Math.cos(a) * d, .62 - h / 2, Math.sin(a) * d], [r() * .2, 0, r() * .2])); } // musgo que cuelga
    o.push(...[0, 1, 2, 3, 4].map(i => pc(new THREE.ConeGeometry(.018, .09, 4), i % 2 ? pal.guaya[0] : pal.flower, [.05, .36, .03], [.5 + (i - 2) * .3, i * 1.2, 0]))); // bromelia
    return o;
  },
  // Helecho arbóreo: tronco delgado y una roseta de frondas que se arquean
  helecho: (pal, v) => {
    const o = [pc(CYL(.02, .032, .55), pal.trunk, [0, .27, 0])], n = 9;
    for (let i = 0; i < n; i++) { const a = i / n * 6.28 + v; o.push(pc(new THREE.ConeGeometry(.05, .5, 3), pal.round[(i + v) % pal.round.length], TRS([0, .56, 0], [0, -a, 0]).multiply(TRS([.2, .05, 0], [0, 0, Math.PI / 2 + .75], [1, 1, .22])))); }
    for (let i = 0; i < 3; i++) o.push(pc(new THREE.SphereGeometry(.018, 6, 5), pal.sprout[1], [Math.cos(i * 2.1) * .04, .62, Math.sin(i * 2.1) * .04])); // frondas nuevas enrolladas
    return o;
  },
  // Heliconia: tallo, dos hojas grandes y una espiga en zigzag de brácteas amarillas
  heliconia: pal => [pc(CYL(.007, .009, .34, 5), pal.grass, [0, .17, 0]), pc(new THREE.SphereGeometry(.1, 8, 6), pal.round[0], [.08, .2, 0], [0, 0, -.6], [1, .25, .5]), pc(new THREE.SphereGeometry(.09, 8, 6), pal.round[1], [-.07, .16, .03], [0, .4, .7], [1, .25, .5]),
    ...[0, 1, 2, 3, 4].map(i => pc(new THREE.ConeGeometry(.02, .07, 4), pal.flower, [(i % 2 ? .035 : -.035), .36 + i * .03, 0], [0, 0, i % 2 ? -1.2 : 1.2])), pc(new THREE.SphereGeometry(.012, 6, 5), pal.flower, [0, .5, 0])],
  // Hojas grandes de sotobosque (como las gunneras y anturios de Mindo)
  hojona: pal => [[.0, 0, 1.0, 0], [.1, .06, .8, 2.1], [-.08, .04, .7, 4.2]].flatMap(([x, z, k, a]) => [pc(CYL(.006, .008, .22 * k, 4), pal.grass, [x, .11 * k, z], [.35, a, 0]), pc(new THREE.IcosahedronGeometry(.11 * k, 1), pal.round[1], [x + Math.sin(a) * .06, .24 * k, z + Math.cos(a) * .06], [-.4, a, 0], [1.2, .18, 1])]),
  // Cascada: pared de roca y una columna de agua con hilos blancos y espuma al pie; la neblina la pone escenario()
  cascada: pal => [ // Mindo: pared de roca en dos peldaños, el agua cae ancha y blanca, espuma abajo, musgo y helechos en la roca
    pc(new THREE.DodecahedronGeometry(.24, 0), pal.trunk, [-.26, .18, -.04], [.1, .3, 0], [1, 1.2, .6]), pc(new THREE.DodecahedronGeometry(.24, 0), pal.trunk, [.27, .2, -.05], [.4, 1.1, 0], [1, 1.35, .6]),
    pc(new THREE.DodecahedronGeometry(.2, 0), pal.trunk, [0, .5, -.12], [.2, .7, 0], [1.6, .8, .6]), pc(new THREE.DodecahedronGeometry(.12, 0), pal.trunk, [-.32, .04, .14], [0, .5, 0], [1, .7, 1]), pc(new THREE.DodecahedronGeometry(.1, 0), pal.trunk, [.33, .04, .15], [0, 1.2, 0], [1, .6, 1]),
    pc(new THREE.BoxGeometry(.18, .16, .05), AGUA(pal), [0, .56, .0]), pc(new THREE.BoxGeometry(.24, .48, .05), AGUA(pal), [0, .25, .06]),
    ...[-.08, -.03, .02, .07].map((x, i) => pc(new THREE.BoxGeometry(.016, .46, .052), '#ffffff', [x, .26 + (i % 2) * .01, .064])), pc(new THREE.BoxGeometry(.012, .14, .052), '#ffffff', [-.02, .57, .003]), pc(new THREE.BoxGeometry(.012, .14, .052), '#ffffff', [.04, .56, .003]),
    pc(new THREE.SphereGeometry(.1, 9, 6), '#ffffff', [0, .02, .12], 0, [2, .35, 1]), pc(new THREE.SphereGeometry(.06, 8, 6), '#ffffff', [.16, .02, .16], 0, [1.4, .3, 1]), pc(new THREE.SphereGeometry(.06, 8, 6), '#ffffff', [-.16, .02, .15], 0, [1.4, .3, 1]), pc(new THREE.SphereGeometry(.05, 8, 6), '#ffffff', [.04, .46, .08], 0, [1.6, .3, 1]),
    ...[[-.3, .36, .1], [.3, .4, .1], [-.12, .62, -.02], [.18, .64, 0]].map(([x, y, z]) => pc(new THREE.SphereGeometry(.07, 8, 6), pal.round[1] || pal.round[0], [x, y, z], 0, [1.3, .45, 1])), // musgo
    ...[[-.34, .1, .5], [.36, .12, .5], [-.1, .66, .4], [.28, .5, .3]].map(([x, y, z]) => pc(new THREE.IcosahedronGeometry(.07, 0), pal.round[0], [x, y, z * .1 - .02], [0, x * 4, 0], [1.2, .6, 1]))], // helechos en la roca
  // Puente de tablas con barandas de cuerda, sobre el arroyo que sale del lago
  puente: pal => [...[0, 1, 2, 3, 4, 5, 6].map(i => pc(new THREE.BoxGeometry(.055, .014, .3), i % 2 ? CARTON : pal.trunk, [-.18 + i * .06, .06, 0])),
    ...[[-.2, .13], [.2, .13], [-.2, -.13], [.2, -.13]].map(([x, z]) => pc(CYL(.01, .012, .16, 5), pal.trunk, [x, .12, z])),
    ...[.13, -.13].flatMap(z => [pc(CYL(.004, .004, .42, 4), CARTON, [0, .19, z], [0, 0, Math.PI / 2]), pc(CYL(.004, .004, .42, 4), CARTON, [0, .13, z], [0, 0, Math.PI / 2])]),
    pc(new THREE.BoxGeometry(.5, .012, .2), AGUA(pal), [0, .004, 0])],
  arroyo: pal => [pc(new THREE.BoxGeometry(.2, .012, .9), AGUA(pal), [0, .004, 0]), ...[-.06, .05, 0].map((x, i) => pc(new THREE.BoxGeometry(.012, .013, .3), '#dfe9f8', [x, .005, -.3 + i * .3]))],
  // Florcitas silvestres: tres tallos con flores chicas (relleno del claro)
  silvestre: (pal, v) => [[0, 0, 0], [.05, .03, 1], [-.04, .04, 2]].flatMap(([x, z, i]) => [pc(CYL(.003, .004, .07 + i * .012, 3), pal.grass, [x, .035 + i * .006, z]), pc(new THREE.SphereGeometry(.016, 6, 4), [pal.flower, pal.guaya[1], pal.dust][(i + v) % 3], [x, .075 + i * .012, z], 0, [1, .7, 1])]),
  // Helechito de suelo: cinco frondas cortas que se abren
  helechito: (pal, v) => [0, 1, 2, 3, 4].map(i => pc(new THREE.ConeGeometry(.025, .16, 3), pal.round[(i + v) % pal.round.length], TRS([0, .02, 0], [0, i / 5 * 6.28 + v, 0]).multiply(TRS([.05, .04, 0], [0, 0, 1.15], [1, 1, .2])))),
  // Poste indicador: un palo con tres tablitas en punta que señalan los senderos
  poste: pal => [pc(CYL(.014, .018, .42, 6), pal.trunk, [0, .21, 0]), pc(new THREE.SphereGeometry(.022, 6, 5), pal.trunk, [0, .42, 0]),
    ...[[.36, .9], [.29, 2.4], [.22, -.8]].map(([y, a]) => pc(new THREE.BoxGeometry(.17, .045, .012), CARTON, TRS([0, y, 0], [0, a, 0]).multiply(TRS([.07, 0, 0])))),
    ...[[.36, .9], [.29, 2.4], [.22, -.8]].map(([y, a]) => pc(new THREE.ConeGeometry(.024, .04, 4), CARTON, TRS([0, y, 0], [0, a, 0]).multiply(TRS([.17, 0, 0], [0, 0, -Math.PI / 2]))))],
  // Farolito de sendero: un poste corto con una lucecita amarilla
  farolito: pal => [pc(CYL(.009, .012, .22, 5), MARINO, [0, .11, 0]), pc(new THREE.BoxGeometry(.05, .05, .05), CREMA, [0, .245, 0]), pc(new THREE.SphereGeometry(.018, 6, 5), AMARILLO, [0, .245, 0]), pc(new THREE.ConeGeometry(.04, .03, 4), MARINO, [0, .285, 0], [0, .78, 0])],
  // Bandera: un asta con una banderita amarilla
  bandera: pal => [pc(CYL(.007, .009, .3, 5), pal.trunk, [0, .15, 0]), pc(new THREE.BoxGeometry(.13, .08, .008), AMARILLO, [.07, .26, 0]), pc(new THREE.SphereGeometry(.014, 6, 5), MARINO, [0, .31, 0])]
});
/* ---------- Cartel «X días sin accidentes» ----------
   Una pizarra pintada en un lienzo, con los dígitos en fichas que se voltean al cambiar el número. setCartel({ dias,
   record, animar }) lo cambia desde afuera (Uku lo hace con un gesto). */
const CARTEL = { dias: 7, prev: 7, record: 0, t0: -1e9, dirty: true, cv: null, tex: null };
const digitosDe = (n) => String(Math.max(0, Math.min(999, Math.round(n)))).padStart(n >= 100 ? 3 : 2, '0').split('');
function pintarCartel(seg) { // seg: segundos desde que cambió el número (9 = ya terminó)
  const cv = CARTEL.cv, g = cv.getContext('2d'), W = cv.width, H = cv.height, F = '"Nunito", "Segoe UI", system-ui, sans-serif';
  g.clearRect(0, 0, W, H); // la tabla de madera se ve detrás
  // vetas suaves
  g.strokeStyle = 'rgba(90,70,40,.08)'; g.lineWidth = 2;
  for (let y = 18; y < H; y += 23) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * .3, y - 6, W * .6, y + 7, W, y - 3); g.stroke(); }
  const nuevos = digitosDe(CARTEL.dias), L = nuevos.length, viejos = digitosDe(CARTEL.prev).slice(-L).join('').padStart(L, '0').split('');
  const w = 92, h = 126, gap = 10, x0 = 34, y0 = (H - h) / 2;
  for (let i = 0; i < L; i++) {
    const x = x0 + i * (w + gap), p = Math.max(0, Math.min(1, (seg - i * .14) / .5)), cambia = nuevos[i] !== viejos[i] && p < 1;
    const d = cambia && p < .5 ? viejos[i] : nuevos[i], k = cambia ? (p < .5 ? 1 - p * 2 : (p - .5) * 2) : 1; // la ficha se pliega y se abre con el número nuevo
    g.save(); g.translate(x + w / 2, y0 + h / 2); g.scale(1, Math.max(.02, k));
    g.fillStyle = '#fbf7ee'; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 8); g.fill();
    g.strokeStyle = 'rgba(74,59,42,.35)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#4a3b2a'; g.font = '600 100px ' + F; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d, 0, 6);
    g.fillStyle = 'rgba(74,59,42,.12)'; g.fillRect(-w / 2 + 2, -1.5, w - 4, 3); // la línea de la ficha partida, apenas
    g.restore();
  }
  const tx = x0 + L * (w + gap) + 18, tw = W - tx - 24;
  g.fillStyle = '#4a3b2a'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.font = '700 54px ' + F; g.fillText('DÍAS', tx, H / 2 - 48);
  g.font = '600 36px ' + F; g.fillText('SIN ACCIDENTES', tx, H / 2 + 2);
  if (CARTEL.record > 0) { g.fillStyle = 'rgba(74,59,42,.7)'; g.font = '500 26px ' + F; g.fillText('Récord: ' + CARTEL.record + (CARTEL.record === 1 ? ' día' : ' días'), tx, H / 2 + 46); }
  void tw;
}
function cartelTextura() {
  if (!CARTEL.cv) {
    CARTEL.cv = document.createElement('canvas'); CARTEL.cv.width = 660; CARTEL.cv.height = 200;
    CARTEL.tex = new THREE.CanvasTexture(CARTEL.cv); CARTEL.tex.colorSpace = THREE.SRGBColorSpace; CARTEL.tex.anisotropy = 4;
    pintarCartel(9);
    // la tipografía puede llegar después: se vuelve a pintar cuando esté lista
    if (document.fonts && document.fonts.load) document.fonts.load('700 44px Nunito').then(() => { pintarCartel(9); CARTEL.tex.needsUpdate = true; }).catch(() => {});
  }
  return CARTEL.tex;
}
export function setCartel(c) {
  c = c || {};
  const dias = c.dias == null ? CARTEL.dias : Math.max(0, Math.min(999, Math.round(+c.dias || 0)));
  const cambia = dias !== CARTEL.dias;
  if (c.animar && cambia && !RM) { CARTEL.prev = CARTEL.dias; CARTEL.t0 = performance.now(); } else CARTEL.prev = dias;
  CARTEL.dias = dias; CARTEL.record = c.record == null ? CARTEL.record : Math.max(0, Math.round(+c.record || 0)); CARTEL.dirty = true;
  if (CARTEL.cv && (!c.animar || !cambia || RM)) { pintarCartel(9); CARTEL.tex.needsUpdate = true; CARTEL.dirty = false; }
}
export function cartelActual() { return { dias: CARTEL.dias, record: CARTEL.record }; }
// Cada cuadro mientras gira: repinta las fichas y hace un saltito de todo el cartel
function tickCartel(o, t) {
  const seg = (performance.now() - CARTEL.t0) / 1000;
  if (seg < 1.3) { pintarCartel(seg); CARTEL.tex.needsUpdate = true; const b = o.userData.base; o.scale.setScalar(b * (1 + Math.sin(Math.min(1, seg / .7) * Math.PI) * .06)); }
  else if (CARTEL.dirty || CARTEL.prev !== CARTEL.dias) { CARTEL.prev = CARTEL.dias; pintarCartel(9); CARTEL.tex.needsUpdate = true; CARTEL.dirty = false; o.scale.setScalar(o.userData.base); }
}

/* Escenario opcional: { lago: tamaño (.7–1.4), arboles: n, tortuga: true, banderas: n, cartel: true }.
   Cada cosa tiene su lugar fijo (a la vista de las cámaras y fuera del paseo de Uku) y su sitio propio en el bosque. */
let esc = null;
const LAGO_P = [1.25, -.05], LAGO_R = .5;
/* Repartido por todo el claro (unos 4,4 m de ancho): a la izquierda el huerto con su cerca y la bandera; al frente a la
   izquierda la banca con el farol; la leña y el buzón junto a la casa; a la derecha el lago con la cascada detrás, el
   arroyo que sale al frente con su puente, la tortuga en la orilla; al fondo a la izquierda, a la entrada del bosque, el letrero; más hongos en la orilla derecha del lago. */
/* Un claro chico y fácil de administrar (lo principal es la asistencia; el mundo acompaña): la casa, el lago con su
   cascada y el puente, la banca con el farol, el letrero del bosque, el buzón, la leña y la tortuga. Nada más. */
const ESC_ZONA = { farol: [-.8, .1], banca: [-1.15, .35], buzon: [-.15, -.62], lena: [-.85, -1.4], tortuga: [1.55, .45], cascada: [1.4, -.72], puente: [.95, .55], arroyo: [.95, .55], bandera: [-1.45, .05], heliconias: [], hojonas: [], cartel: [-1.2, -1.1], farolitos: [], guayas: [[-1.45, -.55], [1.0, -1.3]] };
const PASEO = [[-.9, -.9]]; // junto al letrero, que los árboles no tapen
/* ---------- Senderos ----------
   Corredores invisibles que unen los lugares del claro, saliendo de la plazuela entre los canteros: a la casa, al lago,
   a la banca y de ahí al huerto y, bordeando, hasta el letrero del bosque; a la cascada por detrás del lago, y al
   puente. Siempre están libres (nada se pone encima, los árboles los esquivan): por ahí pasea Uku y por ahí se lo
   guía. No se dibujan (un bosque no tiene caminos de tierra); los farolitos en las esquinas son la única pista. */
const PLAZA = [0, .15];
const SENDEROS = [
  [PLAZA, [-.25, -.25], [-.5, -.55]],                               // a la puerta de la casa
  [PLAZA, [.45, -.05], [.68, -.05]],                                // a la orilla del lago
  [[.45, -.05], [.7, -.45], [.92, -.62]],                           // por detrás del lago, a la cascada
  [PLAZA, [-.3, .68], [-.85, .64]],                                 // a la banca y el farol
  [[-.5, -.55], [-.9, -.9]],                                        // de la casa a la leña y el letrero del bosque
  [PLAZA, [.2, .55], [.55, .68]]                                    // al puente sobre el arroyo
];
const ANCHO_SENDERO = .24;
function distSegmento(x, z, [ax, az], [bx, bz]) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}
// A cuánto queda (x, z) del sendero más cercano
function distSendero(x, z) {
  let d = 1e9;
  for (const s of SENDEROS) for (let i = 1; i < s.length; i++) d = Math.min(d, distSegmento(x, z, s[i - 1], s[i]));
  return d;
}
// Los puntos de llegada de los senderos, con nombre (para «llévame a…» y para pasear)
const DESTINOS = { plaza: PLAZA, casa: [-.5, -.55], lago: [.68, -.05], cascada: [.92, -.62], banca: [-.85, .64], letrero: [-.9, -.9], puente: [.55, .68] };
// Para revisar el diseño: qué cosa queda encima de un sendero (se calcula sin el atajo de «sendero siempre libre»)
export function senderosChocan() {
  const malos = [];
  SENDEROS.forEach((s, si) => { for (let i = 1; i < s.length; i++) { const [ax, az] = s[i - 1], [bx, bz] = s[i], n = Math.ceil(Math.hypot(bx - ax, bz - az) / .05); for (let k = 0; k <= n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n; const q = quienBloquea(x, z); if (q) malos.push({ sendero: si, x: +x.toFixed(2), z: +z.toFixed(2), q }); } } });
  return malos;
}
function quienBloquea(x, z) {
  if (!esc) return null;
  if (Math.hypot(x - LAGO_P[0], z - LAGO_P[1]) < lagoEnForma() + .12) return 'lago';
  if (!ZONA.canteros.every(([bx, bz]) => Math.hypot(x - bx, z - bz) > BED_R + .08)) return 'cantero';
  for (let i = 0; i < ZONA.hogar.length && i < 1; i++) if (Math.hypot(x - ZONA.hogar[i][0], z - ZONA.hogar[i][1]) <= .38) return 'casa';
  for (let i = 0; i < ZONA.guayacanes.length; i++) if (Math.hypot(x - ZONA.guayacanes[i][0], z - ZONA.guayacanes[i][1]) <= .28) return 'guayacan' + i;
  const RADIO = { cascada: .42, puente: .3, arroyo: .3, farol: .18, banca: .3, cerca: .3, huerto: .3, cartel: .32, lena: .18, tortuga: .18, hongos: .16, buzon: .14, bandera: .1, poste: .14 };
  for (const k in ESC_ZONA) { const v = ESC_ZONA[k]; if (!Array.isArray(v[0]) && Math.hypot(x - v[0], z - v[1]) < (RADIO[k] || .22)) return k; }
  if (!(ESC_ZONA.hojonas || []).every(([hx, hz]) => Math.hypot(x - hx, z - hz) > .16)) return 'hojona';
  if (!ESC_ZONA.guayas.every(([gx, gz]) => Math.hypot(x - gx, z - gz) > .32)) return 'guaya';
  if (!ESC_TREES) ESC_TREES = escTrees(); if (!ESC_TREES.every(t => Math.hypot(x - t.x, z - t.z) > .22)) return 'arbol';
  return null;
}
export function destinos() { return Object.assign({}, DESTINOS); }
export function destino(nombre) { const d = DESTINOS[nombre]; return d ? { x: d[0], z: d[1] } : null; }
const lagoEnForma = () => Math.max(.7, Math.min(1.4, esc && esc.lago || 1)) * LAGO_R;
const escTrees = () => scatter(19, 22, 1.0, 2.0, (x, z) => (z < -1.0 || Math.abs(x) > 1.3) && TALL(x, z) && VISIBLE(x, z - .3) && awayBig(.5)(x, z) && distSendero(x, z) > .3 && Math.hypot(x - LAGO_P[0], z - LAGO_P[1]) > lagoEnForma() + .4 && Math.hypot(x - ESC_ZONA.cartel[0], z - ESC_ZONA.cartel[1]) > .5 && Math.hypot(x - ESC_ZONA.cascada[0], z - ESC_ZONA.cascada[1]) > .7 && PASEO.every(([px, pz]) => Math.hypot(x - px, z - pz) > .45) && ESC_ZONA.guayas.every(([gx, gz]) => Math.hypot(x - gx, z - gz) > .55), .42);
// Lo que se ve en el claro
function enClaro() {
  return { props: claro.casa ? ['casa'] : [], guayas: Math.max(0, Math.min(4, claro.guayacanes | 0)),
    flores: Math.max(bloom || 0, claro.flores ? 25 : 0), brotes: !!claro.brotes };
}

// Cada objeto del claro: una malla con su geometría compartida, ubicada y con lo que necesita para crecer y mecerse
function item(kind, v, pal, p, base, opts) {
  const m = new THREE.Mesh(geo(kind + v, () => PARTS[kind](pal, v)), LAMB);
  placeAt(m, p.x, p.z, p.rot);
  Object.assign(m.userData, { kind, base, q0: m.quaternion.clone(), sway: 0, ph: p.rot || 0, gs: 1.3 }, opts || {});
  return m;
}
function makeTree(p, pal) {
  // Con escenario (la POC): bosque nublado, helechos arbóreos y árboles de copa amplia; si no, lo de siempre
  const kind = esc ? (p.t < .3 ? 'helecho' : 'nublado') : p.t < .6 ? (look.region === 'costa' ? 'palma' : 'pino') : 'copa';
  return item(kind, p.v % 3, pal, p, (p.big ? 1.15 : .85 + p.s * .4) * (p.low ? .7 : 1), { sway: .02, gs: .9 });
}
// Las cosas del escenario: el lago (con sus patos que nadan), y alrededor lo de todos los días
function escenario(want, pal, Z, id) {
  const E = ESC_ZONA, face = (x, z) => Math.atan2(-x, 3.2 - z) * .8, put = (k, [x, z], base, rot, extra) => { want['S' + k] = () => Z(item(k, '', pal, { x, z, rot: rot == null ? face(x, z) : rot }, base, Object.assign({ gs: 1.1 }, extra)), 'escenario'); };
  const s = Math.max(.7, Math.min(1.4, esc.lago || 1));
  want['SLAGO'] = () => {
    const o = Z(item('lago', '', pal, { x: LAGO_P[0], z: LAGO_P[1], rot: 0 }, s * 1.05, { gs: .9 }), 'escenario');
    const patoG = geo('pato', () => PARTS.pato(pal));
    const patos = [new THREE.Mesh(patoG, LAMB), new THREE.Mesh(patoG, LAMB)];
    patos.forEach((m, i) => { m.scale.setScalar(i ? .6 : .78); o.add(m); }); // el patito, más chico
    o.userData.tick = (m, t) => patos.forEach((d, i) => { const a = t * (.16 + i * .05) * (i ? -1 : 1) + i * 2.4, rr = LAGO_R * (.42 + i * .18); d.position.set(Math.cos(a) * rr, .03 + Math.sin(t * 2 + i) * .004, Math.sin(a) * rr); d.rotation.y = -a + (i ? Math.PI / 2 : -Math.PI / 2); });
    return o;
  };
  put('farol', E.farol, 1.1); put('banca', E.banca, 1.3, .9);
  put('buzon', E.buzon, 1.1); put('lena', E.lena, 1.1);
  // Más guayacanes en flor repartidos por el claro
  (E.guayas || []).forEach(([x, z], i) => { want['SG' + i] = () => Z(item('guaya', (i + 1) % 3, pal, { x, z, rot: i * 2.1 }, 1.05 + (i % 2) * .15, { sway: .015, gs: .7, crown: .95 }), 'escenario'); });
  if (esc.cartel) want['SCARTEL'] = () => {
    const o = Z(item('cartel', '', pal, { x: E.cartel[0], z: E.cartel[1], rot: .55 }, 1.3, { gs: 1 }), 'escenario');
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.56, .17), new THREE.MeshBasicMaterial({ map: cartelTextura(), fog: false, transparent: true, color: pal.bg === '#1f1f1f' ? '#c4c9d6' : '#ffffff' }));
    m.position.set(0, .3, .0155); o.add(m); o.userData.tick = tickCartel;
    return o;
  };
  // Mindo: la cascada al fondo del lago (con su neblina), el arroyo que sale por delante y el puentecito de tablas
  want['SCASCADA'] = () => {
    const o = Z(item('cascada', '', pal, { x: E.cascada[0], z: E.cascada[1], rot: .25 }, 1.2, { gs: .9 }), 'escenario');
    const tex = dotTexture(), nieblas = [];
    for (let i = 0; i < 4; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#ffffff', transparent: true, opacity: .45, depthWrite: false })); sp.scale.set(.16, .1, 1); o.add(sp); nieblas.push(sp); }
    o.userData.tick = (m, t) => nieblas.forEach((n, i) => { const f = (t * .18 + i / 4) % 1; n.position.set(-.08 + i * .05 + Math.sin(t + i) * .02, .05 + f * .3, .12); n.material.opacity = Math.sin(f * Math.PI) * .45; n.scale.set(.14 + f * .16, .09 + f * .1, 1); });
    return o;
  };
  const ra = Math.atan2(E.arroyo[0] - LAGO_P[0], E.arroyo[1] - LAGO_P[1]);
  want['SARROYO'] = () => Z(item('arroyo', '', pal, { x: E.arroyo[0], z: E.arroyo[1], rot: ra }, 1.1, { gs: 1 }), 'escenario');
  want['SPUENTE'] = () => Z(item('puente', '', pal, { x: E.puente[0], z: E.puente[1], rot: ra + Math.PI / 2 }, 1.1, { gs: 1.1 }), 'escenario');
  (E.heliconias || []).forEach(([x, z], i) => { want['SHELI' + i] = () => Z(item('heliconia', '', pal, { x, z, rot: i * 1.3 }, 1.1 + (i % 3) * .1, { sway: .04, gs: 1.1 }), 'escenario'); });
  (E.hojonas || []).forEach(([x, z], i) => { want['SHOJA' + i] = () => Z(item('hojona', '', pal, { x, z, rot: i * 2.2 }, 1 + (i % 2) * .25, { sway: .03, gs: 1.1 }), 'escenario'); });
  if (esc.tortuga) put('tortuga', E.tortuga, 1.4, 4.4);
  for (let i = 0; i < Math.min(2, esc.banderas | 0); i++) want['Sbandera' + i] = () => Z(item('bandera', '', pal, { x: E.bandera[0] + i * .35, z: E.bandera[1], rot: 0 }, 1.3, { gs: 1.1, sway: .03 }), 'escenario');
}
// Humo de la chimenea: tres bocanadas que suben, crecen y se deshacen
let smokeM = null; const smokeG = new THREE.SphereGeometry(.03, 7, 5);
function smoke(o, t) { o.children.forEach((c, i) => { const f = (t * .22 + i / 3) % 1; c.position.set(.14 + f * .08, .41 + f * .32, -.05); c.scale.setScalar(Math.max(.001, Math.sin(f * Math.PI) * (.6 + f))); }); }
function makeProp(k, pal, x, z) {
  const o = item(k, '', pal, { x, z, rot: Math.atan2(-x, 3.2 - z) * .8 }, 1.45, { gs: 1.1 });
  if (k === 'casa') { for (let i = 0; i < 3; i++) o.add(new THREE.Mesh(smokeG, smokeM)); o.userData.tick = smoke; }
  return o;
}

/* El bosque se actualiza por diferencia: al cambiar el puntaje o el claro sólo crece lo que falta
   y se encoge lo que sobra; nada se recrea de golpe. (full = rehacer, p. ej. al cambiar de tema.) */
let planted = [], plantN = 0; // brotes que Uku plantó en esta visita
function buildForest(full) {
  const pal = palette();
  if (!forest) { forest = new THREE.Group(); scene.add(forest); }
  if (full) { forest.children.slice().forEach(o => forest.remove(o)); clearGeo(); buildGarden(pal); }
  const f = enClaro(), want = {}, id = (x, z) => x.toFixed(2) + ',' + z.toFixed(2);
  const Z = (o, zona) => { o.userData.zona = zona; return o; };
  f.props.forEach((k, i) => { const sp = ZONA.hogar[i]; if (!sp) return; const [x, z] = sp; want['C' + k + id(x, z)] = () => Z(makeProp(k, pal, x, z), 'hogar:' + k); });
  for (let i = 0; i < f.guayas && i < ZONA.guayacanes.length; i++) { const [x, z] = ZONA.guayacanes[i]; want['G' + id(x, z)] = () => Z(item('guaya', i % 3, pal, { x, z, rot: i * 1.7 }, 1.1 + (i % 2) * .12, { sway: .015, gs: .7, crown: .95 }), 'guayacanes'); }
  // Sin guayacanes, en su lugar espera un arbolito: el guayacán que puede crecer
  if (!f.guayas && ZONA.guayacanes[0]) { const [x, z] = ZONA.guayacanes[0]; want['A' + id(x, z)] = () => Z(item('arbolito', '', pal, { x, z, rot: -.5 }, 1.5, { sway: .03, gs: 1 }), 'guayacanes'); }
  // Los canteros siempre están; vacíos, con un letrero que invita a llenarlos
  ZONA.canteros.forEach(([x, z], i) => {
    want['K' + i] = () => Z(item('cantero', '', pal, { x, z, rot: i }, 1, { gs: 1.6 }), 'canteros');
    if (!f.flores && !f.brotes && i === 0) want['L' + i] = () => Z(item('letrero', '', pal, { x: x + .18, z: z - .2, rot: Math.atan2(-x, 3.2 - z) }, 1.3, { sway: .01 }), 'canteros');
  });
  // Bosque de atrás: con escenario, los árboles que pide; sin él, los que dice el puntaje (con brotes, ninguno)
  const spots = esc ? escTrees() : TREES;
  const trees = esc && esc.arboles ? spots.slice(0, esc.arboles) : claro.brotes ? [] : spots.slice(0, 3 + Math.round(score / 100 * (spots.length - 3)));
  trees.forEach(p => { want['T' + (p.low ? 'l' : 'h') + id(p.x, p.z)] = () => Z(makeTree(p, pal), 'bosque'); });
  if (esc) escenario(want, pal, Z, id);
  // En la costa, dos palmeras a los lados de Uku para que se lean a primera vista
  if (look.region === 'costa' && !claro.brotes) [{ x: -1.35, z: -.45, s: 1, t: .1, v: 0, rot: .4 }, { x: 1.4, z: -.5, s: .8, t: .2, v: 1, rot: 2.6 }].forEach(p => { want['P' + id(p.x, p.z)] = () => item('palma', p.v, pal, p, 1.05, { sway: .02, gs: .9 }); });
  FLOWERS.slice(0, Math.round(f.flores / 100 * FLOWERS.length)).forEach((p, i) => { want['F' + i] = () => Z(item('flor', p.v, pal, { x: p.x, z: p.z, rot: Math.atan2(-p.x, 3.2 - p.z) + (p.t - .5) * .8 }, .95 + p.s * .45, { sway: .1, top: .12 }), 'canteros'); });
  if (f.brotes) SPROUTS.concat(FLOWERS.slice(0, 20)).forEach((p, i) => { want['B' + i] = () => Z(item('brote', p.v, pal, p, .9 + p.s * .5, { sway: .08, top: .06 + p.v * .012 }), 'canteros'); });
  planted.forEach(p => { want[p.key] = () => item('brote', 1, pal, p, 1.15, { sway: .08, top: .07, gs: .32 }); });
  // Lo que Fran puso a mano (decorar): cada cosa con su sitio y su giro
  decoracion.forEach(d => { const D = DECORABLES[d.k]; if (D) want['D' + d.id] = () => Z(item(D.kind, D.v == null ? '' : D.v, pal, { x: d.x, z: d.z, rot: d.rot || 0 }, D.base, { sway: D.sway || 0, gs: 1.2 }), 'decoracion'); });
  const have = {};
  forest.children.forEach(o => { have[o.userData.key] = o; });
  Object.keys(have).forEach(k => { const u = have[k].userData; u.dir = want[k] ? 1 : -1; if (u.dir < 0) u.delay = 0; });
  let n = 0;
  Object.keys(want).forEach(k => {
    if (have[k]) return;
    const o = want[k](), u = o.userData; u.key = k; u.dir = 1; u.grow = full ? 1 : 0;
    u.delay = full || RM || k[0] === 'X' ? 0 : (n++ % 14) * .05 + Math.random() * .3; // lo nuevo brota de a poco, no todo a la vez
    o.scale.setScalar(full ? u.base : .001);
    forest.add(o);
  });
  // Mariposas: las que pide setClaro (siempre hay al menos dos revoloteando)
  flyN = claro.mariposas != null ? Math.max(2, Math.min(6, claro.mariposas)) : Math.min(5, 2 + (f.flores > 0) + (f.guayas > 0) + f.brotes);
}
// Lo que siempre está, tenga lo que tenga: pasto, piedras, arbustos y florcitas blancas (una sola malla)
const _dum = new THREE.Object3D();
/* Con escenario el claro se llena: más matas, piedras, arbustos y margaritas, y además florcitas silvestres y helechitos,
   repartidos por todo el claro (más densos cerca de los senderos y lejos del centro) sin pisar los senderos, el lago ni lo
   que hay puesto. Se calcula una vez. */
/* Regado por todo el claro (hasta el borde del bosque, 3,4 m), con mucha separación y mucho espacio libre: la plazuela y
   los senderos quedan despejados, y nada se amontona cerca de la cámara. Lo lejano se apoya solo donde se ve el suelo. */
// Un parche de suelo de otro tono: un casquete de la esfera (sigue la curva del planeta) centrado en (x, z), de radio r
// El casquete tiene pocos lados (CAP_W): entre vértice y vértice la cuerda se hunde (hasta 2,6 cm en los grandes) y se
// metería bajo el suelo, que está teselado fino (se veían «dedos» de suelo encima del parche). Se levanta lo que se hunde.
const _qc = new THREE.Quaternion(), CAP_W = 28, CAP_H = 6;
const hundeCap = r => PLANET_R * Math.sin(Math.min(r / PLANET_R, Math.PI / 2)) * (1 - Math.cos(Math.PI / CAP_W));
// Para apilar parches: a qué altura (alto) va el que se pone encima de uno de radio r que está a alto
const encimaDe = (r, alto = .004) => alto + hundeCap(r) + .004;
function casquete(x, z, r, color, estiro = 1, alto = .004) {
  surf(x, z, _sp); _qc.setFromUnitVectors(_nrm, _sp);
  const g = new THREE.SphereGeometry(PLANET_R + alto + hundeCap(r * Math.max(1, estiro)), CAP_W, CAP_H, 0, Math.PI * 2, 0, r / PLANET_R);
  return pc(g, color, new THREE.Matrix4().compose(PLANET_C, _qc, _s4.set(1, 1, estiro)));
}
// El mismo parche dado por su normal (sirve en la antípoda, donde surf degenera); alto lo levanta para apilar tonos
function casqueteN(n0, r, color, alto = .004) {
  _qc.setFromUnitVectors(_nrm, n0);
  const g = new THREE.SphereGeometry(PLANET_R + alto + hundeCap(r), CAP_W, CAP_H, 0, Math.PI * 2, 0, r / PLANET_R);
  return pc(g, color, new THREE.Matrix4().compose(PLANET_C, _qc, _s4.set(1, 1, 1)));
}
let DECO_ESC = null;
function decoEsc() {
  if (DECO_ESC) return DECO_ESC;
  const libre = (x, z) => distSendero(x, z) > .22 && Math.hypot(x - PLAZA[0], z - PLAZA[1]) > .55 && Math.hypot(x - LAGO_P[0], z - LAGO_P[1]) > lagoEnForma() + .18
    && !quienBloquea(x, z) && VISIBLE(x, z) && z < 1.0 && z > -1.9;
  // Un poco más que antes (49 piezas) pero con las mismas semillas: lo de siempre no se mueve, lo nuevo se suma al final
  return DECO_ESC = {
    tufts: scatter(5, 16, .5, 2.3, libre, .45), rocks: scatter(17, 4, .9, 2.2, libre, 1.0),
    bushes: scatter(23, 4, 1.3, 2.2, (x, z) => libre(x, z) && Math.hypot(x, z) > 1.3, 1.0), daisies: scatter(43, 9, .6, 2.3, libre, .5),
    silvestres: scatter(61, 7, .6, 2.3, libre, .6), helechitos: scatter(67, 3, 1.1, 2.2, (x, z) => libre(x, z) && Math.hypot(x, z) > 1.1, 1.0),
    // Calvas de otro tono: pocas, chicas y bien separadas, y no más allá de 1,9 m (al sur del claro se solapaban)
    parches: scatter(73, 4, .8, 2.2, (x, z) => distSendero(x, z) > .3 && Math.hypot(x - LAGO_P[0], z - LAGO_P[1]) > lagoEnForma() + .5 && VISIBLE(x, z) && Math.hypot(x, z) < 1.9, 1.4)
  };
}
function buildGarden(pal) {
  if (garden) { scene.remove(garden); garden.geometry.dispose(); } PLANETA = null;
  const enLago = (p) => !esc || Math.hypot(p.x - LAGO_P[0], p.z - LAGO_P[1]) > lagoEnForma() * 1.1 + .1;
  const parts = [], M = (p, s) => { placeAt(_dum, p.x, p.z, p.rot); return new THREE.Matrix4().compose(_dum.position, _dum.quaternion, _s4.setScalar(s)); };
  const D = esc ? decoEsc() : DECO;
  D.tufts.filter(enLago).forEach(p => { const m = M(p, .8 + p.s * .5); [-.35, 0, .35].forEach((a, i) => parts.push(pc(new THREE.ConeGeometry(.009, .055 + (i % 2) * .025, 3), pal.grass, m.clone().multiply(TRS([a * .035, .035 + (i % 2) * .015, 0], [0, 0, a]))))); });
  D.rocks.filter(enLago).forEach(p => parts.push(pc(new THREE.DodecahedronGeometry(.06, 0), pal.rock, M(p, .7 + p.s).multiply(TRS([0, .015, 0], [p.t, 0, 0], [1, .55, .8])))));
  D.bushes.filter(enLago).forEach(p => { const m = M(p, 1 + p.s * .5), c = pal.round[p.v % pal.round.length]; [[0, .1, 0, .13], [.1, .07, .04, .09], [-.09, .06, -.03, .08]].forEach(([x, y, z, r]) => parts.push(pc(new THREE.IcosahedronGeometry(r, 0), c, m.clone().multiply(TRS([x, y, z], [p.t, 0, 0]))))); });
  D.daisies.filter(enLago).forEach(p => { const m = M(p, .8 + p.s * .4); parts.push(pc(CYL(.003, .004, .05, 3), pal.grass, m.clone().multiply(TRS([0, .025, 0]))), pc(new THREE.SphereGeometry(.01, 5, 3), pal.dust, m.clone().multiply(TRS([0, .052, 0], 0, [1, .6, 1])))); });
  if (esc) planetaGeo(pal).forEach(g => parts.push(g));
  (D.parches || []).forEach((p, i) => { const col = pal.bg === '#1f1f1f' ? ['#30333b', '#2f3238'][i % 2] : ['#c7ccd4', '#aab1bc'][i % 2]; parts.push(casquete(p.x, p.z, .35 + p.s * .2, col)); });
  (D.silvestres || []).forEach(p => { const m = M(p, .9 + p.s * .5); PARTS.silvestre(pal, p.v).forEach(g => parts.push(g.applyMatrix4(m))); });
  (D.helechitos || []).forEach(p => { const m = M(p, .8 + p.s * .6); PARTS.helechito(pal, p.v).forEach(g => parts.push(g.applyMatrix4(m))); });
  garden = new THREE.Mesh(kit(parts), LAMB); garden.visible = !focus; scene.add(garden);
}
/* ---------- El resto del planeta: un mundo por zonas (como el de Tolan) ----------
   Fuera del claro el planeta no se rellena al azar: tiene seis ZONAS con nombre, cada una un parche grande de otro tono con
   un subparche interior, un hito (algo de 1,3–2 m que se reconoce desde el espacio) y unos racimos de piezas grandes,
   más dos reservas vacías para Decorar y la nieve del polo sur. Entre zona y zona queda suelo pelado (≥ 2,1 m): lo que
   las separa es el espacio libre, no caminos. Alrededor del claro hay una franja sin nada (hasta 4,8 m de arco) para que
   lo automático no caiga en el propio borde del bosque. Todo va en la malla única del jardín (cero llamadas de dibujo
   nuevas, nada animado). Semilla fija por zona: el planeta es el mismo en cada visita. Amarillo solo en la pradera. */
Object.assign(PARTS, {
  // Árbol madre del bosquecito nublado: tronco con raíces, copa amplia y aplastada en capas, barbas de musgo colgando
  arbolMadre: pal => [pc(CYL(.07, .12, .9, 7), pal.trunk, [0, .45, 0]),
    ...[0, 1, 2].map(i => pc(CYL(.03, .05, .25, 5), pal.trunk, [Math.cos(i * 2.094) * .1, .1, Math.sin(i * 2.094) * .1], [0, -i * 2.094, 1.1])),
    pc(new THREE.IcosahedronGeometry(.55, 1), pal.round[0], [0, 1.2, 0], [0, .4, 0], [1, .55, 1]),
    pc(new THREE.IcosahedronGeometry(.32, 0), pal.round[1], [.4, 1.05, .1], [.3, 0, 0]), pc(new THREE.IcosahedronGeometry(.32, 0), pal.round[1], [-.4, 1.05, .1], [0, .7, 0]),
    pc(new THREE.IcosahedronGeometry(.2, 0), pal.pine[2 % pal.pine.length], [0, 1.5, 0], [.2, .5, 0]),
    pc(new THREE.ConeGeometry(.04, .3, 3), pal.grass, [.3, .85, .25], [Math.PI, 0, 0]), pc(new THREE.ConeGeometry(.04, .3, 3), pal.grass, [-.25, .88, -.2], [Math.PI, 0, 0])],
  // Peñón del roquedal: una roca alta con otra al pie, una grieta en sombra y un poco de pasto en la cima
  penon: pal => [pc(new THREE.DodecahedronGeometry(.55, 0), pal.rock, [0, .6, 0], [0, .3, 0], [1, 1.3, .8]), pc(new THREE.DodecahedronGeometry(.3, 0), pal.rock, [.45, .3, .1], [.2, .9, 0]),
    pc(new THREE.DodecahedronGeometry(.22, 0), pal.trunk, [-.35, .2, -.1], [.1, .5, 0]), pc(new THREE.IcosahedronGeometry(.14, 0), pal.grass, [0, 1.35, 0], [0, 0, 0], [1, .6, 1])],
  // Guayacán madre de la pradera: el guayacán de siempre a escala 1,5, con la copa de un solo amarillo más oscuro (para que
  // se distinga de los guayacanes vecinos) y el tronco y las ramas el doble de gruesos
  guayaMadre: pal => {
    const osc = pal.bg === '#1f1f1f', g = osc ? '#e6c13d' : '#e8b93a', o = PARTS.guaya(Object.assign({}, pal, { guaya: [g, g] }), 0);
    o[0] = pc(CYL(.08, .12, .5), pal.trunk, [0, .25, 0], [0, 0, .05]);
    [[-.5, .3], [.55, -.2], [.1, .6]].forEach(([a, b], i) => { o[1 + i] = pc(CYL(.044, .064, .36), pal.trunk, [Math.sin(a) * .1, .6, Math.sin(b) * .08], [b * .6, 0, -a * .9]); });
    return o; },
  // Hongo grande del silvestre: pie crema, sombrero azul gris oscuro y lunares casi blancos (sin amarillo, que es solo del claro y la pradera)
  hongoGrande: pal => { const osc = pal.bg === '#1f1f1f', som = osc ? '#3c4659' : '#7d8aa3', lun = osc ? '#d9dce4' : '#f3f4f7';
    return [pc(CYL(.12, .18, .7, 8), CREMA, [0, .35, 0]), pc(new THREE.SphereGeometry(.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), som, [0, .7, 0], 0, [1, .75, 1]),
    ...[[.2, .25, .3], [-.25, .22, .2], [.05, .32, -.3], [-.1, .35, .1], [.3, .2, -.15]].map(([x, y, z]) => pc(new THREE.SphereGeometry(.07, 5, 3), lun, [x, .7 + y, z], 0, [1, .6, 1])),
    pc(CYL(.05, .07, .3, 6), CREMA, [.45, .15, .1]), pc(new THREE.SphereGeometry(.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), som, [.45, .3, .1], 0, [1, .75, 1])]; },
  // Pino nevado del polo sur: el pino de siempre en celeste pálido, con una capa de nieve blanca en cada piso (que se lea sobre la nieve)
  pinoNevado: pal => { const osc = pal.bg === '#1f1f1f', P = Object.assign({}, pal, { pine: osc ? ['#4a4e5a', '#565a66', '#5f636f'] : ['#c5cfe2', '#b9c6de', '#c5cfe2'] });
    return [...PARTS.pino(P, 0), ...[[.32, .5, .45], [.25, .42, .72], [.17, .32, .95]].map(([r, h, y]) => pc(new THREE.SphereGeometry(r + .02, 7, 4), '#ffffff', [0, y - h / 2 + .03, 0], 0, [1, .25, 1]))]; },
  // Árbol lejano: el más barato (60 triángulos), para los racimos del bosquecito, la laguna y el silvestre
  arbolLejano: (pal, v) => [pc(CYL(.04, .06, .45, 5), pal.trunk, [0, .22, 0]), pc(new THREE.IcosahedronGeometry(.3, 0), pal.round[v % 2], [0, .62, 0], [0, v, 0]),
    pc(new THREE.IcosahedronGeometry(.17, 0), pal.pine[v % pal.pine.length], [.12, .82, .05], [v, 0, 0])]
});
/* Las zonas: centro en polares (a = ángulo desde el claro, b = azimut desde +z, hacia +x), r = radio del parche en metros de arco, ri = el
   subparche interior; tonos [exterior, interior] para tema claro y oscuro (todos con ≥ 10 % de contraste contra el suelo);
   hito { kind, esc, en } y racimos { kind, n, esc: [min, max], gap, r0, r1 } alrededor del centro. Los azimuts son irregulares
   y están girados de modo que, al alejar desde el claro (la cámara mira desde +z), de entrada se vean el bosquecito, la
   pradera y la laguna; la nieve queda abajo y el roquedal y el silvestre, del otro lado: hay que girar el planeta. */
// Las piezas van chicas (escala 0,9–1,4; los hitos 1,3–1,6) y en más cantidad: de cerca (zoom 1,6) queda aire entre
// ellas y desde el espacio la zona se lee por la mancha de tono y el conjunto, no por piezas gigantes.
// Copas más oscuras para el bosquecito (desde el espacio el bosque se lee como mancha oscura, no como piezas pálidas)
const PAL_BOSQUE = (pal, osc) => Object.assign({}, pal, { round: osc ? ['#3d4659', '#444e63'] : ['#aab6cc', '#9aa7c0'] });
const ZONAS = [
  { id: 'bosque', nombre: 'Bosquecito nublado', a: 1.40, b: -0.40, r: 2.0, ri: 1.0, tonos: ['#8f9bb3', '#7f8ca6'], tonosOsc: ['#1f2229', '#1a1d24'],
    hito: { kind: 'arbolMadre', esc: 1.35, R: 1.1, pal: (pal, osc) => Object.assign({}, pal, { round: osc ? ['#4a5469', '#3d4659'] : ['#8a97b0', '#7f8ca6'] }), cap: { r: .6, tono: '#7f8ca6', tonoOsc: '#171a20' } }, // copa más grande y más oscura que las vecinas: se reconoce desde el espacio
    racimos: [{ kind: 'arbolLejano', n: 8, esc: [.9, 1.15], gap: .95, r0: .9, r1: 1.7, pal: PAL_BOSQUE }, // con aire entre copas y un anillo de suelo alrededor del árbol madre { kind: 'helecho', n: 3, esc: [1.0, 1.2], gap: .8, r0: .5, r1: 1.5 }, { kind: 'arbusto', n: 6, esc: [1.0, 1.2], gap: .5, r0: .4, r1: 1.6 },
      { kind: 'hojona', n: 4, esc: [1.0, 1.2], gap: .5, r0: .4, r1: 1.5 }, { kind: 'tufts', n: 12, esc: [1.2, 1.5], gap: .4, r0: .3, r1: 1.8 }, { kind: 'helechito', n: 3, esc: [1.0, 1.2], gap: .6, r0: .5, r1: 1.5 }] },
  { id: 'pradera', nombre: 'Pradera de guayacanes', a: 1.35, b: 1.45, r: 1.8, ri: .9, tonos: ['#d9d4c3', '#e4dfcf'], tonosOsc: ['#33322c', '#3a3832'], hito: { kind: 'guayaMadre', esc: 1.5, R: .9 },
    racimos: [{ kind: 'guaya', n: 5, esc: [1.0, 1.2], gap: 1.2, r0: 1.0, r1: 1.5 }, { kind: 'silvestre', n: 14, esc: [1.0, 1.3], gap: .3, r0: .3, r1: 1.6 }, { kind: 'flor', v: 0, n: 8, esc: [1.0, 1.3], gap: .35, r0: .3, r1: 1.6 },
      { kind: 'arbusto', n: 3, esc: [1.0, 1.2], gap: .6, r0: .6, r1: 1.5 }, { kind: 'tufts', n: 6, esc: [1.2, 1.5], gap: .4, r0: .3, r1: 1.6 }] },
  // Roquedal: parche más claro que el suelo y piedras más oscuras que el parche (en el tema oscuro, al revés)
  { id: 'roquedal', nombre: 'Roquedal', a: 1.40, b: 3.20, r: 1.6, ri: .8, tonos: ['#e8eaef', '#f3f4f7'], tonosOsc: ['#3f424b', '#484b54'], hito: { kind: 'penon', esc: 1.0, R: .8 },
    racimos: [{ kind: 'piedra', n: 10, esc: [1.2, 1.8], gap: .45, r0: .3, r1: 1.3, pal: (pal, osc) => Object.assign({}, pal, { rock: osc ? '#2f3139' : '#d6d9df' }) }, { kind: 'arbusto', n: 3, esc: [1.0, 1.2], gap: .6, r0: .6, r1: 1.4 },
      { kind: 'tufts', n: 5, esc: [1.2, 1.5], gap: .5, r0: .4, r1: 1.4 }] },
  { id: 'laguna', nombre: 'Laguna', a: 2.00, b: 0.55, r: 1.6, laguna: true, tonos: ['#c3d3e8', '#f3f4f7'], tonosOsc: ['#283046', '#4a4e5a'],
    racimos: [{ kind: 'arbolLejano', n: 3, esc: [1.0, 1.3], gap: .9, r0: 1.1, r1: 1.5 }, { kind: 'piedra', n: 4, esc: [1.2, 1.6], gap: .5, r0: 1.05, r1: 1.5 }, { kind: 'heliconia', n: 4, esc: [1.0, 1.2], gap: .45, r0: 1.05, r1: 1.5 },
      { kind: 'tufts', n: 8, esc: [1.2, 1.5], gap: .35, r0: .95, r1: 1.2 }] },
  { id: 'silvestre', nombre: 'Silvestre', a: 2.05, b: 2.40, r: 1.4, ri: .7, tonos: ['#a0a9bb', '#929cb0'], tonosOsc: ['#23262d', '#1e2128'], hito: { kind: 'hongoGrande', esc: 1.5, R: .8 },
    racimos: [{ kind: 'arbolLejano', n: 3, esc: [1.0, 1.3], gap: .9, r0: .6, r1: 1.3 }, { kind: 'arbusto', n: 4, esc: [1.0, 1.2], gap: .55, r0: .4, r1: 1.3 }, { kind: 'lena', n: 1, esc: [1.2, 1.2], gap: 0, r0: .5, r1: 1.0 },
      { kind: 'hongoGrande', n: 2, esc: [.45, .6], gap: .5, r0: .4, r1: 1.1 }, { kind: 'tufts', n: 7, esc: [1.2, 1.5], gap: .4, r0: .3, r1: 1.3 }] },
  // Las reservas: un parche apenas distinto del suelo con una piedra y una mata, nada más (son para Decorar)
  { id: 'reservaA', nombre: 'Reserva (para Decorar)', a: 1.25, b: 4.45, r: 1.1, ri: .5, tonos: ['#c3c9d2', '#cdd2da'], tonosOsc: ['#33363e', '#3a3d46'], racimos: [{ kind: 'piedra', n: 1, esc: [1.4, 1.4], gap: 0, r0: .2, r1: .9 }, { kind: 'tufts', n: 1, esc: [1.3, 1.3], gap: 0, r0: .2, r1: .9 }] },
  { id: 'reservaB', nombre: 'Reserva (para Decorar)', a: 2.25, b: 4.20, r: 1.1, ri: .5, tonos: ['#c3c9d2', '#cdd2da'], tonosOsc: ['#33363e', '#3a3d46'], racimos: [{ kind: 'piedra', n: 1, esc: [1.4, 1.4], gap: 0, r0: .2, r1: .9 }, { kind: 'tufts', n: 1, esc: [1.3, 1.3], gap: 0, r0: .2, r1: .9 }] },
  // El polo sur: la nieve (lo único blanco del planeta): parche casi blanco con dos manchones blancos del todo, un pino nevado
  // y unas piedras celeste pálido (que se lean sobre lo blanco); nada verde ni amarillo
  { id: 'nieve', nombre: 'Nieve del polo sur', polo: true, r: 2.2, tonos: ['#e9ebf0', '#ffffff'], tonosOsc: ['#4a4e5a', '#5f636f'], sub: [[2.9, 0.0], [2.95, 3.2]], hito: { kind: 'pinoNevado', esc: 1.4, R: .7, en: [2.95, 1.2] },
    racimos: [{ kind: 'piedra', n: 7, esc: [1.2, 1.8], gap: .6, r0: 0, r1: 2.0, pal: (pal, osc) => Object.assign({}, pal, { rock: osc ? '#565a66' : '#e3e5ea' }) },
      { kind: 'tufts', n: 5, esc: [1.2, 1.5], gap: .6, r0: .3, r1: 1.9 }] } // matas blancas: la nieve no queda pelada de cerca
];
// Centro de cada zona (y de su hito) en coordenadas de arco, calculado una vez: lo usan sitioLibre y zonas()
ZONAS.forEach((Z, i) => {
  Z.seed = 201 + 10 * i; Z.n0 = Z.polo ? new THREE.Vector3(0, -1, 0) : polar(Z.a, Z.b, new THREE.Vector3());
  const c = arcoDe(Z.n0); Z.cx = c.x; Z.cz = c.z;
  if (Z.hito) { const h = Z.hito.en ? arcoDe(polar(Z.hito.en[0], Z.hito.en[1], _sp)) : c; Z.hitoX = h.x; Z.hitoZ = h.z; }
});
const LEJOS_MAX = 3.0 * PLANET_R; // más allá placeAt degenera (la antípoda): ahí no va nada
const fueraDeZonas = (x, z) => { const d = Math.hypot(x, z); return d > 4.8 && d <= LEJOS_MAX && ZONAS.every(Z => distEsf(x, z, Z.cx, Z.cz) > Z.r + .6); };
let PLANETA = null, PLANETA_PUNTOS = []; // los puntos puestos: { x, z, kind, grande } para sitioLibre y para las pruebas
function planetaGeo(pal) {
  if (PLANETA) return PLANETA;
  const out = [], osc = pal.bg === '#1f1f1f', M = (x, z, rot, sc) => { placeAt(_dum, x, z, rot); return new THREE.Matrix4().compose(_dum.position, _dum.quaternion, _s4.setScalar(sc)); };
  const poner = (kind, v, p, sc, grande, palX) => { PARTS[kind](palX || pal, v).forEach(g => out.push(g.applyMatrix4(M(p.x, p.z, p.rot, sc)))); PLANETA_PUNTOS.push({ x: p.x, z: p.z, kind, grande: !!grande }); };
  const GRANDE = { guaya: 1, helecho: 1, arbolLejano: 1, hongoGrande: 1 };
  PLANETA_PUNTOS = [];
  ZONAS.forEach(Z => {
    const n0 = Z.n0, t = osc ? Z.tonosOsc : Z.tonos;
    out.push(casqueteN(n0, Z.r, t[0])); if (Z.ri) out.push(casqueteN(n0, Z.ri, t[1], encimaDe(Z.r)));
    (Z.sub || []).forEach(([a, b]) => out.push(casqueteN(polar(a, b, _sp), .8, t[1], encimaDe(Z.r))));
    if (Z.laguna) out.push(casqueteN(n0, 1.0, t[1], encimaDe(Z.r)), casqueteN(n0, .75, AGUA(pal), encimaDe(1.0, encimaDe(Z.r)))); // orilla clara y agua
    if (Z.hito) { // el hito, con su propio tono si lo pide y, si lo pide, un parchecito bajo el tronco encima de los demás
      const H = Z.hito;
      if (H.cap) out.push(casqueteN(H.en ? polar(H.en[0], H.en[1], _sp) : n0, H.cap.r, osc ? H.cap.tonoOsc : H.cap.tono, encimaDe(Z.ri || 0, encimaDe(Z.r))));
      poner(H.kind, 0, { x: Z.hitoX, z: Z.hitoZ, rot: H.rot || 0 }, H.esc, true, H.pal && H.pal(pal, osc));
    }
    const ok = (x, z) => (!Z.hito || distEsf(x, z, Z.hitoX, Z.hitoZ) > Z.hito.R) && (!Z.laguna || distEsf(x, z, Z.cx, Z.cz) > .95) && Math.hypot(x, z) <= LEJOS_MAX;
    Z.racimos.forEach((G, j) => scatterEsf(Z.seed + j, G.n, n0, G.r1, ok, G.gap, G.r0)
      .forEach(p => poner(G.kind, G.v == null ? p.v : G.v, p, G.esc[0] + p.s * (G.esc[1] - G.esc[0]), GRANDE[G.kind], G.pal && G.pal(pal, osc))));
  });
  // El aire entre zonas: piedras y matas sueltas, de vez en cuando un árbol o un arbusto solo y unos parchecitos de tono
  // (para que desde el espacio el suelo pelado no parezca un planeta sin nada: lo que marca que es «aire» es la separación)
  scatterEsf(131, 18, _nrm, Math.PI * PLANET_R, fueraDeZonas, 1.5, 4.8).forEach(p => poner('piedra', 0, p, 1.2 + p.s * .6));
  scatterEsf(137, 40, _nrm, Math.PI * PLANET_R, fueraDeZonas, 1.5, 4.8).forEach(p => poner('tufts', 0, p, 1.2 + p.s * .4));
  scatterEsf(139, 10, _nrm, Math.PI * PLANET_R, fueraDeZonas, 2.6, 4.8).forEach(p => poner('arbolLejano', p.v, p, 1.0 + p.s * .3, true));
  scatterEsf(143, 14, _nrm, Math.PI * PLANET_R, fueraDeZonas, 2.2, 4.8).forEach(p => poner('arbusto', 0, p, 1.0 + p.s * .2));
  scatterEsf(149, 10, _nrm, Math.PI * PLANET_R, fueraDeZonas, 1.2, 4.8).forEach(p => out.push(casquete(p.x, p.z, .4 + p.s * .2, osc ? '#2f323a' : '#bfc5ce'))); // un tono más bajo que las reservas, que llevan dos anillos
  // Tres mini grupos (piedra, arbusto y mata) en la franja pelada, a 3,6–4,5 m del claro: el anillo sin nada no es perfecto
  const enFranja = (x, z) => { const d = Math.hypot(x, z); return d > 3.6 && d < 4.5 && ZONAS.every(Z => distEsf(x, z, Z.cx, Z.cz) > Z.r + .3); };
  scatterEsf(151, 3, _nrm, 4.4, enFranja, 2.5, 3.7).forEach((c, i) => {
    const piezas = ['piedra', 'arbusto', 'tufts'], esc = [1.3, 1.0, 1.3];
    scatterEsf(157 + i, 3, surf(c.x, c.z, new THREE.Vector3()), .4, enFranja, .25, .1).forEach((p, j) => poner(piezas[j], 0, p, esc[j]));
  });
  return PLANETA = out;
}
// Las zonas del planeta, para que Uku pueda nombrarlas («del otro lado está la laguna») y para las pruebas
export function zonas() { return ZONAS.map(Z => ({ id: Z.id, nombre: Z.nombre, x: Z.cx, z: Z.cz, r: Z.r })); }
/* ---------- Polvo de luz (motas blancas que flotan) ---------- */
let dust = null; const DUST_OP = .9; // opacidad del polvo (de pájaro, en el espacio, se apaga)
// El polvo de luz sí es suave: un punto difuso (lo único con brillo en el dibujo plano, junto al desenfoque de sueño)
function polvoTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.75)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  // un disco liso de borde nítido (vectorial), no un brillo difuso
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildDust() {
  const n = 170, pos = new Float32Array(n * 3), speed = new Float32Array(n), r = rng(53);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = .3 + r() * 2.6;
    pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = r() * 2.2; pos[i * 3 + 2] = Math.sin(a) * d * .8 + .2;
    speed[i] = .03 + r() * .07;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dust = new THREE.Points(g, new THREE.PointsMaterial({ map: polvoTexture(), size: .045, transparent: true, opacity: DUST_OP, depthWrite: false, color: palette().dust, fog: false }));
  dust.userData.speed = speed;
  scene.add(dust);
}

/* ---------- Pétalos de guayacán (puntos amarillos que caen despacio) ---------- */
let petals = null;
function buildPetals() {
  const n = 40, pos = new Float32Array(n * 3).fill(-9);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  petals = new THREE.Points(g, new THREE.PointsMaterial({ map: dotTexture(), size: .03, transparent: true, depthWrite: false, color: palette().flower }));
  petals.userData = { v: new Float32Array(n), life: new Float32Array(n) };
  petals.visible = false; scene.add(petals);
}
const _pu = new THREE.Vector3();
function updatePetals(dt, t) {
  const gs = forest ? forest.children.filter(o => o.userData.crown && o.userData.dir > 0 && o.userData.grow > .9) : [];
  petals.visible = gs.length > 0 && !focus;
  if (!petals.visible || RM) return;
  const a = petals.geometry.attributes.position, { v, life } = petals.userData;
  for (let i = 0; i < a.count; i++) {
    let x = a.getX(i), y = a.getY(i), z = a.getZ(i);
    life[i] -= dt;
    if (life[i] <= 0 || y < groundY(x, z)) {
      // nace en la copa de un guayacán, a una altura al azar para que no caigan todos juntos
      const o = gs[i % gs.length], k = o.scale.y, ang = Math.random() * 6.28, d = Math.random() * .32 * k;
      _pu.set(0, 1, 0).applyQuaternion(o.quaternion);
      x = o.position.x + _pu.x * .9 * k + Math.cos(ang) * d; y = o.position.y + _pu.y * (.75 + Math.random() * .25) * k; z = o.position.z + _pu.z * .9 * k + Math.sin(ang) * d;
      v[i] = .06 + Math.random() * .08; life[i] = 6 + Math.random() * 6;
    }
    a.setXYZ(i, x + Math.sin(t * 1.3 + i) * .05 * dt, y - v[i] * dt, z + Math.cos(t * 1.1 + i * 2) * .04 * dt);
  }
  a.needsUpdate = true;
}

/* ---------- Mariposas amarillas ----------
   Vuelan sin rumbo por el claro, se posan en flores y brotes (abren y cierran las alas despacio) y,
   si Uku está quieto, en su mano: él la mira y sonríe. */
let flies = [], fliesG = null, flyN = 2, wingM = null;
function wingGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, .006); s.bezierCurveTo(.012, .034, .044, .042, .046, .02); s.bezierCurveTo(.047, .006, .03, .001, .012, 0);
  s.bezierCurveTo(.032, -.008, .034, -.032, .017, -.034); s.bezierCurveTo(.006, -.033, .002, -.016, 0, -.008);
  return new THREE.ShapeGeometry(s, 6).rotateX(Math.PI / 2); // en el plano del suelo; el ala de adelante hacia +z
}
function buildFlies() {
  fliesG = new THREE.Group(); scene.add(fliesG);
  wingM = toon({ color: palette().flower, side: THREE.DoubleSide });
  const wg = wingGeo(), bm = toon({ color: '#3a3c43' }), bg = new THREE.CapsuleGeometry(.0035, .026, 2, 5).rotateX(Math.PI / 2), r = rng(7);
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(), wr = new THREE.Mesh(wg, wingM), wl = new THREE.Mesh(wg, wingM); wl.scale.x = -1;
    g.add(wr, wl, new THREE.Mesh(bg, bm)); g.scale.setScalar(.95 + (i % 3) * .15);
    const p = new THREE.Vector3((r() - .5) * 1.6, 0, -r() * 1.2); p.y = groundY(p.x, p.z) + .25 + r() * .4;
    flies.push({ g, wr, wl, p, v: new THREE.Vector3(), goal: p.clone(), st: 'fly', timer: r() * 3, ph: r() * 9, perch: null, yaw: r() * 6 });
    wr.rotation.z = .5; wl.rotation.z = -.5; g.position.copy(p); fliesG.add(g);
  }
}
const _fp = new THREE.Vector3(), _fv = new THREE.Vector3(), _fu = new THREE.Vector3();
// Uku ofrece la mano solo si está quieto, sin gesto y sin el paraguas
const handFree = () => !!(bear && bones.hand_R && !gesture && !moving && !focus); // el paraguas va en la izquierda
function perchPoint(f, out) {
  const P = f.perch; if (!P) return null;
  // sobre la pata derecha, del lado de la cámara (en metros, con los ejes de Uku)
  if (P === 'hand') { if (!handFree()) return null; bones.hand_R.getWorldPosition(out); return out.add(_fu.set(-.006, -.014, .034).applyQuaternion(bear.quaternion)); }
  if (!P.parent || P.userData.dir < 0) return null;
  _fu.set(0, 1, 0).applyQuaternion(P.quaternion);
  return out.copy(P.position).addScaledVector(_fu, P.userData.top * P.scale.y + .004);
}
function wander(f) {
  f.goal.set(pos.x + (Math.random() - .5) * 2, 0, pos.z - 1 + Math.random() * 1.5);
  f.goal.y = groundY(f.goal.x, f.goal.z) + .15 + Math.random() * .55; f.timer = 2 + Math.random() * 3;
}
function choose(f) {
  const r = Math.random();
  if (r < .22 && handFree() && !flies.some(x => x.perch === 'hand')) { f.st = 'land'; f.perch = 'hand'; return; }
  if (r < .62) {
    const c = forest.children.filter(o => o.userData.top && o.userData.dir > 0 && o.userData.grow >= 1 && !flies.some(x => x.perch === o));
    if (c.length) { f.st = 'land'; f.perch = c[Math.floor(Math.random() * c.length)]; return; }
  }
  f.st = 'fly'; f.perch = null; wander(f);
}
function updateFlies(dt, t) {
  flies.forEach((f, i) => {
    f.g.visible = i < flyN && !focus;
    if (!f.g.visible) { if (f.perch) { f.perch = null; f.st = 'fly'; } return; }
    if (RM) return;
    let a;
    if (f.st === 'perch') {
      const pp = perchPoint(f, _fp);
      if (!pp || (f.timer -= dt) < 0) { f.st = 'fly'; f.perch = null; f.v.set((Math.random() - .5) * .2, .25, (Math.random() - .5) * .2); wander(f); }
      else { f.p.lerp(pp, Math.min(1, dt * 14)); if (f.perch === 'hand') f.yaw = lerp(f.yaw, Math.atan2(camera.position.x - f.p.x, camera.position.z - f.p.z) + Math.PI / 2, Math.min(1, dt * 4)); } // de perfil a la cámara: se le ven las alas
      const o = .5 + .5 * Math.sin(t * 1.7 + f.ph); a = 1.4 - 1.1 * o * o; // posada: abre y cierra las alas despacio
    } else {
      if (f.st === 'land') {
        const pp = perchPoint(f, _fp);
        if (!pp) choose(f);
        else { f.goal.copy(pp); if (f.p.distanceTo(pp) < .02) { f.st = 'perch'; f.timer = f.perch === 'hand' ? 3 + Math.random() * 2 : 3 + Math.random() * 5; if (f.perch === 'hand') happyFor = 1.3; } }
      } else if ((f.timer -= dt) < 0 || f.p.distanceTo(f.goal) < .06) choose(f);
      // vuela hacia su destino con un zigzag que se calma al llegar
      _fv.subVectors(f.goal, f.p); const d = _fv.length(), sp = f.st === 'land' ? Math.min(.22, .04 + d * 1.6) : .2, wob = f.st === 'land' ? Math.min(1, d / .15) : 1;
      _fv.multiplyScalar(sp / Math.max(d, 1e-3));
      _fv.x += Math.sin(t * 3.1 + f.ph) * .09 * wob; _fv.y += Math.sin(t * 5.3 + f.ph * 2) * .07 * wob; _fv.z += Math.cos(t * 2.7 + f.ph) * .07 * wob;
      f.v.lerp(_fv, Math.min(1, dt * 3)); f.p.addScaledVector(f.v, dt);
      if (f.st !== 'land') f.p.y = Math.max(f.p.y, groundY(f.p.x, f.p.z) + .06);
      a = .15 + 1.25 * (.5 + .5 * Math.sin(t * 24 + f.ph));
      if (f.v.x * f.v.x + f.v.z * f.v.z > 1e-4) f.yaw = Math.atan2(f.v.x, f.v.z);
    }
    f.wr.rotation.z = a; f.wl.rotation.z = -a;
    f.g.position.copy(f.p); f.g.rotation.set(f.st === 'perch' ? 0 : -.2, f.yaw, 0, 'YXZ');
  });
}
// Las mariposas que Uku mira: la que se le posó en la mano o la más cercana a su cara
function flyOnHand() { const f = flies.find((x, i) => i < flyN && x.perch === 'hand' && x.st === 'perch'); return f ? f.p : null; }
function flyNear(head, max) {
  let best = null, bd = max;
  flies.forEach((f, i) => { if (i >= flyN || !f.g.visible) return; const d = f.p.distanceTo(head); if (d < bd) { bd = d; best = f.p; } });
  return best;
}

/* ---------- Uku: gestos, paseo, mirada y ojos ---------- */
// Gesto → [clip, velocidad, calma, duración en s, huesos fuera de la calma]: cada oso trae los suyos (rig.gest)
const NAMES = ['wave', 'happy', 'talk', 'nod', 'worried', 'plant', 'read'], ALIAS = { water: 'plant', hold: 'plant' };
let GEST = {}, IDLE = null, WALK = null, PLANT_AT = { hold: [1.6, 3.4], at: 3.4 };
// Conversando solo hace los gestos de pie: los que lo agachan (asentir, plantar) quedan para su mundo
const STANDING = { wave: 1, happy: 1, talk: 1 };
const BEAR_S = .58, WALK_V = .15; // Uku grande; pasea despacio (m/s)
let pos = { x: 0, z: 0 }, heading = 0, goal = null, idleFor = 3, acts = 0, speed = 0, turnTo = 0, moving = false, swayB = 0, giroV = 0, headingAntes = 0;
function clipFor() {
  if (gesture && GEST[gesture] && (!focus || STANDING[gesture])) return GEST[gesture];
  if (moving) return [WALK[0], WALK[1] * clamp(speed / WALK_V, .5, 1.1), WALK[2]];
  // Girando en el sitio da pasitos (la clip de caminar, corta y más lenta): no se desliza sobre los pies quietos
  if (giroV > .3) return [WALK[0], WALK[1] * clamp(.45 + giroV * .3, .45, 1), .5];
  return IDLE;
}
// Pasear: elige un punto del claro, gira hacia él, camina despacio y se queda un rato mirando
function brain(dt) {
  const free = ambient === 'walk' && !front && !focus && !RM;
  if (gesture || !free) { goal = null; ruta = []; }
  if (front || focus) turnTo = 0;
  let want = 0;
  if (manualRel && !gesture && !focus) {
    // Manejo en tercera persona: giro = a su derecha (heading baja) o a su izquierda; avance hacia donde mira (o de espaldas)
    heading -= manualRel.giro * dt * 2.1;
    want = manualRel.avance * WALK_V * 1.6;
    const sg = Math.sign(want) || 1, nx = pos.x + Math.sin(heading) * .06 * sg, nz = pos.z + Math.cos(heading) * .06 * sg;
    if (want && !okWalk(nx, nz) && okWalk(pos.x, pos.z)) want = 0;
    idleFor = 2.5;
  } else if (manual && !gesture && !focus) {
    const err = angDiff(Math.atan2(manual.x, manual.z), heading);
    heading += clamp(err, -dt * 4, dt * 4);
    want = Math.abs(err) < 1.2 ? WALK_V * 1.6 : 0;
    // Mira un paso adelante (no solo el tramo de este cuadro: la velocidad se suaviza y se colaba dentro de las cosas);
    // si ya quedó dentro de algo, se le deja salir por donde sea
    const nx = pos.x + Math.sin(heading) * .06, nz = pos.z + Math.cos(heading) * .06;
    if (!okWalk(nx, nz) && okWalk(pos.x, pos.z)) want = 0; // contra un borde o un objeto: se queda (sigue en la clip de caminar un instante)
    idleFor = 2.5;
  } else if (goal) {
    const dx = goal.x - pos.x, dz = goal.z - pos.z, d = Math.hypot(dx, dz), err = angDiff(Math.atan2(dx, dz), heading);
    heading += clamp(err, -dt * 1.5, dt * 1.5);
    want = Math.abs(err) < .25 ? WALK_V * Math.min(1, d / .15 + .3) : 0; // primero se orienta, luego camina (así sigue el tramo planeado)
    // Nunca atraviesa nada: si el paso siguiente está ocupado, se detiene y vuelve a planear el camino (tres intentos)
    if (want > 0 && !okWalk(pos.x + Math.sin(heading) * .06, pos.z + Math.cos(heading) * .06)) {
      want = 0; const dest = ruta.length ? ruta[ruta.length - 1] : goal;
      if (replanes++ < 3 && irA(dest.x, dest.z)) { /* nuevo camino */ } else { goal = null; ruta = []; idleFor = 1; }
    }
    if (d < .04 && ruta.length) { goal = ruta.shift(); }
    else if (d < .04) { goal = null; idleFor = 3.5 + Math.random() * 5; turnTo = mirando ? Math.atan2(mirando[0] - pos.x, mirando[1] - pos.z) : (Math.random() - .5) * .9; if (mirando && mirando.banca && Math.random() < .5) play('read'); else if (mirando && Math.random() < .5) { play(Math.random() < .5 ? 'nod' : 'happy'); } mirando = null; }
  } else {
    heading += clamp(angDiff(turnTo, heading), -dt * .8, dt * .8);
    if (free && !gesture && (idleFor -= dt) <= 0) next();
  }
  speed = lerp(speed, want, Math.min(1, dt * 3));
  moving = Math.abs(speed) > .03 || want !== 0;
  // Qué tan rápido gira (rad/s, suavizado): girando en el sitio, clipFor le da pasitos
  if (dt > 0) giroV = lerp(giroV, Math.abs(angDiff(heading, headingAntes)) / dt, Math.min(1, dt * 6)); headingAntes = heading;
  pos.x += Math.sin(heading) * speed * dt; pos.z += Math.cos(heading) * speed * dt;
}
/* Por dónde puede andar Uku: todo el claro a la vista, sin pisar los canteros, el lago ni lo que tiene puesto
   (casa, guayacanes, letrero, farol, banca…). Con escenario el claro es más grande. */
let ESC_TREES = null;
function okWalk(x, z) {
  const R = esc ? 1.8 : .75, zmin = esc ? -1.4 : -.5, zmax = esc ? .72 : .1;
  if (Math.hypot(x, z * .8) > R || z < zmin || z > zmax) return false;
  // Los senderos son corredores siempre libres (lo que hay puesto queda a los lados)
  if (esc && distSendero(x, z) < ANCHO_SENDERO / 2 + .04) return true;
  if (chocaPuesto(x, z)) return false; // lo que Fran decoró y los brotes que plantó también estorban
  if (esc) { if (!ESC_TREES) ESC_TREES = escTrees(); if (!ESC_TREES.every(t => Math.hypot(x - t.x, z - t.z) > .22)) return false; }
  if (!ZONA.canteros.every(([bx, bz]) => Math.hypot(x - bx, z - bz) > BED_R + .08)) return false;
  // Solo lo que está puesto de verdad: la casa y los guayacanes (tronco fino)
  const f = enClaro(), nc = Math.min(f.props.length, ZONA.hogar.length), ng = f.guayas || 1;
  for (let i = 0; i < nc; i++) if (Math.hypot(x - ZONA.hogar[i][0], z - ZONA.hogar[i][1]) <= .38) return false;
  for (let i = 0; i < ng && i < ZONA.guayacanes.length; i++) if (Math.hypot(x - ZONA.guayacanes[i][0], z - ZONA.guayacanes[i][1]) <= (esc ? .28 : .38)) return false;
  if (esc) {
    if (Math.hypot(x - LAGO_P[0], z - LAGO_P[1]) < lagoEnForma() + .12) return false;
    const RADIO = { cascada: .42, puente: .3, arroyo: .3, farol: .18, banca: .3, cerca: .3, huerto: .3, cartel: .32, lena: .18, tortuga: .18, hongos: .16, buzon: .14, bandera: .1, poste: .14 };
    for (const k in ESC_ZONA) { const v = ESC_ZONA[k]; if (!Array.isArray(v[0]) && Math.hypot(x - v[0], z - v[1]) < (RADIO[k] || .22)) return false; }
    if (!(ESC_ZONA.hojonas || []).every(([hx, hz]) => Math.hypot(x - hx, z - hz) > .16)) return false;
    if (!(ESC_ZONA.farolitos || []).every(([hx, hz]) => Math.hypot(x - hx, z - hz) > .1)) return false;
    if (!ESC_ZONA.guayas.every(([gx, gz]) => Math.hypot(x - gx, z - gz) > .32)) return false;
  }
  return true;
}
/* Lo puesto a mano (decorar) y los brotes plantados no se pisan: cada cosa con su radio (la banca y el guayacán, grandes).
   decoClaro es la decoración que cae dentro del claro (la del resto del planeta no está en su camino). */
const RADIO_DECO = { banca: .3, guaya: .32, arbusto: .18, farolito: .14 };
const radioDeco = k => RADIO_DECO[k] || .12;
let decoClaro = [], holgura = 0; // holgura: al planear se rodea con un margen, así el paso siguiente no roza lo puesto
function chocaPuesto(x, z) {
  for (let i = 0; i < decoClaro.length; i++) { const d = decoClaro[i]; if (Math.hypot(x - d.x, z - d.z) < radioDeco(d.k) + holgura) return true; }
  for (let i = 0; i < planted.length; i++) if (Math.hypot(x - planted[i].x, z - planted[i].z) < .1 + holgura) return true;
  return false;
}
// Cambió lo puesto: las celdas del planificador se rehacen, si Uku iba a algún lado vuelve a planear el camino, y si
// algo le quedó encima se corre
function puestoCambio() {
  decoClaro = decoracion.filter(d => dentroDelClaro(d.x, d.z)); celdas = null;
  if (goal) { const dest = ruta.length ? ruta[ruta.length - 1] : goal; if (!irA(dest.x, dest.z)) { goal = null; ruta = []; idleFor = 1; } }
  despejarUku();
}
// Si algo quedó encima de Uku (decoración guardada de otra visita, o recién puesta), se corre al punto libre más cercano
function despejarUku() {
  if (!bear || leyendo || gesture === 'read' || okWalk(pos.x, pos.z)) return;
  const p = puntoLibreCerca(pos.x, pos.z); if (p) { pos.x = p.x; pos.z = p.z; goal = null; ruta = []; }
}
function puntoLibreCerca(x, z) {
  for (let r = .1; r <= 1.5; r += .1) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + r, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r; if (okWalk(px, pz)) return { x: px, z: pz }; }
  return null;
}
/* Lugares que Uku visita cuando pasea con escenario: se acerca, se queda un rato mirándolos y sigue.
   Cada uno: dónde está lo que mira y desde qué lado se le acerca (hacia el centro del claro). */
function sitios() {
  if (!esc) return [];
  const E = ESC_ZONA, L = [];
  const add = (nombre, [x, z], d, ang) => { // punto de llegada a d metros del objeto: por el lado del claro (o ang) y, si está ocupado, girando alrededor
    const a0 = ang == null ? Math.atan2(-x, -z) : ang;
    for (const dd of [0, .12, .3, .5]) for (const da of [0, .5, -.5, 1, -1, 1.6, -1.6, 2.3, -2.3, Math.PI]) { // si está rodeado (la cascada tras el lago), lo mira desde más lejos
      const a = a0 + da, px = x + Math.sin(a) * (d + dd), pz = z + Math.cos(a) * (d + dd);
      if (okWalk(px, pz)) { L.push({ nombre, x: px, z: pz, mira: [x, z] }); return; }
    }
  };
  add('lago', LAGO_P, lagoEnForma() + .22); add('lago2', LAGO_P, lagoEnForma() + .24, Math.PI * .95); add('lago3', LAGO_P, lagoEnForma() + .24, Math.PI * .62);
  add('banca', E.banca, .42); if (L.length && L[L.length - 1].nombre === 'banca') L[L.length - 1].mira.banca = true; add('farol', E.farol, .3); add('cartel', E.cartel, .45);
  add('cascada', E.cascada, .55); add('puente', E.puente, .4); add('buzon', E.buzon, .28); add('lena', E.lena, .32); add('tortuga', E.tortuga, .3);
  const fs = enClaro();
  if (fs.props.length && ZONA.hogar[0]) add('casa', ZONA.hogar[0], .55); // la puerta de su casa
  // Los finales de los senderos (el letrero del bosque, la plazuela) también son lugares de paseo
  L.push({ nombre: 'letrero', x: DESTINOS.letrero[0], z: DESTINOS.letrero[1], mira: ESC_ZONA.cartel }, { nombre: 'plaza', x: PLAZA[0], z: PLAZA[1], mira: [0, 2] });
  (E.guayas || []).forEach((g, i) => add('guaya' + i, g, .42));
  ZONA.guayacanes.slice(0, Math.min(2, fs.guayas || 1)).forEach((g, i) => add('inv' + i, g, .45));
  ZONA.canteros.forEach((b, i) => add('cantero' + i, b, BED_R + .22));
  return L;
}
/* Por dónde ir: el tramo recto si está libre; si no, un camino por una rejilla del claro (10 cm, búsqueda en anchura)
   que luego se estira (de cada punto, al más lejano al que se llega recto). Así Uku rodea el lago, la casa o la
   banca en vez de atravesarlos. Las celdas se calculan una vez por escenario. */
let ruta = [], celdas = null, replanes = 0;
const PASO = .05;
function tramoLibre(x0, z0, x1, z1) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / .05));
  for (let i = 1; i <= n; i++) { const t = i / n; if (!okWalk(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false; }
  return true;
}
function rejilla() {
  if (celdas) return celdas;
  const R = esc ? 1.9 : .8, zmin = esc ? -1.5 : -.55, zmax = esc ? .8 : .15, W = Math.round(2 * R / PASO) + 1, H = Math.round((zmax - zmin) / PASO) + 1;
  const ok = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) ok[j * W + i] = okWalk(-R + i * PASO, zmin + j * PASO) ? 1 : 0;
  return celdas = { R, zmin, W, H, ok, cx: (x) => Math.max(0, Math.min(W - 1, Math.round((x + R) / PASO))), cz: (z) => Math.max(0, Math.min(H - 1, Math.round((z - zmin) / PASO))) };
}
function planear(x, z) { holgura = .05; try { return planear0(x, z); } finally { holgura = 0; } }
function planear0(x, z) {
  if (tramoLibre(pos.x, pos.z, x, z)) return [{ x, z }];
  const g = rejilla(), s0 = g.cz(pos.z) * g.W + g.cx(pos.x), s1 = g.cz(z) * g.W + g.cx(x), i0 = s0 % g.W, j0 = (s0 - i0) / g.W;
  const salida = (i, j) => Math.abs(i - i0) <= 2 && Math.abs(j - j0) <= 2; // si quedó pegado a algo (dentro de su margen), puede salir
  const prev = new Int32Array(g.W * g.H).fill(-1); prev[s0] = s0;
  const cola = [s0]; let hallado = s1 === s0;
  for (let q = 0; q < cola.length && !hallado; q++) {
    const c = cola[q], ci = c % g.W, cj = (c - ci) / g.W;
    for (let dj = -1; dj <= 1 && !hallado; dj++) for (let di = -1; di <= 1; di++) {
      const i = ci + di, j = cj + dj; if ((!di && !dj) || i < 0 || j < 0 || i >= g.W || j >= g.H) continue;
      const n = j * g.W + i; if (prev[n] !== -1 || !(g.ok[n] || n === s1 || salida(i, j))) continue;
      if (di && dj && !salida(i, j) && !(g.ok[cj * g.W + i] && g.ok[j * g.W + ci])) continue; // no corta esquinas
      prev[n] = c; cola.push(n); if (n === s1) { hallado = true; break; }
    }
  }
  if (!hallado) return null;
  const pts = []; for (let c = s1; c !== s0; c = prev[c]) pts.push({ x: -g.R + (c % g.W) * PASO, z: g.zmin + Math.floor(c / g.W) * PASO });
  pts.reverse(); pts[pts.length - 1] = { x, z };
  // Estirar: de donde está, al punto más lejano del camino al que llega recto, y así
  const r = []; let cx = pos.x, cz = pos.z, k = 0;
  while (k < pts.length) {
    let m = k; for (let t = pts.length - 1; t > k; t--) if (tramoLibre(cx, cz, pts[t].x, pts[t].z)) { m = t; break; }
    r.push(pts[m]); cx = pts[m].x; cz = pts[m].z; k = m + 1;
  }
  return r;
}
function irA(x, z) { const r = planear(x, z); if (!r) return false; goal = r.shift(); ruta = r; return true; }
function irANuevo(x, z) { replanes = 0; return irA(x, z); }
let ultimoLugar = -1, mirando = null;
function next() {
  acts++;
  if ((claro.brotes || claro.flores || (bloom || 0) > 0) && acts % 3 === 0) { play('plant'); idleFor = 2.5; return; }
  mirando = null;
  // Con escenario, dos de cada tres veces va a un lugar concreto (nunca el mismo seguido); si no, a un punto cualquiera
  const Ls = sitios();
  if (Ls.length && acts % 3 !== 1) {
    const lejos = Ls.map((l, i) => [i, Math.hypot(l.x - pos.x, l.z - pos.z)]).filter(([i, d]) => i !== ultimoLugar && d > .35);
    if (lejos.length) {
      lejos.sort((a, b) => a[1] - b[1]);
      const cerca = lejos.slice(0, 5); // de los cinco más cercanos, uno al que se pueda llegar
      while (cerca.length) {
        const [i] = cerca.splice(Math.floor(Math.random() * cerca.length), 1)[0], l = Ls[i];
        if (irANuevo(l.x, l.z)) { ultimoLugar = i; mirando = l.mira; return; }
      }
    }
  }
  const R = esc ? 1.7 : .6;
  for (let i = 0; i < 60; i++) {
    const x = (Math.random() - .5) * 2 * R, z = (esc ? -1.35 : -.45) + Math.random() * (esc ? 2.0 : .55);
    if (okWalk(x, z) && Math.hypot(x - pos.x, z - pos.z) > .3 && Math.hypot(x - pos.x, z - pos.z) < 1.5 && irANuevo(x, z)) return;
  }
  idleFor = 2;
}
// Manejo a mano (flechas del teclado): dir = { x, z } hacia dónde ir (en el mundo), o null para soltar
let manual = null, manualAt = -1e9, manualRel = null;
export function manejar(dir) { manual = dir && (dir.x || dir.z) ? { x: dir.x, z: dir.z } : null; if (manual) { manualRel = null; manualAt = performance.now(); goal = null; ruta = []; } }
// Manejo relativo a Uku (modo control, tercera persona): { avance: -1…1 (adelante/atrás), giro: -1…1 (izquierda/derecha) }
export function manejarRelativo(c) { manualRel = c && (c.avance || c.giro) ? { avance: clamp(+c.avance || 0, -1, 1), giro: clamp(+c.giro || 0, -1, 1) } : null; if (manualRel) { manual = null; manualAt = performance.now(); goal = null; ruta = []; } }
export function manejando() { return !!manual || !!manualRel; }
export function rumbo() { return heading; }
export function sitiosDePaseo() { return sitios().map(l => l.nombre); }
// Para probar: deja a Uku en un punto del claro (si se puede pisar) mirando hacia `rumbo`
export function caminarA(x, z) { return irANuevo(x, z); }
export function planDe(x, z) { return planear(x, z); }
export function dondeEsta() { return { x: pos.x, z: pos.z, libre: okWalk(pos.x, pos.z), andando: !!goal, ruta: ruta.length, front, gesture, ambient, focus: !!focus, replanes }; }
// La puerta de su casa (adónde vuelve cuando lo guían) y a cuánto está de un punto
export function casa() { const l = sitios().find(s => s.nombre === 'casa'); return l ? { x: l.x, z: l.z } : { x: ZONA.hogar[0][0], z: ZONA.hogar[0][1] + .55 }; }
export function distanciaA(x, z) { return Math.hypot(pos.x - x, pos.z - z); }
export function colocarEn(nombre) { const l = sitios().find(s => s.nombre === nombre); if (!l) return false; pos.x = l.x; pos.z = l.z; goal = null; heading = Math.atan2(l.mira[0] - l.x, l.mira[1] - l.z); return true; }
export function colocar(x, z, rumbo) { if (!okWalk(x, z)) return false; pos.x = x; pos.z = z; goal = null; ruta = []; if (rumbo != null) heading = rumbo; return true; }
/* Leer en la banca: Uku se sienta (pose del rig), abre el periódico y cada tanto pasa la página; al terminar se
   levanta y sigue paseando. Empieza cuando llega paseando a la banca (la mitad de las veces) o con play('read'). */
let leyendo = false, pagina = 0;
function readStep(dt) {
  if (!leyendo) {
    leyendo = true; pagina = 0;
    if (esc) { const b = ESC_ZONA.banca, r = .9; pos.x = b[0] - Math.sin(r) * .02; pos.z = b[1] - Math.cos(r) * .02; heading = r; goal = null; } // en el asiento, mirando al frente de la banca
    rig.sentarse(true, .2); holdObject('periodico');
  }
  if (held && held.userData.pecho) {
    const f = Math.floor(gestureT / 3.5); if (f !== pagina) { pagina = f; held.userData.pasa = .5; }
    if (held.userData.pasa > 0) held.userData.pasa -= dt;
    // Punto del mundo: delante del pecho, a la altura de las manos; inclinado hacia la cara (y un vaivén al pasar la página)
    const chest = held.parent; chest.updateWorldMatrix(true, false);
    chest.getWorldPosition(_rp); _rf.set(Math.sin(heading), 0, Math.cos(heading));
    _rp.addScaledVector(_rf, .13 * bear.scale.x / BEAR_S).y += .02;
    held.position.copy(chest.worldToLocal(_rp));
    _rq.setFromAxisAngle(_ry, heading).multiply(_rq2.setFromEuler(_re.set(-.55 + (held.userData.pasa > 0 ? Math.sin(held.userData.pasa * 6.3) * .3 : 0), 0, 0)));
    chest.getWorldQuaternion(_rq3); held.quaternion.copy(_rq3.invert().multiply(_rq));
  }
}
const _rp = new THREE.Vector3(), _rf = new THREE.Vector3(), _ry = new THREE.Vector3(0, 1, 0), _rq = new THREE.Quaternion(), _rq2 = new THREE.Quaternion(), _rq3 = new THREE.Quaternion(), _re = new THREE.Euler();
function readEnd() { if (!leyendo) return; leyendo = false; rig.sentarse(false); holdObject(null); idleFor = 1.5; }
// Plantar: toma un brote de su lado, se agacha y lo deja en la tierra frente a él; el brote crece despacio
let plantedNow = false;
function plantStep() {
  if (gestureT > PLANT_AT.hold[0] && gestureT < PLANT_AT.hold[1] && !held) holdObject('sprout');
  if (gestureT >= PLANT_AT.at && !plantedNow) {
    plantedNow = true; holdObject(null);
    planted.push({ key: 'X' + plantN++, x: pos.x + Math.sin(heading) * .17, z: pos.z + Math.cos(heading) * .17, rot: Math.random() * 6.28 });
    if (planted.length > 6) planted.shift();
    celdas = null; buildForest(); // el brote nuevo (y el que se fue) cambian por dónde puede andar
  }
}
// Mirada: la cabeza (y un poco el cuello) siguen a una mariposa cercana, a algo del paisaje un rato o a ti
let glance = null, glanceT = 3, glanceFor = 0, lookY = 0, lookP = 0;
const _hp = new THREE.Vector3(), _lp = new THREE.Vector3(), _gl = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _au = new THREE.Vector3(), _ar = new THREE.Vector3();
function lookAround(dt) {
  if (!bones.head || !bones.neck) return;
  bones.head.getWorldPosition(_hp);
  let w = RM || moving || (gesture && !STANDING[gesture]) ? 0 : gesture === 'wave' ? .4 : 1, tgt = null;
  if (w) {
    tgt = flyOnHand();
    if (!tgt) {
      if (glance && (glanceFor -= dt) < 0) glance = null;
      if (!glance && (glanceT -= dt) < 0) {
        // de vez en cuando mira algo: una mariposa que pasa (la sigue un rato) o un punto del paisaje
        glanceT = 3 + Math.random() * 4; const r = Math.random(), fly = r < .4 && flyNear(_hp, 1.3);
        if (fly) { glance = fly; glanceFor = 1.5 + Math.random(); }
        else if (r < .75) { const s = Math.random() < .5 ? -1 : 1; glance = _gl.set(pos.x + s * (.7 + Math.random() * .6), .35 + Math.random() * .4, pos.z - .4 + Math.random() * .9); glanceFor = 1.2 + Math.random() * 1.4; }
      }
      tgt = glance || camera.position; if (!glance) w *= .6; // a ti te mira a medias: la clip ya mira al frente
    }
  }
  let y = 0, p = 0;
  if (tgt) {
    _lp.copy(tgt); bear.worldToLocal(_lp); _hp.copy(bear.worldToLocal(_hp)); _lp.sub(_hp);
    y = clamp(Math.atan2(_lp.x, _lp.z), -.5, .5); p = clamp(Math.atan2(_lp.y, Math.hypot(_lp.x, _lp.z)), -.22, .2); // giros suaves: nunca baja ni tuerce mucho la cabeza
  }
  lookY = lerp(lookY, y * w, Math.min(1, dt * 2.2)); lookP = lerp(lookP, p * w, Math.min(1, dt * 2.2));
  if (Math.abs(lookY) + Math.abs(lookP) < 1e-3) return;
  _au.set(0, 1, 0).applyQuaternion(bear.quaternion); _ar.set(1, 0, 0).applyQuaternion(bear.quaternion);
  [[bones.neck, .35], [bones.head, .65]].forEach(([b, k]) => {
    // giro en el mundo (alrededor del eje vertical y del lateral de Uku) llevado al espacio del hueso
    b.parent.getWorldQuaternion(_qp);
    _qa.setFromAxisAngle(_au, lookY * k).multiply(_qb.setFromAxisAngle(_ar, -lookP * k));
    b.quaternion.premultiply(_qa.premultiply(_qp.clone().invert()).multiply(_qp));
    b.updateMatrixWorld(true);
  });
}
/* Ojos y boca: piezas de la cara (rig.face). Pestañea cada pocos segundos (a veces dos seguidas), pone ojos
   contentos ^ ^ al alegrarse o cuando una mariposa se le posa, y mueve la boca al hablar. */
let eyeKind = 'open', blinkT = 2.5, happyFor = 0, mouthCur = 0, mouthRed = 0, bocaFn = null;
// Quién mueve la boca mientras habla (voz.js › boca): () => { a: 0–1 abierta, r: 0–1 redonda } o null si está callado
export function setBoca(fn) { bocaFn = typeof fn === 'function' ? fn : null; }
function eyes(dt, t) {
  if (!rig || !rig.face) return;
  let k = 'open';
  if (gesture === 'happy' && gestureT > .25 && gestureT < 1.9) happyFor = Math.max(happyFor, .05);
  if (happyFor > 0) { happyFor -= dt; k = 'happy'; blinkT = Math.max(blinkT, .8); }
  else if (!RM && (blinkT -= dt) < 0) {
    // un pestañeo: entrecerrado, cerrado, entrecerrado (~0,2 s)
    const s = -blinkT; k = s < .05 ? 'half' : s < .15 ? 'shut' : s < .21 ? 'half' : 'open';
    if (s >= .21) blinkT = Math.random() < .18 ? .2 : 2.2 + Math.random() * 3.8;
  }
  if (espejo.on && espejo.cara) { const c = espejo.cara; k = c.blink > .5 ? 'shut' : c.blink > .3 ? 'half' : c.smile > .45 ? 'happy' : 'open'; } // en espejo, los ojos son los tuyos
  if (k !== eyeKind) { eyeKind = k; rig.face.eyes(k); }
  // Boca: mientras suena la voz, sigue sus sílabas (voz.js › boca: cuánto abre y si la vocal es redonda); sin voz, al
  // hablar se abre y cierra como sílabas; contento, sonríe con la boca abierta
  const v = bocaFn && !RM ? bocaFn() : null;
  const talking = gesture === 'talk' && gestureT < 2;
  const m = v ? v.a : RM ? 0 : talking ? Math.max(0, Math.sin(t * 13) * .6 + Math.sin(t * 7.3) * .4) * .8 : gesture === 'happy' && gestureT < 2 ? .55 : 0;
  mouthCur = lerp(mouthCur, m, Math.min(1, dt * 22));
  mouthRed = lerp(mouthRed, v ? v.r : 0, Math.min(1, dt * 16));
  rig.face.mouth(mouthCur, mouthRed);
}

function holdObject(kind) {
  if (held) { held.parent && held.parent.remove(held); held = null; }
  if (!kind || !bones.hand_R || (umb && kind === 'periodico' && umbEstado !== 'guardado')) return; // el paraguas va en la izquierda: la derecha queda libre (menos para el periódico, que pide las dos)
  if (kind === 'coin') {
    held = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .014, 28), toon({ color: '#ffd200' }));
    // sobre la palma: en reposo la palma mira a (0, -0.89, 0.45) en el espacio del hueso
    held.rotation.x = -.46; held.position.set(-.03, -.052, .026);
  } else if (kind === 'leaf') {
    held = new THREE.Mesh(new THREE.ConeGeometry(.035, .1, 4), toon({ color: palette().pine[0], flatShading: true }));
    held.position.set(-.03, -.06, .03); held.rotation.set(-.46 + Math.PI, 0, -.4); // el tallo sale de la palma
  } else if (kind === 'periodico') {
    // Un periódico abierto (dos hojas con cabecera y columnas). Cuelga del pecho y readStep lo pone cada cuadro
    // delante de Uku, entre las manos, inclinado hacia su cara
    held = new THREE.Group();
    const m = toon({ map: periodicoTextura(), side: THREE.DoubleSide });
    held.add(new THREE.Mesh(new THREE.PlaneGeometry(.3, .21), m));
    held.userData.pasa = 0; held.userData.pecho = true;
    const chest = rig.B('mixamorig:Spine2') || bones.hand_R;
    held.scale.setScalar(1 / chest.getWorldScale(_fu).x); chest.add(held); return;
  } else if (kind === 'sprout') {
    // el esqueleto está en centímetros: se escala para que el brote mida lo mismo que en la tierra
    held = new THREE.Mesh(geo('brote1', () => PARTS.brote(palette(), 1)), LAMB);
    const f = bones.hand_R.children[0]; held.scale.setScalar(1.1 / bones.hand_R.getWorldScale(_fu).x);
    if (f) held.position.copy(f.position); // entre los dedos, listo para plantar
  }
  held && bones.hand_R.add(held);
}

let _periodico = null;
function periodicoTextura() {
  if (_periodico) return _periodico;
  const c = document.createElement('canvas'); c.width = 512; c.height = 360; const g = c.getContext('2d');
  g.fillStyle = '#f6f2e8'; g.fillRect(0, 0, 512, 360);
  g.fillStyle = '#2b3146'; g.font = '700 44px "Nunito", "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillText('EL CLARO', 256, 50);
  g.fillStyle = '#9ea4b2'; g.fillRect(24, 62, 464, 3);
  g.fillStyle = '#c3c7d1';
  for (let col = 0; col < 4; col++) for (let i = 0; i < 18; i++) { const w = 92 - (i * 37 % 31); g.fillRect(28 + col * 118 + (col >= 2 ? 10 : 0), 82 + i * 15, w, 6); }
  g.fillStyle = '#e4e7ee'; g.fillRect(148, 82, 110, 72); g.fillStyle = '#ffd200'; g.beginPath(); g.arc(203, 118, 22, 0, 6.3); g.fill(); // una foto con sol
  g.fillStyle = '#9ea4b2'; g.fillRect(254, 70, 2, 280); // el pliegue del centro
  _periodico = new THREE.CanvasTexture(c); _periodico.colorSpace = THREE.SRGBColorSpace; return _periodico;
}

/* ---------- Ropa según el clima ----------
   Los accesorios cuelgan del hueso de la cabeza (en reposo está en
   (0, 0.64, 0) sin rotación; la cabeza llega hasta y .97, las orejas a .99,
   los ojos están en y .795 y el hocico llega a z .23), así siguen cada gesto. */
let acc = null, ropaCols = null, rain = null;
function mat(color, extra) { return toon(Object.assign({ color }, extra || {})); }
// La cabeza medida en el espacio de su hueso (al cargar, en reposo): medio ancho W, la coronilla y la punta del
// hocico. Los accesorios se ubican y se escalan con eso, así le quedan bien a cualquiera de los dos osos.
let HEAD = { W: .228, top: .358, front: .233 };
function measureHead() {
  if (!bones.head || !rig) return;
  bear.updateMatrixWorld(true);
  const v = new THREE.Vector3(), hw = bones.head.getWorldPosition(new THREE.Vector3()), b = { x0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  rig.skinned.forEach(m => {
    const p = m.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / 4000));
    for (let i = 0; i < p.count; i += step) {
      m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld); if (v.y < hw.y) continue;
      bones.head.worldToLocal(v); b.x0 = Math.min(b.x0, v.x); b.x1 = Math.max(b.x1, v.x); b.y1 = Math.max(b.y1, v.y); b.z1 = Math.max(b.z1, v.z);
    }
  });
  if (isFinite(b.x0)) HEAD = { W: (b.x1 - b.x0) / 2, top: b.y1, front: b.z1 };
}
function hatPaja() {
  const g = new THREE.Group(), straw = mat('#e9dcb2'), band = mat('#2f2f2f');
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(.2, .21, .01, 32), straw);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(.092, .108, .095, 24), straw); crown.position.y = .05;
  const top = new THREE.Mesh(new THREE.SphereGeometry(.092, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), straw); top.position.y = .097; top.scale.y = .25;
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(.109, .111, .024, 24), band); ribbon.position.y = .017;
  g.add(brim, crown, top, ribbon);
  const W = HEAD.W; g.scale.setScalar(6.4 * W); g.position.set(0, HEAD.top - .06 * W, -.07 * W); g.rotation.set(-.12, 0, .06);
  return g;
}
function hatLana() {
  const g = new THREE.Group(), wool = mat('#2c4f9e'), cuff = mat('#efe9df'); // azul con blanco
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.125, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), wool); cap.scale.y = .95;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(.128, .13, .04, 24), cuff); rim.position.y = .01;
  const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(.038, 1), cuff); pom.position.y = .125;
  g.add(cap, rim, pom);
  const { W, top } = HEAD; g.scale.setScalar(7.7 * W); g.position.set(0, top - .62 * W, -.09 * W); g.rotation.x = -.1;
  return g;
}
/* Paraguas en la mano izquierda (la derecha saluda): el brazo izquierdo lo sostiene con el codo doblado (rig.sostener) y
   el paraguas es rígido: largo fijo, medido una vez con el brazo ya en su pose; cada cuadro se apoya en la pata y apunta
   a un punto sobre la cabeza, así cubre a Uku aunque camine. La tela queda horizontal. */
let umb = null;
function umbrella() {
  const g = new THREE.Group(), canopy = new THREE.Group(), cloth = mat('#1b2a4e', { side: THREE.DoubleSide }), stripe = mat('#ffd200', { side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) canopy.add(new THREE.Mesh(new THREE.ConeGeometry(.29, .11, 2, 1, true, i / 8 * Math.PI * 2, Math.PI / 4), i % 2 ? stripe : cloth));
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .06, 5), mat('#2f2f2f')); tip.position.y = .08; canopy.add(tip);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.007, .007, 1, 5), mat('#2f2f2f'));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.03, .008, 6, 12, Math.PI), mat('#2f2f2f')); handle.rotation.z = Math.PI; handle.position.set(-.03, -.02, 0);
  g.add(canopy, pole, handle);
  g.userData = { canopy, pole, L: 0 };
  return g;
}
const _h = new THREE.Vector3(), _t = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _bu = new THREE.Vector3();
function placeUmbrella() {
  const mano = bones.hand_L || bones.hand_R;
  if (!umb || !mano || !bones.head) return;
  mano.getWorldPosition(_h); if (mano.children[0]) _h.lerp(mano.children[0].getWorldPosition(_t), .6); // centro de la pata
  _bu.set(0, 1, 0).applyQuaternion(bear.quaternion); // el «arriba» de Uku (la normal del planeta)
  (bones.headTop || bones.head).getWorldPosition(_t); _t.addScaledVector(_bu, .06 * bear.scale.x / BEAR_S).lerp(_h, .12); // sobre la coronilla, apenas hacia la pata
  _d.subVectors(_t, _h); const dist = _d.length(); _d.normalize();
  const u = umb.userData;
  // Largo fijo: se mide cuando el brazo ya está en su pose (y si Uku cambia de tamaño); después no se estira nunca
  const k = rig && rig.pose ? rig.pose.hold : 1;
  if (!u.L || (k > .95 && !u.medido) || Math.abs((u.esc || 0) - bear.scale.x) > .002) { u.L = dist; u.esc = bear.scale.x; u.medido = k > .95; }
  umb.position.copy(_h); umb.quaternion.setFromUnitVectors(_up, _d);
  u.pole.scale.y = u.L; u.pole.position.y = u.L / 2; u.canopy.position.y = u.L;
  u.canopy.quaternion.setFromUnitVectors(_d, _up); // la tela queda horizontal aunque el mango vaya inclinado
}
/* Manos ocupadas: leer y plantar piden las dos manos. Con el paraguas abierto, Uku primero lo cierra (.5 s: la tela se
   pliega sobre el palo), lo cuelga cruzado en la espalda y baja el brazo; ahí empieza la acción. Al terminar (sin gesto
   ni lectura) lo vuelve a tomar con la izquierda, sube el brazo y lo abre. umbT: 0 abierto … 1 cerrado. */
const MANOS = { read: 1, plant: 1 };
let umbEstado = 'abierto', umbT = 0, pendiente = null;
const _ub = new THREE.Vector3(), _uf = new THREE.Vector3(), _ur = new THREE.Vector3(), _uq = new THREE.Quaternion(), _uI = new THREE.Quaternion();
function pasoParaguas(dt) {
  if (!umb) { umbEstado = 'abierto'; umbT = 0; pendiente = null; return; }
  const u = umb.userData;
  if (umbEstado === 'cerrando') {
    umbT = Math.min(1, umbT + dt / .5);
    if (umbT >= 1) { umbEstado = 'guardado'; const p = pendiente; pendiente = null; if (p) play(p.name, p.opts); }
  } else if (umbEstado === 'guardado') {
    if (!pendiente && !gesture && !leyendo) umbEstado = 'abriendo';
  } else if (umbEstado === 'abriendo') {
    // primero sube el brazo con el paraguas cerrado; con el brazo arriba, lo abre
    if (!rig.pose || rig.pose.hold > .8) umbT = Math.max(0, umbT - dt / .5);
    if (umbT <= 0) umbEstado = 'abierto';
  }
  if (pendiente || gesture || leyendo) idleFor = Math.max(idleFor, 1); // mientras cambia de manos no se va a pasear
  const enMano = umbEstado === 'abierto' || umbEstado === 'cerrando' || umbEstado === 'abriendo';
  if (rig.sostener) rig.sostener(umbEstado !== 'guardado');
  // la tela: abierta, horizontal; cerrada, plegada a lo largo del palo
  const c = umbT * umbT * (3 - 2 * umbT);
  u.canopy.scale.set(1 - .86 * c, 1 + .9 * c, 1 - .86 * c);
  if (enMano) {
    placeUmbrella();
    _uq.copy(u.canopy.quaternion); u.canopy.quaternion.copy(_uq.slerp(_uI, c)); // al cerrarse se alinea con el palo
  } else {
    // en la espalda: cruzado, del lado izquierdo de la cadera al hombro derecho, sin tocar el cuerpo
    const chest = bones.chest || bones.neck; if (!chest) return;
    const s = bear.scale.x / BEAR_S;
    _ub.set(0, 1, 0).applyQuaternion(bear.quaternion); _uf.set(0, 0, 1).applyQuaternion(bear.quaternion); _ur.set(1, 0, 0).applyQuaternion(bear.quaternion);
    chest.getWorldPosition(_h); _h.addScaledVector(_uf, -.11 * s).addScaledVector(_ur, .07 * s).addScaledVector(_ub, -.13 * s);
    _d.copy(_ub).addScaledVector(_ur, -.55).normalize();
    umb.position.copy(_h); umb.quaternion.setFromUnitVectors(_up, _d);
    u.pole.scale.y = u.L; u.pole.position.y = u.L / 2; u.canopy.position.y = u.L; u.canopy.quaternion.identity();
  }
}
function shades() {
  const g = new THREE.Group(), lens = mat('#1e2126', { flatShading: false }), frame = mat('#111111');
  [-1, 1].forEach(s => {
    const l = new THREE.Mesh(new THREE.CircleGeometry(.034, 20), lens); l.position.set(s * .047, 0, 0); l.rotation.y = s * .18; g.add(l);
  });
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(.028, .006, .004), frame); g.add(bridge);
  const { W, top, front } = HEAD; g.scale.setScalar(6.8 * W); g.position.set(0, top - .89 * W, front - .12 * W);
  return g;
}
// Guayabera: el suéter se repinta en lino claro (en el clásico, su textura; en el de respaldo, los
// colores de sus vértices) y la bufanda se guarda
const LINO = [231, 220, 194];
let guayaMap = null, ropaMaps = null;
function guayaTex(baseMap) {
  const img = baseMap.image, c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), a = d.data, W = c.width, H = c.height;
  // Máscara del suéter cerrada (dilatar y erosionar 6 px): así entran también
  // las líneas grises del zigzag, que quedan rodeadas de amarillo.
  const yel = new Uint8Array(W * H);
  for (let i = 0, j = 0; i < a.length; i += 4, j++) { const r = a[i], g = a[i + 1], b = a[i + 2]; yel[j] = r > 140 && g > 120 && r - b > 70 ? 1 : 0; }
  const pass = (src, R, op) => {
    const h = new Uint8Array(W * H), v = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x0 = 0; x0 < W; x0++) {
      let m = op; for (let k = -R; k <= R; k++) { const xx = x0 + k; const val = xx < 0 || xx >= W ? 0 : src[y * W + xx]; m = op ? Math.min(m, val) : Math.max(m, val); }
      h[y * W + x0] = m;
    }
    for (let y = 0; y < H; y++) for (let x0 = 0; x0 < W; x0++) {
      let m = op; for (let k = -R; k <= R; k++) { const yy = y + k; const val = yy < 0 || yy >= H ? 0 : h[yy * W + x0]; m = op ? Math.min(m, val) : Math.max(m, val); }
      v[y * W + x0] = m;
    }
    return v;
  };
  const shirt = pass(pass(yel, 6, 0), 6, 1);
  for (let i = 0, j = 0; i < a.length; i += 4, j++) {
    if (shirt[j] && !yel[j]) { a[i] = 255; a[i + 1] = 210; a[i + 2] = 40; } // se pinta como suéter y abajo pasa a lino
    const r = a[i], g = a[i + 1], b = a[i + 2], l = (r + g + b) / 765;
    // lino parejo (sin el zigzag del suéter): apenas se conserva el sombreado
    if (r > 140 && g > 120 && r - b > 70) { const k = .95 + (l - .62) * .12; a[i] = 247 * k; a[i + 1] = 244 * k; a[i + 2] = 234 * k; }
    // la bufanda pasa a ser el cuello de la guayabera, del mismo lino
    else if (b > r + 35 && b > g + 5) { const k = .9 + (l - .3) * .1; a[i] = 240 * k; a[i + 1] = 236 * k; a[i + 2] = 224 * k; }
  }
  x.putImageData(d, 0, 0);
  guayaMap = new THREE.CanvasTexture(c);
  ['flipY', 'colorSpace', 'wrapS', 'wrapT', 'anisotropy'].forEach(k => { guayaMap[k] = baseMap[k]; });
  return guayaMap;
}
// En v2 la guayabera viene horneada (tools/uku-hornea.py: lino con sus pliegues y la misma luz que el suéter)
function linoTex(base) {
  guayaMap = new THREE.TextureLoader().load(new URL('./oso/tex/uku_ropa_lino.png', import.meta.url).href);
  ['flipY', 'colorSpace', 'wrapS', 'wrapT', 'anisotropy', 'magFilter', 'minFilter'].forEach(k => { guayaMap[k] = base[k]; });
  return guayaMap;
}
function guayabera(on) {
  if (!rig) return;
  const buf = rig.skinned.find(m => m.name === 'bufanda'); if (buf) buf.visible = !on; // con calor, sin bufanda
  // El oso de siempre: las piezas con la textura de la ropa
  if (!ropaMaps) { ropaMaps = []; rig.root.traverse(o => { if (o.isMesh && o.material.map && /ropa/.test(o.material.map.name || '')) ropaMaps.push([o, o.material.map]); }); }
  if (ropaMaps.length) {
    ropaMaps.forEach(([o, m]) => { const t = on ? (guayaMap || (OSO === 'v2' || OSO === 'v3' ? linoTex(m) : guayaTex(m))) : m; if (o.material.map !== t) { o.material.map = t; o.material.needsUpdate = true; } });
    return;
  }
  const ropa = rig.skinned.find(m => m.name === 'ropa');
  if (!ropa || !ropa.geometry.attributes.color) return;
  const a = ropa.geometry.attributes.color, v = a.array, n = a.itemSize;
  if (!ropaCols) ropaCols = v.slice();
  for (let i = 0; i < a.count; i++) {
    const o = i * n;
    if (!on) { v[o] = ropaCols[o]; v[o + 1] = ropaCols[o + 1]; v[o + 2] = ropaCols[o + 2]; continue; }
    const f = (ropaCols[o + 2] > 60 ? .9 : 1) * Math.min(1, .82 + .18 * ropaCols[o] / 250);
    v[o] = LINO[0] * f; v[o + 1] = LINO[1] * f; v[o + 2] = LINO[2] * f;
  }
  a.needsUpdate = true;
}
function dressBear() {
  if (!bear || !bones.head) return;
  if (acc) { bones.head.remove(acc); acc.traverse(c => { c.geometry && c.geometry.dispose(); c.material && c.material.dispose(); }); }
  acc = new THREE.Group();
  if (look.hat === 'paja') acc.add(hatPaja());
  if (look.hat === 'lana') acc.add(hatLana());
  if (look.shades) acc.add(shades());
  bones.head.add(acc);
  if (umb && look.hat !== 'paraguas') { scene.remove(umb); umb.traverse(c => { c.geometry && c.geometry.dispose(); c.material && c.material.dispose(); }); umb = null; }
  if (!umb && look.hat === 'paraguas') { umb = umbrella(); scene.add(umb); }
  if (rig && rig.sostener) rig.sostener(!!umb && umbEstado !== 'guardado'); // el brazo izquierdo sostiene el paraguas (si no lo guardó para leer o plantar)
  guayabera(look.shirt === 'guayabera');
  const lentes = rig.N('lentes'); if (lentes) lentes.visible = !look.shades; // con gafas de sol se guarda los lentes
}
function buildRain() {
  const n = 220, pos = new Float32Array(n * 6), r = rng(71);
  for (let i = 0; i < n; i++) {
    const x = (r() - .5) * 5, y = r() * 2.6, z = -r() * 3 + .8;
    pos.set([x, y, z, x - .01, y - .07, z], i * 6);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#9fb3c8', transparent: true, opacity: .55 }));
  rain.visible = false; scene.add(rain);
}
export function setLook(l) {
  const region = look.region;
  look = Object.assign({}, look, l || {});
  if (!scene) return;
  dressBear();
  if (rain) rain.visible = !!look.rain;
  if (region !== look.region) repaint();
}

/* ---------- Bucle ---------- */
let last = 0;
const MOOD_TINT = { feliz: new THREE.Color('#ffffff'), pensativo: new THREE.Color('#e1e6ef'), tranquilo: new THREE.Color('#ffffff') }, WHITE = new THREE.Color('#ffffff');
const _qs = new THREE.Quaternion(), _es = new THREE.Euler(), _cam = new THREE.Vector3();
function frame(now) {
  raf = requestAnimationFrame(frame);
  if (!visible || !host) return;
  if (now - last < 32) return; // ~30 fps: suficiente y cuida batería
  last = now;
  const dt = Math.min(clock.getDelta(), .1), t = clock.elapsedTime;
  if (gesture && GEST[gesture]) { gestureT += dt; if (gestureT > GEST[gesture][3]) { gesture = null; gestureT = 0; holdObject(null); readEnd(); } }
  if (gesture === 'plant' && !focus) plantStep();
  if (gesture === 'read' && !focus) readStep(dt); else if (leyendo) readEnd();
  // Mientras Uku carga, el bosque aparece solo: el puntaje sube hasta el de la persona en 2.2 s
  if (!bear && target != null) {
    const s2 = Math.round(Math.min(1, (performance.now() - loadAt) / 2200) * target);
    if (s2 !== score) { score = s2; buildForest(); }
  }
  moodTint.lerp(MOOD_TINT[mood] || WHITE, Math.min(1, dt * 2));
  if (ambLight) ambLight.color.copy(AMB).multiply(moodTint);
  if (bear) {
    if (bear.userData.grow < 1) { bear.userData.grow = Math.min(1, bear.userData.grow + dt * 1.2); bear.scale.setScalar(Math.max(.001, BEAR_S * (1 - Math.pow(1 - bear.userData.grow, 3)))); }
    brain(dt);
    const c = clipFor();
    rig.playClip(c[0], .8, { speed: c[1], calm: c[2], keep: c[4] });
    rig.update(dt);
    // Los pies siempre en el suelo (el rig apoya el pie más bajo); quieto, se mece apenas.
    // Sobre la esfera su eje vertical es la normal del planeta
    const still = !moving && !gesture && !RM && !focus;
    swayB = 0; // antes se mecía girando el cuerpo entero, y los pies apoyados giraban con él (se deslizaban): la vida la pone la clip
    surf(pos.x, pos.z, _sp);
    bear.position.copy(PLANET_C).addScaledVector(_sp, PLANET_R);
    // Sombra de contacto: lo asienta en el suelo
    shadow.position.copy(bear.position).addScaledVector(_sp, .004); shadow.quaternion.setFromUnitVectors(_nrm, _sp);
    shadow.scale.setScalar(bear.scale.x / BEAR_S * (gesture === 'plant' ? 1.15 : 1)); shadow.visible = !focus;
    bear.quaternion.setFromUnitVectors(_nrm, _sp).multiply(_yaw.setFromAxisAngle(_nrm, heading + swayB));
    bear.updateMatrixWorld(true);
    if (espejo.on) espejoPaso(dt); else lookAround(dt);
    eyes(dt, t);
    if (umb) pasoParaguas(dt);
  }
  if (forest) forest.children.slice().forEach(o => {
    const u = o.userData;
    if (u.delay > 0) { u.delay -= dt; return; }
    if ((u.dir > 0 && u.grow < 1) || (u.dir < 0 && u.grow > 0)) {
      u.grow = clamp(u.grow + u.dir * dt * (RM ? 10 : u.gs), 0, 1);
      // crece con un pequeño rebote (se pasa un poco y se asienta); se va encogiéndose sin rebote
      const g = u.grow, e = u.dir > 0 ? 1 + 2.2 * Math.pow(g - 1, 3) + 1.2 * Math.pow(g - 1, 2) : 1 - Math.pow(1 - g, 3);
      o.scale.setScalar(Math.max(.001, u.base * e));
      if (u.dir < 0 && u.grow <= 0) { forest.remove(o); return; }
    }
    // El viento: flores y brotes se mecen más que los árboles, cada uno a su ritmo
    if (u.sway && !RM) o.quaternion.copy(u.q0).multiply(_qs.setFromEuler(_es.set(Math.sin(t * .9 + u.ph * 5) * u.sway * .6, 0, Math.sin(t * 1.3 + u.ph * 3) * u.sway)));
    if (u.tick && !RM) u.tick(o, t);
  });
  if (fliesG) updateFlies(dt, t);
  if (petals) updatePetals(dt, t);
  if (frameHooks.length) frameHooks.forEach(f => f(dt, t));
  if (dust && !RM) {
    const a = dust.geometry.attributes.position, sp = dust.userData.speed;
    for (let i = 0; i < a.count; i++) {
      let y = a.getY(i) + sp[i] * dt;
      if (y > 2.2) y = -.05;
      a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t * .6 + i) * .0009);
    }
    a.needsUpdate = true;
  }
  if (rain && rain.visible && !RM) {
    const a = rain.geometry.attributes.position;
    for (let i = 0; i < a.count; i += 2) {
      let y = a.getY(i) - dt * 2.4;
      if (y < 0) y += 2.6;
      a.setY(i, y); a.setY(i + 1, y - .07);
    }
    a.needsUpdate = true;
  }
  // Giro: el dedo manda (con un pequeño rebote en los topes); a los 3 s vuelve de frente.
  // Con un mensaje o conversando, siempre de frente; en libertad la cámara orbita despacio alrededor de él
  if (!drag) { if (focus || performance.now() - idleAt > 3000) yawTo = focus ? 0 : (1 - frontAmt) * Math.sin(t * .07) * .45; else yawTo = Math.max(-1.13, Math.min(1.13, yawTo)); }
  yaw = RM ? yawTo : lerp(yaw, yawTo, Math.min(1, dt * (drag ? 14 : 2.5)));
  frontAmt = RM ? (front ? 1 : 0) : lerp(frontAmt, front ? 1 : 0, Math.min(1, dt * 1.6));
  const sway = RM || drag || focus ? 0 : Math.sin(t * .15) * (.12 + .18 * (1 - frontAmt));
  // Conversando, la cámara se acerca y lo mira a la cara; su mundo queda apagado detrás
  focusAmt = RM ? (focus ? 1 : 0) : lerp(focusAmt, focus ? 1 : 0, Math.min(1, dt * 4));
  // En libertad la cámara se aleja y sube un poco (se ve el horizonte del planeta); con un mensaje, Uku pasa a primer plano
  const free = (1 - frontAmt) * (1 - focusAmt);
  planoAmt = RM ? (plano ? 1 : 0) : lerp(planoAmt, plano ? 1 : 0, Math.min(1, dt * 2.2));
  const cd = camDist * (.66 - .1 * focusAmt) * zoomCur * (1 + .4 * free + .5 * planoAmt), ch = CAM_H * (.6 - .04 * focusAmt + .14 * free + .3 * planoAmt);
  // El encuadre (corrimiento) también se mueve con suavidad
  const sdt = Math.min(dt, .05);
  if (Math.abs(shiftCur.x - shiftTo.x) > 1e-4 || Math.abs(shiftCur.y - shiftTo.y) > 1e-4 || Math.abs(camVel.x) > 1e-4 || Math.abs(camVel.y) > 1e-4) {
    if (RM) { shiftCur.x = shiftTo.x; shiftCur.y = shiftTo.y; camVel.x = camVel.y = 0; } else { shiftCur.x = spring(shiftCur.x, shiftTo.x, 'x', sdt); shiftCur.y = spring(shiftCur.y, shiftTo.y, 'y', sdt); }
    applyShift();
  }
  if (Math.abs(zoomCur - zoomTo) > 1e-3 || Math.abs(camVel.z) > 1e-4) { if (RM) { zoomCur = zoomTo; camVel.z = 0; } else zoomCur = spring(zoomCur, zoomTo, 'z', sdt); }
  // La cámara acompaña a Uku por el claro: en libertad un poco menos (se le ve pasear), con un mensaje o conversando del todo
  folCur = lerp(folCur, front || focus || manual || manualRel || performance.now() - manualAt < 4000 ? 1 : .8, Math.min(1, dt * 1.5)); // manejándolo, la cámara lo sigue del todo
  const fx = pos.x * folCur, fz = pos.z * folCur, fy = groundY(fx, fz);
  // Ningún objeto se mete entre la cámara y Uku: si uno le tapa la cabeza o el pecho, la cámara sube y se aleja (suave,
  // con histéresis) y, si aun así sigue tapada casi medio segundo, gira alrededor de él hacia el lado libre (ocYaw)
  const yw = yaw + ocYaw, bx = Math.sin(yw) * cd + Math.cos(yw) * sway + fx, by = ch + fy, bz = Math.cos(yw) * cd - Math.sin(yw) * sway + fz;
  velar(); // en tercera persona y de pájaro cerca, lo que se interpone se vuelve translúcido (y ya no cuenta como tapar)
  if (++ocN % 3 === 0) {
    const ahoraTapada = camTapada(camera.position.x, camera.position.y, camera.position.z);
    if (ahoraTapada) { ocT = 1; if (!ocDesde) ocDesde = t; } // tapada: sube ya (la histéresis es solo para bajar)
    else { ocDesde = 0; if (!camTapada(bx, by, bz)) ocT = Math.max(0, ocT - .12); }
    if (ahoraTapada && camModo === 'libre' && t - ocDesde > .4) { // ya subida y alejada y sigue tapada: prueba a un lado y al otro
      const cdM = cd * 1.9, chM = ch + .9 + fy;
      for (const dy of [.7, -.7, 1.3, -1.3]) { const y2 = yw + dy; if (!camTapada(Math.sin(y2) * cdM + fx, chM, Math.cos(y2) * cdM + fz)) { ocYawTo = clamp(ocYaw + dy, -2.6, 2.6); ocDesde = t; break; } }
    } else if (!ahoraTapada && ocT <= 0 && ocYawTo && !camTapada(Math.sin(yaw) * cd + fx, ch + fy, Math.cos(yaw) * cd + fz)) ocYawTo = 0; // destapada: vuelve a su sitio
  }
  ocl = RM ? ocT : lerp(ocl, ocT, Math.min(1, dt * (ocT > ocl ? 6 : 3)));
  ocYaw = RM ? ocYawTo : lerp(ocYaw, ocYawTo, Math.min(1, dt * 2.5));
  const cdF = cd * (1 + .9 * ocl), chF = ch + .9 * ocl, ywF = yaw + ocYaw;
  _cp.set(Math.sin(ywF) * cdF + Math.cos(ywF) * sway + fx, chF + fy, Math.cos(ywF) * cdF - Math.sin(ywF) * sway + fz);
  _cl.set(fx, .32 + .04 * focusAmt + .1 * planoAmt + fy, fz);
  // Tercera persona (detrás de Uku, mirando adelante) y vista de pájaro (el claro desde arriba): se funden con la libre
  camAmt.tercera = RM ? (camModo === 'tercera' ? 1 : 0) : lerp(camAmt.tercera, camModo === 'tercera' ? 1 : 0, Math.min(1, dt * 2.5));
  camAmt.pajaro = RM ? (camModo === 'pajaro' ? 1 : 0) : lerp(camAmt.pajaro, camModo === 'pajaro' ? 1 : 0, Math.min(1, dt * 2.5));
  if (camAmt.tercera > .001) {
    terceraYaw += angDiff(heading, terceraYaw) * Math.min(1, dt * 3);
    // Detrás y un poco arriba (Uku ocupa el tercio inferior de la pantalla y se ve el camino por delante)
    const d = 1.7 * zoomCur, tx = pos.x - Math.sin(terceraYaw) * d, tz = pos.z - Math.cos(terceraYaw) * d;
    _tp.set(tx, groundY(tx, tz) + .95 + .8 * ocl, tz); _tl.set(pos.x + Math.sin(terceraYaw) * .9, groundY(pos.x, pos.z) + .22, pos.z + Math.cos(terceraYaw) * .9); // tapada por el jardín (que no se vela por pieza): sube
    _cp.lerp(_tp, camAmt.tercera); _cl.lerp(_tl, camAmt.tercera);
  }
  let esp = 0; // cuánto se está en el espacio (0 en el suelo, 1 en el tope del zoom)
  if (camAmt.pajaro > .001) {
    // El globo entero: pajaro.q es el marco del punto mirado (Y = su normal). Siguiendo a Uku, el marco va hacia el suyo;
    // soltado el dedo, sigue girando un poco por inercia
    if (pajaro.seguir) { marcoDeUku(_qU); pajaro.q.slerp(_qU, RM ? 1 : Math.min(1, dt * 2)); }
    else if (pajaro.w.lengthSq() > 4e-4) inercia(dt);
    pajaro.zoom = RM ? pajaro.zoomA : Math.exp(lerp(Math.log(pajaro.zoom), Math.log(pajaro.zoomA), Math.min(1, dt * 9)));
    const z = pajaro.zoom;
    // Cuanto más lejos, más desde arriba (de cerca se ve en perspectiva; de lejos, el planeta entero centrado).
    // Con q = identidad (centro del claro) es el mismo encuadre de siempre
    const atras = 1.6 * z / (1 + Math.max(0, z - 1) * .6);
    _upL.set(0, 1, 0).applyQuaternion(pajaro.q);
    _tp.set(0, PLANET_R + 2.3 * z, atras).applyQuaternion(pajaro.q).add(PLANET_C);
    _tl.set(0, PLANET_R - Math.max(0, z - 1) * .35, 0).applyQuaternion(pajaro.q).add(PLANET_C);
    // Más allá de 2,5 de zoom la cámara se va al espacio y orbita el planeta entero (como en Tolan) desde el MISMO
    // marco: lo que se gira es lo que se ve al acercar. Continuo en z: no hay salto entre el suelo y el espacio, y esp
    // llega a 1 justo en el tope del zoom (7,5). La órbita mira el planeta bastante desde arriba (0, 3.2, 1) para que
    // el punto mirado (el claro, al salir desde él) quede cerca del centro del disco y no caiga inclinado en el borde
    esp = clamp((z - 2.5) / 5, 0, 1); const D = PLANET_R * (2.4 + 2.3 * esp);
    if (esp > 0) { _ep.set(0, 3.2, 1).normalize().multiplyScalar(D).applyQuaternion(pajaro.q).add(PLANET_C); _tp.lerp(_ep, esp); _tl.lerp(PLANET_C, esp); }
    _cp.lerp(_tp, camAmt.pajaro); _cl.lerp(_tl, camAmt.pajaro);
    _upCam.copy(_UP0).lerp(_upL, camAmt.pajaro).normalize();
    // En el espacio la niebla toma el azul del cielo de noche: el limbo no se difumina a crema
    if (scene.fog) { scene.fog.color.copy(bgCol).lerp(_colEsp, esp * camAmt.pajaro); fogEsp = true; }
  } else if (fogEsp && scene.fog) { scene.fog.color.copy(bgCol); fogEsp = false; }
  // Desde lejos la niebla se abre: así, alejando del todo, se ve el claro entero y el planeta redondo (como en Tolan)
  if (scene.fog) { const lejos = camAmt.pajaro * Math.max(0, pajaro.zoom - 1) * 6; scene.fog.near = FOG_NEAR + lejos; scene.fog.far = 9.5 + lejos * 3; }
  if (dust) dust.material.opacity = DUST_OP * (1 - esp * camAmt.pajaro); // desde el espacio el polvo del claro no asoma fuera del limbo
  camera.position.copy(_cp);
  camera.up.copy(camAmt.pajaro > .001 ? _upCam : _UP0); // de pájaro, «arriba» es la normal del punto mirado
  camera.lookAt(_cl);
  if (Math.abs(camAmt.pajaro - pajShift) > 1e-4) { pajShift = camAmt.pajaro; applyShift(); } // el corrimiento se funde con la vista
  draw();
}
/* ---------- Espejo (como los Memoji): Uku imita tu cabeza, tus ojos y tus brazos ----------
   setEspejo(f): f = null apaga; si no, { cabeza: { yaw, pitch, roll } (rad, ya en espejo: positivo = hacia la izquierda de la
   pantalla / arriba / inclinado a la izquierda), cara: { blink: 0–1, smile: 0–1 }, brazos: { L: { arm, fore }, R: { arm, fore } } }
   donde arm y fore son direcciones [x, y, z] en pantalla (x = izquierda de la pantalla, y = arriba) del brazo y el antebrazo.
   La cabeza se gira alrededor de los ejes de Uku (como la mirada); cada hueso del brazo se apunta en esa dirección
   (el eje del hueso es el que va hacia su hijo). Todo con suavizado: se evita el temblor de la cámara. */
const espejo = { on: false, cabeza: { yaw: 0, pitch: 0, roll: 0 }, cara: null, brazos: null, q: {} };
const _ed = new THREE.Vector3(), _eq = new THREE.Quaternion(), _ea = new THREE.Vector3(), _ef = new THREE.Vector3(), _er = new THREE.Vector3();
export function setEspejo(f) {
  if (!f) { espejo.on = false; espejo.cara = null; espejo.brazos = null; return; }
  espejo.on = true;
  if (f.cabeza) espejo.cabeza = f.cabeza;
  if (f.cara) espejo.cara = f.cara;
  espejo.brazos = f.brazos || null;
}
export function espejoActivo() { return espejo.on; }
function espejoPaso(dt) {
  if (!bones.head || !bones.neck || !rig) return;
  const k = Math.min(1, dt * 9), c = espejo.cabeza;
  // Cabeza: el giro (yaw), el cabeceo (pitch) y la inclinación (roll) alrededor de los ejes de Uku, repartidos cuello/cabeza
  lookY = lerp(lookY, clamp(c.yaw, -.9, .9), k); lookP = lerp(lookP, clamp(c.pitch, -.5, .5), k); espejo.roll = lerp(espejo.roll || 0, clamp(c.roll, -.6, .6), k);
  _au.set(0, 1, 0).applyQuaternion(bear.quaternion); _ar.set(1, 0, 0).applyQuaternion(bear.quaternion); _ef.set(0, 0, 1).applyQuaternion(bear.quaternion);
  [[bones.neck, .35], [bones.head, .65]].forEach(([b, w]) => {
    b.parent.getWorldQuaternion(_qp);
    _qa.setFromAxisAngle(_au, lookY * w).multiply(_qb.setFromAxisAngle(_ar, -lookP * w)).multiply(_eq.setFromAxisAngle(_ef, -espejo.roll * w));
    b.quaternion.premultiply(_qa.premultiply(_qp.clone().invert()).multiply(_qp));
    b.updateWorldMatrix(true, true);
  });
  // Brazos: cada hueso apunta hacia donde va el tuyo (en el plano de la pantalla, un poco hacia adelante)
  if (!espejo.brazos) return;
  const lado = (L, br) => {
    if (!br) return;
    const arm = rig.B('mixamorig:' + L + 'Arm'), fore = rig.B('mixamorig:' + L + 'ForeArm'), hand = rig.B('mixamorig:' + L + 'Hand');
    [[arm, fore, br.arm], [fore, hand, br.fore]].forEach(([b, hijo, dir]) => {
      if (!b || !hijo || !dir) return;
      // dirección en el mundo: x de pantalla es -x del mundo (la cámara mira hacia -z); y arriba; z hacia la cámara
      _ed.set(-dir[0], dir[1], dir[2] || .15).normalize();
      _ea.copy(hijo.position).normalize(); // el eje del hueso, en su propio espacio
      b.parent.getWorldQuaternion(_qp);
      _er.copy(_ed).applyQuaternion(_qp.clone().invert()); // la dirección deseada, en el espacio del padre
      _eq.setFromUnitVectors(_ea, _er);
      const key = b.name; espejo.q[key] = espejo.q[key] || b.quaternion.clone();
      espejo.q[key].slerp(_eq, k); b.quaternion.copy(espejo.q[key]);
      b.updateWorldMatrix(true, true);
    });
  };
  lado('Left', espejo.brazos.L); lado('Right', espejo.brazos.R);
}

/* ---------- Decorar (como en Tolan): Fran pone cosas de a una, donde toca, y las gira o las quita ----------
   Las cosas que se pueden poner (clave → pieza), lo puesto (localStorage mimo_decoracion) y lo que hace falta para
   la interfaz: el punto del suelo bajo un toque y dónde cae en pantalla un punto del claro. */
export const DECORABLES = {
  flor: { kind: 'silvestre', v: 0, base: 1.1, nombre: 'florcitas' }, mata: { kind: 'tufts', base: 1, nombre: 'mata' },
  piedra: { kind: 'piedra', base: 1, nombre: 'piedra' }, arbusto: { kind: 'arbusto', base: 1.1, nombre: 'arbusto' },
  helecho: { kind: 'helechito', v: 1, base: 1.2, nombre: 'helecho' }, guaya: { kind: 'guaya', v: 1, base: 1.0, sway: .015, nombre: 'guayacán' },
  hongos: { kind: 'hongos', base: 1.2, nombre: 'hongos' }, farolito: { kind: 'farolito', base: 1.1, nombre: 'farolito' }, banca: { kind: 'banca', base: 1.3, nombre: 'banca' }
};
Object.assign(PARTS, {
  tufts: pal => [-.35, 0, .35].map((a, i) => pc(new THREE.ConeGeometry(.012, .07 + (i % 2) * .03, 3), pal.grass, [a * .04, .04 + (i % 2) * .015, 0], [0, 0, a])),
  piedra: pal => [pc(new THREE.DodecahedronGeometry(.08, 0), pal.rock, [0, .03, 0], [.3, .5, 0], [1.2, .6, .9]), pc(new THREE.DodecahedronGeometry(.045, 0), pal.rock, [.1, .02, .05], [.1, .9, 0], [1, .6, 1])],
  arbusto: pal => [[0, .12, 0, .16], [.12, .08, .05, .11], [-.11, .07, -.04, .1]].map(([x, y, z, r], i) => pc(new THREE.IcosahedronGeometry(r, 0), pal.round[i % pal.round.length], [x, y, z], [.2 * i, 0, 0]))
});
const KD = 'mimo_decoracion';
let decoracion = (() => { try { return JSON.parse(localStorage.getItem(KD) || '[]'); } catch (e) { return []; } })();
function guardarDecoracion() { try { localStorage.setItem(KD, JSON.stringify(decoracion)); } catch (e) {} if (renderer) buildForest(); puestoCambio(); }
export function decoracionLista() { return decoracion.slice(); }
export function ponerDecoracion(k, x, z, rot = 0) { if (!DECORABLES[k] || Math.hypot(+x, +z) > Math.PI * PLANET_R - .4) return null; const d = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), k, x: +x, z: +z, rot: +rot }; decoracion.push(d); guardarDecoracion(); return d; }
export function moverDecoracion(id, x, z) { const d = decoracion.find(o => o.id === id); if (d) { d.x = +x; d.z = +z; guardarDecoracion(); } }
export function girarDecoracion(id, paso = Math.PI / 4) { const d = decoracion.find(o => o.id === id); if (d) { d.rot = (d.rot || 0) + paso; guardarDecoracion(); } }
export function cambiarDecoracion(id, k) { const d = decoracion.find(o => o.id === id); if (d && DECORABLES[k]) { d.k = k; guardarDecoracion(); } }
export function quitarDecoracion(id) { decoracion = decoracion.filter(o => o.id !== id); guardarDecoracion(); }
export function quitarTodaDecoracion() { decoracion = []; guardarDecoracion(); }
/* ¿Se puede poner algo ahí? En el claro: fuera de los corredores, del lago y de lo que hay puesto (la regla de siempre).
   En el resto de la esfera: en cualquier sitio que se vea desde la cámara, salvo el bosque del claro y su franja pelada,
   la antípoda (placeAt degenera), los hitos de las zonas, el agua y la orilla de la laguna, y lo grande que ya hay. */
const dentroDelClaro = (x, z) => Math.hypot(x, z * .8) < 2.2;
decoClaro = decoracion.filter(d => dentroDelClaro(d.x, d.z)); // lo guardado de otra visita ya cuenta para andar
const _vd = new THREE.Vector3();
function visibleDesdeCamara(x, z) { if (!camera) return true; surf(x, z, _sp); return _vd.copy(camera.position).sub(PLANET_C).addScaledVector(_sp, -PLANET_R).dot(_sp) > .05; }
// k (opcional) es lo que se va a poner: lo grande necesita más sitio (no se encima a Uku, a otra cosa puesta ni al sendero)
export function sitioLibre(x, z, k) {
  if (!esc) return false;
  if (dentroDelClaro(x, z)) {
    const rk = k ? radioDeco(k) : .12;
    if (bear && Math.hypot(x - pos.x, z - pos.z) < .35 + rk * .5) return false; // nunca encima de Uku
    if (!decoracion.every(o => Math.hypot(x - o.x, z - o.z) >= radioDeco(o.k) + rk * .5) || !planted.every(p => Math.hypot(x - p.x, z - p.z) >= .14)) return false;
    return distSendero(x, z) > .14 + Math.max(0, rk - .12) && Math.hypot(x - LAGO_P[0], z - LAGO_P[1]) > lagoEnForma() + .14 && !quienBloquea(x, z) && VISIBLE(x, z);
  }
  const d = Math.hypot(x, z);
  if (d < 3.8 || d > Math.PI * PLANET_R - .4) return false;
  if (!visibleDesdeCamara(x, z)) return false;
  if (ZONAS.some(Z => Z.hito && distEsf(x, z, Z.hitoX, Z.hitoZ) < Z.hito.R + .3)) return false;
  if (ZONAS.some(Z => Z.laguna && distEsf(x, z, Z.cx, Z.cz) < 1.05)) return false;
  return decoracion.every(o => distEsf(x, z, o.x, o.z) >= .22) && PLANETA_PUNTOS.every(p => !p.grande || distEsf(x, z, p.x, p.z) >= .35);
}
// El punto del claro (x, z) bajo un punto de la pantalla (px del contenedor), o null si no toca el suelo
const _rayS = new THREE.Raycaster(), _ndcS = new THREE.Vector2(), _esf = new THREE.Sphere(), _hit = new THREE.Vector3();
export function puntoDeSuelo(cx, cy) {
  if (!host || !camera || !normalBajo(cx, cy, _nB)) return null;
  return arcoDe(_nB); // de la esfera a las coordenadas de arco (las que usa surf), válido en toda la esfera
}
// Dónde cae en pantalla (px del contenedor) un punto del claro
const _pp = new THREE.Vector3();
export function pantallaDe(x, z, alto = 0) {
  if (!host || !camera) return null;
  surf(x, z, _sp); _pp.copy(PLANET_C).addScaledVector(_sp, PLANET_R + alto);
  if (_vd.copy(camera.position).sub(_pp).dot(_sp) <= .02) return null; // en la cara oculta del planeta
  _pp.project(camera);
  if (_pp.z > 1) return null;
  return { x: (_pp.x + 1) / 2 * host.clientWidth, y: (1 - _pp.y) / 2 * host.clientHeight };
}

/* ---------- Cámaras: libre (la de siempre), tercera (detrás de Uku, para manejarlo) y pájaro (el claro desde
   arriba: se arrastra con el mouse o el dedo, hace zoom con la rueda o el pellizco, y Uku sigue en lo suyo) ---------- */
let camModo = 'libre', terceraYaw = 0;
/* Vista de pájaro = el planeta entero se gira con el dedo (como en Tolan). pajaro.q lleva el marco del claro (Y = normal
   del polo, +Z hacia la cámara, +X derecha) al marco del punto mirado: q·(0,1,0) es su normal, q·(0,0,1) «atrás» y
   q·(1,0,0) «derecha»; q = identidad mira al centro del claro (la misma imagen de siempre). Es la construcción de placeAt.
   zoom es el valor animado que usa la cámara y zoomA el que piden la rueda, el pellizco y 📍; ambos en [.4, 7.5].
   w es la velocidad angular de la inercia (rad/s, vector mundial) y tUlt el performance.now() del último pointermove. */
const camAmt = { tercera: 0, pajaro: 0 }, pajaro = { q: new THREE.Quaternion(), zoom: 1, zoomA: 1, seguir: true, w: new THREE.Vector3(), tUlt: 0 };
const _cp = new THREE.Vector3(), _cl = new THREE.Vector3(), _tp = new THREE.Vector3(), _tl = new THREE.Vector3(), _ep = new THREE.Vector3();
const _qU = new THREE.Quaternion(), _qd = new THREE.Quaternion(), _qm = new THREE.Quaternion(), _ax = new THREE.Vector3(), _upL = new THREE.Vector3(), _upN = new THREE.Vector3(), _upA = new THREE.Vector3(), _nA = new THREE.Vector3(), _nB = new THREE.Vector3(), _upCam = new THREE.Vector3(0, 1, 0), _UP0 = new THREE.Vector3(0, 1, 0);
const _colEsp = new THREE.Color('#2b3470'), bgCol = new THREE.Color('#ffffff'); let fogEsp = false, pajShift = -1; // bgCol: el fondo de la paleta (repaint lo actualiza)
function marcoDeUku(out) { surf(pos.x, pos.z, _sp); return out.setFromUnitVectors(_nrm, _sp); }
export function setCamara(m) {
  const antes = camModo; camModo = m === 'tercera' || m === 'pajaro' ? m : 'libre'; if (camModo === 'tercera') terceraYaw = heading;
  if (camModo === 'pajaro') { pajaro.seguir = true; pajaro.w.set(0, 0, 0); if (antes !== 'pajaro') { pajaro.zoomA = Math.min(pajaro.zoomA, 2.4); pajaro.zoom = Math.min(pajaro.zoom, 2.4); if (camAmt.pajaro < .2) { marcoDeUku(pajaro.q); pajaro.zoom = pajaro.zoomA; } } } // se entra sobre Uku, nunca en el espacio (ni un cuadro: así body.espacio no parpadea)
  else if (antes === 'pajaro') { // al salir, el fundido parte de cerca de Uku: si se miraba la cara opuesta, la recta cruzaría la esfera
    pajaro.seguir = true; pajaro.w.set(0, 0, 0); pajaro.zoomA = Math.min(pajaro.zoomA, 1.6);
    if (_upL.set(0, 1, 0).applyQuaternion(pajaro.q).y < 0) { marcoDeUku(pajaro.q); pajaro.zoom = pajaro.zoomA; }
  }
  if (renderer) renderer.domElement.style.touchAction = camModo === 'pajaro' ? 'none' : 'pan-y';
}
export function camaraActual() { return camModo; }
export function vistaSigueAUku() { return camModo !== 'pajaro' || pajaro.seguir; }
// 📍: el globo gira hasta Uku y el zoom cae a ≤ 1,6, a la vez
export function centrarEnUku() { pajaro.seguir = true; pajaro.zoomA = Math.min(pajaro.zoomA, 1.6); pajaro.w.set(0, 0, 0); }
// Giro alrededor de la Z y la X LOCALES del marco (sin ladeo): Rz(+θ)·(0,1,0) = (−sin θ, cos θ, 0) lleva el punto mirado
// a −X local (el mundo se corre a la derecha); Rx(+θ)·(0,1,0) = (0, cos θ, sin θ) lo lleva a +Z local (hacia la cámara)
export function girarVista(ax, ay) {
  pajaro.seguir = false;
  pajaro.q.multiply(_qd.setFromAxisAngle(_ax.set(0, 0, 1), ax)).multiply(_qd.setFromAxisAngle(_ax.set(1, 0, 0), ay)).normalize();
}
// Mover la vista de pájaro (en metros de arco, en el sentido de siempre, ya sin recortes: se llega a toda la esfera) y
// hacer zoom (factor); en la vista libre el zoom es el de siempre
export function moverVista(dx, dz) { girarVista(-dx / PLANET_R, dz / PLANET_R); }
export function zoomVista(f) { if (camModo === 'pajaro') pajaro.zoomA = clamp(pajaro.zoomA * f, .4, 7.5); else setZoom(zoomTo * f); }
export function zoomPajaro() { return pajaro.zoom; }
export function enElEspacio() { return camModo === 'pajaro' && pajaro.zoom > 2.5; }
// Trackball exacto para el punto central, sin ladeo: el planeta tiene que llevar la normal a (la que estaba bajo el dedo)
// a b (la de ahora); Δ⁻¹ se aplica solo al «arriba» y el marco se recompone con la rotación mínima (sin giro sobre la normal)
function girarHacia(a, b) {
  pajaro.seguir = false;
  _qm.setFromUnitVectors(a, b).invert();
  _upL.set(0, 1, 0).applyQuaternion(pajaro.q);
  _upN.copy(_upL).applyQuaternion(_qm);
  pajaro.q.premultiply(_qd.setFromUnitVectors(_upL, _upN)).normalize();
}
// Inercia: el globo sigue girando alrededor del eje w y se frena (τ = .35 s)
function inercia(dt) {
  const v = pajaro.w.length();
  _upL.set(0, 1, 0).applyQuaternion(pajaro.q);
  _upN.copy(_upL).applyQuaternion(_qd.setFromAxisAngle(_ax.copy(pajaro.w).divideScalar(v), v * dt));
  pajaro.q.premultiply(_qd.setFromUnitVectors(_upL, _upN)).normalize();
  pajaro.w.multiplyScalar(Math.exp(-dt / .35)); if (pajaro.w.length() < .02) pajaro.w.set(0, 0, 0);
}
// Normal de la esfera bajo un píxel (null fuera del limbo)
function normalBajo(cx, cy, out) {
  const r = renderer.domElement.getBoundingClientRect();
  _ndcS.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1); _rayS.setFromCamera(_ndcS, camera); _esf.set(PLANET_C, PLANET_R);
  if (!_rayS.ray.intersectSphere(_esf, _hit)) return null;
  return out.copy(_hit).sub(PLANET_C).divideScalar(PLANET_R);
}
// Dónde mira la vista de pájaro: { x, z } (arco), zoom, zoomA, seguir y la normal up (para pruebas y para guardarla)
export function vistaPajaro() { _upL.set(0, 1, 0).applyQuaternion(pajaro.q); const p = arcoDe(_upL); return { x: p.x, z: p.z, zoom: pajaro.zoom, zoomA: pajaro.zoomA, seguir: pajaro.seguir, up: [_upL.x, _upL.y, _upL.z] }; }

// El mundo y Uku son la misma ilustración plana; Uku va en su propia escena, encima, sin borrar la profundidad:
// lo que está delante de él lo sigue tapando
function draw() {
  seguirLuz();
  renderer.render(scene, camera);
  renderer.autoClear = false; renderer.render(bearScene, camera); renderer.autoClear = true;
}
function resize() {
  if (!host) return;
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Encuadre: el oso siempre entra completo, más cerca en pantallas altas.
  camera.fov = camera.aspect < .8 ? 38 : 30;
  camDist = camera.aspect < .8 ? 3.4 : 3.6; // planeta: desde más lejos y más alto se ve el horizonte curvo
  // Escenario: data-shift corre el encuadre (fracción del ancho) para que Uku
  // no quede detrás del globo de texto.
  applyShift();
}
function applyShift() {
  if (!host) return;
  // De pájaro el corrimiento se anula: el centro del trackball y del pellizco es el centro de la pantalla
  const w = host.clientWidth, h = host.clientHeight, k = 1 - camAmt.pajaro, sh = shiftCur.x * k, sv = shiftCur.y * k;
  if (!w || !h) return;
  if (Math.abs(sh) > 1e-4 || Math.abs(sv) > 1e-4) camera.setViewOffset(w, h, -w * sh, h * sv, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'b3d-canvas';
  scene = new THREE.Scene();
  const pal = palette();
  scene.background = null; // transparente: la máscara del contenedor funde la escena con la página
  bgCol.set(pal.bg); scene.fog = new THREE.Fog(pal.bg, FOG_NEAR, 9.5); // el fondo del claro se aclara con la distancia, como en una ilustración
  camera = new THREE.PerspectiveCamera(30, 1, .05, 90); // lejos: el planeta entero desde el espacio
  camera.position.set(0, .75, 2.6);
  // Ilustración vectorial: luz ambiente y un sol de dos tonos (ver toon)
  ambLight = new THREE.AmbientLight(AMB, Math.PI); scene.add(ambLight);
  solMundo = new THREE.DirectionalLight(SOL, Math.PI); scene.add(solMundo);
  LAMB = toon({ vertexColors: true });
  smokeM = new THREE.MeshBasicMaterial({ color: pal.dust, transparent: true, opacity: .85 });
  ground = new THREE.Mesh(new THREE.SphereGeometry(PLANET_R, 128, 96), toon({ color: pal.ground }));
  ground.position.copy(PLANET_C); scene.add(ground);
  // Uku y lo que lleva van en su escena, con la misma luz de dos tonos que el mundo
  bearScene = new THREE.Scene();
  bearScene.add(new THREE.AmbientLight(AMB, Math.PI));
  solUku = new THREE.DirectionalLight(SOL, Math.PI); bearScene.add(solUku);
  stage = new THREE.Group(); bearScene.add(stage); // el claro de Uku: arriba del planeta, sin giro
  shadow = new THREE.Mesh(new THREE.CircleGeometry(.14, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: dotTexture(), color: '#4e5870', transparent: true, opacity: .3, depthWrite: false, fog: false }));
  shadow.scale.set(1, 1, .8); shadow.visible = false; scene.add(shadow);
  clock = new THREE.Clock();
  import(OSO === 'nuevo' ? './uku-rig-nuevo.js' : './uku-rig.js').then(R => R.loadUkuGltf().then(g => [R, g])).then(([R, g]) => {
    rig = R.ukuFrom(g);
    GEST = rig.gest; IDLE = rig.gest.idle; WALK = rig.gest.walk; PLANT_AT = rig.gest.plantAt;
    // El modelo va dentro de un pivote apoyado en sus pies: el pivote es lo que camina (y crece desde el suelo).
    // Se escala a 0.9 m (la altura del oso anterior) y se centra en x y z.
    const model = g.scene, box = rig.box, mid = box.getCenter(new THREE.Vector3());
    const k = .9 / box.getSize(new THREE.Vector3()).y;
    model.scale.setScalar(k);
    model.position.set(-mid.x * k, -box.min.y * k, -mid.z * k);
    bear = new THREE.Group(); bear.add(model); bear.userData.grow = 0; bear.scale.setScalar(.001);
    bear.traverse(o => {
      if (o.isMesh) {
        o.frustumCulled = false;
        // Como el resto del mundo: su color plano (la textura o el color de la pieza) y un tono de sombra nítido
        const src = o.material;
        o.material = src.map ? toon({ map: src.map, transparent: !!src.transparent, opacity: src.opacity, fog: false })
          : toon({ vertexColors: !!o.geometry.attributes.color, color: o.geometry.attributes.color ? 0xffffff : src.color });
        src.dispose && src.dispose();
      }
    });
    if (rig.face.instalar) rig.face.instalar(); // ojos, nariz y boca, sobre el material nuevo de la cabeza
    stage.add(bear);
    if (target != null) { score = target; target = null; buildForest(); }
    // Lo que se sostiene, se pone o se atacha usa estos huesos
    bones.hand_R = rig.B('mixamorig:RightHand'); bones.hand_L = rig.B('mixamorig:LeftHand'); bones.head = rig.B('mixamorig:Head'); bones.headTop = rig.B('mixamorig:HeadTop_End'); bones.neck = rig.B('mixamorig:Neck'); bones.chest = rig.B('mixamorig:Spine1');
    measureHead();
    dressBear();
    play('wave');
    despejarUku(); // si la decoración guardada le cayó encima, arranca en el sitio libre más cercano
    readyFns.splice(0).forEach(f => { try { f(); } catch (e) {} });
  });
  const cv = renderer.domElement;
  cv.style.touchAction = 'pan-y'; // el scroll vertical de la página sigue funcionando
  const dedos = new Map(); let pellizco = 0; // los dedos en pantalla (para el pellizco)
  cv.addEventListener('pointerdown', e => { dedos.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (dedos.size === 2) { const [a, b] = [...dedos.values()]; pellizco = Math.hypot(a.x - b.x, a.y - b.y); if (drag) drag.moved = true; } pajaro.w.set(0, 0, 0); pajaro.tUlt = performance.now(); if (!drag) drag = { x: e.clientX, y: e.clientY, y0: yawTo, moved: false, id: e.pointerId }; }); // un dedo nuevo corta la inercia; el segundo hace del gesto un arrastre (soltar el pellizco no es un toque)
  const medio = () => { const [a, b] = [...dedos.values()]; return [(a.x + b.x) / 2, (a.y + b.y) / 2]; };
  cv.addEventListener('pointermove', e => {
    const dos = dedos.size === 2 && pellizco, m0 = dos ? medio() : null;
    if (dedos.has(e.pointerId)) dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dos) { // pellizco: zoom con la separación y, de pájaro, el globo sigue al punto medio
      const [a, b] = [...dedos.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (d > 10) { zoomVista(pellizco / d); pellizco = d; }
      if (camModo === 'pajaro') { const m1 = medio(); if (normalBajo(m0[0], m0[1], _nA) && normalBajo(m1[0], m1[1], _nB)) girarHacia(_nA, _nB); }
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 8) { drag.moved = true; try { cv.setPointerCapture(e.pointerId); } catch (x) {} }
    if (!drag.moved) return;
    if (camModo === 'pajaro') { // arrastrar el globo: lo que estaba bajo el dedo sigue bajo el dedo (trackball)
      const t = performance.now(), dtm = Math.max(8, t - (pajaro.tUlt || t)), a = normalBajo(drag.x, drag.y, _nA), b = normalBajo(e.clientX, e.clientY, _nB);
      _upA.set(0, 1, 0).applyQuaternion(pajaro.q);
      if (a && b) girarHacia(a, b);
      else if (pajaro.zoom > 2.5) { const s = Math.PI / Math.max(300, host.clientWidth); girarVista(dx * s, -dy * s); } // fuera del limbo, en el espacio: una pantalla = media vuelta
      else { pajaro.tUlt = t; drag.x = e.clientX; drag.y = e.clientY; return; } // fuera del limbo de cerca (zoom bajo): no gira ni acumula inercia
      // inercia: velocidad angular del «arriba» (eje × ángulo / Δt), filtrada
      const upDesp = _upN.set(0, 1, 0).applyQuaternion(pajaro.q), ang = _upA.angleTo(upDesp);
      _ax.crossVectors(_upA, upDesp).normalize().multiplyScalar(ang / (dtm / 1000));
      if (!RM) pajaro.w.lerp(_ax, .5);
      pajaro.tUlt = t; drag.x = e.clientX; drag.y = e.clientY; return;
    }
    // ±65°: lo alto del claro está detrás del oso, así nunca queda un árbol delante de la cámara
    const v = drag.y0 - dx * .011, L = 1.13; yawTo = Math.max(-L - .15, Math.min(L + .15, v)); idleAt = performance.now();
  });
  cv.addEventListener('wheel', e => { e.preventDefault(); zoomVista(e.deltaY > 0 ? 1.1 : 1 / 1.1); }, { passive: false });
  const soltarDedo = e => { dedos.delete(e.pointerId); if (dedos.size < 2) pellizco = 0; };
  cv.addEventListener('pointerup', soltarDedo); cv.addEventListener('pointercancel', soltarDedo);
  const end = e => {
    if (!drag) return;
    const moved = drag.moved; drag = null; idleAt = performance.now();
    if (moved) {
      // soltado el dedo en movimiento, el globo sigue un poco (si se paró antes de soltar, no)
      if (performance.now() - pajaro.tUlt > 80 || pajaro.w.length() < .6) pajaro.w.set(0, 0, 0); else pajaro.w.clampLength(0, 6);
      // el arrastre no cuenta como toque (el portal del hub es un botón)
      const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', stop, true), 400);
      return;
    }
    // Un toque en el planeta (no en el cielo) visto desde el espacio vuelve a Uku (como en Tolan); decorando, el toque es para poner cosas
    if (e.type === 'pointerup' && camModo === 'pajaro' && enElEspacio() && !document.body.classList.contains('decorando')) { if (normalBajo(e.clientX, e.clientY, _nA)) centrarEnUku(); return; }
    if (e.type === 'pointerup') { play(['wave', 'nod', 'happy'][Math.floor(Math.random() * 3)]); onTap && onTap(); }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  new ResizeObserver(resize).observe(document.documentElement);
  document.addEventListener('visibilitychange', () => { visible = document.visibilityState === 'visible'; });
  new MutationObserver(() => repaint()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  buildGarden(pal);
  buildForest();
  buildDust();
  buildRain();
  buildFlies();
  buildPetals();
  rain.visible = !!look.rain;
  raf = requestAnimationFrame(frame);
}
// Tema o región nuevos: se repinta todo con la paleta que toca
function repaint() {
  const p = palette(); bgCol.set(p.bg); scene.fog.color.set(p.bg); fogEsp = false; ground.material.color.set(p.ground);
  if (wingM) wingM.color.set(p.flower); if (petals) petals.material.color.set(p.flower); if (smokeM) smokeM.color.set(p.dust);
  buildForest(true);
}

export function setAmbient(name) { ambient = name || null; if (ambient === 'walk') idleFor = Math.min(idleFor, 1.5); }
/* play(gesto, { hold }): wave, happy, talk, nod, worried o plant (water y hold son plant: antes regaba,
   ahora planta un brote). walk lo pone a pasear; null lo deja quieto. */
export function play(name, opts) {
  name = ALIAS[name] || name;
  if (name === 'walk') { setAmbient('walk'); return; }
  // Leer y plantar piden las dos manos: con el paraguas en la mano, primero lo cierra y lo cuelga en la espalda
  // (pasoParaguas), y la acción empieza cuando ya tiene las manos libres
  if (umb && MANOS[name] && umbEstado !== 'guardado') { pendiente = { name, opts }; if (umbEstado !== 'cerrando') { umbEstado = 'cerrando'; } goal = null; ruta = []; return; }
  gesture = NAMES.includes(name) ? name : null; gestureT = 0; plantedNow = false;
  if (gesture) goal = null;
  holdObject(opts && opts.hold !== 'can' ? opts.hold : null);
}
export function attach(el, opts) {
  if (!renderer) init();
  host = el;
  el.appendChild(renderer.domElement);
  if (opts && typeof opts.score === 'number') {
    // Antes de que Uku cargue, el bosque crece en vez de aparecer de golpe
    if (!bear) { target = opts.score; loadAt = performance.now(); score = 0; buildForest(); }
    else if (opts.score !== score) { score = opts.score; buildForest(); }
  }
  if (opts && opts.onTap) onTap = opts.onTap;
  if (opts && opts.onReady) { if (bear) opts.onReady(); else readyFns.push(opts.onReady); }
  resize();
  attach._ro && attach._ro.disconnect();
  attach._ro = new ResizeObserver(resize); attach._ro.observe(el); // el contenedor cambia de alto al conversar
  if ('IntersectionObserver' in window) {
    attach._io && attach._io.disconnect();
    attach._io = new IntersectionObserver(es => { visible = es[0].isIntersecting && document.visibilityState === 'visible'; });
    attach._io.observe(el);
  }
}
/* Para dibujar cosas dentro del mundo (los efectos 3D de la POC de Uku: globos, corazones, confeti…):
   enCuadro(fn) llama fn(dt, t) en cada cuadro y mundo3d() entrega three, la escena, la cámara y a Uku. */
const frameHooks = [];
export function enCuadro(fn) { frameHooks.push(fn); }
// El material plano de dos tonos, para lo que se agrega al mundo desde afuera (efectos3d)
export function materialPlano(o) { return toon(o); }
export function mundo3d() { return { THREE, scene, camera, get uku() { return bear; }, get rig() { return rig; }, get estado() { return { pos, heading, speed, moving, gesture, giroV, clip: clipFor()[0], paraguas: umbEstado, leyendo }; }, groundY, PLANET_C, PLANET_R, get renderer() { return renderer; }, get planeta() { return PLANETA_PUNTOS; }, get garden() { return garden; }, get pajaro() { return pajaro; }, decoEsc, okWalk: (x, z) => okWalk(x, z), camTapada: () => camera ? camTapada(camera.position.x, camera.position.y, camera.position.z) : false, get ocultacion() { return { ocT, ocl, ocYaw, ocYawTo, velados: velados.size }; } }; }
export function setScore(s) { if (!bear && target != null) { target = s; return; } if (s !== score) { score = s; if (renderer) buildForest(); } }
export function setBloom(b) { b = b == null ? null : Math.max(0, Math.min(100, b)); if (b !== bloom) { bloom = b; if (renderer) buildForest(); } }
/* Lo que hay en el claro: { brotes, flores, guayacanes: 0–4, casa, mariposas, escenario }.
   brotes lo llena de brotes; flores, los canteros; guayacanes los planta; casa pone su casa con chimenea. */
export function setClaro(f) {
  f = f || {};
  claro = { brotes: !!f.brotes, flores: !!f.flores, guayacanes: +f.guayacanes || 0, casa: !!f.casa,
    mariposas: f.mariposas == null ? null : Math.max(0, +f.mariposas || 0) };
  const antes = !!esc; esc = f.escenario || null; ESC_TREES = null; celdas = null; DECO_ESC = null;
  if (renderer) { if (antes !== !!esc || esc) { const pal = palette(); buildGarden(pal); if (ground) ground.material.color.set(pal.ground); if (dust) dust.material.color.set(pal.dust); } buildForest(); }
  despejarUku(); // con el claro ya armado: si algo guardado le quedó encima, se corre
}
/* Para que la cámara no quede tapada: un rayo de la cabeza y otro del pecho de Uku a la cámara, contra todo lo del
   mundo (el escenario, la casa y el lago, la decoración, los brotes plantados y la malla única del jardín), no contra él
   mismo. Lo velado (translúcido, ver velar) ya no tapa. */
const _oc = new THREE.Raycaster(), _oh = new THREE.Vector3(), _ocd = new THREE.Vector3();
let ocT = 0, ocl = 0, ocN = 0, ocDesde = 0, ocYaw = 0, ocYawTo = 0;
const estorba = o => o.parent && !velados.has(o) && (o.userData.zona || (o.userData.key && o.userData.key[0] === 'X'));
function rayoTapado(bone, cx, cy, cz, objs) {
  try { bone.getWorldPosition(_oh); } catch (e) { return false; }
  _ocd.set(cx - _oh.x, cy - _oh.y, cz - _oh.z); const d = _ocd.length();
  if (d < .3) return false;
  _oc.set(_oh, _ocd.multiplyScalar(1 / d)); _oc.far = d - .12; _oc.camera = camera; // (los Sprite —la neblina de la cascada— piden la cámara; y no tapan)
  try { if (_oc.intersectObjects(objs, true).some(h => !h.object.isSprite)) return true; return !!garden && d < 8 && _oc.intersectObject(garden, false).length > 0; } catch (e) { return false; }
}
function camTapada(cx, cy, cz) {
  if (!bones.head || !bones.head.parent || !forest || !rig || !rig.root || !rig.root.parent) return false; // aún no está en escena
  const objs = forest.children.filter(estorba);
  return rayoTapado(bones.head, cx, cy, cz, objs) || (!!bones.chest && rayoTapado(bones.chest, cx, cy, cz, objs));
}
/* En tercera persona (la cámara va detrás de él, entre los árboles) y de pájaro cerca, las piezas del mundo que quedan
   entre la cámara y Uku se vuelven translúcidas en vez de taparlo: se les cambia el material por uno al 25 % y se les
   devuelve el suyo al despejarse. La malla única del jardín no se puede velar por pieza: ahí la cámara sube (ocl). */
const velados = new Set(); let LAMB_T = null;
const _vh = new THREE.Vector3();
function velar() {
  const activo = camModo === 'tercera' || (camModo === 'pajaro' && pajaro.zoom < 1.3);
  const ahora = new Set();
  if (activo && forest && bones.head && bones.head.parent) {
    LAMB_T = LAMB_T || toon({ vertexColors: true, transparent: true, opacity: .25, depthWrite: false });
    const objs = forest.children.filter(o => o.parent && (o.userData.zona || (o.userData.key && o.userData.key[0] === 'X')));
    for (const bone of [bones.head, bones.chest]) {
      if (!bone) continue;
      try { bone.getWorldPosition(_vh); } catch (e) { continue; }
      _ocd.copy(_vh).sub(camera.position); const d = _ocd.length(); if (d < .3) continue;
      _oc.set(camera.position, _ocd.multiplyScalar(1 / d)); _oc.far = d - .12; _oc.camera = camera;
      try { _oc.intersectObjects(objs, true).forEach(h => { if (h.object.isSprite) return; let o = h.object; while (o.parent && o.parent !== forest) o = o.parent; ahora.add(o); }); } catch (e) {}
    }
    // La cámara metida dentro de una copa (el rayo nace adentro y no la ve): lo que la envuelve también se vela
    objs.forEach(o => { const bs = o.geometry && o.geometry.boundingSphere; if (bs && o.position.distanceTo(camera.position) < bs.radius * o.scale.x + .1) ahora.add(o); });
  }
  ahora.forEach(o => { if (!velados.has(o)) { velados.add(o); o.traverse(m => { if (m.isMesh && m.material === LAMB) m.material = LAMB_T; }); } });
  velados.forEach(o => { if (!ahora.has(o)) { velados.delete(o); o.traverse(m => { if (m.isMesh && m.material === LAMB_T) m.material = LAMB; }); } });
}
// Qué hay hoy en el claro (para depurar)
export function contenido() { const f = enClaro(); return { arboles: forest ? forest.children.filter(o => /^T/.test(o.userData.key || '') && o.userData.dir > 0).length : 0, props: f.props, guayacanes: f.guayas, flores: Math.round(f.flores / 100 * FLOWERS.length), brotes: f.brotes ? SPROUTS.length : 0, plantados: planted.length, mariposas: flyN }; }
/* Uku sale de su mundo para conversar: el bosque, el suelo y el polvo se apagan y queda él solo,
   nítido, sobre una foto borrosa de su mundo (snapshot). Al volver, todo reaparece. */
export function setFocus(on) {
  if (!!on === focus) return;
  focus = !!on;
  // Conversando no pasea: se queda contigo. Al volver a su mundo retoma lo que hacía.
  if (focus) { ambFocus = ambient; ambient = null; } else ambient = ambFocus;
  [forest, garden, ground, dust, rain, umb, fliesG].forEach(o => { if (o) o.visible = focus ? false : (o === rain ? !!look.rain : true); });
  if (scene) scene.fog.near = focus ? 1e4 : FOG_NEAR;
}
export function snapshot() {
  if (!renderer || !scene) return null;
  // La foto es de su mundo, sin él: Uku queda delante, nítido, no repetido en el fondo
  try { const sv = shadow.visible; shadow.visible = false; renderer.render(scene, camera); const u = renderer.domElement.toDataURL('image/png'); shadow.visible = sv; return u; } catch (e) { return null; }
}
// El encuadre se mueve con suavidad hacia su destino; con `instant` salta de una (antes de mostrarse)
export function setShift(f, fy, instant) { shiftTo = { x: +f || 0, y: +fy || 0 }; if (instant) { shiftCur.x = shiftTo.x; shiftCur.y = shiftTo.y; camVel.x = camVel.y = 0; if (camera) applyShift(); } }
// La cámara se aleja (z > 1) o se acerca; sirve para que la cara de Uku quepa donde hay sitio
// Plano general: la cámara se aleja y sube para que se vea el mundo de Uku entero
export function setPlano(on) { plano = !!on; }
export function setZoom(z, instant) { zoomTo = Math.max(.8, Math.min(1.8, +z || 1)); if (instant) { zoomCur = zoomTo; camVel.z = 0; } }
// Primer plano (true): Uku se detiene, te mira y no pasea; libre (false): pasea y la cámara orbita
export function setFront(on) { front = !!on; }
// Dónde está su cara en pantalla (px del contenedor): centro, radio aproximado y el encuadre actual.
// Con esto, la app calcula un corrimiento para que nada le tape la cara.
const _h1 = new THREE.Vector3(), _h2 = new THREE.Vector3(), _camUp = new THREE.Vector3();
export function head() {
  if (!bear || !bones.head || !host || !camera) return null;
  const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return null;
  bones.head.getWorldPosition(_h1);
  const top = bones.headTop; if (top) top.getWorldPosition(_h2); else _h2.copy(_h1).add(_camUp.set(0, 1, 0).multiplyScalar(.2 * BEAR_S));
  _h1.project(camera); _h2.project(camera);
  const x1 = (_h1.x + 1) / 2 * w, y1 = (1 - _h1.y) / 2 * h, x2 = (_h2.x + 1) / 2 * w, y2 = (1 - _h2.y) / 2 * h;
  const r = Math.hypot(x2 - x1, y2 - y1) * .62; // la mitad de cuello a coronilla, con margen para las orejas
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2, r, shiftX: shiftCur.x, shiftY: shiftCur.y, zoom: zoomCur, shiftToX: shiftTo.x, shiftToY: shiftTo.y, zoomTo };
}
export function setMood(m) { mood = ['feliz', 'tranquilo', 'pensativo'].includes(m) ? m : null; }
export function isReady() { return !!bear; }
export function detach(el) { if (host === el) { host = null; } }
export function supported() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
