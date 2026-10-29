/* =====================================================================
   Uku · efectos en el mundo 3D
   Los globos, los corazones, el confeti, los fuegos, las flores, el sol y
   todas las reacciones son objetos 3D del mundo de Uku (three.js, la misma
   escena de su claro): piezas modeladas con el estilo del claro (colores
   planos, volumen, un borde azul marino), no imágenes ni emojis. Estrellas,
   notas, gotas, copos, tarro de miel, abeja, flores, tazas, trofeos,
   pasteles, regalos, rayos, lunas, zetas… Viven en
   el espacio: tienen profundidad, pasan delante o detrás de Uku y de los
   árboles, se alejan con la niebla y se mueven con la cámara.
   Misma interfaz que efectos.js: lanzar(tipo, { x, y }) con x, y en 0–1 de la
   pantalla (por dónde está la mano) y activos.
   ===================================================================== */
import { EMOJIS } from './efectos.js?v=__BUILD__';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const AMARILLOS = ['#ffdd00', '#ffc400', '#ffd200', '#ffe14d']; // los corazones, siempre amarillos
const GLOBOS = ['#ffdd00', '#ffc400', '#ffd200', '#2c4f9e', '#5f78a8', '#ffdd00'];
const CONFETI = ['#ffdd00', '#ffd200', '#f7d96b', '#c9d3e6', '#2c4f9e', '#ffffff'];
const MARINO = '#0f265c';
const K = .42; // Uku mide ~.5 en este mundo: los tamaños de abajo son «de pantalla» y se escalan a esa medida
const r = (a, b) => a + Math.random() * (b - a);
const pick = (l) => l[Math.floor(Math.random() * l.length)];

export function crearEfectos3d(b3d) {
  const { THREE, scene, camera } = b3d.mundo3d();
  const grupo = new THREE.Group(); grupo.name = 'efectos'; scene.add(grupo);
  const P = [];                       // lo que está vivo
  const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _ejeY = new THREE.Vector3(0, 1, 0), _ejeZ = new THREE.Vector3(0, 0, 1);

  /* ---------- De la pantalla al mundo ---------- */
  const dUku = () => { const u = b3d.mundo3d().uku; return u ? camera.position.distanceTo(u.position) : 3; };
  // Un punto del mundo que se ve en (sx, sy) de la pantalla, a `prof` metros de la cámara
  function punto(sx, sy, prof) {
    camera.updateMatrixWorld();
    _v.set(sx * 2 - 1, -(sy * 2 - 1), .5).unproject(camera);
    _d.copy(_v).sub(camera.position).normalize();
    return camera.position.clone().addScaledVector(_d, prof);
  }

  /* ---------- Materiales y formas que se comparten ---------- */
  const MATS = {};
  const basico = (c, o) => MATS[c + JSON.stringify(o || '')] || (MATS[c + JSON.stringify(o || '')] = new THREE.MeshBasicMaterial(Object.assign({ color: c }, o)));
  const contorno = new THREE.MeshBasicMaterial({ color: MARINO, side: THREE.BackSide, transparent: true, opacity: .4 });
  const hilo = new THREE.MeshBasicMaterial({ color: MARINO, transparent: true, opacity: .45 });
  const texturas = {};
  function lienzo(w, h, pintar) { const c = document.createElement('canvas'); c.width = w; c.height = h; pintar(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  const emojiTex = (e) => texturas[e] || (texturas[e] = lienzo(128, 128, (g) => { g.font = '100px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 64, 70); }));
  const puntoTex = () => texturas.punto || (texturas.punto = lienzo(64, 64, (g) => { const d = g.createRadialGradient(32, 32, 0, 32, 32, 32); d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(.4, 'rgba(255,255,255,.8)'); d.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = d; g.fillRect(0, 0, 64, 64); }));
  const solTex = () => texturas.sol || (texturas.sol = lienzo(256, 256, (g) => {
    const d = g.createRadialGradient(128, 128, 0, 128, 128, 128); d.addColorStop(0, 'rgba(255,230,120,.95)'); d.addColorStop(.35, 'rgba(255,221,0,.45)'); d.addColorStop(1, 'rgba(255,221,0,0)');
    g.fillStyle = d; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; g.save(); g.translate(128, 128); g.rotate(a); const l = g.createLinearGradient(0, 0, 0, -128); l.addColorStop(0, 'rgba(255,221,0,.5)'); l.addColorStop(1, 'rgba(255,221,0,0)'); g.fillStyle = l; g.beginPath(); g.moveTo(-5, 0); g.lineTo(5, 0); g.lineTo(1.5, -128); g.lineTo(-1.5, -128); g.fill(); g.restore(); }
  }));

  // Corazón con volumen (una forma extruida con bisel) y su silueta azul detrás
  const CORAZON = (() => {
    const s = new THREE.Shape();
    s.moveTo(.25, .25); s.bezierCurveTo(.25, .25, .2, 0, 0, 0); s.bezierCurveTo(-.3, 0, -.3, .35, -.3, .35); s.bezierCurveTo(-.3, .55, -.1, .77, .25, .95);
    s.bezierCurveTo(.6, .77, .8, .55, .8, .35); s.bezierCurveTo(.8, .35, .8, 0, .5, 0); s.bezierCurveTo(.35, 0, .25, .25, .25, .25);
    const g = new THREE.ExtrudeGeometry(s, { depth: .12, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 3, curveSegments: 14 });
    g.translate(-.25, -.475, -.1); g.rotateZ(Math.PI); return g; // la forma venía con la punta hacia arriba
  })();
  const GLOBO = new THREE.SphereGeometry(.5, 18, 14), NUDO = new THREE.ConeGeometry(.07, .13, 6), HILO = new THREE.CylinderGeometry(.007, .007, 1.3, 4);
  const PLANO = new THREE.PlaneGeometry(.055, .034);

  /* ---------- Ciclo de vida ---------- */
  function quitar(p) {
    grupo.remove(p.o);
    if (p.dispose) p.dispose();
    if (p.o.material && p.o.material.isSpriteMaterial) p.o.material.dispose();
  }
  function agregar(p) { P.push(Object.assign({ v: new THREE.Vector3(), g: 0, t: 0, vida: 2, s: 1, pop: false, spin: 0, fase: Math.random() * 6.28 }, p)); grupo.add(p.o); return p; }
  const ent = (p) => Math.min(1, p.t * 6);                       // aparece con un saltito
  const sal = (p) => Math.max(0, Math.min(1, (p.vida - p.t) / .45)); // y se encoge al irse
  const pop = (p) => (1 + Math.sin(Math.min(1, p.t * 4) * Math.PI) * .25) * ent(p);

  /* ---------- Piezas ---------- */
  function sprite(e, size, pos, extra) {
    const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(e), transparent: true, depthWrite: false }));
    o.position.copy(pos); size *= K; o.scale.set(size, size, 1);
    return agregar(Object.assign({ o, tipo: 'sprite', size }, extra));
  }
  function corazon(color, size, pos, extra) {
    const o = new THREE.Group(), c = new THREE.Mesh(CORAZON, basico(color)), f = new THREE.Mesh(CORAZON, contorno);
    f.scale.setScalar(1.12); o.add(f, c); o.position.copy(pos);
    return agregar(Object.assign({ o, tipo: 'malla', size: size * K, vira: true }, extra));
  }
  function globo(color, size, pos, extra) {
    const o = new THREE.Group(), cuerpo = new THREE.Mesh(GLOBO, basico(color)), borde = new THREE.Mesh(GLOBO, contorno), nudo = new THREE.Mesh(NUDO, basico(color)), cuerda = new THREE.Mesh(HILO, hilo);
    cuerpo.scale.set(1, 1.2, 1); borde.scale.set(1.07, 1.27, 1.07); nudo.position.y = -.66; nudo.rotation.z = Math.PI; cuerda.position.y = -1.3;
    const brillo = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), basico('#ffffff', { transparent: true, opacity: .55 })); brillo.position.set(-.2, .25, .43); brillo.scale.set(.8, 1.5, .5);
    o.add(borde, cuerpo, nudo, cuerda, brillo); o.position.copy(pos);
    return agregar(Object.assign({ o, tipo: 'malla', size: size * K, vira: false, bambolea: true }, extra));
  }

  /* ---------- Piezas 3D de las reacciones ----------
     Cada pieza es un grupo de mallas de ~1 de alto, centrado, con su borde azul marino detrás (como los corazones y los
     globos). Las siluetas planas (estrella, rayo, zeta, signos, nota) se extruyen con bisel para que tengan volumen. Las
     geometrías se hacen una vez y se comparten. */
  const C = { amarillo: '#ffdd00', oro: '#f2c94c', miel: '#f2b632', marino: MARINO, azul: '#2c4f9e', celeste: '#9fb8e6', crema: '#efe9df', blanco: '#ffffff',
    gris: '#aeb6c7', piedra: '#9aa2b2', rosa: '#f29bb0', rojo: '#e2574c', verde: '#9fbf7a', hoja: '#7fa86a', cafe: '#8a6a4a', cafeOsc: '#5b4632' };
  const GEOS = {};
  const geoDe = (k, f) => GEOS[k] || (GEOS[k] = f());
  const extruir = (shape, depth = .16) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .04, bevelSize: .035, bevelSegments: 2, curveSegments: 12 }); g.center(); return g; };
  const forma = (pts) => { const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(([x, y]) => sh.lineTo(x, y)); sh.closePath(); return sh; };
  // Una malla con su borde detrás (borde = false para piezas chicas o translúcidas)
  function m(geo, color, pos, rot, esc, borde = true, extra) {
    const g = new THREE.Group(), c = new THREE.Mesh(geo, basico(color, extra));
    g.add(c);
    if (borde) { const b = new THREE.Mesh(geo, contorno); b.scale.setScalar(1.1); g.add(b); }
    if (pos) g.position.set(...pos);
    if (rot) g.rotation.set(...rot);
    if (esc) { if (typeof esc === 'number') g.scale.setScalar(esc); else g.scale.set(...esc); }
    return g;
  }
  const ESTRELLA = () => geoDe('estrella', () => { const pts = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? .22 : .5; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); } return extruir(forma(pts), .14); });
  const RAYO = () => geoDe('rayo', () => extruir(forma([[.08, .5], [-.22, -.02], [-.02, -.02], [-.1, -.5], [.24, .08], [.03, .08], [.16, .5]]), .12));
  const ZETA = () => geoDe('zeta', () => extruir(forma([[-.3, .4], [.3, .4], [.3, .28], [-.1, -.28], [.3, -.28], [.3, -.4], [-.3, -.4], [-.3, -.28], [.1, .28], [-.3, .28]]), .12));
  const CHECK = () => geoDe('check', () => extruir(forma([[-.42, .02], [-.28, .16], [-.1, -.04], [.3, .4], [.44, .26], [-.1, -.32]]), .14));
  const CRUZ = () => geoDe('cruz', () => { const g = extruir(forma([[-.1, .4], [.1, .4], [.1, .1], [.4, .1], [.4, -.1], [.1, -.1], [.1, -.4], [-.1, -.4], [-.1, -.1], [-.4, -.1], [-.4, .1], [-.1, .1]]), .14); g.rotateZ(Math.PI / 4); return g; });
  const GOTA = () => geoDe('gota', () => { const sh = new THREE.Shape(); sh.moveTo(0, .5); sh.bezierCurveTo(.12, .3, .34, .05, .34, -.14); sh.absarc(0, -.14, .34, 0, Math.PI, true); sh.bezierCurveTo(-.34, .05, -.12, .3, 0, .5); return extruir(sh, .2); });
  const NOTA = () => geoDe('nota', () => { const sh = new THREE.Shape(); sh.absellipse(-.12, -.32, .17, .13, 0, Math.PI * 2, false, -.4); return extruir(sh, .12); });
  const LUNA = () => geoDe('luna', () => new THREE.TorusGeometry(.32, .13, 10, 24, Math.PI * 1.25));
  const SPH = (n) => geoDe('sph' + n, () => new THREE.SphereGeometry(.5, n, Math.max(6, n - 4)));
  const CIL = (rt, rb, h, n = 18) => geoDe(`cil${rt}_${rb}_${h}_${n}`, () => new THREE.CylinderGeometry(rt, rb, h, n));
  const CAJA = (x, y, z) => geoDe(`caja${x}_${y}_${z}`, () => new THREE.BoxGeometry(x, y, z));
  const TORO = (r1, r2, arc = Math.PI * 2) => geoDe(`toro${r1}_${r2}_${arc}`, () => new THREE.TorusGeometry(r1, r2, 8, 20, arc));
  const PIEZAS = {
    estrella: () => m(ESTRELLA(), pick([C.amarillo, C.oro, C.amarillo])),
    chispa: () => m(geoDe('chispa', () => new THREE.OctahedronGeometry(.32)), pick([C.amarillo, C.blanco, C.oro]), null, null, [.7, 1.2, .7], false),
    corazonP: () => { const g = new THREE.Group(), cc = new THREE.Mesh(CORAZON, basico(pick(AMARILLOS))), b = new THREE.Mesh(CORAZON, contorno); b.scale.setScalar(1.12); g.add(b, cc); g.scale.setScalar(.9); return g; },
    rayo: () => m(RAYO(), C.amarillo),
    zeta: () => m(ZETA(), pick([C.celeste, C.blanco])),
    check: () => m(CHECK(), C.verde),
    cruz: () => m(CRUZ(), C.rojo),
    gota: () => m(GOTA(), C.celeste),
    luna: () => m(LUNA(), C.amarillo, null, [0, 0, -.6]),
    nota: () => { const g = new THREE.Group(); g.add(m(NOTA(), C.marino, null, null, null, false), m(CAJA(.06, .62, .06), C.marino, [.03, 0, 0], null, null, false), m(CAJA(.24, .07, .06), C.marino, [.14, .28, 0], [0, 0, -.35], null, false)); return g; },
    exclama: () => { const g = new THREE.Group(); g.add(m(CAJA(.16, .56, .16), C.rojo, [0, .12, 0]), m(SPH(10), C.rojo, [0, -.36, 0], null, .2)); return g; },
    pregunta: () => { const g = new THREE.Group(); g.add(m(TORO(.2, .07, Math.PI * 1.4), C.azul, [0, .2, 0], [0, 0, -.6]), m(CAJA(.12, .2, .12), C.azul, [.02, -.1, 0]), m(SPH(10), C.azul, [.02, -.36, 0], null, .17)); return g; },
    copo: () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) g.add(m(CAJA(.9, .08, .08), C.blanco, null, [0, 0, i * Math.PI / 3], null, false)); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.add(m(SPH(8), C.celeste, [Math.cos(a) * .45, Math.sin(a) * .45, 0], null, .14, false)); } return g; },
    burbuja: () => m(SPH(14), C.celeste, null, null, .7, false, { transparent: true, opacity: .55 }),
    nube: () => { const g = new THREE.Group(); [[-.25, -.05, .32], [.05, .08, .4], [.32, -.06, .3], [0, -.16, .3]].forEach(([x, y, rr]) => g.add(m(SPH(12), C.gris, [x, y, 0], null, rr * 2, false))); return g; },
    flor: () => { const c = pick([C.amarillo, C.oro, C.rosa, C.blanco]), g = new THREE.Group(); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.add(m(SPH(10), c, [Math.cos(a) * .24, Math.sin(a) * .24, 0], null, [.34, .34, .14], false)); } g.add(m(SPH(10), C.miel, [0, 0, .04], null, [.26, .26, .2], false)); return g; },
    hoja: () => m(SPH(10), pick([C.verde, C.hoja]), null, [0, 0, .6], [.4, .8, .12], false),
    brote: () => { const g = new THREE.Group(); g.add(m(CIL(.03, .03, .4, 6), C.hoja, [0, -.15, 0], null, null, false), m(SPH(10), C.verde, [-.13, .08, 0], [0, 0, .7], [.32, .16, .12], false), m(SPH(10), C.verde, [.13, .1, 0], [0, 0, -.7], [.32, .16, .12], false)); return g; },
    miel: () => { const g = new THREE.Group(); g.add(m(CIL(.3, .32, .55), C.miel, [0, -.08, 0]), m(CIL(.33, .33, .12), C.azul, [0, .26, 0]), m(CIL(.31, .31, .2, 18), C.crema, [0, -.06, .02], null, [1, 1, 1.02], false), m(SPH(10), C.miel, [.12, .34, .1], null, [.18, .1, .18], false)); return g; },
    abeja: () => { const g = new THREE.Group(); g.add(m(SPH(14), C.amarillo, null, null, [.62, .46, .46])); [-.1, .1].forEach(x => g.add(m(CIL(.235, .235, .07, 16), C.marino, [x, 0, 0], [0, 0, Math.PI / 2], null, false))); [-.08, .1].forEach((x, i) => g.add(m(SPH(10), C.blanco, [x, .26, 0], [0, 0, i ? -.5 : .5], [.18, .3, .06], false, { transparent: true, opacity: .85 }))); g.add(m(SPH(8), C.marino, [.28, .05, .12], null, .07, false)); return g; },
    taza: () => { const g = new THREE.Group(); g.add(m(CIL(.3, .24, .42), C.crema, [0, -.08, 0]), m(TORO(.13, .045), C.crema, [.32, -.06, 0], null, null, false), m(CIL(.27, .27, .03), C.cafeOsc, [0, .13, 0], null, null, false)); [-.08, .08].forEach((x, i) => g.add(m(TORO(.07, .02, Math.PI), C.blanco, [x, .3 + i * .06, 0], [0, 0, i ? Math.PI : 0], null, false))); return g; },
    trofeo: () => { const g = new THREE.Group(); g.add(m(CIL(.3, .14, .4), C.oro, [0, .14, 0]), m(CIL(.05, .05, .2), C.oro, [0, -.16, 0]), m(CAJA(.36, .1, .22), C.cafe, [0, -.3, 0]), m(TORO(.12, .035, Math.PI), C.oro, [-.3, .18, 0], [0, 0, Math.PI / 2], null, false), m(TORO(.12, .035, Math.PI), C.oro, [.3, .18, 0], [0, 0, -Math.PI / 2], null, false)); return g; },
    pastel: () => { const g = new THREE.Group(); g.add(m(CIL(.4, .4, .26), C.crema, [0, -.2, 0]), m(CIL(.3, .3, .2), C.rosa, [0, .02, 0]), m(CIL(.03, .03, .2, 8), C.azul, [0, .22, 0], null, null, false), m(geoDe('llama', () => new THREE.ConeGeometry(.05, .12, 8)), C.amarillo, [0, .38, 0], null, null, false)); return g; },
    regalo: () => { const g = new THREE.Group(); g.add(m(CAJA(.56, .46, .56), pick([C.azul, C.rosa, C.amarillo]), [0, -.06, 0]), m(CAJA(.1, .48, .58), C.crema, [0, -.06, 0], null, null, false), m(CAJA(.58, .48, .1), C.crema, [0, -.06, 0], null, null, false), m(TORO(.1, .04), C.crema, [-.08, .24, 0], [0, .6, .4], null, false), m(TORO(.1, .04), C.crema, [.08, .24, 0], [0, -.6, -.4], null, false)); return g; },
    guitarra: () => { const g = new THREE.Group(); g.add(m(SPH(14), C.rojo, [0, -.22, 0], null, [.52, .46, .16]), m(SPH(14), C.rojo, [0, .02, 0], null, [.38, .34, .14]), m(CAJA(.08, .5, .06), C.cafeOsc, [0, .34, 0], null, null, false), m(CIL(.07, .07, .03, 12), C.cafeOsc, [0, -.18, .08], [Math.PI / 2, 0, 0], null, false)); g.rotation.z = -.5; return g; },
    coco: () => { const g = new THREE.Group(); g.add(m(SPH(12), C.cafe, null, null, .6)); [[-.08, .12], [.08, .12], [0, -.02]].forEach(([x, y]) => g.add(m(SPH(6), C.cafeOsc, [x, y, .28], null, .07, false))); return g; },
    ola: () => m(TORO(.3, .1, Math.PI), C.celeste, null, [0, 0, .2]),
    manzana: () => { const g = new THREE.Group(); g.add(m(SPH(14), C.rojo, [0, -.04, 0], null, [.6, .56, .56]), m(CIL(.025, .025, .14, 6), C.cafeOsc, [0, .3, 0], null, null, false), m(SPH(8), C.verde, [.1, .32, 0], [0, 0, -.6], [.16, .08, .06], false)); return g; },
    piedra: () => m(geoDe('piedra', () => new THREE.DodecahedronGeometry(.42, 0)), C.piedra, null, [.3, .5, 0], [1.1, .8, .9]),
    papel: () => { const g = new THREE.Group(); g.add(m(CAJA(.62, .8, .03), C.blanco, null, [0, 0, .12])); [-.18, -.04, .1, .24].forEach(y => g.add(m(CAJA(.42, .025, .035), C.gris, [0, y, .02], [0, 0, .12], null, false))); return g; },
    tijera: () => { const g = new THREE.Group(); g.add(m(CAJA(.08, .62, .05), C.gris, [0, .12, 0], [0, 0, .32], null, false), m(CAJA(.08, .62, .05), C.gris, [0, .12, .02], [0, 0, -.32], null, false), m(TORO(.11, .04), C.rojo, [-.14, -.28, 0], null, null, false), m(TORO(.11, .04), C.rojo, [.14, -.28, 0], null, null, false)); return g; },
    trebol: () => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const h = new THREE.Mesh(CORAZON, basico(C.verde)); h.scale.setScalar(.5); h.rotation.z = i * Math.PI / 2; h.position.set(Math.sin(i * Math.PI / 2) * .2, -Math.cos(i * Math.PI / 2) * .2, 0); g.add(h); } return g; },
    globoP: () => { const g = new THREE.Group(); g.add(m(SPH(16), pick(GLOBOS), null, null, [.6, .72, .6]), m(geoDe('nudo', () => new THREE.ConeGeometry(.05, .1, 6)), MARINO, [0, -.4, 0], [Math.PI, 0, 0], null, false)); return g; }
  };
  // pieza(nombre, tamaño, posición, extra): una pieza del mundo que vive como las demás (sube, cae o explota y gira)
  function pieza(nombre, size, pos, extra) {
    const o = (PIEZAS[nombre] || PIEZAS.estrella)();
    o.position.copy(pos);
    return agregar(Object.assign({ o, tipo: 'malla', size: size * K, vira: true, vuelta: r(1, 2.2) }, extra));
  }

  /* ---------- Emisores ---------- */
  const EMISORES = {
    // Un corazón grande que late donde está la mano y una lluvia de corazones que sube
    corazon(sx, sy, d) {
      corazon('#ffdd00', .75, punto(sx, sy - .06, d - .9), { vida: 1.9, v: new THREE.Vector3(0, .18, 0), latido: true });
      for (let i = 0; i < 18; i++) corazon(pick(AMARILLOS), r(.2, .42), punto(sx + r(-.05, .05), sy + r(-.03, .04), d - r(.2, 1)), { vida: r(2.6, 3.6), v: new THREE.Vector3(r(-.5, .5), r(.8, 1.7), r(-.2, .2)), g: -.18 });
      for (let i = 0; i < 16; i++) corazon(pick(AMARILLOS), r(.18, .4), punto(r(.02, .98), 1.06, d + r(-1.4, .8)), { vida: 5, v: new THREE.Vector3(r(-.1, .1), r(.55, 1), 0), g: .02 });
    },
    // Globos que suben desde abajo, a distintas profundidades: unos pasan delante de Uku y otros por detrás
    globos(sx, sy, d) {
      for (let i = 0; i < 24; i++) globo(pick(GLOBOS), r(.24, .4), punto(r(.04, .96), 1.12, d + r(-1.4, .9)), { vida: 6, v: new THREE.Vector3(r(-.08, .08), r(.7, 1.25), 0), g: 0 });
    },
    confeti(sx, sy, d) {
      const N = 240, geo = PLANO, mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), im = new THREE.InstancedMesh(geo, mat, N), col = new THREE.Color(), m4 = new THREE.Matrix4();
      const S = Array.from({ length: N }, (_, i) => { const p = punto(r(-.05, 1.05), r(-.7, -.05), d + r(-1.5, .9)); im.setColorAt(i, col.set(pick(CONFETI))); return { p, v: new THREE.Vector3(r(-.15, .15), -r(.45, 1.0), r(-.1, .1)), a: r(0, 6.3), w: r(-7, 7), f: r(0, 6.3), k: r(.8, 1.6) }; });
      const o = new THREE.Group(); o.add(im);
      agregar({ o, tipo: 'especial', vida: 6.5, dispose: () => { geo !== PLANO && geo.dispose(); mat.dispose(); im.dispose(); }, update: (p, dt) => {
        S.forEach((c, i) => { c.p.addScaledVector(c.v, dt); c.a += c.w * dt; c.p.x += Math.sin(p.t * 2 + c.f) * .1 * dt;
          _q.setFromAxisAngle(_ejeZ, c.a); _q2.setFromAxisAngle(_ejeY, p.t * 3 + c.f); _q.multiply(_q2);
          m4.compose(c.p, _q, _v.set(c.k * .8, c.k * .8, c.k * .8)); im.setMatrixAt(i, m4); });
        im.instanceMatrix.needsUpdate = true; } });
    },
    // Fuegos artificiales: seis estallidos de chispas en el cielo, a distinta distancia
    fuegos(sx, sy, d) {
      for (let k = 0; k < 6; k++) setTimeout(() => {
        const N = 70, c = punto(r(.15, .85), r(.1, .45), d + r(0, 1.8)), pos = new Float32Array(N * 3), vel = [];
        for (let i = 0; i < N; i++) { const a = r(0, 6.283), b = Math.acos(r(-1, 1)), v = r(.5, 1.4); vel.push(new THREE.Vector3(Math.sin(b) * Math.cos(a) * v, Math.cos(b) * v, Math.sin(b) * Math.sin(a) * v)); pos[i * 3] = c.x; pos[i * 3 + 1] = c.y; pos[i * 3 + 2] = c.z; }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const m = new THREE.PointsMaterial({ map: puntoTex(), color: pick(['#ffdd00', '#ffe680', '#ffffff', '#c9d3e6']), size: .06, transparent: true, depthWrite: false });
        agregar({ o: new THREE.Points(g, m), tipo: 'especial', vida: 1.8, dispose: () => { g.dispose(); m.dispose(); }, update: (p, dt) => {
          const a = g.attributes.position; vel.forEach((v, i) => { v.y -= .9 * dt; a.setXYZ(i, a.getX(i) + v.x * dt, a.getY(i) + v.y * dt, a.getZ(i) + v.z * dt); }); a.needsUpdate = true; m.opacity = sal(p); } });
      }, k * 380);
    },
    // Flores que saltan de la mano y caen girando: crece un jardín
    jardin(sx, sy, d) {
      for (let i = 0; i < 18; i++) pieza(pick(['flor', 'flor', 'hoja', 'brote']), r(.2, .34), punto(sx + r(-.03, .03), sy, d - r(.3, 1)), { vida: 2.4, v: new THREE.Vector3(r(-.7, .7), r(1.6, 2.8), r(-.2, .2)), g: -3.2 });
    },
    // Sol: un resplandor con rayos allá al fondo, que sube y se apaga
    sol(sx, sy, d) {
      const m = new THREE.SpriteMaterial({ map: solTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), o = new THREE.Sprite(m);
      o.position.copy(punto(.5, .22, d + 3.4)); o.scale.set(7, 7, 1);
      agregar({ o, tipo: 'especial', vida: 2.6, update: (p) => { m.opacity = Math.sin(Math.min(1, p.t / p.vida) * Math.PI) * .95; m.rotation = p.t * .25; o.scale.setScalar(7 + p.t * .6); } });
    }
  };
  /* Cada reacción: qué piezas 3D salen (la primera es la grande que «salta» primero), cómo se mueven (sube, cae, explota)
     y cuántas. Las mismas claves que EMOJIS de efectos.js (que queda solo para la capa 2D, sin WebGL). */
  const TABLA3D = {
    like: { p: ['estrella', 'chispa'], modo: 'sube', n: 9 }, nomegusta: { p: ['nube', 'gota'], modo: 'explota', n: 6 }, ok: { p: ['check', 'chispa'], modo: 'sube', n: 7 },
    miel: { p: ['miel', 'abeja', 'gota'], modo: 'cae', n: 16 }, hambre: { p: ['manzana', 'miel', 'taza'], modo: 'cae', n: 14 },
    beso: { p: ['corazonP', 'corazonP', 'chispa'], modo: 'sube', n: 12 }, risa: { p: ['burbuja', 'chispa', 'estrella'], modo: 'sube', n: 14 },
    estrellas: { p: ['estrella', 'chispa'], modo: 'explota', n: 22 }, aplausos: { p: ['chispa', 'estrella'], modo: 'explota', n: 16 },
    rock: { p: ['guitarra', 'rayo', 'nota'], modo: 'explota', n: 14 }, censura: { p: ['nube', 'cruz'], modo: 'cae', n: 14 },
    surf: { p: ['ola', 'coco', 'gota'], modo: 'cae', n: 14 }, rezo: { p: ['estrella', 'chispa', 'luna'], modo: 'sube', n: 12 },
    lengua: { p: ['chispa', 'estrella', 'burbuja'], modo: 'explota', n: 9 }, guino: { p: ['estrella', 'chispa'], modo: 'sube', n: 8 },
    bostezo: { p: ['zeta', 'zeta', 'luna'], modo: 'sube', n: 9 }, sorpresa: { p: ['exclama', 'pregunta', 'chispa'], modo: 'explota', n: 10 },
    cruzados: { p: ['cruz', 'exclama'], modo: 'explota', n: 8 }, mano: { p: ['pregunta', 'chispa'], modo: 'sube', n: 6 },
    poquito: { p: ['miel', 'gota'], modo: 'sube', n: 9 }, tres: { p: ['estrella', 'chispa'], modo: 'explota', n: 8 }, cuatro: { p: ['trebol', 'chispa'], modo: 'explota', n: 8 },
    choca: { p: ['estrella', 'chispa', 'rayo'], modo: 'explota', n: 12 }, musica: { p: ['nota', 'nota', 'estrella'], modo: 'sube', n: 14 },
    nieve: { p: ['copo', 'copo', 'burbuja'], modo: 'cae', n: 26 }, cumple: { p: ['pastel', 'regalo', 'globoP', 'estrella'], modo: 'cae', n: 18 },
    cafe: { p: ['taza', 'chispa'], modo: 'sube', n: 9 }, sueno: { p: ['zeta', 'luna', 'estrella'], modo: 'sube', n: 12 },
    sonrisa: { p: ['flor', 'corazonP', 'estrella'], modo: 'sube', n: 10 }, enojo: { p: ['nube', 'rayo'], modo: 'explota', n: 8 },
    abrazo: { p: ['corazonP', 'corazonP', 'estrella'], modo: 'sube', n: 12 }, si: { p: ['check', 'chispa'], modo: 'sube', n: 6 }, no: { p: ['cruz', 'nube'], modo: 'explota', n: 6 },
    piedra: { p: ['piedra'], modo: 'explota', n: 1, grande: true }, papel: { p: ['papel'], modo: 'explota', n: 1, grande: true }, tijera: { p: ['tijera'], modo: 'explota', n: 1, grande: true },
    trofeo: { p: ['trofeo', 'estrella', 'chispa'], modo: 'explota', n: 14 }
  };
  // Lo que no tenga pieza todavía sale como antes (emoji), para no perder ninguna reacción
  const TABLA = Object.assign({}, EMOJIS, TABLA3D);
  function emojis(cfg, sx, sy, d) {
    const sale = cfg.p ? pieza : sprite, lista = cfg.p || cfg.e;
    if (cfg.grande) { sale(lista[0], .95, punto(sx, sy - .03, d - .9), { vida: 2, pop: true, v: new THREE.Vector3(0, .15, 0) }); return; }
    for (let i = 0; i < cfg.n; i++) {
      const e = pick(lista), size = r(.2, .38);
      if (cfg.modo === 'cae') sale(e, size, punto(r(.02, .98), -.1, d + r(-1.3, .8)), { vida: 6.5, v: new THREE.Vector3(r(-.12, .12), -r(.5, 1.1), 0) });
      else if (cfg.modo === 'sube') sale(e, size, punto(sx + r(-.05, .05), sy + r(-.02, .03), d - r(.2, 1)), { vida: r(1.8, 2.8), v: new THREE.Vector3(r(-.5, .5), r(.9, 1.8), r(-.2, .2)), g: -.35 });
      else { const a = r(0, 6.283), v = r(.8, 2.2); sale(e, size, punto(sx, sy, d - r(.2, .9)), { vida: r(1.5, 2.4), v: new THREE.Vector3(Math.cos(a) * v, Math.sin(a) * v + .5, r(-.3, .3)), g: -1.5 }); }
    }
    sale(lista[0], .7, punto(sx, sy - .04, d - .9), { vida: 1.5, pop: true, v: new THREE.Vector3(0, .2, 0) }); // uno grande que «salta» primero
  }

  function lanzar(tipo, o = {}) {
    const sx = o.x ?? .5, sy = o.y ?? .55, d = dUku();
    if (EMISORES[tipo]) EMISORES[tipo](sx, sy, d);
    else if (TABLA[tipo]) emojis(TABLA[tipo], sx, sy, d);
  }

  /* ---------- Cada cuadro ---------- */
  function paso(dt) {
    dt = Math.min(.05, Math.max(0, dt));
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.t += dt;
      if (p.t >= p.vida) { quitar(p); P.splice(i, 1); continue; }
      if (!RM) { p.v.y += p.g * dt; p.o.position.addScaledVector(p.v, dt); }
      if (p.update) p.update(p, dt);
      if (p.tipo === 'sprite') {
        p.o.material.opacity = sal(p);
        const e = p.pop ? pop(p) : ent(p); p.o.scale.set(p.size * e, p.size * e, 1);
      } else if (p.tipo === 'malla') {
        let k = p.size * (p.latido ? (1 + Math.abs(Math.sin(p.t * 7)) * .12) : 1) * ent(p) * sal(p) * (p.latido ? 1 : 1);
        if (p.latido) k = p.size * pop(p) * (1 + Math.abs(Math.sin(p.t * 7)) * .1) * sal(p);
        p.o.scale.setScalar(Math.max(.001, k));
        // De frente a la cámara; los corazones giran sobre su eje para que se les vea el grosor
        p.o.quaternion.copy(camera.quaternion);
        if (p.vira) { _q.setFromAxisAngle(_ejeY, p.t * (p.vuelta || 1.6) + p.fase); p.o.quaternion.multiply(_q); }
        if (p.bambolea) { _q.setFromAxisAngle(_ejeZ, Math.sin(p.t * 1.6 + p.fase) * .18); p.o.quaternion.multiply(_q); p.o.position.x += Math.sin(p.t * 1.4 + p.fase) * .1 * dt; }
      }
    }
  }
  b3d.enCuadro(paso);

  return { lanzar, get activos() { return P.length; }, limpiar() { P.slice().forEach(quitar); P.length = 0; }, tipos: () => Object.keys(Object.assign({}, EMISORES, TABLA)), piezas: () => Object.keys(PIEZAS) };
}
