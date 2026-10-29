"""Hornea las texturas de Uku v2 (assets/oso/tex/) desde su geometría.

En el mundo, las piezas con textura se dibujan sin luz (MeshBasicMaterial): la textura es el aspecto final.
Por eso cada texel se calcula en 3D, en la pose de reposo del modelo:
  - qué es (pelaje, parche claro, oreja, uñas): sale de la textura anterior, con bordes nítidos (se suaviza
    la máscara de cada clase y se vuelve a cortar), y sin los ojos, la nariz ni la boca pintados: esos los
    dibuja ahora el shader de la cara (uku-rig.js › cara), que puede pestañear y hablar;
  - el suéter (azul), la guayabera (lino) y la bufanda (amarilla) son patrones en 3D: punto acanalado en
    puños, ruedo y bufanda, punto fino en el cuerpo. Así no dependen del atlas UV, que viene en pedazos;
  - la luz: oclusión ambiental (cuánto cielo ve cada punto, con 48 mapas de profundidad) y una luz suave
    desde arriba y adelante. Queda como un muñeco de vinilo con sombras suaves, no un dibujo plano.

Uso: python3 tools/uku-hornea.py   (escribe assets/oso/tex/*.png y actualiza los materiales de uku-rig-v2.glb)
Necesita numpy y Pillow. Tarda un par de minutos.
"""
import json, os, struct, sys
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from glb import Glb  # noqa: E402
from raster import rasterizar, dilatar  # noqa: E402

OSO = os.path.join(AQUI, '..', 'assets', 'oso')
GLB = os.path.join(OSO, 'uku-rig-v2.glb')
TEX = os.path.join(OSO, 'tex')
FUENTE = os.path.join(OSO, 'tex-original')  # las texturas del archivo: de ahí salen las clases (no se tocan)

# Paleta (sRGB). El pelaje gris azulado de siempre, un poco más limpio
PELAJE = np.array([134, 143, 160.]); CLARO = np.array([228, 231, 238.]); OREJA = np.array([70, 102, 168.]); UNAS = np.array([30, 52, 98.])
AZUL = np.array([42, 78, 160.])       # el suéter
LINO = np.array([242, 238, 226.])     # la guayabera, con calor
AMARILLO = np.array([246, 196, 38.])  # la bufanda
LENTES = [1.0, .69, 0.0]              # lineal (glTF): un amarillo intenso


def caja(a, r, eje):
    """Promedio móvil de ancho 2r+1 (con cumsum), en un eje."""
    if r < 1: return a
    pad = [(0, 0)] * a.ndim; pad[eje] = (r + 1, r)
    c = np.cumsum(np.pad(a, pad, mode='edge'), axis=eje)
    n = a.shape[eje]
    return (np.take(c, range(2 * r + 1, 2 * r + 1 + n), axis=eje) - np.take(c, range(0, n), axis=eje)) / (2 * r + 1)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def suavizar(a, r):
    for _ in range(3):
        a = caja(caja(a, r, 0), r, 1)
    return a


# ---------- Geometría ----------
g = Glb(GLB)
prims = g.primitivas()
por_mat = {p['material']: p for p in prims}


def fibonacci(n):
    i = np.arange(n) + .5
    phi = np.arccos(1 - 2 * i / n); th = np.pi * (1 + 5 ** .5) * i
    return np.c_[np.cos(th) * np.sin(phi), np.cos(phi), np.sin(th) * np.sin(phi)]


DIRS = fibonacci(48)
RES_P = 384


def mapas(sin=()):
    """Un mapa de profundidad por dirección, con todas las piezas menos los lentes (y las de `sin`)."""
    oc = [p for p in prims if p['material'] != 'lentes_amarillo' and p['material'] not in sin]
    TP = np.concatenate([p['pos'] for p in oc])
    TT = np.concatenate([p['tri'] + sum(len(q['pos']) for q in oc[:i]) for i, p in enumerate(oc)])
    out = []
    print('mapas de profundidad' + (' sin ' + ', '.join(sin) if sin else '') + '…', flush=True)
    for d in DIRS:
        a = np.cross(d, [0, 1, 0] if abs(d[1]) < .9 else [1, 0, 0]); a /= np.linalg.norm(a); b = np.cross(d, a)
        u, v = TP @ a, TP @ b
        lo, hi = min(u.min(), v.min()) - .02, max(u.max(), v.max()) + .02
        k = RES_P / (hi - lo)
        z = TP @ d
        val, ok, _ = rasterizar(np.c_[(u - lo) * k, (v - lo) * k], z[:, None], TT, RES_P, RES_P, prof=z)
        out.append((a, b, lo, k, np.where(ok, val[..., 0], -np.inf)))
    return out


_MAPAS = {}


def oclusion(P, Nn, sin=()):
    """Cuánto cielo ve cada punto (0–1), pesado por el coseno con su normal."""
    if sin not in _MAPAS: _MAPAS[sin] = mapas(sin)
    vis = np.zeros(len(P)); peso = np.zeros(len(P))
    for d, (a, b, lo, k, prof) in zip(DIRS, _MAPAS[sin]):
        c = Nn @ d
        m = c > 0
        if not m.any(): continue
        x = np.clip(((P[m] @ a) - lo) * k, 0, RES_P - 1).astype(int); y = np.clip(((P[m] @ b) - lo) * k, 0, RES_P - 1).astype(int)
        z = P[m] @ d
        libre = z + .012 >= prof[y, x]
        vis[m] += libre * c[m]; peso[m] += c[m]
    return np.where(peso > 0, vis / np.maximum(peso, 1e-9), 1)


LUZ = np.array([-.35, .8, .55]); LUZ /= np.linalg.norm(LUZ)


def luz(P, Nn, cuanto=1.0, sin=()):
    ao = oclusion(P, Nn, sin)
    ao = np.clip(ao * 1.25, 0, 1) ** 1.3                    # el cielo abierto no se oscurece; los huecos sí
    lam = np.clip(Nn @ LUZ * .5 + .5, 0, 1)                # media Lambert: sin negro del lado oscuro
    alto = np.clip((P[:, 1] - .2) / 1.5, 0, 1)              # un poco más claro arriba
    s = (.62 + .38 * ao) * (.84 + .2 * lam) * (.96 + .06 * alto)
    return 1 + (s - 1) * cuanto


def texeles(p, res):
    """Para cada texel cubierto: su punto 3D y su normal (en reposo)."""
    val, ok, _ = rasterizar(p['uv'] * res, np.c_[p['pos'], p['normal']], p['tri'], res, res)
    Nn = val[..., 3:]; Nn /= np.maximum(np.linalg.norm(Nn, axis=-1, keepdims=True), 1e-9)
    return val[..., :3], Nn, ok


def guardar(nombre, img, ok, pasos=16):
    img, ok2 = dilatar(img, ok, pasos)
    resto = ~ok2
    if resto.any(): img[resto] = img[ok2].mean(0)
    Image.fromarray(np.clip(img, 0, 255).round().astype(np.uint8)).save(os.path.join(TEX, nombre + '.png'), optimize=True)
    print('  ', nombre, flush=True)


# ---------- Pelaje (cabeza, brazos, piernas) ----------
CLASES = [PELAJE, CLARO, OREJA, UNAS]
REF = np.array([[134, 144, 157], [218, 221, 230], [40, 90, 160], [11, 39, 80.]])


def pelaje(mat, imagen, res, cara=False, unas=True):
    print(mat, flush=True)
    p = por_mat[mat]
    P, Nn, ok = texeles(p, res)
    vieja = np.asarray(Image.open(os.path.join(FUENTE, imagen + '.png')).convert('RGB').resize((res, res), Image.BICUBIC)).astype(float)
    # Pesos de cada clase por cercanía de color
    d = np.stack([np.linalg.norm(vieja - c, axis=-1) for c in REF], -1)
    w = np.exp(-(d / 28.) ** 2)
    # La oreja: el azul difuso del interior, también en sus tonos intermedios
    azul = (vieja[..., 2] - vieja[..., 0]) > 30
    if cara:
        w[..., 2] = np.maximum(w[..., 2], azul & (vieja.sum(-1) > 250))
        w[..., 3] *= ~(azul & (vieja.sum(-1) > 250))
    else:
        # Manos y patas: no hay oreja. Los trazos de las uñas (azulados y más oscuros que el pelaje) quedan como uñas
        w[..., 2] = 0
        w[..., 3] = np.maximum(w[..., 3], azul * smooth(390, 300, vieja.sum(-1))) if unas else 0
    if cara:
        # Ojos, nariz y boca pintados: fuera (los dibuja el shader). En el hocico quedan claros; los ojos, pelaje
        X, Y, Z = P[..., 0], P[..., 1], P[..., 2]
        frente = ok & (Z > .18) & (np.abs(X) < .17) & (Y > 1.27) & (Y < 1.53)
        hocico = ((X / .108) ** 2 + ((Y - 1.338) / .094) ** 2) < 1
        oscuro = frente & ((w[..., 3] > .02) | (vieja.sum(-1) < 520))
        w[oscuro] = 0
        w[oscuro & hocico, 1] = 1; w[oscuro & ~hocico, 0] = 1
    w = w / np.maximum(w.sum(-1, keepdims=True), 1e-9)
    w = np.stack([suavizar(w[..., i], 2) for i in range(4)], -1)
    w = w ** 7; w /= np.maximum(w.sum(-1, keepdims=True), 1e-9)       # bordes nítidos, con antialias
    base = sum(w[..., i:i + 1] * CLASES[i] for i in range(4))
    img = np.zeros((res, res, 3))
    img[ok] = base[ok] * luz(P[ok], Nn[ok])[:, None]
    guardar(imagen, img, ok)


# ---------- Ropa ----------
def ropa():
    print('ropa', flush=True)
    p = por_mat['Material_0']; res = 2048
    P, Nn, ok = texeles(p, res)
    Q, M = P[ok], Nn[ok]
    X, Y, Z = Q[:, 0], Q[:, 1], Q[:, 2]
    V = p['pos']
    manga = np.abs(X) > .3
    mx = np.abs(V[:, 0]) > .5
    yc, zc = V[mx, 1].mean(), V[mx, 2].mean()
    ruedo = V[:, 1].min(); puno = np.abs(V[:, 0]).max()
    # Alrededor del cuerpo (o del brazo) y a lo largo
    ang_c = np.arctan2(X, Z) * .26
    ang_m = np.arctan2(Z - zc, Y - yc) * .085
    alrededor = np.where(manga, ang_m, ang_c)
    a_lo_largo = np.where(manga, np.abs(X), Y)
    # Punto fino (columnas de «V» muy suaves) y acanalado en ruedo y puños
    col = alrededor / .0105; fila = a_lo_largo / .0085
    v = np.abs((col % 1) - .5) * 2
    punto = 1 - .07 * smooth(.25, .0, np.abs(v - (fila % 1)))
    banda = np.where(manga, smooth(puno - .075, puno - .06, np.abs(X)), smooth(ruedo + .075, ruedo + .06, Y))
    canal = .9 + .1 * np.abs(np.cos(alrededor / .0125 * np.pi))
    tex = np.where(banda > .5, canal, punto)
    borde = 1 - .1 * banda * smooth(.004, 0, np.abs(np.where(manga, puno - .075 - np.abs(X), Y - ruedo - .075)))
    for nombre, color, k in (('uku_ropa', AZUL, 1.0), ('uku_ropa_lino', LINO, .45)):
        # con la guayabera no hay bufanda: su sombra no va
        l = luz(Q, M, sin=('bufanda_azul', 'bufanda_amarilla') if nombre == 'uku_ropa_lino' else ())
        img = np.zeros((res, res, 3))
        t = 1 + (tex * borde - 1) * k
        if nombre == 'uku_ropa_lino':
            # Guayabera: lino liso con sus dos pliegues al frente (sin punto ni acanalado)
            t = (1 + (punto - 1) * .2) * (1 - .1 * ((~manga) & (Z > .05) & (np.abs(np.abs(X) - .085) < .0035)))
        img[ok] = color * t[:, None] * l[:, None]
        guardar(nombre, img, ok)


def bufanda():
    print('bufanda', flush=True)
    p = por_mat.get('bufanda_amarilla') or por_mat['bufanda_azul']; res = 1024
    P, Nn, ok = texeles(p, res)
    Q, M = P[ok], Nn[ok]
    X, Y, Z = Q[:, 0], Q[:, 1], Q[:, 2]
    # Acanalado: en la vuelta al cuello, a lo largo de la vuelta; en la punta que cuelga, vertical
    vuelta = Y > 1.12
    alrededor = np.where(vuelta, Y, X + Z * .3)
    canal = .88 + .12 * np.abs(np.cos(alrededor / .011 * np.pi))
    img = np.zeros((res, res, 3))
    img[ok] = AMARILLO * canal[:, None] * luz(Q, M)[:, None]
    guardar('uku_bufanda', img, ok)


# ---------- Materiales del .glb ----------
def materiales():
    b = open(GLB, 'rb').read()
    lj = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + lj]); resto = b[20 + lj:]
    imgs = [i.get('name') for i in j['images']]
    if 'uku_bufanda' not in imgs:
        j['images'].append({'uri': 'tex/uku_bufanda.png', 'name': 'uku_bufanda'})
        j['textures'].append({'sampler': 0, 'source': len(j['images']) - 1})
    tb = next(i for i, t in enumerate(j['textures']) if j['images'][t['source']]['name'] == 'uku_bufanda')
    for m in j['materials']:
        if m['name'] in ('bufanda_azul', 'bufanda_amarilla'):
            m['name'] = 'bufanda_amarilla'
            m['pbrMetallicRoughness'] = {'baseColorTexture': {'index': tb}, 'metallicFactor': 0}
        if m['name'] == 'lentes_amarillo':
            m['pbrMetallicRoughness']['baseColorFactor'] = LENTES + [1]
    s = json.dumps(j, separators=(',', ':')).encode()
    s += b' ' * ((4 - len(s) % 4) % 4)
    total = 12 + 8 + len(s) + len(resto)
    open(GLB, 'wb').write(b[:4] + struct.pack('<I', 2) + struct.pack('<I', total) + struct.pack('<I', len(s)) + b'JSON' + s + resto)
    print('glb: bufanda amarilla con textura, lentes amarillos')


if __name__ == '__main__':
    solo = sys.argv[1:]
    if solo:
        for n in solo: {'cabeza': lambda: pelaje('uku_cabeza', 'uku_cabeza_final', 2048, cara=True), 'brazos': lambda: pelaje('uku_brazos', 'uku_brazos', 1024),
                         'piernas': lambda: pelaje('uku_piernas', 'uku_piernas_final', 1024, unas=False), 'ropa': ropa, 'bufanda': bufanda, 'glb': materiales}[n]()
        sys.exit()
    pelaje('uku_cabeza', 'uku_cabeza_final', 2048, cara=True)
    pelaje('uku_brazos', 'uku_brazos', 1024)
    pelaje('uku_piernas', 'uku_piernas_final', 1024, unas=False)  # patas limpias: las manchas de los dedos se veían borrosas
    ropa()
    bufanda()
    materiales()
