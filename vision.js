/* =====================================================================
   Uku · visión (MediaPipe Tasks Vision, en el navegador)
   Tres modelos sobre el video de la webcam, sin enviar nada a un servidor,
   los completos (más precisos que los «lite»):
   - HandLandmarker (full): manos (21 puntos). El gesto de cada una
     (Thumb_Up, Thumb_Down, Victory, Open_Palm, Closed_Fist, Pointing_Up,
     ILoveYou, None) se decide por la geometría de los puntos
     (gestos.js › etiquetaBasica), no por un clasificador que parpadea.
   - PoseLandmarker (full): cuerpo en 3D (hombros, codos, muñecas…).
   - FaceLandmarker: giro de la cabeza (matriz) y expresiones (pestañeo,
     sonrisa).
   Las librerías y los modelos se cargan de su CDN; para un equipo sin
   internet se pueden servir copias locales con ?mp=…&modelos=… (LEEME.md).
   ===================================================================== */
import * as descargas from './descargas.js?v=__BUILD__';
import { etiquetaBasica } from './gestos.js?v=__BUILD__';
const Q = new URLSearchParams(location.search);
export const RUTAS = {
  mp: Q.get('mp') || 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14',
  modelos: Q.get('modelos') || 'https://storage.googleapis.com/mediapipe-models'
};
const MODELOS = {
  manos: 'hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  pose: 'pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  cara: 'face_landmarker/face_landmarker/float16/1/face_landmarker.task'
};
// Con copias locales, los modelos van sueltos en la carpeta (sin la ruta del CDN)
const ruta = (k) => RUTAS.modelos + '/' + (Q.get('modelos') ? MODELOS[k].split('/').pop() : MODELOS[k]);

export async function iniciarVision({ alAvance = () => {} } = {}) {
  alAvance('Cargando la visión de Uku…');
  descargas.empezar('vision', 'Visión', 'MediaPipe: manos, cuerpo y cara');
  const mp = await import(RUTAS.mp + '/vision_bundle.mjs');
  const files = await mp.FilesetResolver.forVisionTasks(RUTAS.mp + '/wasm');
  // Los tres modelos se bajan a la vez, contando los bytes (así se ve cuánto falta)
  const buffers = {};
  await Promise.all(Object.keys(MODELOS).map(async k => { buffers[k] = await descargas.bajar(ruta(k), 'vision'); }));
  let delegado = 'GPU';

  // GPU si se puede; si el equipo no la ofrece, CPU (más lento pero funciona)
  async function crear(Clase, modelo, extra) {
    for (const delegate of ['GPU', 'CPU']) {
      try {
        const t = await Clase.createFromOptions(files, Object.assign({ baseOptions: { modelAssetBuffer: buffers[modelo], delegate }, runningMode: 'VIDEO' }, extra));
        delegado = delegate;
        return t;
      } catch (e) { if (delegate === 'CPU') throw e; }
    }
  }
  alAvance('Aprendiendo a ver tus manos…');
  const manos = await crear(mp.HandLandmarker, 'manos', { numHands: 2, minHandDetectionConfidence: .6, minHandPresenceConfidence: .6, minTrackingConfidence: .6 });
  alAvance('Aprendiendo a ver cómo te mueves…');
  const pose = await crear(mp.PoseLandmarker, 'pose', { numPoses: 1, minPoseDetectionConfidence: .5, minTrackingConfidence: .5 });
  alAvance('Aprendiendo a ver tu cara…');
  const cara = await crear(mp.FaceLandmarker, 'cara', { numFaces: 4, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true });
  descargas.listo('vision', `MediaPipe: manos, cuerpo y cara · en la ${delegado === 'GPU' ? 'tarjeta gráfica' : 'CPU'}`);

  let ultimo = -1, turno = 0, prevCara = null;
  /* detectar(video): un cuadro. Manos y cuerpo en cada cuadro; la cara, uno
     sí y uno no (cambia más lento y así queda tiempo para el 3D). */
  function detectar(video) {
    const t = performance.now();
    if (video.readyState < 2 || t <= ultimo) return null;
    ultimo = t;
    const g = manos.detectForVideo(video, t);
    const p = pose.detectForVideo(video, t);
    if (turno++ % 2 === 0 || !prevCara) prevCara = cara.detectForVideo(video, t);
    return normalizar(g, p, prevCara, t);
  }
  return { detectar };
}

/* Resultado común (el mismo que usan las pruebas con datos simulados):
   { t, manos: [{ lado: 'Left'|'Right' (de la persona), gesto, score, puntos: [{x,y,z}] }],
     pose: { puntos (imagen, 0–1), mundo (m) } | null,
     cara: { matriz: number[16], forma: { nombre: valor } } | null } */
export function normalizar(g, p, c, t) {
  const manos = [];
  (g.landmarks || []).forEach((pts, i) => {
    // Con el GestureRecognizer venía una etiqueta; con el HandLandmarker la sacamos de la forma de la mano
    const ges = g.gestures && g.gestures[i] && g.gestures[i][0];
    const lado = g.handedness && g.handedness[i] && g.handedness[i][0];
    manos.push({ lado: lado ? lado.categoryName : null, gesto: ges ? ges.categoryName : etiquetaBasica(pts), score: ges ? ges.score : 1, puntos: pts });
  });
  const pose = p && p.landmarks && p.landmarks[0] ? { puntos: p.landmarks[0], mundo: p.worldLandmarks && p.worldLandmarks[0] } : null;
  // Hasta cuatro caras a la vez (para reconocer a cada persona que se acerque); `cara` es la más grande
  // (la de quien está más cerca) y es la que usan las expresiones y la cabeza
  const caras = [];
  if (c && c.faceLandmarks) c.faceLandmarks.forEach((pts, i) => {
    const forma = {};
    (c.faceBlendshapes && c.faceBlendshapes[i] ? c.faceBlendshapes[i].categories : []).forEach(k => { forma[k.categoryName] = k.score; });
    const m = c.facialTransformationMatrixes && c.facialTransformationMatrixes[i];
    const xs = pts.map(q => q.x), ys = pts.map(q => q.y);
    // Caja de la cara (0–1 de la imagen): caras.js recorta ahí para reconocer
    const caja = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
    // Puntos clave (para el espejo y el depurador): nariz, rabillos de los ojos, mejillas, frente, mentón y labios
    const clave = { nariz: pts[1], ojoI: pts[263], ojoD: pts[33], mejI: pts[454], mejD: pts[234], frente: pts[10], menton: pts[152], labioS: pts[13], labioI: pts[14] };
    caras.push({ matriz: m ? Array.from(m.data) : null, forma, nariz: pts[1], clave, caja, area: (caja.x1 - caja.x0) * (caja.y1 - caja.y0) });
  });
  caras.sort((a, b) => b.area - a.area);
  const cara = caras[0] || null;
  return { t, manos, pose, cara, caras };
}
