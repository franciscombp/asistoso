/* =====================================================================
   Uku · efectos de pantalla (como las reacciones de la cámara de
   macOS): una capa 2D encima de la escena con partículas.
   lanzar(tipo, { x, y }) — x, y en 0–1 de la pantalla (donde está la mano).
   Tipos: like, nomegusta, corazon, globos, confeti, fuegos, ok, jardin, sol,
   y los de emojis de EMOJIS (miel, beso, risa, estrellas, aplausos, rock,
   censura, surf, rezo, lengua…): suben desde la mano, caen del cielo o
   explotan desde un punto.
   Colores de Uku: amarillo, azul gris y blanco (los corazones también,
   en amarillos).
   ===================================================================== */
const AMARILLOS_CONFETI = ['#ffdd00', '#ffd200', '#f7d96b', '#c9d3e6', '#aeb6c7', '#ffffff'];
// Con contraste sobre el cielo claro: amarillos intensos y azules de la marca (los pálidos se perdían)
const VIVOS = ['#ffdd00', '#ffc400', '#ffd200', '#2c4f9e', '#5f78a8', '#ffdd00'];
const AMARILLOS = ['#ffdd00', '#ffc400', '#ffd200', '#ffe14d']; // los corazones siempre amarillos
const BORDE = 'rgba(15,38,92,.35)';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* modo: 'sube' (salen de la mano y suben), 'cae' (llueven del cielo), 'explota' (salen en todas direcciones) */
export const EMOJIS = {
  miel: { e: ['🍯', '🐝'], modo: 'cae', n: 22 }, hambre: { e: ['🍯', '🍕', '🍩', '🍎'], modo: 'cae', n: 18 },
  beso: { e: ['😘', '💋', '💛'], modo: 'sube', n: 12 }, risa: { e: ['😂', '🤣'], modo: 'sube', n: 14 },
  estrellas: { e: ['⭐', '✨', '🌟'], modo: 'explota', n: 26 }, aplausos: { e: ['👏', '✨'], modo: 'explota', n: 16 },
  rock: { e: ['🎸', '🤘', '🔥', '⚡'], modo: 'explota', n: 18 }, censura: { e: ['🙈', '🙊', '🙉', '🚫'], modo: 'cae', n: 18 },
  surf: { e: ['🏄', '🌴', '🥥', '🌊', '☀️'], modo: 'cae', n: 18 }, rezo: { e: ['🙏', '✨', '😇'], modo: 'sube', n: 12 },
  lengua: { e: ['😝', '😜', '🤪'], modo: 'explota', n: 9 }, guino: { e: ['😉', '✨'], modo: 'sube', n: 8 },
  bostezo: { e: ['🥱', '💤'], modo: 'sube', n: 10 }, sorpresa: { e: ['😮', '❗', '⁉️'], modo: 'explota', n: 10 },
  cruzados: { e: ['🙅', '❌'], modo: 'explota', n: 8 }, mano: { e: ['🙋', '❓'], modo: 'sube', n: 6 },
  poquito: { e: ['🤏', '🍯'], modo: 'sube', n: 10 }, tres: { e: ['3️⃣', '🐯'], modo: 'explota', n: 8 }, cuatro: { e: ['4️⃣', '🍀'], modo: 'explota', n: 8 },
  choca: { e: ['🙌', '✋', '💥'], modo: 'explota', n: 12 }, musica: { e: ['🎵', '🎶', '🎤', '🎧'], modo: 'sube', n: 18 },
  nieve: { e: ['❄️', '☃️', '🧊'], modo: 'cae', n: 30 }, cumple: { e: ['🎂', '🎉', '🎈', '🎁'], modo: 'cae', n: 22 },
  cafe: { e: ['☕', '🥐'], modo: 'sube', n: 10 }, sueno: { e: ['💤', '🌙', '⭐'], modo: 'sube', n: 14 },
  sonrisa: { e: ['😊', '🌼', '☺️'], modo: 'sube', n: 10 }, enojo: { e: ['😤', '💢'], modo: 'explota', n: 8 },
  abrazo: { e: ['🤗', '💛', '🐻'], modo: 'sube', n: 12 }, si: { e: ['✅', '👍'], modo: 'sube', n: 6 }, no: { e: ['🙅', '❌'], modo: 'explota', n: 6 },
  piedra: { e: ['✊'], modo: 'explota', n: 1, grande: true }, papel: { e: ['✋'], modo: 'explota', n: 1, grande: true }, tijera: { e: ['✌️'], modo: 'explota', n: 1, grande: true },
  trofeo: { e: ['🏆', '🎉', '✨'], modo: 'explota', n: 14 }
};

export function crearEfectos(lienzo) {
  const ctx = lienzo.getContext('2d');
  let W = 0, H = 0, dpr = 1, parts = [], raf = 0, last = 0;

  function ajustar() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = lienzo.clientWidth; H = lienzo.clientHeight;
    lienzo.width = W * dpr; lienzo.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  new ResizeObserver(ajustar).observe(lienzo); ajustar();

  const r = (a, b) => a + Math.random() * (b - a);
  const pick = (l) => l[Math.floor(Math.random() * l.length)];

  /* ---------- Dibujos ---------- */
  function corazon(x, y, s, color) {
    if (!(s > 1)) return;
    ctx.fillStyle = color; ctx.strokeStyle = BORDE; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + s * .3);
    ctx.bezierCurveTo(x, y, x - s * .5, y, x - s * .5, y + s * .3);
    ctx.bezierCurveTo(x - s * .5, y + s * .6, x, y + s * .8, x, y + s);
    ctx.bezierCurveTo(x, y + s * .8, x + s * .5, y + s * .6, x + s * .5, y + s * .3);
    ctx.bezierCurveTo(x + s * .5, y, x, y, x, y + s * .3);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; // brillo
    ctx.beginPath(); ctx.ellipse(x - s * .24, y + s * .26, s * .08, s * .12, -.6, 0, Math.PI * 2); ctx.fill();
  }
  function globo(p) {
    const { x, y, s, color } = p;
    ctx.strokeStyle = 'rgba(30,40,70,.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y + s * .62);
    ctx.quadraticCurveTo(x + Math.sin(p.t * 3) * 10, y + s * 1.2, x, y + s * 1.9); ctx.stroke();
    ctx.fillStyle = color; ctx.strokeStyle = BORDE; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y, s * .5, s * .62, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 5, y + s * .66); ctx.lineTo(x + 5, y + s * .66); ctx.lineTo(x, y + s * .58); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.beginPath(); ctx.ellipse(x - s * .18, y - s * .22, s * .1, s * .18, -.5, 0, Math.PI * 2); ctx.fill();
  }
  function emoji(p) {
    ctx.font = p.s + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.e, p.x, p.y);
  }
  // Florcita amarilla: cinco pétalos y el centro
  function flor(p) {
    ctx.fillStyle = '#ffd200';
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * p.s * .28, p.y + Math.sin(a) * p.s * .28, p.s * .24, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#e8b93a'; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * .18, 0, Math.PI * 2); ctx.fill();
  }

  /* ---------- Emisores ---------- */
  function add(p) { parts.push(Object.assign({ t: 0, vida: 2, rot: 0, vr: 0, g: 0, a: 1 }, p)); }

  const EMISORES = {
    like(o) { burstEmoji('👍', o, 9); },
    nomegusta(o) { burstEmoji('👎', o, 6, true); },
    ok(o) { burstEmoji('👌', o, 7); },
    // Un corazón grande que late donde está la mano y una lluvia de corazones que sube por toda la pantalla
    corazon(o) {
      add({ k: 'corazon', grande: true, x: o.x, y: o.y - 90, vx: 0, vy: -30, s: 180, color: '#ffdd00', vida: 1.8 });
      for (let i = 0; i < 18; i++) add({ k: 'corazon', x: o.x + r(-70, 70), y: o.y + r(-30, 30), vx: r(-220, 220), vy: r(-420, -160), s: r(36, 80), color: pick(AMARILLOS), vida: r(2.6, 3.6), g: 60 });
      for (let i = 0; i < 16; i++) add({ k: 'corazon', x: r(0, W), y: H + r(0, 160), vx: r(-20, 20), vy: r(-320, -200), s: r(30, 70), color: pick(AMARILLOS), vida: 5 });
    },
    // Globos que entran ya desde el borde de abajo y suben rápido
    globos() {
      for (let i = 0; i < 26; i++) add({ k: 'globo', x: r(W * .04, W * .96), y: H + r(20, 260), vx: r(-20, 20), vy: r(-340, -220), s: r(70, 120), color: pick(VIVOS), vida: 6 });
    },
    confeti() {
      for (let i = 0; i < 260; i++) add({ k: 'confeti', x: r(0, W), y: r(-H * .5, -10), vx: r(-40, 40), vy: r(80, 260), s: r(6, 12), color: pick(AMARILLOS_CONFETI), rot: r(0, 6), vr: r(-8, 8), vida: 5 });
    },
    fuegos() {
      for (let k = 0; k < 6; k++) setTimeout(() => {
        const cx = r(W * .15, W * .85), cy = r(H * .12, H * .45), color = pick(['#ffdd00', '#ffe680', '#ffffff', '#c9d3e6']);
        for (let i = 0; i < 70; i++) { const a = r(0, Math.PI * 2), v = r(120, 340); add({ k: 'chispa', x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: r(2, 4), color, g: 160, vida: r(1, 1.8) }); }
      }, k * 380);
    },
    jardin(o) {
      for (let i = 0; i < 18; i++) add({ k: 'flor', x: o.x + r(-30, 30), y: o.y, vx: r(-160, 160), vy: r(-520, -300), s: r(26, 40), g: 900, vida: 2.2 });
    },
    sol() {
      add({ k: 'rayos', x: W / 2, y: H * .18, s: Math.min(W, H) * .5, vida: 2.4 });
    }
  };
  function emojis(cfg, o) {
    const sube = cfg.modo === 'sube', cae = cfg.modo === 'cae';
    if (cfg.grande) { add({ k: 'emoji', e: cfg.e[0], x: o.x, y: o.y - 20, vx: 0, vy: -40, s: 200, vida: 2, pop: true }); return; }
    for (let i = 0; i < cfg.n; i++) {
      const e = pick(cfg.e);
      if (cae) add({ k: 'emoji', e, x: r(0, W), y: r(-H * .5, -20), vx: r(-30, 30), vy: r(110, 280), s: r(38, 76), vida: 6, g: 0 });
      else if (sube) add({ k: 'emoji', e, x: o.x + r(-60, 60), y: o.y + r(-20, 20), vx: r(-110, 110), vy: r(-380, -170), s: r(36, 72), vida: r(1.8, 2.8), g: 50 });
      else { const a = r(0, Math.PI * 2), v = r(160, 440); add({ k: 'emoji', e, x: o.x, y: o.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, s: r(36, 76), vida: r(1.5, 2.4), g: 280 }); }
    }
    add({ k: 'emoji', e: cfg.e[0], x: o.x, y: o.y - 30, vx: 0, vy: -50, s: 130, vida: 1.5, pop: true }); // uno grande que "salta" primero
  }
  function burstEmoji(e, o, n, cae) {
    add({ k: 'emoji', e, x: o.x, y: o.y, vx: 0, vy: cae ? 40 : -60, s: 120, vida: 1.6, pop: true });
    for (let i = 0; i < n; i++) add({ k: 'emoji', e, x: o.x + r(-30, 30), y: o.y + r(-10, 10), vx: r(-120, 120), vy: cae ? r(60, 180) : r(-320, -160), s: r(34, 64), vida: r(1.6, 2.6), g: cae ? 120 : 60 });
  }

  function lanzar(tipo, o = {}) {
    const em = EMISORES[tipo], cfg = EMOJIS[tipo];
    if (!em && !cfg) return;
    const pos = { x: (o.x ?? .5) * W, y: (o.y ?? .55) * H };
    if (em) em(pos); else emojis(cfg, pos);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(paso); }
  }

  function paso(now) {
    const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = Math.max(last, now); // el primer cuadro puede venir con hora anterior al disparo
    ctx.clearRect(0, 0, W, H);
    parts = parts.filter(p => p.t < p.vida && p.y < H + 600 && p.y > -900);
    for (const p of parts) {
      p.t += dt;
      if (!RM) { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
      const fin = Math.min(1, (p.vida - p.t) / .5);
      ctx.globalAlpha = Math.max(0, fin);
      if (p.k === 'emoji') {
        const s = p.pop ? p.s * Math.min(1, p.t * 6) * (1 + Math.sin(Math.min(1, p.t * 4) * Math.PI) * .25) : p.s;
        emoji({ e: p.e, x: p.x, y: p.y, s });
      } else if (p.k === 'corazon') {
        // El grande aparece de golpe y late dos veces
        const s = p.grande ? p.s * Math.min(1, p.t * 7) * (1 + Math.abs(Math.sin(p.t * 7)) * .12) : p.s;
        corazon(p.x, p.y - s / 2, s, p.color);
      }
      else if (p.k === 'globo') { p.x += Math.sin(p.t * 1.5 + p.s) * .4; globo(p); }
      else if (p.k === 'confeti') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2 * Math.abs(Math.cos(p.t * 6))); ctx.restore();
      } else if (p.k === 'chispa') { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill(); }
      else if (p.k === 'flor') flor(p);
      else if (p.k === 'rayos') {
        const a = Math.sin(Math.min(1, p.t / p.vida) * Math.PI);
        const rr = p.s > 0 && isFinite(p.s) ? p.s : 400, g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
        g.addColorStop(0, 'rgba(255,221,0,' + (.55 * a) + ')'); g.addColorStop(1, 'rgba(255,221,0,0)');
        ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
    }
    ctx.globalAlpha = 1;
    raf = parts.length ? requestAnimationFrame(paso) : 0;
    if (!raf) ctx.clearRect(0, 0, W, H);
  }

  return { lanzar, get activos() { return parts.length; } };
}
