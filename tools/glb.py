"""Lee un .glb (solo lo que hace falta para hornear texturas): JSON, accesos a buffers y primitivas."""
import json, struct
import numpy as np

TIPOS = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
N = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


class Glb:
    def __init__(self, ruta):
        b = open(ruta, 'rb').read()
        lj = struct.unpack('<I', b[12:16])[0]
        self.j = json.loads(b[20:20 + lj])
        o = 20 + lj
        lb = struct.unpack('<I', b[o:o + 4])[0]
        self.bin = b[o + 8:o + 8 + lb]

    def acceso(self, i):
        a = self.j['accessors'][i]
        v = self.j['bufferViews'][a['bufferView']]
        t, n = TIPOS[a['componentType']], N[a['type']]
        ini = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        paso = v.get('byteStride', 0) or np.dtype(t).itemsize * n
        crudo = np.frombuffer(self.bin, dtype=np.uint8, count=paso * (a['count'] - 1) + np.dtype(t).itemsize * n, offset=ini)
        if paso == np.dtype(t).itemsize * n:
            arr = np.frombuffer(crudo.tobytes(), dtype=t).reshape(a['count'], n)
        else:
            arr = np.stack([np.frombuffer(crudo[k * paso:k * paso + np.dtype(t).itemsize * n].tobytes(), dtype=t) for k in range(a['count'])])
        return arr.astype(np.float64) if t == np.float32 else arr.astype(np.int64)

    def primitivas(self):
        """[(nombre de la malla, nombre del material, imagen de la textura o None, pos, normal, uv, triángulos)]"""
        out = []
        for m in self.j['meshes']:
            for p in m['primitives']:
                at = p['attributes']
                mat = self.j['materials'][p['material']]
                tex = mat.get('pbrMetallicRoughness', {}).get('baseColorTexture')
                img = self.j['images'][self.j['textures'][tex['index']]['source']].get('name') if tex else None
                out.append(dict(malla=m['name'], material=mat['name'], imagen=img,
                                pos=self.acceso(at['POSITION']), normal=self.acceso(at['NORMAL']),
                                uv=self.acceso(at['TEXCOORD_0']) if 'TEXCOORD_0' in at else None,
                                tri=self.acceso(p['indices']).reshape(-1, 3)))
        return out
