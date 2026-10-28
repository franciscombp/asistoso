/* =====================================================================
   Uku: el modelo con esqueleto Mixamo (assets/oso/uku-rig.glb). Este módulo
   sólo carga y controla el personaje; la escena (bosque, flores, planeta) la
   arma bosque3d.js, que lo usa como su único oso.
   - ukuFrom(gltf): huesos, piezas y clips (crossfade). El modelo trae sus
     animaciones; no tiene morph targets.
   - Las clips traen el desplazamiento del torso al caminar; el planeta mueve
     al oso, así que x y z del torso se fijan en su pose de reposo.
   - Los pies siempre en el suelo: cada cuadro se miden las plantas (los
     vértices más bajos del modelo) y la cadera sube o baja hasta apoyarlas.
   - face: ojos pintados en la textura de la cabeza; para pestañear se
     cambia el mapa por variantes (entrecerrados, cerrados, contentos).
   - gest: cómo hace cada gesto de la app con estas clips (velocidad, calma).
   - loadUkuRig(container): visor independiente para verificar el modelo.
   (El oso de respaldo, hecho por código, está en uku-rig-nuevo.js.)
   Unidad = 1 m; el cuerpo mide ~1.64.
   ===================================================================== */
import * as THREE from './vendor/three/three.module.min.js';
import { GLTFLoader } from './vendor/three/jsm/loaders/GLTFLoader.js';

/* Dos versiones del mismo personaje:
   - v2 (por defecto): assets/oso/uku-rig-v2.glb, hecho con tools/uku-suave.py: malla subdividida (un loop
     por arista, para que doble bien en codos, rodillas, cuello y cintura), pesos limpios (sin huesos del lado
     contrario, 3 por vértice, suavizados) y las texturas aparte.
   - clasico: assets/oso/uku-rig.glb, el archivo original, tal cual (?oso=clasico o localStorage uku_oso).
   Las texturas de v2 vienen en dos juegos: oso/tex/ (suavizadas: la cara ya no se escalona) y
   oso/tex-original/ (las del archivo). ?texturas=original (o localStorage uku_texturas) usa las originales. */
const Q = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(); } })();
const LS = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
export const VARIANTE = (Q.get('oso') || LS('uku_oso')) === 'clasico' ? 'clasico' : 'v2';
export const TEXTURAS = (Q.get('texturas') || LS('uku_texturas')) === 'original' ? 'original' : 'suaves';
export const UKU_URL = VARIANTE === 'clasico' ? './oso/uku-rig.glb' : './oso/uku-rig-v2.glb';
// three.js guarda los nombres sin puntos ni corchetes ni dos puntos ("mixamorig:Hips" -> "mixamorigHips")
const key = (n) => n.replace(/[\[\].:\/]/g, '');
const HIPS = key('mixamorig:Hips');
const NEEDED = ['mixamorig:Hips', 'mixamorig:Head', 'mixamorig:RightHand'].map(key);

export function loadUkuGltf() {
  const manager = new THREE.LoadingManager();
  // Las texturas de v2 se piden como oso/tex/…; con las originales se redirige a oso/tex-original/
  if (TEXTURAS === 'original') manager.setURLModifier(u => u.replace(/\/oso\/tex\//, '/oso/tex-original/'));
  return new Promise((ok, fail) => new GLTFLoader(manager).load(new URL(UKU_URL, import.meta.url).href, g => {
    g.scene.traverse(o => { if (o.isMesh && o.material && o.material.map) { o.material.map.anisotropy = 8; o.material.map.minFilter = THREE.LinearMipmapLinearFilter; o.material.map.magFilter = THREE.LinearFilter; o.material.map.needsUpdate = true; } });
    ok(g);
  }, undefined, fail));
}

/* Sobre un GLTF ya cargado: huesos, piezas, clips y expresiones. No crea render ni escena. */
export function ukuFrom(gltf, { onLog = () => {} } = {}) {
  const root = gltf.scene;
  const report = { errors: [], warnings: [] };
  const skinned = []; const bones = {}; const nodes = {};
  root.traverse(o => {
    if (o.isSkinnedMesh) skinned.push(o);
    if (o.isBone) bones[o.name] = o;
    nodes[o.name] = nodes[o.name] || o;
  });
  NEEDED.forEach(n => { if (!bones[n] && !nodes[n]) report.errors.push('hueso inexistente: ' + n); });

  // El cuerpo es la pieza más alta (la caja de la pose base, sin morph targets)
  // Caja de la pose base (la del archivo, no la de una pose)
  const boxOf = (m) => new THREE.Box3().setFromBufferAttribute(m.geometry.attributes.position);
  const hOf = (m) => { const b = boxOf(m); return b.max.y - b.min.y; };
  const body = skinned.reduce((a, m) => (hOf(m) > hOf(a) ? m : a), skinned[0]);
  // Altura del personaje: la caja que envuelve todas sus piezas (la ropa no siempre llega a los pies)
  const box = skinned.map(boxOf).reduce((u, b) => u.union(b));
  onLog('Piezas: ' + skinned.map(m => m.name + ' ' + hOf(m).toFixed(3) + ' m').join(', '));

  // Desplazamiento del torso: x y z vuelven a su pose de reposo; la altura (y) conserva el vaivén al caminar
  const hips = bones[HIPS];
  const rest = hips ? hips.position.clone() : null;
  const clips = gltf.animations.map(c => {
    c.tracks = c.tracks.map(t => {
      if (!rest || t.name !== HIPS + '.position') return t;
      const v = Float32Array.from(t.values);
      for (let i = 0; i < v.length; i += 3) { v[i] = rest.x; v[i + 2] = rest.z; }
      return new THREE.VectorKeyframeTrack(t.name, t.times, v);
    });
    return c;
  });

  // Mixer y clips con crossfade
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  clips.forEach(c => { actions[c.name] = mixer.clipAction(c); });
  // Pose de reposo (primer cuadro de Happy Idle): «calm» acerca cada hueso a ella después del mixer,
  // así cualquier clip se mueve con menos amplitud sin cambiar su ritmo (y sin mezclar pesos, que
  // con menos de 1 dejarían ver la pose T del archivo)
  const rest0 = [], REST = actions['Happy Idle'] ? 'Happy Idle' : clips[0] && clips[0].name;
  if (REST) { actions[REST].play(); mixer.update(0); Object.values(bones).forEach(b => rest0.push([b, b.quaternion.clone()])); actions[REST].stop(); }
  let current = null, calmTo = 0, calmCur = 0, keep = null;
  /* Pose sentado (para leer en la banca): se aplica después del mixer y la calma. Los muslos van hacia adelante,
     las pantorrillas hacia abajo, los brazos adelante con los codos doblados (sostienen el periódico) y la cabeza
     baja un poco. Las rotaciones son sobre la pose de reposo; `sit` va de 0 a 1 para entrar y salir suave. */
  const pose = { sit: 0, sitTo: 0, raise: 0, ang: { upLeg: -1.5, leg: 1.55, arm: -1.0, foreArm: -1.2, armZ: .2, head: .45 } };
  // Los huesos de Mixamo tienen giro propio en sus ejes locales: las rotaciones de la pose se hacen alrededor de
  // ejes del personaje (x = a su derecha/izquierda, z = hacia adelante), convertidos al espacio del padre de cada hueso
  const _qp = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _axw = new THREE.Vector3();
  function rotWorld(b, ax, ay, az, a) {
    if (!b || !a) return;
    root.getWorldQuaternion(_qw); _axw.set(ax, ay, az).applyQuaternion(_qw).normalize();
    b.parent.getWorldQuaternion(_qp); _qr.setFromAxisAngle(_axw, a);
    b.quaternion.premultiply(_qp.clone().invert().multiply(_qr).multiply(_qp));
    b.updateWorldMatrix(false, true); // los hijos (la pantorrilla, el antebrazo) parten de la nueva posición
  }
  /* playClip(nombre, fundido, { speed, calm, keep }): speed es la velocidad de la clip y calm (0–1) cuánto
     se acerca a la pose de reposo (0.6 = se mueve al 40 %); keep (RegExp) deja fuera de la calma los huesos
     que deben moverse completos (p. ej. el brazo que saluda). La misma clip no se reinicia. */
  function playClip(name, fade = .7, { speed = 1, calm = 0, keep: k = null } = {}) {
    const next = actions[name];
    if (!next) { report.errors.push('clip inexistente: ' + name); return false; }
    calmTo = calm; keep = k;
    if (current === next) { next.setEffectiveTimeScale(speed); return true; }
    next.reset().setEffectiveTimeScale(speed).fadeIn(fade).play();
    if (current) current.fadeOut(fade);
    current = next;
    return true;
  }

  // El mixer solo reescribe un hueso si su valor cambió: antes de cada cuadro se devuelve cada hueso a lo
  // que dejó el mixer, así los retoques de después (calma, mirada, apoyo) no se acumulan cuadro a cuadro
  const mixed = Object.values(bones).map(b => [b, b.quaternion.clone()]), hipsMixed = hips ? hips.position.clone() : null;
  // Las plantas de los pies: los vértices más bajos del modelo en la pose del archivo. Y además una muestra
  // del resto del cuerpo (cabeza, torso, piernas; las manos no, que al plantar sí tocan la tierra): nada de eso
  // puede quedar bajo el suelo, aunque la clip agache al oso más de lo que su cuerpo permite
  const soles = [];
  skinned.forEach(m => { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) soles.push([m, i, p.getY(i)]); });
  soles.sort((a, b) => a[2] - b[2]); soles.length = Math.min(60, soles.length);
  skinned.forEach(m => { if (/brazos/.test(m.material && m.material.map && m.material.map.name || '')) return; const p = m.geometry.attributes.position, paso = Math.max(1, Math.round(p.count / 220)); for (let i = 0; i < p.count; i += paso) soles.push([m, i, p.getY(i)]); });
  const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
  function update(dt) {
    mixed.forEach(([b, q]) => b.quaternion.copy(q));
    if (hips) hips.position.copy(hipsMixed);
    mixer.update(dt);
    mixed.forEach(([b, q]) => q.copy(b.quaternion));
    if (hips) hipsMixed.copy(hips.position);
    calmCur += (calmTo - calmCur) * Math.min(1, dt * 2.5);
    if (calmCur > .005) rest0.forEach(([b, q]) => { if (!keep || !keep.test(b.name)) b.quaternion.slerp(q, calmCur); });
    pose.sit += (pose.sitTo - pose.sit) * Math.min(1, dt * 3);
    if (pose.sit > .005) {
      const k = pose.sit, A = pose.ang;
      // sentado: todo el cuerpo parte de la pose de reposo (sin el vaivén de la clip) y se doblan las articulaciones
      rest0.forEach(([b, q]) => b.quaternion.slerp(q, k));
      root.updateMatrixWorld(true);
      ['Left', 'Right'].forEach(L => {
        const s = L === 'Left' ? 1 : -1, B = (n) => bones[key('mixamorig:' + L + n)];
        rotWorld(B('UpLeg'), 1, 0, 0, A.upLeg * k);   // muslos hacia adelante (girando alrededor de su eje lateral)
        rotWorld(B('Leg'), 1, 0, 0, A.leg * k);        // pantorrillas de vuelta hacia abajo
        rotWorld(B('Arm'), 1, 0, 0, A.arm * k); rotWorld(B('Arm'), 0, 0, 1, -s * A.armZ * k); // brazos adelante y un poco hacia adentro
        rotWorld(B('ForeArm'), 1, 0, 0, A.foreArm * k); rotWorld(B('ForeArm'), 0, 1, 0, -s * .5 * k); // antebrazos hacia el centro
      });
      rotWorld(bones[key('mixamorig:Head')], 1, 0, 0, A.head * k); // la cabeza baja hacia el periódico
    }
    // Los pies en el suelo: la cadera baja o sube hasta que la planta más baja toca el suelo (ni flota ni se hunde)
    if (!hips) return;
    root.updateMatrixWorld(true);
    let low = Infinity;
    soles.forEach(([m, i]) => { m.getVertexPosition(i, _v).applyMatrix4(m.matrixWorld); root.worldToLocal(_v); if (_v.y < low) low = _v.y; });
    // Sentado, el suelo no manda: la cadera queda a la altura del asiento (pose.raise, en metros del personaje)
    root.localToWorld(_a.set(0, 0, 0)); root.localToWorld(_b.set(0, (box.min.y - low) * (1 - pose.sit) + pose.raise * pose.sit, 0));
    hips.parent.worldToLocal(_a); hips.parent.worldToLocal(_b);
    hips.position.add(_b.sub(_a));
  }
  // sentarse(on, raise): on = true/false; raise = a qué altura (m del personaje) queda el bajo de los pies sobre el suelo
  function sentarse(on, raise = .22) { pose.sitTo = on ? 1 : 0; if (on) pose.raise = raise; }

  /* Ojos: están pintados en la textura de la cabeza (uku_cabeza_final) como dos puntos azul marino sobre el
     pelaje. Para pestañear se dibujan variantes de la textura y se cambia el mapa unos cuadros. M dice cuánto
     mide en la cara (mm; x a la derecha, y hacia arriba) un píxel de la textura en x y en y: en el mapa UV los
     ojos están girados y estirados. */
  let headMesh = null, headMap = null;
  root.traverse(o => { if (o.isMesh && o.material && o.material.map && /cabeza/.test(o.material.map.name || '')) { headMesh = o; headMap = o.material.map; } });
  const maps = { open: headMap };
  const face = {
    eyes(kind) {
      if (!headMesh || !headMap || !headMap.image) return;
      if (!maps[kind]) { try { maps[kind] = eyeMap(headMap, kind); } catch (e) { maps[kind] = headMap; } }
      headMesh.material.map = maps[kind];
    },
    mouth() {} // la boca está pintada: no se abre
  };

  // Cómo hace cada gesto de la app: [clip, velocidad, calma (cuánto se acerca a su pose quieta), duración en s, huesos fuera de la calma]
  const gest = {
    wave: ['Waving', .55, .45, 2.7, /Right(Shoulder|Arm|ForeArm|Hand)/], // saluda con el brazo entero, pero el cuerpo casi quieto
    happy: ['Happy Idle', .8, .15, 2.4], talk: ['Happy Idle', .6, .45, 2.2],
    nod: ['Thoughtful Head Nod', .8, .1, 3.4], worried: ['Thoughtful Head Nod', .7, .2, 3.8],
    // Plantar: la clip es de una persona que se arrodilla; con el cuerpo de Uku la cabeza se iba bajo tierra. Solo los brazos
    // hacen el gesto completo (bajan hasta la tierra); cadera, piernas, torso y cabeza se quedan a medio camino (calma .62)
    plant: ['Plant A Plant', .9, .62, 8.2, /Arm|Hand|Shoulder/],
    idle: ['Happy Idle', .45, .65], walk: ['Walking', .6, .1],
    read: ['Happy Idle', .35, 1, 16], // leer sentado: la pose la pone sentarse(); la clip solo respira
    plantAt: { hold: [1.6, 3.4], at: 3.4 } // plantar: cuándo sostiene el brote y cuándo queda en la tierra (s del gesto)
  };

  return { root, body, box, skinned, bones, nodes, clips, playClip, update, face, gest, report, sentarse, pose, B: n => bones[key(n)], N: n => nodes[key(n)] };
}

const EYES = [{ c: [189, 132], M: [-3.08, -5.66, -5.10, 2.61] }, { c: [169, 111], M: [-4.74, -2.86, -2.59, 5.62] }];
function eyeMap(base, kind) {
  const img = base.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'), k = img.width / 512; x.drawImage(img, 0, 0);
  EYES.forEach(e => {
    const [a, b, cc, d] = e.M, det = a * d - cc * b, r = 3.9 * Math.sqrt(Math.abs(det)); // radio (mm) del punto original, ~3.9 px
    x.setTransform(k, 0, 0, k, 0, 0); x.fillStyle = '#88909d'; x.beginPath(); x.arc(e.c[0], e.c[1], 6, 0, 7); x.fill(); // el pelaje tapa el ojo
    x.setTransform(k * d / det, -k * b / det, -k * cc / det, k * a / det, k * e.c[0], k * e.c[1]); // de mm de la cara a píxeles
    x.fillStyle = x.strokeStyle = '#0b2750'; x.lineCap = 'round'; x.lineWidth = r * .5; x.beginPath();
    if (kind === 'half') { x.ellipse(0, -r * .3, r, r * .55, 0, 0, Math.PI * 2); x.fill(); }
    else if (kind === 'shut') { x.moveTo(-r, 0); x.quadraticCurveTo(0, -r * .7, r, 0); x.stroke(); }
    else { x.moveTo(-r, -r * .35); x.quadraticCurveTo(0, r * 1.1, r, -r * .35); x.stroke(); }
  });
  const t = new THREE.CanvasTexture(c);
  ['flipY', 'colorSpace', 'wrapS', 'wrapT', 'anisotropy', 'magFilter', 'minFilter'].forEach(p => { t[p] = base[p]; });
  return t;
}

/* Visor independiente (para revisar el modelo): cámara, luz, suelo y Uku con la clip que se pida. */
export async function loadUkuRig(container, { onLog = console.log, frame = { dist: 3.4, y: .85 } } = {}) {
  const u = ukuFrom(await loadUkuGltf(), { onLog });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f6f6f5');
  const camera = new THREE.PerspectiveCamera(30, 1, .05, 50);
  camera.position.set(0, frame.y + .25, frame.dist); camera.lookAt(0, frame.y, 0);
  scene.add(new THREE.AmbientLight('#ffffff', 1.4));
  const sun = new THREE.DirectionalLight('#ffffff', 1.2); sun.position.set(2, 4, 3); scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshLambertMaterial({ color: '#e7ebf2' }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
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
  function loop() { raf = requestAnimationFrame(loop); u.update(clock.getDelta()); renderer.render(scene, camera); }
  return { ...u, scene, camera, renderer, start() { if (!raf) loop(); }, stop() { cancelAnimationFrame(raf); raf = 0; } };
}
