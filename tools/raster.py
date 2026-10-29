"""Rasteriza triángulos en una grilla e interpola atributos por vértice (baricéntricas). Con prof, gana el de mayor prof."""
import numpy as np


def rasterizar(xy, attrs, tri, w, h, prof=None):
    """xy: (n, 2) en píxeles; attrs: (n, k). Devuelve (valores (h, w, k), cubierto (h, w), id de triángulo (h, w))."""
    k = attrs.shape[1]
    out = np.zeros((h, w, k)); hecho = np.zeros((h, w), bool); cual = np.full((h, w), -1)
    zbuf = np.full((h, w), -np.inf)
    for t, (a, b, c) in enumerate(tri):
        A, B, C = xy[a], xy[b], xy[c]
        x0, x1 = int(max(0, np.floor(min(A[0], B[0], C[0])))), int(min(w - 1, np.ceil(max(A[0], B[0], C[0]))))
        y0, y1 = int(max(0, np.floor(min(A[1], B[1], C[1])))), int(min(h - 1, np.ceil(max(A[1], B[1], C[1]))))
        if x1 < x0 or y1 < y0: continue
        d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1])
        if abs(d) < 1e-12: continue
        X, Y = np.meshgrid(np.arange(x0, x1 + 1) + .5, np.arange(y0, y1 + 1) + .5)
        l1 = ((B[1] - C[1]) * (X - C[0]) + (C[0] - B[0]) * (Y - C[1])) / d
        l2 = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Y - C[1])) / d
        l3 = 1 - l1 - l2
        e = -1e-4
        m = (l1 >= e) & (l2 >= e) & (l3 >= e)
        if not m.any(): continue
        if prof is not None:
            z = l1 * prof[a] + l2 * prof[b] + l3 * prof[c]
            m &= z > zbuf[y0:y1 + 1, x0:x1 + 1]
            zbuf[y0:y1 + 1, x0:x1 + 1][m] = z[m]
        v = l1[..., None] * attrs[a] + l2[..., None] * attrs[b] + l3[..., None] * attrs[c]
        out[y0:y1 + 1, x0:x1 + 1][m] = v[m]
        hecho[y0:y1 + 1, x0:x1 + 1][m] = True
        cual[y0:y1 + 1, x0:x1 + 1][m] = t
    return out, hecho, cual


def dilatar(img, hecho, pasos=8):
    """Extiende los bordes de cada isla del UV hacia afuera (sin costuras al filtrar la textura)."""
    img = img.copy(); hecho = hecho.copy()
    for _ in range(pasos):
        suma = np.zeros_like(img); n = np.zeros(hecho.shape)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            s = np.roll(np.roll(hecho, dy, 0), dx, 1); v = np.roll(np.roll(img, dy, 0), dx, 1)
            suma += v * s[..., None]; n += s
        nuevo = (~hecho) & (n > 0)
        img[nuevo] = suma[nuevo] / n[nuevo][:, None]; hecho |= nuevo
    return img, hecho
