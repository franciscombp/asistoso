"""Convierte FaceNet (InceptionResnetV1 entrenado con VGGFace2, de facenet-pytorch, MIT) a Core ML.

Entrada: imagen RGB de 160×160 con la cara alineada (la recorta y alinea Vision en la app).
Salida: `huella`, 512 números con norma 1 (dos caras de la misma persona: distancia euclídea < ~1.0).

Uso (con uv, sin tocar el Python del sistema):
  uv run --python 3.11 --with torch==2.2.2 --with coremltools==8.3.0 --with "numpy<2" \
         --with facenet-pytorch==2.6.0 tools/convertir_huella.py asistoso/Huella.mlpackage
"""
import sys

import coremltools as ct
import numpy as np
import torch
from facenet_pytorch import InceptionResnetV1

destino = sys.argv[1] if len(sys.argv) > 1 else "Huella.mlpackage"

modelo = InceptionResnetV1(pretrained="vggface2").eval()  # classify=False: devuelve la huella normalizada
ejemplo = torch.rand(1, 3, 160, 160)
traza = torch.jit.trace(modelo, ejemplo)

# facenet-pytorch normaliza los píxeles con (x - 127.5) / 128: Core ML lo hace al recibir la imagen
ml = ct.convert(
    traza,
    inputs=[ct.ImageType(name="cara", shape=(1, 3, 160, 160), scale=1 / 128.0, bias=[-127.5 / 128.0] * 3,
                         color_layout=ct.colorlayout.RGB)],
    outputs=[ct.TensorType(name="huella")],
    convert_to="mlprogram",
    compute_precision=ct.precision.FLOAT16,
    minimum_deployment_target=ct.target.macOS14,
)
ml.short_description = "Huella de la cara (FaceNet, InceptionResnetV1 VGGFace2): 512 números con norma 1"
ml.author = "facenet-pytorch (MIT), convertido para Uku"
ml.license = "MIT"
ml.save(destino)

# Comprobación: la huella de Core ML es casi igual a la de PyTorch
from PIL import Image
pix = (np.random.rand(160, 160, 3) * 255).astype(np.uint8)
x = torch.from_numpy((pix.astype(np.float32) - 127.5) / 128).permute(2, 0, 1)[None]
a = modelo(x).detach().numpy()[0]
b = np.array(ml.predict({"cara": Image.fromarray(pix)})["huella"]).reshape(-1)
print("dimensión", b.shape, "norma", float(np.linalg.norm(b)), "coseno con PyTorch", float(a @ b / np.linalg.norm(b)))
