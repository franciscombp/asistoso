/* =====================================================================
   Uku · efectos en el mundo 3D
   Los globos, los corazones, el confeti, los fuegos, las flores, el sol y
   los emojis de las reacciones ya no son una capa 2D pegada a la pantalla:
   son objetos de la escena (three.js, la misma de Uku y su claro). Viven en
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
      for (let i = 0; i < 18; i++) sprite(pick(['🌼', '🌻', '🌷', '🌱']), r(.2, .34), punto(sx + r(-.03, .03), sy, d - r(.3, 1)), { vida: 2.4, v: new THREE.Vector3(r(-.7, .7), r(1.6, 2.8), r(-.2, .2)), g: -3.2 });
    },
    // Sol: un resplandor con rayos allá al fondo, que sube y se apaga
    sol(sx, sy, d) {
      const m = new THREE.SpriteMaterial({ map: solTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), o = new THREE.Sprite(m);
      o.position.copy(punto(.5, .22, d + 3.4)); o.scale.set(7, 7, 1);
      agregar({ o, tipo: 'especial', vida: 2.6, update: (p) => { m.opacity = Math.sin(Math.min(1, p.t / p.vida) * Math.PI) * .95; m.rotation = p.t * .25; o.scale.setScalar(7 + p.t * .6); } });
    }
  };
  // Los de emojis (efectos.js › EMOJIS), más los que antes eran ráfagas
  const TABLA = Object.assign({
    like: { e: ['👍'], modo: 'sube', n: 9 }, nomegusta: { e: ['👎'], modo: 'explota', n: 6 }, ok: { e: ['👌'], modo: 'sube', n: 7 }
  }, EMOJIS);
  function emojis(cfg, sx, sy, d) {
    if (cfg.grande) { sprite(cfg.e[0], .95, punto(sx, sy - .03, d - .9), { vida: 2, pop: true, v: new THREE.Vector3(0, .15, 0) }); return; }
    for (let i = 0; i < cfg.n; i++) {
      const e = pick(cfg.e), size = r(.2, .4);
      if (cfg.modo === 'cae') sprite(e, size, punto(r(.02, .98), -.1, d + r(-1.3, .8)), { vida: 6.5, v: new THREE.Vector3(r(-.12, .12), -r(.5, 1.1), 0) });
      else if (cfg.modo === 'sube') sprite(e, size, punto(sx + r(-.05, .05), sy + r(-.02, .03), d - r(.2, 1)), { vida: r(1.8, 2.8), v: new THREE.Vector3(r(-.5, .5), r(.9, 1.8), r(-.2, .2)), g: -.35 });
      else { const a = r(0, 6.283), v = r(.8, 2.2); sprite(e, size, punto(sx, sy, d - r(.2, .9)), { vida: r(1.5, 2.4), v: new THREE.Vector3(Math.cos(a) * v, Math.sin(a) * v + .5, r(-.3, .3)), g: -1.5 }); }
    }
    sprite(cfg.e[0], .75, punto(sx, sy - .04, d - .9), { vida: 1.5, pop: true, v: new THREE.Vector3(0, .2, 0) }); // uno grande que «salta» primero
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

  return { lanzar, get activos() { return P.length; }, limpiar() { P.slice().forEach(quitar); P.length = 0; } };
}
