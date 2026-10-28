/* =====================================================================
   Uku de respaldo, hecho por código (assets/oso/uku.glb, generado por
   tools/uku/uku.py): se prueba con ?oso=nuevo o desde el laboratorio del
   mundo. El oso de siempre está en uku-rig.js. Este módulo sólo carga y
   anima al personaje; la escena
   (claro, flores, planeta) la arma bosque3d.js, que lo usa como su único oso.
   - El modelo trae el esqueleto (nombres de Mixamo) en reposo y sin clips:
     cada gesto es una función del tiempo que da el giro de cada hueso.
     Así se controla todo: la velocidad, cuánto se mueve (calm), los fundidos
     entre gestos y que los pies queden siempre apoyados en el suelo.
   - La ropa usa los mismos pesos que el cuerpo que cubre (no se deforma
     raro) y la punta de la bufanda tiene su hueso: se mece con un resorte.
   - face: ojos (abiertos, entrecerrados, cerrados, contentos) y boca
     (cerrada o abierta, para hablar).
   - loadUkuRig(container): visor independiente para verificar el modelo.
   Unidad = 1 m; Uku mide 1.
   ===================================================================== */
import * as THREE from './vendor/three/three.module.min.js';
import { GLTFLoader } from './vendor/three/jsm/loaders/GLTFLoader.js';

export const UKU_URL = './oso/uku.glb';
const key = (n) => n.replace(/[\[\].:\/]/g, ''); // three.js quita ":" de los nombres ("mixamorig:Hips" -> "mixamorigHips")

export function loadUkuGltf() {
  return new Promise((ok, fail) => new GLTFLoader().load(new URL(UKU_URL, import.meta.url).href, ok, undefined, fail));
}

/* ---------- Gestos ----------
   Cada gesto devuelve el giro (x, y, z en radianes, desde el reposo) de los huesos que mueve y la
   altura de la cadera; t es su tiempo (s). Ejes del personaje: x a su izquierda, y arriba, z al frente.
   En un hueso que cuelga (brazo, pierna), x negativo lo lleva al frente; en el tronco, x positivo
   lo inclina hacia adelante; en la cabeza, x positivo mira abajo. Brazo derecho: z negativo lo sube. */
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const S = Math.sin, C = Math.cos, PI = Math.PI;
// Pose base: de pie, tranquilo, los brazos junto al cuerpo
function base(p) {
  p.LeftArm = [0, 0, -.2]; p.RightArm = [0, 0, .2];
  p.LeftForeArm = [-.12, 0, 0]; p.RightForeArm = [-.12, 0, 0];
  return p;
}
const GESTOS = {
  // Reposo: respira, se balancea apenas de un pie al otro y mueve un poco los brazos
  idle(t) {
    const p = base({}), b = S(t * 1.25), w = S(t * .42);
    p.Spine1 = [.015 * b, 0, 0]; p.Spine2 = [.012 * b, 0, 0];
    p.Hips = [0, 0, .018 * w]; p.Spine = [0, 0, -.022 * w]; p.Neck = [-.01 * b, 0, .01 * w];
    p.Head = [.02 * S(t * .6), .03 * S(t * .31), .025 * S(t * .37 + 1)];
    p.LeftArm[2] -= .025 * b; p.RightArm[2] += .025 * b; p.LeftArm[0] = .03 * w; p.RightArm[0] = -.03 * w;
    p.y = -.003 * (1 - b);
    return p;
  },
  // Saluda: sube el brazo derecho junto a la cara y lo mueve de lado a lado, sin aspaviento
  wave(t) {
    const p = GESTOS.idle(t), up = ss(0, .45, t), sw = S(t * 6.5) * up;
    p.RightArm = [-.25 * up, -.2 * up, .2 - 2.35 * up];
    p.RightForeArm = [-.15 - .55 * up, 0, -.35 * sw];
    p.RightHand = [0, 0, -.2 * sw];
    p.Spine2 = [0, -.05 * up, .04 * up]; p.Head = [.02, -.08 * up, -.06 * up + .03 * sw];
    return p;
  },
  // Contento: un rebote suave de rodillas, los brazos un poco afuera y la cabeza de lado a lado
  happy(t) {
    const p = base({}), b = Math.abs(S(t * 4.2)), s = S(t * 2.1), o = ss(0, .3, t);
    p.LeftUpLeg = [-.1 * b, 0, 0]; p.RightUpLeg = [-.1 * b, 0, 0]; p.LeftLeg = [.2 * b, 0, 0]; p.RightLeg = [.2 * b, 0, 0]; p.LeftFoot = [-.1 * b, 0, 0]; p.RightFoot = [-.1 * b, 0, 0];
    p.LeftArm = [-.15 * o, 0, -.2 - .35 * o - .1 * b]; p.RightArm = [-.15 * o, 0, .2 + .35 * o + .1 * b];
    p.LeftForeArm = [-.5 * o, 0, 0]; p.RightForeArm = [-.5 * o, 0, 0];
    p.Spine = [0, .06 * s, .03 * s]; p.Spine2 = [-.06 * o, 0, 0]; p.Head = [-.08 * o, .06 * s, .12 * s];
    return p;
  },
  // Habla: la cabeza acompaña con pequeños asentimientos y una mano explica
  talk(t) {
    const p = GESTOS.idle(t), o = ss(0, .4, t), g = S(t * 3.1);
    p.LeftArm = [-.35 * o, 0, -.2 - .15 * o]; p.LeftForeArm = [-.9 * o - .15 * g * o, 0, .1 * g * o]; p.LeftHand = [0, .3 * g * o, 0];
    p.Head = [.05 * S(t * 4.3), .05 * S(t * 1.7), .03 * g];
    return p;
  },
  // Asiente despacio, dos veces
  nod(t) {
    const p = GESTOS.idle(t), k = ss(0, .3, t) * (1 - ss(2.4, 3, t));
    p.Neck = [.08 * k * Math.max(0, S(t * 4.6)), 0, 0]; p.Head = [.22 * k * Math.max(0, S(t * 4.6)), 0, 0];
    p.Spine2 = [.03 * k, 0, 0];
    return p;
  },
  // Pensativo: la pata derecha al mentón y la cabeza ladeada
  worried(t) {
    const p = GESTOS.idle(t), o = ss(0, .6, t) * (1 - ss(3.2, 3.8, t)), r = S(t * 1.3);
    p.RightArm = [-1.1 * o, .7 * o, .2 - .1 * o]; p.RightForeArm = [-2.05 * o, .15 * o, 0]; p.RightHand = [.3 * o, 0, 0];
    p.Head = [.1 * o + .03 * r, .12 * o, .16 * o]; p.Neck = [.05 * o, 0, .04 * o]; p.Spine2 = [.04 * o, 0, 0];
    return p;
  },
  // Caminar: piernas cortas que se alternan, la cadera sube y baja y los brazos van al revés de las piernas
  walk(t) {
    const p = base({}), f = t * 2 * PI / 1.05, sL = S(f), sR = -sL;
    [['Left', sL], ['Right', sR]].forEach(([n, s]) => {
      const lift = Math.max(0, S(f + (n === 'Left' ? .9 : .9 + PI)));
      p[n + 'UpLeg'] = [-.42 * s - .15 * lift, 0, 0]; p[n + 'Leg'] = [.55 * lift, 0, 0]; p[n + 'Foot'] = [.42 * s + .15 * lift - .55 * lift * .6, 0, 0];
    });
    p.LeftArm = [.32 * sL, 0, -.2]; p.RightArm = [.32 * sR, 0, .2]; p.LeftForeArm = [-.2 - .1 * Math.max(0, -sL), 0, 0]; p.RightForeArm = [-.2 - .1 * Math.max(0, -sR), 0, 0];
    p.Hips = [0, .09 * sL, .03 * S(f)]; p.Spine = [.04, -.06 * sL, -.03 * S(f)]; p.Spine2 = [0, -.04 * sL, 0]; p.Head = [-.03, .04 * sL, 0];
    p.y = .012 * Math.abs(C(f));
    return p;
  },
  // Plantar (7,6 s): se agacha, deja el brote con la pata derecha, aprieta la tierra con las dos, se para y lo mira
  plant(t) {
    const p = base({}), d = ss(.1, 1.2, t) * (1 - ss(5.6, 6.8, t)), pat = ss(3, 3.3, t) * (1 - ss(5.2, 5.6, t)), place = ss(1.3, 1.9, t) * (1 - ss(2.9, 3.3, t));
    p.LeftUpLeg = [-1.2 * d, 0, -.18 * d]; p.RightUpLeg = [-1.2 * d, 0, .18 * d];
    p.LeftLeg = [1.9 * d, 0, 0]; p.RightLeg = [1.9 * d, 0, 0]; p.LeftFoot = [-.7 * d, 0, 0]; p.RightFoot = [-.7 * d, 0, 0];
    p.Hips = [.2 * d, 0, 0]; p.Spine = [.25 * d, 0, 0]; p.Spine1 = [.2 * d, 0, 0]; p.Spine2 = [.12 * d, 0, 0];
    p.Neck = [.1 * d, 0, 0]; p.Head = [.25 * d + .08 * ss(6.6, 7.2, t), 0, 0];
    const tap = (ph) => Math.max(0, S(t * 7 + ph)) * pat;
    // brazos al frente y abajo: la derecha deja el brote, después las dos golpean suave la tierra
    p.RightArm = [-1.15 * d - .1 * tap(0), .2 * d, .2 - .1 * d]; p.RightForeArm = [-.45 * d - .35 * place + .3 * tap(0), 0, 0];
    p.LeftArm = [-1.0 * d - .1 * tap(PI), -.2 * d, -.2 + .1 * d]; p.LeftForeArm = [-.55 * d + .3 * tap(PI), 0, 0];
    p.y = 0;
    return p;
  }
};
// Duración natural de cada gesto (los que no terminan, se repiten)
export const GESTO_DUR = { wave: 2.6, happy: 2.4, talk: 2.2, nod: 3, worried: 3.8, plant: 7.6 };
// Los nombres de las clips de Mixamo que usaba la app siguen funcionando
const CLIP = { 'Happy Idle': 'idle', Waving: 'wave', Walking: 'walk', 'Plant A Plant': 'plant', 'Thoughtful Head Nod': 'nod', Watering: 'plant' };

/* Sobre un GLTF ya cargado: huesos, piezas, gestos y cara. No crea render ni escena. */
export function ukuFrom(gltf, { onLog = () => {} } = {}) {
  const root = gltf.scene;
  const report = { errors: [], warnings: [] };
  const skinned = [], bones = {}, nodes = {};
  root.traverse(o => {
    if (o.isSkinnedMesh) skinned.push(o);
    if (o.isBone) bones[o.name] = o;
    nodes[o.name] = nodes[o.name] || o;
  });
  ['mixamorig:Hips', 'mixamorig:Head', 'mixamorig:RightHand'].map(key).forEach(n => { if (!bones[n]) report.errors.push('hueso inexistente: ' + n); });
  const boxOf = (m) => new THREE.Box3().setFromBufferAttribute(m.geometry.attributes.position);
  const body = skinned.find(m => m.name === 'uku') || skinned[0];
  const box = skinned.map(boxOf).reduce((u, b) => u.union(b));
  onLog('Piezas: ' + skinned.map(m => m.name + ' ' + m.geometry.attributes.position.count + ' vértices').join(', '));

  const B = n => bones[key('mixamorig:' + n)];
  const hips = B('Hips'), hipsY = hips.position.y;
  const names = Object.keys(bones).map(k => k.replace(/^mixamorig/, ''));
  // Puntos que tocan el suelo: el talón (bajo el tobillo) y la punta de cada pie
  const feet = ['Left', 'Right'].map(s => ({ foot: B(s + 'Foot'), toe: B(s + 'ToeBase') }));
  const heel = new THREE.Vector3(), tip = new THREE.Vector3();

  // Gestos activos (con fundido): cada uno con su tiempo, velocidad y peso
  let layers = [], calmTo = 0, calmCur = 0, keep = null, cur = null, scarfV = 0, scarfA = 0, lastChest = 0;
  /* playClip(nombre, fundido, { speed, calm, keep }): el gesto (o el nombre de su clip de Mixamo), su
     velocidad, calm (0–1: cuánto se acerca a la pose base) y keep (RegExp): huesos fuera de la calma.
     El mismo gesto no se reinicia; solo cambia su velocidad. */
  function playClip(name, fade = .6, { speed = 1, calm = 0, keep: k = null } = {}) {
    const g = CLIP[name] || name;
    if (!GESTOS[g]) { report.errors.push('gesto inexistente: ' + name); return false; }
    calmTo = calm; keep = k;
    if (cur && cur.g === g) { cur.speed = speed; return true; }
    layers.forEach(l => { l.to = 0; l.rate = 1 / Math.max(.05, fade); });
    cur = { g, t: 0, speed, w: layers.length ? 0 : 1, to: 1, rate: 1 / Math.max(.05, fade) };
    layers.push(cur);
    return true;
  }
  const rot = {}, E = new THREE.Euler(), BASE = base({});
  function update(dt) {
    // Avanza y funde los gestos
    layers.forEach(l => { l.t += dt * l.speed; l.w += Math.sign(l.to - l.w) * Math.min(Math.abs(l.to - l.w), dt * l.rate); });
    layers = layers.filter(l => l.w > 0 || l.to > 0);
    const tot = layers.reduce((a, l) => a + l.w, 0) || 1;
    for (const n in rot) rot[n].fill(0);
    let y = 0;
    layers.forEach(l => {
      const p = GESTOS[l.g](l.t), k = l.w / tot;
      for (const n in p) { if (n === 'y') { y += p.y * k; continue; } const r = rot[n] || (rot[n] = [0, 0, 0]); r[0] += p[n][0] * k; r[1] += p[n][1] * k; r[2] += p[n][2] * k; }
    });
    // Calma: todo se acerca a la pose base (menos los huesos de keep)
    calmCur += (calmTo - calmCur) * Math.min(1, dt * 2.5);
    names.forEach(n => {
      const b = bones['mixamorig' + n]; if (!b || n === 'ScarfTail') return;
      const r = rot[n] || (rot[n] = [0, 0, 0]), q = BASE[n] || [0, 0, 0], c = keep && keep.test('mixamorig:' + n) ? 0 : calmCur;
      b.rotation.set(r[0] + (q[0] - r[0]) * c, r[1] + (q[1] - r[1]) * c, r[2] + (q[2] - r[2]) * c);
    });
    // La punta de la bufanda: un resorte que sigue el movimiento del pecho, con un vaivén leve
    const chest = (rot.Spine2 ? rot.Spine2[1] : 0) + (rot.Spine ? rot.Spine[1] : 0) + (rot.Hips ? rot.Hips[1] : 0) + y * 8;
    const acc = -(chest - lastChest) / Math.max(dt, 1e-3) * .12; lastChest = chest;
    scarfV += (acc - scarfA * 30 - scarfV * 5) * dt; scarfA += scarfV * dt;
    const tail = B('ScarfTail'); if (tail) { const ti = performance.now() / 1000; tail.rotation.set(.04 + .03 * S(ti * 1.1), 0, scarfA + .03 * S(ti * .8)); }
    // Los pies en el suelo: la cadera baja o sube hasta que el pie más bajo apoya (nunca flota ni se hunde)
    hips.position.y = hipsY + y;
    root.updateMatrixWorld(true);
    let low = Infinity;
    feet.forEach(f => {
      f.foot.localToWorld(heel.set(0, -.058, -.05)); root.worldToLocal(heel); f.toe.localToWorld(tip.set(0, -.02, .02)); root.worldToLocal(tip);
      low = Math.min(low, heel.y, tip.y);
    });
    hips.position.y -= low;
  }

  // Cara: ojos y boca son piezas hijas de la cabeza; se escalan en su lugar
  const N_ = n => nodes[n];
  const eyes = ['L', 'R'].map(s => ({ o: N_('ojo_' + s), h: N_('ojo_feliz_' + s) }));
  const mouth = { c: N_('boca'), o: N_('boca_abierta') };
  const face = {
    eyes(kind) { // open, half, shut, happy
      const k = { open: 1, half: .5, shut: .1, happy: 0 }[kind]; if (k == null) return;
      eyes.forEach(e => { if (e.o) { e.o.scale.set(1, Math.max(.001, k), 1); e.o.visible = k > 0; } if (e.h) e.h.scale.setScalar(kind === 'happy' ? 1 : .001); });
    },
    mouth(open) { // 0 = sonrisa cerrada; 1 = abierta
      if (mouth.o) mouth.o.scale.set(1, Math.max(.001, open), 1);
      if (mouth.c) mouth.c.scale.setScalar(open > .25 ? .001 : 1);
    }
  };

  // Cómo hace cada gesto de la app: [gesto, velocidad, calma, duración en s]
  const gest = {
    wave: ['wave', 1, 0, 2.6], happy: ['happy', 1, 0, 2.4], talk: ['talk', 1, 0, 2.2], nod: ['nod', 1, 0, 3], worried: ['worried', 1, 0, 3.8], plant: ['plant', 1, 0, 7.6],
    idle: ['idle', 1, 0], walk: ['walk', 1, 0], plantAt: { hold: [.5, 2], at: 2 }
  };
  return { root, body, box, skinned, bones, nodes, clips: Object.keys(GESTOS), playClip, update, face, gest, report, B: n => bones[key(n)], N: n => nodes[key(n)] };
}

/* Visor independiente (para revisar el modelo): cámara, luz, suelo y Uku con el gesto que se pida. */
export async function loadUkuRig(container, { onLog = console.log, frame = { dist: 3.4, y: .5 } } = {}) {
  const u = ukuFrom(await loadUkuGltf(), { onLog });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f6f6f5');
  const camera = new THREE.PerspectiveCamera(30, 1, .05, 50);
  camera.position.set(0, frame.y + .25, frame.dist); camera.lookAt(0, frame.y, 0);
  scene.add(new THREE.HemisphereLight('#ffffff', '#c9ccd6', 2.2));
  const sun = new THREE.DirectionalLight('#ffffff', 1.4); sun.position.set(-1.5, 3, 3); scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshLambertMaterial({ color: '#e7ebf2' }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  u.root.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.material = new THREE.MeshLambertMaterial({ vertexColors: true }); } });
  scene.add(u.root);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  container.appendChild(renderer.domElement);
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container); resize();
  const clock = new THREE.Clock();
  let raf = 0;
  function loop() { raf = requestAnimationFrame(loop); u.update(Math.min(.1, clock.getDelta())); renderer.render(scene, camera); }
  u.playClip('idle');
  return { ...u, scene, camera, renderer, start() { if (!raf) loop(); }, stop() { cancelAnimationFrame(raf); raf = 0; } };
}
