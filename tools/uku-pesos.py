"""Re-pesa el rig de Uku: assets/oso/uku-rig-v2.glb → assets/oso/uku-rig-v3.glb.

Solo cambian JOINTS_0 y WEIGHTS_0 de las cinco primitivas con skin (bufanda, ropa, cabeza, piernas, manos). La malla en
reposo, las normales, las UV, las texturas, los huesos, las inverseBindMatrices y las clips quedan byte a byte iguales:
la silueta de Uku no cambia, solo cómo se dobla. Los pesos nuevos se calculan en el espacio del bind con la geometría
del cuerpo (ver uku-rig-mide.py para la medición antes/después):
  1. Cápsulas por hueso: cada hueso es un segmento a→b (posiciones de los huesos en bind) con radio r y un margen m
     en los extremos; peso crudo = f(d_perp / r) · f(e / m), con f(s) = (1 − s²)² (suave, C1, cero fuera), d_perp la
     distancia radial al eje y e cuánto se pasa el punto de los extremos del segmento. Así dos huesos vecinos se
     funden solo en una franja de ±m alrededor de la articulación, y el radio separa el muslo de la cadera, la manga
     del pecho, el cuello de la cabeza. En la columna y la cabeza el radio es enorme: manda solo la altura.
  2. Restricciones por parte y región (PARTES): qué huesos puede usar cada vértice según su primitiva y dónde está
     en reposo (lado izquierdo/derecho, manga/torso, franja central de la entrepierna), antes de normalizar. Nunca una
     pierna pesa a la otra; las manos van a Hand (no a los dedos HandIndex, que los clips de Mixamo curvan);
     HeadTop_End, Toe_End y HandIndex pesan 0. Si un vértice queda fuera de toda cápsula, toma el hueso permitido
     más cercano.
  3. Ropa: cápsulas con sus propias regiones (el torso no existe como malla del cuerpo). Bufanda: copia los pesos
     del cuerpo que cubre (los K vértices más cercanos de cabeza y ropa ya re-pesadas, ponderados por 1/d), limitada a
     cuello, cabeza y torso alto.
  4. Suavizado laplaciano sobre el grafo de aristas de cada primitiva, con las costuras del atlas UV soldadas (los
     vértices con la misma posición son un solo nodo y reciben el mismo peso: no se abren las costuras); después se
     vuelve a aplicar la máscara de la parte, se dejan los 4 huesos mayores, se quitan los pesos < UMBRAL y se normaliza.
  5. Se escriben los pesos nuevos en su sitio del BIN (mismos accessors, mismo tamaño: ningún offset cambia).

Uso: python3 tools/uku-pesos.py [entrada.glb] [salida.glb] [--sin-suavizar]   (por defecto v2 → v3)
Necesita numpy. Tarda unos segundos. Después: python3 tools/uku-rig-mide.py assets/oso/uku-rig-v3.glb --costuras
"""
import importlib.util, json, os, struct, sys
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
_m = importlib.util.spec_from_file_location('mide', os.path.join(AQUI, 'uku-rig-mide.py'))
mide = importlib.util.module_from_spec(_m); _m.loader.exec_module(mide)  # Rig, aristas, segmento_dist
OSO = os.path.join(AQUI, '..', 'assets', 'oso')
ENTRADA = os.path.join(OSO, 'uku-rig-v2.glb'); SALIDA = os.path.join(OSO, 'uku-rig-v3.glb')

# ---------- Parámetros (metros, espacio del bind) ----------
PASADAS = {'uku_piernas': 8, 'uku_brazos': 3, 'uku_cabeza': 2, 'Material_0': 3, 'bufanda_amarilla': 3}  # pasadas de suavizado laplaciano por parte
LAMBDA = .5       # cuánto se acerca cada pasada a la media de los vecinos
UMBRAL = .02      # pesos menores se quitan
K_COPIA = 3       # vecinos del cuerpo que promedia la bufanda
MAX_HUESOS = 4

# Cápsulas: hueso → (inicio, fin, radio, margen). Los nombres cortos son los de Mixamo sin "mixamorig:"; 'J:x' es la
# posición en bind del hueso x; una tupla es una posición fija. Para la columna, el cuello y la cabeza el radio es
# grande (manda la altura); en los miembros el radio separa el hueso de lo que tiene al lado.
CAPSULAS = {
    # bajo cuerpo. La cadera tiene dos cápsulas: la pelvis (ancha, hasta el inicio de Spine, con margen largo hacia
    # abajo que se funde con los muslos) y una virtual por el centro (el vientre bajo y la entrepierna, estrecha)
    'Hips': [((0, .50, 0), 'J:Spine', 1.0, (.18, .07)), ((0, .28, 0), (0, .50, 0), .10, (.05, .05))],
    # los muslos: solo altura (la pelvis es ancha) y un fundido lateral desde el centro: 0 en |x| ≤ .03, 1 en |x| ≥ .16
    'LeftUpLeg': [('J:LeftUpLeg', 'J:LeftLeg', 1.0, (.10, .05), (.03, .16))], 'RightUpLeg': [('J:RightUpLeg', 'J:RightLeg', 1.0, (.10, .05), (.03, .16))],
    'LeftLeg': [('J:LeftLeg', 'J:LeftFoot', .20, (.05, .04))], 'RightLeg': [('J:RightLeg', 'J:RightFoot', .20, (.05, .04))],
    'LeftFoot': [('J:LeftFoot', 'J:LeftToeBase', .16, (.04, .04))], 'RightFoot': [('J:RightFoot', 'J:RightToeBase', .16, (.04, .04))],
    'LeftToeBase': [('J:LeftToeBase', 'J:LeftToe_End', .10, (.04, .06))], 'RightToeBase': [('J:RightToeBase', 'J:RightToe_End', .10, (.04, .06))],
    # columna (solo altura) y cuello/cabeza (la cabeza se funde con el cuello entre y 1.19 y 1.31)
    'Spine': [('J:Spine', 'J:Spine1', 1.0, (.07, .07))], 'Spine1': [('J:Spine1', 'J:Spine2', 1.0, (.07, .07))],
    'Spine2': [('J:Spine2', 'J:Neck', 1.0, (.07, .07))],
    'Neck': [((0, 1.105, 0), (0, 1.25, 0), 1.0, (.06, .06))], 'Head': [((0, 1.25, 0), (0, 1.75, 0), 1.0, (.06, .06))],
    # brazos (las mangas): clavícula, brazo, antebrazo y la mano entera como un bloque
    'LeftShoulder': [('J:LeftShoulder', 'J:LeftArm', .14, (.04, .04))], 'RightShoulder': [('J:RightShoulder', 'J:RightArm', .14, (.04, .04))],
    'LeftArm': [('J:LeftArm', 'J:LeftForeArm', .14, (.04, .04))], 'RightArm': [('J:RightArm', 'J:RightForeArm', .14, (.04, .04))],
    'LeftForeArm': [('J:LeftForeArm', 'J:LeftHand', .13, (.04, .03))], 'RightForeArm': [('J:RightForeArm', 'J:RightHand', .13, (.04, .03))],
    'LeftHand': [('J:LeftHand', 'J:LeftHandIndex3', .14, (.03, .10))], 'RightHand': [('J:RightHand', 'J:RightHandIndex3', .14, (.03, .10))],
}
# La ropa tiene sus propias cápsulas donde hace falta: la columna con radio finito (el pecho y la barriga, sin llegar
# a las mangas), el cuello solo cerca del eje (el cuello del suéter), Spine2 alargado hasta el cuello del suéter, y
# brazos más gruesos (la manga es más ancha que el brazo)
CAPSULAS_PARTE = {('Mesh_0.003', 'Material_0'): {
    'Hips': [((0, .45, 0), 'J:Spine', .60, (.16, .07))], 'Spine': [('J:Spine', 'J:Spine1', .55, (.07, .07))],
    'Spine1': [('J:Spine1', 'J:Spine2', .50, (.07, .07))], 'Spine2': [('J:Spine2', (0, 1.25, 0), .46, (.07, .06))],
    'Neck': [((0, 1.105, 0), (0, 1.25, 0), .20, (.06, .06))],
    'LeftShoulder': [('J:LeftShoulder', 'J:LeftArm', .18, (.04, .04))], 'RightShoulder': [('J:RightShoulder', 'J:RightArm', .18, (.04, .04))],
    'LeftArm': [('J:LeftArm', 'J:LeftForeArm', .26, (.06, .04))], 'RightArm': [('J:RightArm', 'J:RightForeArm', .26, (.06, .04))],
    'LeftForeArm': [('J:LeftForeArm', 'J:LeftHand', .17, (.04, .03))], 'RightForeArm': [('J:RightForeArm', 'J:RightHand', .17, (.04, .03))],
    'LeftHand': [('J:LeftHand', 'J:LeftHandIndex3', .17, (.03, .10))], 'RightHand': [('J:RightHand', 'J:RightHandIndex3', .17, (.03, .10))],
}}
MANO = (.65, .70)  # |x| de la muñeca: de ForeArm a Hand en fundido lineal; más allá, 100 % Hand

# Partes: primitiva (malla, material) → regiones [(condición sobre la posición de reposo, huesos permitidos)]. Se
# toma la primera región que cumple. 'copia' = copia los pesos del cuerpo (lista de partes fuente) en vez de cápsulas.
COLUMNA = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck']
PIERNA = lambda L: ['Hips', L + 'UpLeg', L + 'Leg', L + 'Foot', L + 'ToeBase']
BRAZO = lambda L: [L + 'Shoulder', L + 'Arm', L + 'ForeArm', L + 'Hand']
PARTES = {
    # bajo cuerpo: en la franja central (la entrepierna, donde los muslos se juntan) pueden pesar las dos piernas, que
    # ahí ya casi no llegan (fundido lateral de los muslos, radio de las pantorrillas): así no hay salto en x = 0;
    # fuera de ella, solo la pierna de su lado
    ('Mesh_0', 'uku_piernas'): [(lambda p: abs(p[0]) <= .04, PIERNA('Left') + PIERNA('Right')), (lambda p: p[0] > 0, PIERNA('Left')), (lambda p: True, PIERNA('Right'))],
    ('Mesh_0', 'uku_brazos'): [(lambda p: p[0] > 0, ['LeftForeArm', 'LeftHand']), (lambda p: True, ['RightForeArm', 'RightHand'])],
    ('Mesh_0', 'uku_cabeza'): [(lambda p: p[1] > 1.34, ['Head']), (lambda p: True, ['Neck', 'Head'])],
    # el suéter: columna y el brazo de su lado (los radios de CAPSULAS_PARTE reparten manga y torso sin saltos); en
    # la franja central pueden pesar los dos hombros (ahí ya casi no llegan)
    ('Mesh_0.003', 'Material_0'): [(lambda p: abs(p[0]) <= .05, COLUMNA + BRAZO('Left') + BRAZO('Right')),
                                   (lambda p: p[0] > 0, COLUMNA + BRAZO('Left')), (lambda p: True, COLUMNA + BRAZO('Right'))],
    ('Mesh_0.002', 'bufanda_amarilla'): {'copia': [('Mesh_0', 'uku_cabeza'), ('Mesh_0.003', 'Material_0')], 'huesos': ['Neck', 'Head', 'Spine2', 'Spine1']},
}
CERO = ['HeadTop_End', 'LeftToe_End', 'RightToe_End'] + [L + 'HandIndex' + str(k) for L in ('Left', 'Right') for k in (1, 2, 3, 4)]


# ---------- Geometría ----------
def falloff(s):
    s = np.clip(s, 0, 1); return (1 - s * s) ** 2


def peso_capsula(P, a, b, r, m, lateral=None):
    """Peso crudo de una cápsula a→b (radio r, margen (m_a, m_b) en los extremos) para los puntos P (n,3). Con
    lateral = (x0, x1) se multiplica por un fundido en |x|: 0 hasta x0, 1 desde x1 (los muslos, desde la entrepierna)."""
    ab = b - a; L = np.linalg.norm(ab); u = ab / max(L, 1e-9)
    rel = P - a; t = rel @ u
    d = np.linalg.norm(rel - np.outer(t, u), axis=1)
    e = np.where(t < 0, -t, np.where(t > L, t - L, 0))
    mm = np.where(t < 0, m[0], m[1])
    w = falloff(d / r) * falloff(e / np.maximum(mm, 1e-9))
    if lateral: w = w * (1 - falloff((np.abs(P[:, 0]) - lateral[0]) / (lateral[1] - lateral[0])))
    return w


class Pesador:
    def __init__(self, ruta):
        self.rig = rig = mide.Rig(ruta)
        self.corto = [rig.name[jn].replace('mixamorig:', '') for jn in rig.joints]
        self.k = {n: i for i, n in enumerate(self.corto)}
        self.J = {n: rig.joint_pos(rig.bind_world, rig.name[rig.joints[i]]) for n, i in self.k.items()}
        self.prims = {}
        for m in rig.j['meshes']:
            for p in m['primitives']:
                if 'JOINTS_0' in p['attributes']: self.prims[(m['name'], rig.j['materials'][p['material']]['name'])] = p
        self.nuevos = {}  # parte → pesos densos (n, huesos)

    def punto(self, v):
        return self.J[v[2:]] if isinstance(v, str) else np.array(v, float)

    def crudo(self, P, huesos, parte=None):
        """Pesos crudos de las cápsulas de `huesos` en los puntos P; si un punto no cae en ninguna, el hueso permitido
        más cercano (por distancia a su segmento) con peso 1."""
        W = np.zeros((len(P), len(self.corto)))
        dist = np.full((len(P), len(self.corto)), np.inf)
        caps = {**CAPSULAS, **CAPSULAS_PARTE.get(parte, {})}
        for h in huesos:
            for a, b, r, m, *lat in caps[h]:
                a, b = self.punto(a), self.punto(b)
                W[:, self.k[h]] = np.maximum(W[:, self.k[h]], peso_capsula(P, a, b, r, m, lat[0] if lat else None))
                dist[:, self.k[h]] = np.minimum(dist[:, self.k[h]], mide.segmento_dist(P, a, b))
        sin = W.sum(1) < 1e-6
        W[sin, dist[sin].argmin(1)] = 1
        return W

    def mascara(self, parte, P):
        """(n, huesos) booleana: qué huesos puede usar cada vértice de la parte."""
        M = np.zeros((len(P), len(self.corto)), bool)
        reg = PARTES[parte]
        if isinstance(reg, dict):
            for h in reg['huesos']: M[:, self.k[h]] = True
            return M
        for i, p in enumerate(P):
            for cond, huesos in reg:
                if cond(p):
                    for h in huesos: M[i, self.k[h]] = True
                    break
        return M

    def grafo(self, prim):
        """Vecinos por arista, con los vértices de la misma posición (costuras UV) soldados: devuelve (nodo de cada
        vértice, lista de aristas entre nodos)."""
        pos = self.rig.g.acceso(prim['attributes']['POSITION'])
        _, nodo = np.unique(np.round(pos, 6), axis=0, return_inverse=True); nodo = nodo.ravel()
        tri = self.rig.g.acceso(prim['indices']).reshape(-1, 3)
        E = mide.aristas(dict(tri=tri)); E = nodo[E]; E = E[E[:, 0] != E[:, 1]]
        E = np.unique(np.sort(E, 1), axis=0)
        return nodo, E

    def suavizar(self, W, nodo, E, pasadas):
        """Laplaciano: w ← (1−λ)·w + λ·media(vecinos), sobre los nodos soldados; todos los vértices de un nodo salen iguales."""
        n = nodo.max() + 1
        Wn = np.zeros((n, W.shape[1])); cnt = np.zeros(n)
        np.add.at(Wn, nodo, W); np.add.at(cnt, nodo, 1); Wn /= cnt[:, None]
        grado = np.zeros(n); np.add.at(grado, E[:, 0], 1); np.add.at(grado, E[:, 1], 1)
        for _ in range(pasadas):
            S = np.zeros_like(Wn); np.add.at(S, E[:, 0], Wn[E[:, 1]]); np.add.at(S, E[:, 1], Wn[E[:, 0]])
            med = S / np.maximum(grado, 1)[:, None]
            Wn = np.where(grado[:, None] > 0, (1 - LAMBDA) * Wn + LAMBDA * med, Wn)
        return Wn[nodo]

    def rematar(self, W, M):
        """Máscara, 4 huesos mayores, umbral y normalización."""
        W = W * M
        for h in CERO: W[:, self.k[h]] = 0
        sin = W.sum(1) < 1e-9
        if sin.any():  # sin nada permitido tras suavizar: el mayor de lo permitido antes (no debería pasar)
            W[sin] = M[sin]
        orden = np.argsort(-W, 1)[:, MAX_HUESOS:]
        np.put_along_axis(W, orden, 0, 1)
        W /= W.sum(1, keepdims=True)
        W[W < UMBRAL] = 0
        W /= W.sum(1, keepdims=True)
        return W

    def pesar(self, parte, suavizar=True):
        prim = self.prims[parte]; P = self.rig.g.acceso(prim['attributes']['POSITION'])
        M = self.mascara(parte, P); reg = PARTES[parte]
        if isinstance(reg, dict):  # copia del cuerpo que cubre
            fuente = np.concatenate([self.rig.g.acceso(self.prims[f]['attributes']['POSITION']) for f in reg['copia']])
            fw = np.concatenate([self.nuevos[f] for f in reg['copia']])
            d = np.sqrt(((P[:, None, :] - fuente[None, :, :]) ** 2).sum(2))
            cerca = np.argsort(d, 1)[:, :K_COPIA]; dc = np.take_along_axis(d, cerca, 1)
            inv = 1 / np.maximum(dc, 1e-4); inv /= inv.sum(1, keepdims=True)
            W = np.einsum('vk,vkj->vj', inv, fw[cerca])
        elif parte == ('Mesh_0', 'uku_brazos'):  # manos: ForeArm → Hand por |x| (la manopla entera es un bloque)
            u = np.clip((np.abs(P[:, 0]) - MANO[0]) / (MANO[1] - MANO[0]), 0, 1)
            W = np.zeros((len(P), len(self.corto)))
            for L, s in (('Left', 1), ('Right', -1)):
                lado = (P[:, 0] * s) > 0
                W[lado, self.k[L + 'ForeArm']] = 1 - u[lado]; W[lado, self.k[L + 'Hand']] = u[lado]
        else:
            huesos = sorted({h for _, hs in reg for h in hs})
            W = self.crudo(P, huesos, parte)
        W = W * M; W /= np.maximum(W.sum(1, keepdims=True), 1e-12)
        sin = W.sum(1) < .5  # máscara sin ninguna cápsula: hueso permitido más cercano
        if sin.any():
            d = np.full((len(P), len(self.corto)), np.inf)
            caps = {**CAPSULAS, **CAPSULAS_PARTE.get(parte, {})}
            for h in self.corto:
                if h in caps:
                    for a, b, *_ in caps[h]: d[:, self.k[h]] = np.minimum(d[:, self.k[h]], mide.segmento_dist(P, self.punto(a), self.punto(b)))
            d[~M] = np.inf; W[sin] = 0; W[sin, d[sin].argmin(1)] = 1
        if suavizar:
            nodo, E = self.grafo(prim); W = self.suavizar(W, nodo, E, PASADAS[parte[1]])
        W = self.rematar(W, M)
        self.nuevos[parte] = W
        return W

    def todo(self, suavizar=True):
        orden = [('Mesh_0', 'uku_piernas'), ('Mesh_0', 'uku_brazos'), ('Mesh_0', 'uku_cabeza'), ('Mesh_0.003', 'Material_0'), ('Mesh_0.002', 'bufanda_amarilla')]
        for parte in orden:
            W = self.pesar(parte, suavizar)
            nb = (W > 0).sum(1); tot = W.sum(0); top = np.argsort(-tot)[:6]
            print('%-30s %5d v  huesos/v %.2f  dominante>.8 %3.0f%%  %s' % (parte[1], len(W), nb.mean(), 100 * (W.max(1) > .8).mean(),
                                                                          ', '.join('%s %.0f' % (self.corto[k], 100 * tot[k] / len(W)) for k in top)))

    def escribir(self, salida):
        """JOINTS_0 / WEIGHTS_0 nuevos en su sitio del BIN; el JSON no cambia (mismos accessors, mismo tamaño)."""
        g = self.rig.g; b = bytearray(g.bin)
        for parte, W in self.nuevos.items():
            at = self.prims[parte]['attributes']
            orden = np.argsort(-W, 1)[:, :4]
            Wj = np.take_along_axis(W, orden, 1).astype(np.float32); Jj = np.where(Wj > 0, orden, 0).astype(np.uint16)
            for acc, arr in ((at['JOINTS_0'], Jj), (at['WEIGHTS_0'], Wj)):
                a = g.j['accessors'][acc]; v = g.j['bufferViews'][a['bufferView']]
                assert not v.get('byteStride') and a['count'] == len(arr)
                ini = v.get('byteOffset', 0) + a.get('byteOffset', 0); raw = arr.tobytes()
                assert len(raw) == v['byteLength'] - a.get('byteOffset', 0), (acc, len(raw), v['byteLength'])
                b[ini:ini + len(raw)] = raw
        s = json.dumps(g.j, separators=(',', ':')).encode(); s += b' ' * ((4 - len(s) % 4) % 4)
        bb = bytes(b) + b'\0' * ((4 - len(b) % 4) % 4)
        total = 12 + 8 + len(s) + 8 + len(bb)
        open(salida, 'wb').write(b'glTF' + struct.pack('<II', 2, total) + struct.pack('<I', len(s)) + b'JSON' + s + struct.pack('<I', len(bb)) + b'BIN\0' + bb)
        print('escrito', salida, total, 'bytes')


def comprobar(entrada, salida):
    """La malla en bind no cambia (posiciones, normales, UV e índices byte a byte iguales; el skin en bind reproduce las
    posiciones) y la cabeza por encima de y 1.34 es rígida con Head (los lentes son hijos de Head)."""
    a, b = mide.Rig(entrada), mide.Rig(salida)
    for pa, pb in zip(a.prims, b.prims):
        assert np.array_equal(pa['pos'], pb['pos']) and np.array_equal(pa['normal'], pb['normal']) and np.array_equal(pa['tri'], pb['tri']), pa['nombre']
    for i, acc in enumerate(a.j['accessors']):
        if acc['type'] == 'VEC2': assert np.array_equal(a.g.acceso(i), b.g.acceso(i))  # UV
    assert np.array_equal(a.ibm, b.ibm) and a.j['nodes'] == b.j['nodes']
    mats = b.skin_mats(b.bind_world); peor = 0
    for p in b.prims:
        pos, _ = b.skin(p, mats); peor = max(peor, np.abs(pos - p['pos']).max())
    print('bind: malla idéntica; |skin(bind) − pos| máx %.2e m' % peor)
    cab = next(p for p in b.prims if 'cabeza' in p['nombre']); alto = cab['pos'][:, 1] > 1.34
    for clip, t in (('Plant A Plant', 2.5), ('Thoughtful Head Nod', 1.5), ('Waving', 1.2)):
        world = b.pose(clip, t); pos, _ = b.skin(cab, b.skin_mats(world))
        H = world[b.idx['mixamorig:Head']] @ b.ibm[b.joints.index(b.idx['mixamorig:Head'])]
        rig = (cab['pos'][alto] @ H[:3, :3].T) + H[:3, 3]
        print('cabeza rígida con Head (%s): desvío máx %.2e m en %d vértices' % (clip, np.abs(pos[alto] - rig).max(), alto.sum()))


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    entrada = args[0] if args else ENTRADA; salida = args[1] if len(args) > 1 else SALIDA
    p = Pesador(entrada); p.todo(suavizar='--sin-suavizar' not in sys.argv); p.escribir(salida)
    comprobar(entrada, salida)
