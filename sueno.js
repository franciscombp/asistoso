/* =====================================================================
   Uku · el sueño (atmósfera de ilusión)
   Que todo el claro parezca un sueño idílico:
   - Polvo de luz: motas doradas que flotan despacio entre los árboles
     (puntos con brillo aditivo, de dos tamaños, que titilan).
   - Bokeh: discos grandes y borrosos muy cerca de la cámara, como una
     lente con poco foco; se mueven con la cámara.
   - Bruma: la niebla de la escena se acerca y todo lo lejano se aclara.
   El desenfoque de los bordes que sigue a Uku, el brillo cálido y los
   rayos de luz son de mimo.css (.mimo-sueno, .mimo-brillo, .mimo-rayos).
   ?sueno=0 lo apaga.
   ===================================================================== */
const r = (a, b) => a + Math.random() * (b - a);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function crearSueno(b3d) {
  const { THREE, scene, camera } = b3d.mundo3d();
  const grupo = new THREE.Group(); grupo.name = 'sueno'; scene.add(grupo);

  // Textura suave: un disco con borde difuso; con `anillo`, un poco más marcado en el borde (el bokeh real)
  const disco = (anillo) => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), d = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    d.addColorStop(0, 'rgba(255,255,255,' + (anillo ? .55 : 1) + ')'); d.addColorStop(anillo ? .78 : .35, 'rgba(255,255,255,' + (anillo ? .75 : .7) + ')'); d.addColorStop(anillo ? .92 : 1, 'rgba(255,255,255,' + (anillo ? .95 : 0) + ')'); if (anillo) d.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = d; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };

  /* ---------- Polvo de luz ---------- */
  function motas(n, tam, color, opacidad, mezcla) {
    const pos = new Float32Array(n * 3), fase = new Float32Array(n), vel = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = r(-2.6, 2.6); pos[i * 3 + 1] = r(0, 2.4); pos[i * 3 + 2] = r(-2.8, 2.4); fase[i] = r(0, 6.28); vel[i] = r(.025, .085); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ map: disco(false), color, size: tam, transparent: true, opacity: opacidad, depthWrite: false, blending: mezcla, fog: false });
    const o = new THREE.Points(g, m); o.frustumCulled = false; grupo.add(o);
    return { o, m, g, pos, fase, vel, n, base: opacidad };
  }
  // Pequeñas y doradas (se ven sobre el día y brillan de noche) y unas pocas grandes y suaves
  const polvo = [motas(240, .06, '#ffc93a', .95, THREE.NormalBlending), motas(60, .16, '#fff1b0', .38, THREE.AdditiveBlending)];

  /* ---------- Bokeh: discos borrosos cerca de la lente ---------- */
  const bokeh = [];
  const tex = [disco(false), disco(true)];
  for (let i = 0; i < 11; i++) {
    const m = new THREE.SpriteMaterial({ map: tex[i % 2], color: i % 3 === 0 ? '#fff3c4' : '#ffd24d', transparent: true, opacity: r(.07, .16), depthWrite: false, depthTest: false, fog: false });
    const o = new THREE.Sprite(m); o.renderOrder = 50; const t = r(.45, 1.1); o.scale.set(t, t, 1); grupo.add(o);
    // posición respecto de la cámara (x a la derecha, y arriba, z hacia adelante)
    bokeh.push({ o, m, x: r(-1.1, 1.1), y: r(-.6, .7), z: r(1.3, 2.4), v: new THREE.Vector2(r(-.02, .02), r(.01, .035)), base: m.opacity, fase: r(0, 6.28) });
  }

  /* ---------- Bruma ---------- */
  if (scene.fog) { scene.fog.near = 3.8; scene.fog.far = 9; }

  const _o = new THREE.Vector3();
  function paso(dt, t) {
    dt = Math.min(.05, Math.max(0, dt));
    polvo.forEach((P) => {
      for (let i = 0; i < P.n; i++) {
        let y = P.pos[i * 3 + 1] + P.vel[i] * dt;
        if (y > 2.5) { y = -.05; P.pos[i * 3] = r(-2.6, 2.6); P.pos[i * 3 + 2] = r(-2.8, 2.4); }
        P.pos[i * 3 + 1] = y;
        if (!RM) { P.pos[i * 3] += Math.sin(t * .5 + P.fase[i]) * .03 * dt; P.pos[i * 3 + 2] += Math.cos(t * .4 + P.fase[i] * 1.3) * .025 * dt; }
      }
      P.g.attributes.position.needsUpdate = true;
      P.m.opacity = P.base * (.82 + Math.sin(t * .9) * .18); // todo el polvo respira despacio
    });
    camera.updateMatrixWorld();
    bokeh.forEach((b) => {
      if (!RM) { b.x += b.v.x * dt; b.y += b.v.y * dt; if (b.y > .85) { b.y = -.75; b.x = r(-1.1, 1.1); } if (Math.abs(b.x) > 1.3) b.v.x = -b.v.x; }
      _o.set(b.x, b.y, -b.z).applyQuaternion(camera.quaternion).add(camera.position);
      b.o.position.copy(_o);
      b.m.opacity = b.base * (.7 + Math.sin(t * .6 + b.fase) * .3);
    });
  }
  b3d.enCuadro(paso);
  return { motas: polvo.reduce((n, p) => n + p.n, 0), bokeh: bokeh.length };
}
