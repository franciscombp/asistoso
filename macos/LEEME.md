# Uku para Mac

La app nativa de macOS. El mundo 3D sigue siendo la web de este repo (copiada en `asistoso/Web.bundle`, con un puente
`nativo.js` que solo se activa dentro de la app). El resto lo hace Swift:

| Qué | Cómo |
| --- | --- |
| Cerebro | Apple Intelligence (FoundationModels) en el Mac y **Groq** para lo complejo. En Macs de 8 GB, la charla va a Groq si hay key. La key se guarda en el Llavero (⌘, › Cerebro). |
| Oído y voz | SpeechAnalyzer y AVSpeechSynthesizer por un solo motor de audio con **cancelación de eco**: Uku no se oye a sí mismo, se le puede interrumpir y empieza a hablar mientras el modelo escribe. |
| Visión | Manos y cuerpo con Vision. Caras: Vision las encuentra y **FaceNet en Core ML** (`Sentidos/Huella.mlpackage`) las reconoce. MediaPipe queda solo para las expresiones de la cara. |
| Interfaz | SwiftUI con Liquid Glass: inicio, barra, «Quién vino» (visitas, mensajes, personas, dónde estoy, diario) y ayuda. |

Requisitos: macOS 26 o más nuevo; Apple Intelligence activado (opcional si hay key de Groq).

## Compilar

Abrir `asistoso.xcodeproj` en Xcode 27 y correr. La web se sirve desde la app en `http://127.0.0.1:47615/`.

## El modelo de caras

`tools/convertir_huella.py` convierte FaceNet (InceptionResnetV1, VGGFace2, de facenet-pytorch, licencia MIT) a Core ML:

```
uv run --python 3.11 --with torch==2.2.2 --with coremltools==8.3.0 --with "numpy<2" \
       --with facenet-pytorch==2.6.0 tools/convertir_huella.py asistoso/Sentidos/Huella.mlpackage
```

Probado con retratos de dominio público: la misma persona queda a 0,50–0,59 de distancia; personas distintas, a
1,24–1,38 (umbral: 0,95).
