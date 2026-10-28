/* =====================================================================
   Uku · gestos
   Convierte los cuadros de visión (vision.js → normalizar) en eventos:
   - de una mano o de dos (como las reacciones de la cámara de macOS):
       👍 like · 👍👍 fuegos · 👎 nomegusta · 👎👎 lluvia · ✌️ globos ·
       ✌️✌️ confeti · 🤟 fiesta · ☝️ consejo · ✊ jardín · 👌 ok
   - propios: 🫶 corazon (dos manos), 👋 saludo (mano abierta que se
     mueve de lado a lado) y 🙌 sol (los dos brazos arriba).
   - de la forma de la mano (sin depender del modelo): 🖕 dedo, 🤘 rock,
     🤙 shaka, 🤏 poquito, 3 y 4 dedos, ✋ choca (palma quieta), 👏 aplauso
     y 🙏 rezo (dos manos).
   - de la cara (blendshapes): lengua, beso, sorpresa, bostezo, guiño,
     sonrisa y enojo; y de la cabeza: sí y no.
   - del cuerpo: brazos cruzados y una mano levantada.
   - llega / se va: alguien aparece o deja de estar frente a la cámara.
   Cada gesto debe sostenerse un instante (evita falsos disparos al pasar
   de uno a otro) y no se repite hasta que la mano cambie.
   Las posiciones (x, y) van en 0–1 de la pantalla, ya en espejo.
   ===================================================================== */
const REGLAS = {
  'Thumb_Up': 'like', 'Thumb_Up+Thumb_Up': 'fuegos',
  'Thumb_Down': 'nomegusta', 'Thumb_Down+Thumb_Down': 'lluvia',
  'Victory': 'globos', 'Victory+Victory': 'confeti',
  'ILoveYou': 'fiesta', 'ILoveYou+ILoveYou': 'fiesta',
  'Pointing_Up': 'tip', 'Pointing_Up+Pointing_Up': 'tip',
  'Closed_Fist': 'jardin', 'Closed_Fist+Closed_Fist': 'jardin',
  'OK': 'ok', 'OK+OK': 'ok',
  'Corazon': 'corazon',
  // Las de la forma de la mano: una o dos manos con la misma señal valen igual
  'DedoMedio': 'dedo', 'Rock': 'rock', 'Shaka': 'shaka', 'Poquito': 'poquito', 'Tres': 'tres', 'Cuatro': 'cuatro', 'Choca': 'choca'
};
const base = (f) => { const l = f.split('+'); return l.every(x => x === l[0]) ? l[0] : null; };
// Cuánto se sostiene cada gesto antes de disparar (ms): el puño y el índice
// aparecen de paso al mover la mano, así que piden un poco más
const SOSTENER = { jardin: 650, tip: 450, corazon: 300, dedo: 400, rock: 400, shaka: 450, poquito: 500, tres: 750, cuatro: 800, choca: 700 };
const SOSTENER_BASE = 300;
const ESPERA = 1200; // entre dos eventos de gesto

const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* Forma de la mano (21 puntos): un dedo está estirado si su punta queda mucho
   más lejos de la muñeca que su articulación, y doblado si queda más cerca. */
const razon = (p, t, j) => d2(p[0], p[t]) / (d2(p[0], p[j]) || 1e-3);
// Con manos reales: estirado ≈ 1,33 · doblado ≈ 0,55–0,7 (los umbrales quedan en el medio de cada lado)
const estirado = (p, t, j) => razon(p, t, j) > 1.2;
const doblado = (p, t, j) => razon(p, t, j) < .95;
const pulgarFuera = (p) => d2(p[4], p[17]) > (d2(p[0], p[9]) || 1e-3) * 1.05;
const pulgarDentro = (p) => d2(p[4], p[17]) < (d2(p[0], p[9]) || 1e-3) * .85;
export function formaDeMano(p) {
  const i = estirado(p, 8, 6), m = estirado(p, 12, 10), a = estirado(p, 16, 14), k = estirado(p, 20, 18);
  const ic = doblado(p, 8, 6), mc = doblado(p, 12, 10), ac = doblado(p, 16, 14), kc = doblado(p, 20, 18);
  if (m && ic && ac && kc) return 'DedoMedio';                                       // 🖕
  if (i && k && mc && ac && !pulgarFuera(p)) return 'Rock';                          // 🤘
  if (k && ic && mc && ac && pulgarFuera(p)) return 'Shaka';                         // 🤙
  // 🤏: las puntas se tocan, el índice sigue algo abierto (en un puño está totalmente doblado, ≈ 0,66) y los otros tres cerrados
  if (d2(p[4], p[8]) < (d2(p[0], p[9]) || 1e-3) * .25 && razon(p, 8, 6) > .85 && mc && ac && kc) return 'Poquito';
  if (i && m && a && kc && pulgarDentro(p)) return 'Tres';
  if (i && m && a && k && pulgarDentro(p)) return 'Cuatro';
  return null;
}
// Cuántos vaivenes (cambios de dirección) hay en una serie de valores, ignorando lo menor que el umbral
function vaivenes(serie, umbral) {
  let giros = 0, dir = 0, ext = serie[0];
  for (let i = 1; i < serie.length; i++) {
    const dx = serie[i] - ext;
    if (!dir) { if (Math.abs(dx) > umbral) { dir = Math.sign(dx); ext = serie[i]; } continue; }
    if (Math.sign(dx) === dir || !dx) { if (dir * dx > 0) ext = serie[i]; }
    else if (Math.abs(dx) > umbral) { giros++; dir = -dir; ext = serie[i]; }
  }
  return giros;
}

// 👌: pulgar e índice se tocan y los otros tres dedos están estirados
function esOK(p) {
  const tam = d2(p[0], p[9]) || 1e-3;
  if (d2(p[4], p[8]) > tam * .28) return false;
  return [[12, 10], [16, 14], [20, 18]].every(([tip, pip]) => d2(p[0], p[tip]) > d2(p[0], p[pip]) * 1.08);
}
// 🫶: dos manos con las puntas de los pulgares juntas y las de los índices juntas, índices arriba
function esCorazon(m) {
  if (m.length < 2) return false;
  const a = m[0].puntos, b = m[1].puntos, tam = (d2(a[0], a[9]) + d2(b[0], b[9])) / 2 || 1e-3;
  return d2(a[4], b[4]) < tam * .55 && d2(a[8], b[8]) < tam * .55 && a[8].y < a[4].y && b[8].y < b[4].y;
}

export function crearGestos(emitir) {
  let firma = '', desde = 0, disparada = '', ultimoEvento = -1e9; // "nunca": las esperas no frenan los primeros segundos
  let candidato = '', candDesde = 0; // el gesto que se ve ahora; pasa a ser "firma" cuando dura más de 120 ms (así no parpadea)
  let trayecto = [];                 // por dónde anduvo la mano (para saber si está quieta)
  let ultimoAplauso = -1e9, juntasDesde = 0, ultimoRezo = -1e9, distAntes = [];
  const espera = {}, cond = {};      // esperas y "desde cuándo" de los gestos de la cara y el cuerpo
  let serieCabeza = [];
  let presente = false, vistoDesde = 0, ultimaVez = 0;
  let ola = [], ultimoSaludo = -1e9, manoVista = 0;
  let arribaDesde = 0, ultimoSol = -1e9;

  function centro(manos) {
    const pts = manos.map(m => m.puntos[9]);
    const x = pts.reduce((s, p) => s + p.x, 0) / pts.length, y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    return { x: 1 - x, y }; // espejo
  }

  function presencia(r) {
    const hay = !!(r.cara || r.pose || r.manos.length);
    if (hay) { ultimaVez = r.t; if (!vistoDesde) vistoDesde = r.t; } else vistoDesde = 0;
    if (!presente && hay && r.t - vistoDesde > 400) { presente = true; emitir({ tipo: 'llega' }); }
    if (presente && !hay && r.t - ultimaVez > 2500) { presente = false; emitir({ tipo: 'se_va' }); }
  }

  function manosEstables(r) {
    // Etiqueta de cada mano: los gestos del modelo, más 👌 que el modelo no trae
    const manos = r.manos.filter(m => m.puntos && m.puntos.length === 21);
    // Quieta: la palma no se movió más de un 3 % de la imagen en los últimos 0,7 s
    if (manos.length === 1) { trayecto.push({ t: r.t, x: manos[0].puntos[9].x, y: manos[0].puntos[9].y }); } else trayecto = [];
    trayecto = trayecto.filter(q => r.t - q.t < 900);
    const quieta = trayecto.length > 4 && r.t - trayecto[0].t > 700 &&
      Math.max(...trayecto.map(q => q.x)) - Math.min(...trayecto.map(q => q.x)) < .03 && Math.max(...trayecto.map(q => q.y)) - Math.min(...trayecto.map(q => q.y)) < .03;
    let etiquetas = manos.map(m => {
      const forma = formaDeMano(m.puntos);                      // lo que se ve en la mano pesa más que la etiqueta del modelo
      if (forma && (forma !== 'Tres' && forma !== 'Cuatro' || quieta)) return forma;
      if ((m.gesto === 'None' || m.gesto === 'Open_Palm') && esOK(m.puntos)) return 'OK';
      if (m.gesto === 'Open_Palm' && quieta && manos.length === 1) return 'Choca';
      return m.score > .55 ? m.gesto : 'None';
    });
    let f;
    if (esCorazon(manos) && !manos.every(h => abierta(h.puntos))) f = 'Corazon'; // con los dedos estirados son dos palmas juntas, no un corazón
    else {
      const utiles = etiquetas.filter(e => e !== 'None' && e !== 'Open_Palm').sort();
      f = utiles.length === 2 && utiles[0] !== utiles[1] ? utiles[0] : utiles.join('+'); // dos distintos: cuenta el primero
    }
    // Un gesto que aparece y desaparece en menos de 120 ms es ruido del modelo: no cambia nada
    if (f !== candidato) { candidato = f; candDesde = r.t; }
    if (candidato !== firma && r.t - candDesde >= 120) { firma = candidato; desde = candDesde; }
    // El mismo gesto vuelve a valer cuando la mano cambió de verdad (no un parpadeo del modelo)
    if (disparada && firma !== disparada && r.t - desde > 250) disparada = '';
    f = firma;
    if (!f) return;
    const tipo = REGLAS[f] || (base(f) && REGLAS[base(f)]);
    if (!tipo || f === disparada) return;
    if (r.t - desde < (SOSTENER[tipo] || SOSTENER_BASE) || r.t - ultimoEvento < ESPERA) return;
    disparada = f; ultimoEvento = r.t;
    const enJuego = manos.filter((m, i) => etiquetas[i] !== 'None');
    emitir(Object.assign({ tipo, manos: f.indexOf('+') > 0 || f === 'Corazon' ? 2 : 1 }, centro(enJuego.length ? enJuego : manos)));
  }

  // 👏 las dos manos se juntan rápido (venían separadas) · 🙏 se quedan juntas un buen rato
  function dosManos(r) {
    const m = r.manos.filter(h => h.puntos && h.puntos.length === 21);
    if (m.length < 2 || (esCorazon(m) && !m.every(h => abierta(h.puntos)))) { distAntes = []; juntasDesde = 0; return; }
    const a = m[0].puntos, b = m[1].puntos, tam = (d2(a[0], a[9]) + d2(b[0], b[9])) / 2 || 1e-3;
    const d = d2(a[9], b[9]) / tam;
    distAntes.push({ t: r.t, d }); distAntes = distAntes.filter(q => r.t - q.t < 500);
    const lejos = Math.max(...distAntes.map(q => q.d));
    if (d < .9 && lejos > 2.2 && r.t - ultimoAplauso > 2500) {
      ultimoAplauso = r.t; distAntes = [];
      emitir({ tipo: 'aplauso', manos: 2, x: 1 - (a[9].x + b[9].x) / 2, y: (a[9].y + b[9].y) / 2 });
    }
    if (d < .9) { if (!juntasDesde) juntasDesde = r.t; } else juntasDesde = 0;
    if (juntasDesde && r.t - juntasDesde > 1300 && r.t - ultimoRezo > 8000) {
      ultimoRezo = r.t; juntasDesde = 0;
      emitir({ tipo: 'rezo', manos: 2, x: 1 - (a[9].x + b[9].x) / 2, y: (a[9].y + b[9].y) / 2 });
    }
  }

  // Cada gesto de cara o cuerpo: la condición debe cumplirse sin parar durante `ms`, y luego espera `pausa`
  function sostiene(clave, ok, t, ms, pausa) {
    if (!ok) { cond[clave] = 0; return false; }
    if (!cond[clave]) cond[clave] = t;
    if (t - cond[clave] >= ms && t - (espera[clave] ?? -1e9) > pausa) { espera[clave] = t; cond[clave] = 0; return true; }
    return false;
  }
  function cara(r) {
    const f = r.cara && r.cara.forma;
    if (!f) { cond.cabezaT = 0; serieCabeza = []; return; }
    const pos = { x: r.cara.nariz ? 1 - r.cara.nariz.x : .5, y: r.cara.nariz ? r.cara.nariz.y : .4 };
    const prom = (a, b) => ((f[a] || 0) + (f[b] || 0)) / 2;
    const parpadeo = prom('eyeBlinkLeft', 'eyeBlinkRight'), boca = f.jawOpen || 0;
    const ev = (tipo) => emitir(Object.assign({ tipo, manos: 0 }, pos));
    if (sostiene('lengua', (f.tongueOut || 0) > .45, r.t, 350, 8000)) ev('lengua');
    else if (sostiene('beso', (f.mouthPucker || 0) > .55 && boca < .3, r.t, 450, 8000)) ev('beso');
    else if (sostiene('bostezo', boca > .6 && parpadeo > .35, r.t, 700, 15000)) ev('bostezo');
    else if (sostiene('sorpresa', boca > .5 && (f.browInnerUp || 0) > .45 && parpadeo < .3, r.t, 400, 10000)) ev('sorpresa');
    else if (sostiene('guino', Math.abs((f.eyeBlinkLeft || 0) - (f.eyeBlinkRight || 0)) > .5 && Math.max(f.eyeBlinkLeft || 0, f.eyeBlinkRight || 0) > .6, r.t, 300, 6000)) ev('guino');
    else if (sostiene('sonrisa', prom('mouthSmileLeft', 'mouthSmileRight') > .65 && boca < .35, r.t, 1800, 25000)) ev('sonrisa');
    else if (sostiene('enojo', prom('browDownLeft', 'browDownRight') > .6 && prom('mouthFrownLeft', 'mouthFrownRight') > .3, r.t, 1200, 20000)) ev('enojo');
    // Cabeza: sí (arriba y abajo) y no (de lado a lado), a partir de la matriz de la cara
    const m = r.cara.matriz;
    if (m && (!serieCabeza.length || serieCabeza[serieCabeza.length - 1].m0 !== m[0])) serieCabeza.push({ t: r.t, m0: m[0], yaw: m[8], pitch: -m[9] });
    serieCabeza = serieCabeza.filter(q => r.t - q.t < 1700);
    if (serieCabeza.length > 6 && r.t - (espera.cabeza ?? -1e9) > 7000) {
      const yaw = serieCabeza.map(q => q.yaw), pit = serieCabeza.map(q => q.pitch);
      const rango = (a) => Math.max(...a) - Math.min(...a);
      if (vaivenes(yaw, .22) >= 2 && rango(pit) < .3) { espera.cabeza = r.t; serieCabeza = []; ev('no'); }
      else if (vaivenes(pit, .13) >= 2 && rango(yaw) < .22) { espera.cabeza = r.t; serieCabeza = []; ev('si'); }
    }
  }
  function cuerpo(r) {
    const p = r.pose && r.pose.puntos;
    if (!p) return;
    const ve = (i) => (p[i].visibility ?? 1) > .5;
    const ancho = Math.abs(p[11].x - p[12].x), hombros = (p[11].y + p[12].y) / 2;
    const pos = { x: 1 - (p[15].x + p[16].x) / 2, y: (p[15].y + p[16].y) / 2 };
    const enPecho = (q) => q.y > hombros - .02 && q.y < hombros + ancho * 1.6;
    // Brazos cruzados: las muñecas se cruzan a la altura del pecho
    const cruzados = ve(15) && ve(16) && ve(11) && ve(12) && ancho > .08 && enPecho(p[15]) && enPecho(p[16]) && p[15].x < p[16].x - .03;
    if (sostiene('cruzados', cruzados, r.t, 800, 10000)) emitir(Object.assign({ tipo: 'cruzados', manos: 2 }, pos));
    // Una mano levantada (la otra abajo), sin estar saludando
    const arriba = (a) => ve(a) && p[a].y < p[0].y - .06;
    const una = (arriba(15) !== arriba(16)) && ve(11) && (arriba(15) ? p[16].y > hombros : p[15].y > hombros);
    if (sostiene('mano', una && r.t - ultimoSaludo > 3000, r.t, 900, 12000)) emitir({ tipo: 'mano', manos: 1, x: 1 - p[arriba(15) ? 15 : 16].x, y: p[arriba(15) ? 15 : 16].y });
  }

  // 👋: una mano abierta (3 o más dedos estirados, sin depender de la etiqueta
  // del modelo, que parpadea con el movimiento) cuyas puntas de los dedos van y
  // vienen de lado a lado: 2 cambios de dirección en 1,6 s, cada vaivén de al
  // menos un tercio del tamaño de la mano. Un cuadro sin mano no corta el saludo.
  function abierta(p) { return [[8, 6], [12, 10], [16, 14], [20, 18]].filter(([t, j]) => d2(p[0], p[t]) > d2(p[0], p[j]) * 1.1).length >= 3; }
  function saludo(r) {
    const m = r.manos.filter(h => h.puntos && h.puntos.length === 21 && (h.gesto === 'Open_Palm' || abierta(h.puntos)))
      .sort((a, b) => a.puntos[0].y - b.puntos[0].y)[0]; // la más alta
    if (!m) { if (r.t - manoVista > 450) ola = []; return; }
    manoVista = r.t;
    const p = m.puntos, tam = d2(p[0], p[9]) || .05;
    ola.push({ t: r.t, x: (p[8].x + p[12].x + p[16].x) / 3 });
    ola = ola.filter(q => r.t - q.t < 1600);
    let giros = 0, dir = 0, ext = ola[0].x;
    const umbral = tam * .33;
    for (let i = 1; i < ola.length; i++) {
      const dx = ola[i].x - ext;
      if (!dir) { if (Math.abs(dx) > umbral) { dir = Math.sign(dx); ext = ola[i].x; } continue; }
      if (Math.sign(dx) === dir || !dx) { if (dir * dx > 0) ext = ola[i].x; }   // sigue hacia el mismo lado
      else if (Math.abs(dx) > umbral) { giros++; dir = -dir; ext = ola[i].x; } // dio la vuelta
    }
    if (giros >= 2 && r.t - ultimoSaludo > 3500) {
      ultimoSaludo = r.t; ola = [];
      emitir({ tipo: 'saludo', manos: 1, x: 1 - p[9].x, y: p[9].y });
    }
  }

  // 🙌: las dos muñecas por encima de la nariz
  function brazosArriba(r) {
    const p = r.pose && r.pose.puntos;
    const arriba = p && p[15].y < p[0].y - .04 && p[16].y < p[0].y - .04 && (p[15].visibility ?? 1) > .5 && (p[16].visibility ?? 1) > .5;
    if (!arriba) { arribaDesde = 0; return; }
    if (!arribaDesde) arribaDesde = r.t;
    if (r.t - arribaDesde > 500 && r.t - ultimoSol > 4000) {
      ultimoSol = r.t;
      emitir({ tipo: 'sol', manos: 2, x: 1 - (p[15].x + p[16].x) / 2, y: (p[15].y + p[16].y) / 2 });
    }
  }

  return {
    procesar(r) {
      if (!r) return;
      presencia(r);
      manosEstables(r);
      dosManos(r);
      saludo(r);
      brazosArriba(r);
      cara(r);
      cuerpo(r);
    },
    get presente() { return presente; }
  };
}
