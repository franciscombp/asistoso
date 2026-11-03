"""Mide cómo deforma el rig de Uku (assets/oso/uku-rig-v2.glb) con sus propias clips.

Para cada clip que se pida se muestrean N cuadros, se acumulan las transformaciones de los nodos (canales de
animación con interpolación lineal / slerp, o STEP), se skinnea cada primitiva con pesos lineales (LBS, lo mismo que
hace three.js) y se mide, por primitiva:
  - aristas: |L_pose − L_bind| / L_bind (media, p95 y máximo);
  - triángulos invertidos (la normal de la pose apunta contra la normal de reposo girada por los huesos)
    y aplastados (área < 20 % de la de reposo);
  - «candy wrapper» en codos, rodillas y cuello: los vértices del anillo alrededor de la articulación (en reposo,
    a menos de `ancho` del hueso a lo largo de su eje) pierden grosor: 1 − radio_pose / radio_bind (media y peor caso).
También imprime la estadística de los pesos (huesos por vértice, vértices con hueso dominante, pesos a huesos
lejanos) y, con --costuras, la diferencia de pesos entre la ropa y el cuerpo que cubre (vértice más cercano).

Uso: python3 tools/uku-rig-mide.py [ruta.glb] [--clips "Walking,Waving,Happy Idle,Plant A Plant"] [--cuadros 10] [--costuras]
     [--csv salida.csv]  (para comparar antes/después de re-pesar: mismas métricas sobre otro .glb)
Necesita numpy (no scipy). Tarda unos segundos.
"""
import os, sys
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from glb import Glb  # noqa: E402

GLB = os.path.join(AQUI, '..', 'assets', 'oso', 'uku-rig-v2.glb')
CLIPS = ['Walking', 'Waving', 'Happy Idle', 'Plant A Plant']
# Articulaciones donde se mira el candy wrapper: (nombre corto, hueso de la articulación, hueso padre) — el anillo se
# toma alrededor del origen del hueso, a lo largo del eje padre→hueso
ARTIC = [('codo I', 'mixamorig:LeftForeArm'), ('codo D', 'mixamorig:RightForeArm'), ('rodilla I', 'mixamorig:LeftLeg'),
         ('rodilla D', 'mixamorig:RightLeg'), ('cuello', 'mixamorig:Neck'), ('hombro I', 'mixamorig:LeftArm'), ('hombro D', 'mixamorig:RightArm')]


# ---------- transformaciones ----------
def quat_mat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def trs(t, r, s):
    m = np.eye(4); m[:3, :3] = quat_mat(r) * np.asarray(s)[None, :]; m[:3, 3] = t
    return m


def slerp(a, b, u):
    d = float(np.dot(a, b))
    if d < 0: b = -b; d = -d
    if d > .9995: q = a + u * (b - a); return q / np.linalg.norm(q)
    th = np.arccos(d)
    return (np.sin((1 - u) * th) * a + np.sin(u * th) * b) / np.sin(th)


class Rig:
    """Nodos, esqueleto, primitivas con skin y clips de un .glb de Mixamo."""

    def __init__(self, ruta):
        self.g = g = Glb(ruta); self.j = j = g.j
        self.nodes = j['nodes']; self.n = len(self.nodes)
        self.parent = [-1] * self.n
        for i, nd in enumerate(self.nodes):
            for c in nd.get('children', []): self.parent[c] = i
        self.name = [nd.get('name', str(i)) for i, nd in enumerate(self.nodes)]
        self.idx = {nm: i for i, nm in enumerate(self.name)}
        skin = j['skins'][0]; self.joints = skin['joints']
        self.ibm = g.acceso(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)  # column-major → filas
        self.bind_local = [trs(nd.get('translation', [0, 0, 0]), nd.get('rotation', [0, 0, 0, 1]), nd.get('scale', [1, 1, 1])) for nd in self.nodes]
        self.bind_world = self.world(self.bind_local)
        self.prims = []
        for m in j['meshes']:
            for p in m['primitives']:
                at = p['attributes']
                if 'JOINTS_0' not in at: continue
                mat = j['materials'][p['material']]['name']
                self.prims.append(dict(nombre=m['name'] + ' / ' + mat, pos=g.acceso(at['POSITION']), normal=g.acceso(at['NORMAL']),
                                       J=g.acceso(at['JOINTS_0']), W=g.acceso(at['WEIGHTS_0']), tri=g.acceso(p['indices']).reshape(-1, 3)))
        self.clips = {}
        for a in j['animations']:
            ch = []
            for c in a['channels']:
                s = a['samplers'][c['sampler']]
                ch.append((c['target']['node'], c['target']['path'], s['interpolation'], g.acceso(s['input'])[:, 0], g.acceso(s['output'])))
            self.clips[a['name']] = dict(canales=ch, dur=max(c[3][-1] for c in ch))

    def world(self, local):
        w = [None] * self.n
        for i in range(self.n):  # los padres vienen antes que los hijos en este archivo, pero se resuelve igual sin suponerlo
            if w[i] is None: self._w(i, local, w)
        return w

    def _w(self, i, local, w):
        if w[i] is not None: return w[i]
        p = self.parent[i]
        w[i] = local[i] if p < 0 else self._w(p, local, w) @ local[i]
        return w[i]

    def pose(self, clip, t):
        """Matrices de mundo de cada nodo en el instante t de la clip."""
        local = [m.copy() for m in self.bind_local]
        trs_ = {}
        for node, path, interp, ti, vo in self.clips[clip]['canales']:
            k = np.searchsorted(ti, t, side='right') - 1
            k = min(max(k, 0), len(ti) - 1)
            if interp == 'STEP' or k + 1 >= len(ti) or ti[k + 1] == ti[k]: v = vo[k]
            else:
                u = (t - ti[k]) / (ti[k + 1] - ti[k]); u = min(max(u, 0), 1)
                v = slerp(vo[k], vo[k + 1], u) if path == 'rotation' else vo[k] + u * (vo[k + 1] - vo[k])
            nd = self.nodes[node]
            d = trs_.setdefault(node, [np.array(nd.get('translation', [0, 0, 0.])), np.array(nd.get('rotation', [0, 0, 0, 1.])), np.array(nd.get('scale', [1, 1, 1.]))])
            d[['translation', 'rotation', 'scale'].index(path)] = np.asarray(v, float)
        for node, (tt, r, s) in trs_.items(): local[node] = trs(tt, r, s)
        return self.world(local)

    def skin_mats(self, world):
        return np.stack([world[jn] @ self.ibm[k] for k, jn in enumerate(self.joints)])

    def skin(self, p, mats):
        """LBS: posiciones y normales de la primitiva con las matrices de los huesos."""
        M = np.einsum('vk,vkij->vij', p['W'], mats[p['J']])  # (v,4,4)
        pos = np.einsum('vij,vj->vi', M[:, :3, :3], p['pos']) + M[:, :3, 3]
        nrm = np.einsum('vij,vj->vi', M[:, :3, :3], p['normal'])  # con rotaciones puras basta (no hay escala en los clips)
        return pos, nrm

    def joint_pos(self, world, nm):
        return (world[self.idx[nm]] @ np.array([0, 0, 0, 1.]))[:3]


# ---------- métricas ----------
def aristas(p):
    t = p['tri']; e = np.concatenate([t[:, [0, 1]], t[:, [1, 2]], t[:, [2, 0]]])
    e = np.sort(e, 1); return np.unique(e, axis=0)


def tri_normal_area(pos, tri):
    a, b, c = pos[tri[:, 0]], pos[tri[:, 1]], pos[tri[:, 2]]
    n = np.cross(b - a, c - a); area = np.linalg.norm(n, axis=1) / 2
    return n / np.maximum(area[:, None] * 2, 1e-12), area


def metricas_prim(rig, p, mats, bind_pos, bind_area, bind_n_tri, E, L0):
    pos, nrm = rig.skin(p, mats)
    L = np.linalg.norm(pos[E[:, 0]] - pos[E[:, 1]], axis=1)
    d = np.abs(L - L0) / np.maximum(L0, 1e-9)
    n_pose, area = tri_normal_area(pos, p['tri'])
    # normal de reposo girada por los huesos del triángulo (promedio de las normales skinneadas de sus vértices)
    n_ref = nrm[p['tri']].mean(1); n_ref /= np.maximum(np.linalg.norm(n_ref, axis=1)[:, None], 1e-12)
    inv = (np.einsum('ij,ij->i', n_pose, n_ref) < 0) & (area > 1e-9 * 0)
    apl = area < .2 * bind_area
    return dict(media=d.mean(), p95=np.percentile(d, 95), max=d.max(), inv=int(inv.sum()), apl=int(apl.sum()), pos=pos)


def anillos(rig, prims, ancho=.045):
    """Para cada articulación, (primitiva, índices de vértices, radio en reposo, hueso, padre) de los vértices del anillo."""
    out = []
    for nm, hueso in ARTIC:
        i = rig.idx[hueso]; pa = rig.parent[i]
        c = rig.joint_pos(rig.bind_world, hueso); cp = rig.joint_pos(rig.bind_world, rig.name[pa])
        hijo = [k for k in range(rig.n) if rig.parent[k] == i]
        ch = rig.joint_pos(rig.bind_world, rig.name[hijo[0]]) if hijo else c + (c - cp)
        eje = ch - cp; eje /= np.linalg.norm(eje)  # eje medio padre→hijo
        for pi, p in enumerate(prims):
            r = p['pos'] - c; t = r @ eje; rad = np.linalg.norm(r - np.outer(t, eje), axis=1)
            # en el anillo: cerca del eje a lo largo (|t| < ancho) y no demasiado lejos radialmente (el torso también cae cerca del hombro)
            sel = np.where((np.abs(t) < ancho) & (rad < .16))[0]
            if len(sel) >= 6: out.append((nm, pi, sel, rad[sel], c, eje))
    return out


def medir(ruta=GLB, clips=CLIPS, cuadros=10, costuras=False, csv=None, callado=False):
    rig = Rig(ruta)
    prims = rig.prims
    bind = []
    for p in prims:
        E = aristas(p); L0 = np.linalg.norm(p['pos'][E[:, 0]] - p['pos'][E[:, 1]], axis=1)
        _, area0 = tri_normal_area(p['pos'], p['tri'])
        bind.append((E, L0, area0))
    filas = []
    an = anillos(rig, prims)
    res_an = {}
    for clip in clips:
        if clip not in rig.clips: print('clip inexistente:', clip); continue
        dur = rig.clips[clip]['dur']
        acc = [dict(media=[], p95=[], max=[], inv=[], apl=[]) for _ in prims]
        cw = {}
        for k in range(cuadros):
            t = dur * (k + .5) / cuadros
            mats = rig.skin_mats(rig.pose(clip, t))
            posed = []
            for pi, p in enumerate(prims):
                E, L0, area0 = bind[pi]
                m = metricas_prim(rig, p, mats, p['pos'], area0, None, E, L0)
                posed.append(m.pop('pos'))
                for kk, v in m.items(): acc[pi][kk].append(v)
            world = rig.pose(clip, t)
            for nm, pi, sel, rad0, c, eje in an:
                # el anillo gira con la articulación: radio respecto al eje posado del hueso (de su origen hacia su hijo)
                i = rig.idx[dict(ARTIC)[nm]]; hijo = [kk for kk in range(rig.n) if rig.parent[kk] == i]
                cp_ = rig.joint_pos(world, dict(ARTIC)[nm]); pa = rig.parent[i]
                a1 = rig.joint_pos(world, rig.name[hijo[0]]) - cp_ if hijo else None
                a0 = cp_ - rig.joint_pos(world, rig.name[pa])
                eje_p = (a0 / np.linalg.norm(a0)) + (a1 / np.linalg.norm(a1) if a1 is not None else 0); eje_p /= np.linalg.norm(eje_p)
                r = posed[pi][sel] - cp_; tt = r @ eje_p; rad = np.linalg.norm(r - np.outer(tt, eje_p), axis=1)
                perd = 1 - rad / np.maximum(rad0, 1e-9)
                cw.setdefault((nm, pi), []).append((perd.mean(), np.percentile(perd, 90)))
        for pi, p in enumerate(prims):
            a = acc[pi]
            filas.append(dict(clip=clip, prim=p['nombre'], media=np.mean(a['media']), p95=np.mean(a['p95']), max=np.max(a['max']),
                              inv=np.mean(a['inv']), apl=np.mean(a['apl']), ntri=len(p['tri'])))
        for (nm, pi), v in cw.items():
            v = np.array(v); res_an[(clip, nm, pi)] = (v[:, 0].mean(), v[:, 1].max())
    if not callado:
        print('== Distorsión por clip y primitiva (promedio de %d cuadros; aristas: |ΔL|/L; inv = triángulos invertidos, apl = aplastados <20 %% de área) ==' % cuadros)
        print('%-14s %-32s %7s %7s %7s %6s %6s %6s' % ('clip', 'primitiva', 'media', 'p95', 'max', 'inv', 'apl', 'tris'))
        for f in filas:
            print('%-14s %-32s %6.1f%% %6.1f%% %6.1f%% %6.1f %6.1f %6d' % (f['clip'], f['prim'], 100 * f['media'], 100 * f['p95'], 100 * f['max'], f['inv'], f['apl'], f['ntri']))
        print('\n== Candy wrapper: pérdida de grosor del anillo alrededor de la articulación (media de los cuadros; peor p90 de un cuadro) ==')
        print('%-14s %-10s %-32s %8s %8s %5s' % ('clip', 'artic.', 'primitiva', 'media', 'peor', 'n'))
        for (clip, nm, pi), (m, w) in sorted(res_an.items()):
            n = [len(s) for a_, p_, s, *_ in an if a_ == nm and p_ == pi][0]
            print('%-14s %-10s %-32s %7.1f%% %7.1f%% %5d' % (clip, nm, prims[pi]['nombre'], 100 * m, 100 * w, n))
        pesos(rig)
        if costuras: costuras_ropa(rig)
    if csv:
        with open(csv, 'w') as f:
            f.write('clip,primitiva,media,p95,max,inv,apl\n')
            for r in filas: f.write('%s,%s,%.4f,%.4f,%.4f,%.1f,%.1f\n' % (r['clip'], r['prim'], r['media'], r['p95'], r['max'], r['inv'], r['apl']))
    return filas, res_an


def segmento_dist(p, a, b):
    ab = b - a; t = np.clip(((p - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
    return np.linalg.norm(p - (a + np.outer(t, ab)), axis=1)


def pesos(rig):
    """Estadística de los pesos: huesos por vértice, dominancia, pesos a huesos lejanos (a > 25 cm del segmento del hueso)."""
    print('\n== Pesos ==')
    print('%-32s %6s %6s %8s %9s %s' % ('primitiva', 'h/v', 'dom>.8', 'lejos', 'peso lejos', 'huesos más usados (peso total %)'))
    jw = {k: rig.joint_pos(rig.bind_world, rig.name[jn]) for k, jn in enumerate(rig.joints)}
    seg = {}
    for k, jn in enumerate(rig.joints):
        hijos = [c for c in range(rig.n) if rig.parent[c] == jn and c in rig.joints]
        fin = rig.joint_pos(rig.bind_world, rig.name[hijos[0]]) if hijos else jw[k] + np.array([0, .03, 0])
        seg[k] = (jw[k], fin)
    for p in rig.prims:
        W, J = p['W'], p['J']; nb = (W > 0).sum(1).mean(); dom = (W.max(1) > .8).mean()
        lejos = np.zeros(len(W), bool); plejos = 0
        for c in range(4):
            d = np.array([segmento_dist(p['pos'][i:i + 1], *seg[J[i, c]])[0] for i in range(len(W))])
            m = (W[:, c] > .02) & (d > .25); lejos |= m; plejos += (W[:, c] * m).sum()
        tot = np.zeros(len(rig.joints))
        for c in range(4): np.add.at(tot, J[:, c], W[:, c])
        top = np.argsort(-tot)[:6]
        print('%-32s %6.2f %5.0f%% %7.1f%% %8.3f  %s' % (p['nombre'], nb, 100 * dom, 100 * lejos.mean(), plejos / len(W),
                                                         ', '.join('%s %.0f' % (rig.name[rig.joints[k]].replace('mixamorig:', ''), 100 * tot[k] / len(W)) for k in top)))


def costuras_ropa(rig):
    """Ropa y bufanda contra el cuerpo: para cada vértice de la ropa, el vértice más cercano del cuerpo y la diferencia (L1) de sus pesos."""
    print('\n== Costuras: pesos de la ropa frente al vértice más cercano del cuerpo (|Δw| L1, 0 = iguales, 2 = sin nada en común) ==')
    cuerpo = [p for p in rig.prims if p['nombre'].startswith('Mesh_0 /')]
    cp = np.concatenate([p['pos'] for p in cuerpo]); cw = np.concatenate([denso(rig, p) for p in cuerpo])
    for p in rig.prims:
        if p['nombre'].startswith('Mesh_0 /'): continue
        w = denso(rig, p); d = []
        for i in range(len(p['pos'])):
            k = np.argmin(((cp - p['pos'][i]) ** 2).sum(1)); d.append(np.abs(w[i] - cw[k]).sum())
        d = np.array(d)
        print('%-32s media %.2f  p90 %.2f  >0.5: %.0f%%' % (p['nombre'], d.mean(), np.percentile(d, 90), 100 * (d > .5).mean()))


def denso(rig, p):
    w = np.zeros((len(p['W']), len(rig.joints)))
    for c in range(4): np.add.at(w, (np.arange(len(w)), p['J'][:, c]), p['W'][:, c])
    return w


if __name__ == '__main__':
    args = sys.argv[1:]
    ruta = GLB; clips = CLIPS; cuadros = 10; costuras = False; csv = None
    while args:
        a = args.pop(0)
        if a == '--clips': clips = [c.strip() for c in args.pop(0).split(',')]
        elif a == '--cuadros': cuadros = int(args.pop(0))
        elif a == '--costuras': costuras = True
        elif a == '--csv': csv = args.pop(0)
        else: ruta = a
    medir(ruta, clips, cuadros, costuras, csv)
