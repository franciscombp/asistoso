# Uku · asistente de Fran

Uku es un osito que vive en una pantalla de escritorio y juega con quien esté frente a la
webcam. Tiene esqueleto Mixamo (`assets/uku-rig.js`), estilo de ilustración, gestos, voz, un
compendio de frases y su propio mundo 3D: un claro en el bosque nublado.

**Abrir:** `index.html` servido por HTTP (por ejemplo `python3 -m http.server 8765` y
`http://localhost:8765/`). Chrome o Edge de escritorio, con webcam. Se toca **Empezar**: pide
la cámara y pasa a pantalla completa.

**Publicado (público):** https://franciscombp.github.io/asistoso/ — lo sube
`.github/workflows/pages.yml` con cada push a la rama principal (o a mano: Actions › Pages › Run workflow).

## La idea

Uku es el **asistente de Fran**. Cuando Fran deja su computadora, Uku se
queda en la pantalla y atiende a quien se acerque por la webcam:

- **Reconoce a varias personas a la vez** (hasta cuatro caras en cámara) y **también cuando Fran
  está en cámara**: cada cara tiene su seguimiento, se identifica por separado, se anota con su
  foto («Visitante 2», «Visitante 3»…) y Uku la saluda aunque Fran esté ahí («¡Hola! Fran está aquí
  mismo, a tu lado»). Si se va una, se despide de ella y sigue con las demás. Mientras haya una
  visita, Uku atiende a la visita y no habla de lo de Fran.
- **Reconoce caras por su cuenta.** A quien ya conoce lo saluda por su nombre
  ("¡Hola, Ana! Fran no está, pero le cuento que viniste"). A quien no, lo
  anota como visitante ("Visitante 3") con una foto pequeña; si vuelve, sabe
  que es la misma persona.
- **Cuando Fran vuelve**, Uku lo reconoce, le dice cuántas personas vinieron
  y abre **Quién vino** (tecla `P` o el botón 👤 de arriba, que muestra
  cuántas visitas no ha visto):
  - **Visitas:** foto, hora, cuánto se quedó y cuántos gestos hizo. A quien
    no tiene nombre se le pone uno, o se junta con alguien que Uku ya conoce
    ("Es… Ana").
  - **Personas:** las que Uku reconoce. Cambiar nombre, **Soy yo** (marca al
    dueño: así Uku sabe cuándo volvió Fran y no anota sus visitas), borrar o
    presentar a alguien a propósito frente a la cámara.
- Mientras tanto **juega**: gestos de las manos, entornos y, de vez en cuando,
  un consejo de oso.

Todo se guarda solo en este equipo (`localStorage`: `mimo_personas` con
nombre, foto de 96 px y huellas; `mimo_visitas` con el historial). Nada sale
del navegador.

## Como Tolan: memoria, diario, tono y un claro que crece

Uku toma de Tolan (la app de compañía de Portola; el benchmark está en `docs/benchmark-tolan.md`)
lo que hace que un personaje se sienta vivo:

- **Improvisa en vez de seguir guion.** El prompt se arma en cada turno (`atiende.js › sistema`):
  la ficha de Uku (quién es, su claro, lo que le gusta), cómo conversa (corto, de tú, sigue la
  energía de quien habla, no pregunta siempre, no solo da la razón, empuja a la vida real), el
  tono de lo que acaban de decirle, lo que recuerda que viene al caso y la situación (hora, clima,
  quién está, qué vino, qué tiene pendiente). La charla («¿cómo estás?», «estoy cansado», «cuéntame
  algo») va al modelo; los datos y las acciones (dónde está Fran, quién vino, el cartel, la hora,
  cuentas) siguen al toque, sin modelo.
- **Tono** (`tono.js`): cada frase se lee como triste, estresada, enojada, cansada, feliz, bromista,
  seria o neutra. Cada tono trae su guía para el modelo («acompaña, nada de chistes»), un gesto y
  un ánimo que se le queda a Uku un rato.
- **Memoria** (`memoria.js`): lo que Fran cuenta de su vida se anota como hechos («Su hermana se
  llama Ana», «Tiene pendiente: mañana tiene la presentación con el comité»), con reglas al instante
  y, al cerrar la conversación, con el modelo. Los que piden seguimiento hacen que Uku **saque el
  tema** después («Oye, ¿y cómo te fue con la presentación?»), igual que cuánto hace que no
  hablan o, por la mañana, «¿qué es lo único que tiene que salir hoy?». Si sabe poco de Fran, le
  pregunta algo de su vida.
- **Diario**: al despedirse de Fran, Uku escribe dos o tres frases desde su punto de vista. Está
  en **P › Diario**, junto a todo lo que sabe de Fran; cada cosa se puede borrar, o todo.
- **El claro crece con la relación** (`memoria.js › mundo()`): empieza con brotes y el lago chico;
  con las conversaciones salen las flores, con los días los guayacanes y los árboles, con lo que
  sabe las mariposas; la casa aparece al segundo día, la tortuga a la semana y una bandera por cada
  meta que recuerda. Cada hecho nuevo hace brotar flores. Para verlo crecido:
  `Mimo.memoria.simular(8, 30)` y recargar.
- Nada de esto sale del navegador (`localStorage` `mimo_memoria`), salvo lo que viaja al modelo
  mientras Fran conversa.

## Como el Alien Child de «Her»: picardía y «Guíame»

El otro benchmark (también en `docs/benchmark-tolan.md`) es el personaje del juego de la película
*Her*: un alien chiquito que vive en la sala, sin pantalla ni mandos, con genio propio, que guía a
Theodore por unos túneles mientras lo insulta con gracia y se mete en la conversación con Samantha.

- **Picardía con cariño**: Uku puede molestar un poquito, quejarse, negarse con humor o pedir algo a
  cambio; nunca hiere y lo deja apenas algo es serio.
- **Guíame** (tecla `7` o decir «guíame» / «te guío», o «guíame al lago»): Uku se pierde lejos y tú lo
  llevas a un destino (su casa, el lago, la banca, el huerto, el letrero, la cascada o el puente) con la voz («izquierda», «derecha», «arriba», «sigue», «para») o señalando con la
  mano (a un lado de la cámara lo lleva para allá; arriba, al fondo). Comenta el camino, se queja si
  lo dejas parado, avisa si choca con algo, celebra al llegar y a los dos minutos se rinde. «Ya no»
  lo termina.
- **A tres**: con Fran en cámara y una visita hablándole, Uku incluye a los dos.

## Modo guardián y modo demo

- **Guardián** (por defecto): Uku atiende a los demás. Cuando quien está enfrente es Fran
  (la persona marcada «Soy yo»), solo lo **saluda** y le cuenta quién vino; unos 8 segundos
  después **sigue en lo suyo** (pasea, mira el paisaje) y no reacciona a sus gestos, no le
  contesta lo que diga ni le suelta frases ni pistas. Solo habla cuando hay alguien más.
- **Demo**: Uku juega y conversa con todos, también con Fran (para mostrarlo o probarlo:
  gestos, chistes, recordatorios…).
- Se elige en el inicio («Modo demo»), con el botón de arriba (🛡️ / 🎉) o con la tecla `N`;
  `?modo=demo` lo deja en demo. Se recuerda en este equipo. Las teclas de quien opera
  (`Q`, `G`, `Z`…) siguen funcionando en los dos modos.

## Habla con Uku

Uku escucha por el micrófono y **conversa** por Fran. El cerebro es **Groq** a través del Worker
`uku-cerebro` (abajo), más la lógica propia de Uku (`atiende.js`: respuestas al toque, memoria, tono).

- **Oído** (`oido.js`): el reconocimiento de voz del propio navegador (Chrome o Edge). Muestra lo que
  va oyendo mientras hablas y no descarga nada; el audio lo procesa el servicio del navegador, así que
  necesita internet. Mientras Uku habla o el panel está abierto, no escucha.
- **Cerebro en la nube** (`cerebro/worker.js`): un Cloudflare Worker (gratis, `uku-cerebro`) que
  guarda la key de Groq como secreto y conversa con el modelo; la página solo conoce la URL. Sin key,
  sin red o si tarda más de 15 s, Uku responde con su compendio de frases.

  ```
  Página (mente.js, pedirNube) ──POST──► uku-cerebro.francisco-a86.workers.dev (cerebro/worker.js) ──► Groq
  ```

  - **Poner la key**: Cloudflare › **Workers & Pages › uku-cerebro › Settings › Variables and
    Secrets › Add**, tipo **Secret**, nombre `GROQ_API_KEY`, valor: una key de Groq (gratis con
    límites, https://console.groq.com). Con la CLI:
    `npx wrangler secret put GROQ_API_KEY --name uku-cerebro`. Luego
    https://uku-cerebro.francisco-a86.workers.dev/ debe decir `"listo":true` y el modelo.
  - **Variables opcionales**: `GROQ_MODEL` (si no está, el Worker elige el modelo de chat de más
    contexto que ofrece Groq con esa key; la lista en `/modelos`), `ORIGENES` (quién puede llamarlo;
    por defecto GitHub Pages de `franciscombp` y `localhost:8765`).
  - **Pasar a Claude** (API de pago): variable `PROVEEDOR = anthropic` y secreto `ANTHROPIC_API_KEY`
    (opcional `ANTHROPIC_MODEL`, por defecto Claude Haiku 5.5). El código es el mismo.
  - **Contrato**: `GET /` → `{ listo, proveedor, modelo }`; `GET /modelos`; `POST /`
    `{ mensajes: [{ role, content }] }` → texto plano por trozos (streaming, se va escribiendo en el
    globo). Errores: `503` sin key, `403` origen no permitido, `429` más de 20 preguntas por minuto
    por IP, `502` el proveedor falló. El prompt (hasta 6000 caracteres) lo arma la página.
  - **Volver a desplegar**: `npx wrangler deploy cerebro/worker.js --name uku-cerebro
    --compatibility-date 2026-10-01`, o pídeselo a Claude con el conector de Cloudflare. Los
    secretos se conservan.
  - **Probar sin publicar**: `localStorage.setItem('uku-cerebro-url', 'http://localhost:8787/')`
    apunta a otro Worker (p. ej. `wrangler dev`); `'off'` apaga la nube; `?cerebro=URL` en la
    dirección hace lo mismo y se recuerda (`?cerebro=` vacío lo borra).
- **Modelos locales, solo para pruebas** (quedan en el código, no se cargan ni se ofrecen en el
  inicio): Whisper en el navegador con `?whisper=onnx-community/whisper-base`, un modelo de lenguaje
  local (Qwen3 con WebGPU) con `?llm=onnx-community/Qwen3-0.6B-ONNX`, y el modelo de frases MiniLM
  con `?sentido`.
- **Lo que no se deja al modelo** (`atiende.js`):
  - Los mensajes: "déjale un mensaje" → Uku lo pide y guarda lo siguiente que
    digas; "dile que la reunión se movió" → lo guarda de una.
  - Las palabras de juego dichas solas ("¡fiesta!", "globos").

- **Respuestas al toque** (`frases.js` › `CHARLA`): lo que más preguntan se
  contesta al instante, con varias respuestas graciosas que se alternan, sin
  esperar al modelo. Solo lo que no está aquí lo conversa el modelo (que se
  corta en dos frases para no hacer esperar).
- **Globo con puntos**: mientras hablas (con el reconocimiento del
  navegador) y mientras Uku piensa, el globo muestra tres puntos que saltan;
  si contesta el modelo, el texto aparece mientras se escribe.

| Le dicen | Uku responde (estado: Piso 10, vuelve en 20 minutos) |
| --- | --- |
| ¿Quién eres? | Soy Uku. Cuido la compu de Fran cuando no está. Sueldo: cero. Pasión: toda. |
| ¿Qué puedes hacer? | Te digo dónde está Fran y cuándo vuelve, le paso tus mensajes y, si haces ✌️, suelto globos. |
| ¿En cuánto regresa Fran? | Fran vuelve en 20 minutos. Yo le cuido la silla mientras tanto. |
| ¿Dónde está Fran? | Fran subió al Piso 10. Allá arriba se deciden cosas importantes. |
| ¿Cómo estás? / Cuéntame un chiste / ¿Eres un robot? | Bien, aunque con un antojito de miel. ¿Y tú? / Hice dieta de miel una semana. Perdí siete días. / Soy un oso de verdad… de verdad digital. |
| ¿Tienes su número? / ¿Vino alguien? | Sus datos no los doy ni aunque me ofrezcas miel… / Secreto profesional. |
| Dile que lo busqué | Hecho. Fran lo verá apenas vuelva: «Lo busqué.» |
| (Fran) ¿Quién vino? / ¿Tengo mensajes? | Vinieron Ana y Visitante 2… / Tienes 1 mensaje: «Lo busqué.» |
| ¿Te gusta la lluvia? / cualquier otra cosa | Lo conversa el modelo, con el mismo tono. |

Cada estado de Fran (baño, Piso 10, reunión, almuerzo) tiene varias formas
graciosas de contarse; el dato exacto es el que Fran eligió en **P › Estado**.

Para probar sin descargar nada: `/?oido=simulado&mente=simulada`, y en
la consola `Mimo.oir("¿dónde está Fran?")`; `Mimo.mente.ultimosMensajes()`
muestra el contexto que recibió el modelo.

### Cómo va la descarga

La tarjeta **La IA de Uku** (arriba a la izquierda; tecla `A`) muestra cada
modelo mientras baja: **Visión** (MediaPipe, ~17 MB) y **Caras** (face-api, ~7 MB), con MB y % y
dónde corre (tarjeta gráfica o CPU). Si algo falla lo dice ("Revisa
la conexión con huggingface.co"). Cuando todo está listo se esconde sola; la
segunda vez sale de la caché casi al instante.

## El claro de Uku

El mundo de Uku es un paisaje fijo (`escena.js › MUNDO`, que se pasa a `assets/bosque3d.js › setClaro`):

| Qué hay | Dónde |
| --- | --- |
| Su **casa** con chimenea (un montículo con puerta redonda) | A la izquierda, al fondo |
| El **lago**, con muelle, nenúfares, juncos y dos **patos** que nadan | A la derecha |
| **Flores** amarillas en los dos canteros | Delante de Uku |
| **Guayacanes** en flor | Repartidos por el claro |
| 24 **árboles** del bosque nublado | Al fondo |
| Una **tortuga** de Galápagos | En la orilla del lago |
| Farol, banca, cerca, huerto, buzón, hongos y leña, y el **cartel de días sin accidentes** | Alrededor |

- Sale en el día, la noche, la lluvia y la fiesta, y lo ven todos los que se acercan.
- Para cambiarlo: `setClaro({ casa, flores, guayacanes: 0–4, mariposas, brotes, escenario: { lago, arboles,
  tortuga, banderas, cartel } })`.

### El cartel «X días sin accidentes»

Un cartel de pizarra al fondo, con **«SEGURIDAD PRIMERO»**, el número en fichas que **se voltean** al
cambiar, «DÍAS SIN ACCIDENTES» y el récord. **Uku lo cambia**:

| Qué pasa | Cómo se lo pides | Qué hace Uku |
| --- | --- | --- |
| Un día más sin accidentes | 🙏 manos juntas · tecla `B` · «un día más» | Sonríe, las fichas giran y dice «¡Un día más sin accidentes! Ya van 8» |
| Hubo un accidente | ❌ brazos cruzados · tecla `0` · «hubo un accidente» | La escena tiembla, el cartel vuelve a 00 y guarda el récord |
| Dejarlo en un número | «pon el cartel en 15» (también «en quince») | Cambia las fichas |
| Saber cómo va | «¿cuántos días llevamos sin accidentes?» | Responde con los días y el récord |

- **Sube solo**: cuenta los días desde el último accidente, así que cada medianoche el cartel
  gira por su cuenta. La primera vez arranca en 7 días.
- Se guarda en este equipo (`mimo_cartel`: fecha del último accidente y récord).
- Funciona con cualquiera que se acerque en modo guardián: si un visitante cruza los brazos, el
  cartel vuelve a cero (el récord se conserva).

## Efectos en el mundo 3D

Los globos, corazones, confeti, fuegos artificiales, monedas, el sol y todos los emojis de las
reacciones **son objetos de la escena 3D** (`efectos3d.js`, three.js), no una capa pegada a la
pantalla: tienen profundidad, pasan delante o detrás de Uku y de los árboles, se desvanecen con
la niebla y se mueven con la cámara. Los globos son esferas con su nudo e hilo, los corazones
tienen volumen y giran, y el confeti es una nube de piezas que cae girando. (La capa 2D de
`efectos.js` queda solo como respaldo si no hay WebGL.)

## El modelo de Uku (v2)

`assets/oso/uku-rig-v2.glb`, hecho a partir del original (`uku-rig.glb`, que no se toca):

- **Malla subdividida** (un loop nuevo en cada arista: de 3 000 a 9 200 vértices, suavizada con las
  reglas de Loop sin abrir las costuras): codos, rodillas, cuello y cintura tienen dónde doblar.
- **Pesos limpios**: sin huesos del lado contrario, máximo 3 huesos por vértice y una pasada de
  suavizado. El suéter pasa de 31 % a 73 % de vértices con un hueso dominante; las piernas, de 72 % a 83 %.
  El esqueleto (Mixamo) es el mismo: no se puede re-riggear sin Blender.
- **Texturas suavizadas** (cara, brazos y piernas de 512 → 2048 px; la ropa queda en 1024) en
  `assets/oso/tex/`; las originales, tal cual, en `assets/oso/tex-original/`.
- **Plantar**: solo los brazos hacen el gesto completo; el resto del cuerpo se queda a medio camino, y
  además ninguna parte del cuerpo (salvo las manos) puede quedar bajo el suelo.
- Para volver atrás: `?oso=clasico` (modelo original) y `?texturas=original` (malla nueva con las
  texturas del archivo); también con `localStorage` `uku_oso` / `uku_texturas`.

## Suelo, banca y periódico

- El **suelo es gris** (`#b9bfc9`, en pantalla queda ~`#bcc0c6`): ya no parece nieve, y es más claro y
  menos azul que el pelaje de Uku (`#89919e`). Los **realces van en blanco**: piedras, pasto, florcitas
  y polvo (con escenario; sin él, el suelo es claro).
- **Banca de parque** (dos listones de asiento, respaldo y patas de hierro azul marino). Cuando Uku llega
  paseando a la banca, la mitad de las veces **se sienta a leer «El Claro»** 16 s: pose sentada del rig
  (muslos adelante, pantorrillas abajo, codos doblados, cabeza baja), el periódico delante del pecho y
  pasa la página cada 3,5 s; luego se levanta y sigue. `Mimo.escena.mundo().play('read')` lo fuerza.
- El **suéter** se horneó desde 3D: el patrón se define sobre el
  cuerpo (altura y ángulo alrededor del torso y de cada manga: amarillo liso, zigzag doble en el pecho y las
  mangas, canalé en cuello, puños y dobladillo) y se pinta en la textura a través de las UV, triángulo a
  triángulo, con relleno de borde. Así es continuo aunque las islas UV estén cortadas. El patrón va en un
  **amarillo apagado** (ocre, como el original), no en azul, y todo el saco es de lana: ya no quedan
  triángulos grises en el dobladillo ni en las mangas. La cara va en otra textura y no se toca. La original sigue en
  `assets/oso/tex-original/` (`?texturas=original`).
- **Sin marca**: no hay logo en la barra ni en el inicio y el icono es un Uku de línea (`icono.svg`).

## Cámaras: control en tercera persona, vista de pájaro y espejo

Tres botones arriba (o sus teclas) cambian cómo se ve y se usa el claro:

- **🎮 Control** (tecla `K`, o decir «modo control»): la cámara se pone **detrás de Uku** y lo manejas
  tú. Con la **mano** frente a la cámara: arriba = adelante, abajo = atrás, a un lado = gira hacia
  ese lado; o con las **flechas** (arriba/abajo avanza y retrocede, izquierda/derecha gira). Al
  soltar se queda; al apagar el modo sigue en lo suyo. `escena.controlar({ avance, giro })`.
- **🗺️ Vista** (tecla `O`, o «vista de pájaro»): el claro **desde arriba**. Se arrastra con el mouse o
  el dedo (en dos ejes), se acerca o aleja con la **rueda** o el **pellizco**, y **Uku sigue en sus
  cosas** mientras tanto (pasea, lee, mira mariposas). El botón **📍** vuelve a él: la cámara lo sigue
  hasta que vuelvas a arrastrar. En la vista normal la rueda también acerca y aleja.
- **🪞 Espejo** (tecla `E`, o «imítame»): Uku **te imita como un Memoji**: gira, cabecea e inclina la
  cabeza como tú, pestañea cuando pestañeas, pone ojos contentos cuando sonríes, y mueve los brazos
  como los tuyos (en espejo: tu izquierda es su derecha). La postura que tengas al encenderlo es el
  «cero», así que no hace falta mirar a la cámara exacto. Mientras imita, las manos no son gestos.
  Se calcula en `mimo.js › imitar()` (nariz respecto al centro de la cara, línea de los ojos,
  expresiones de MediaPipe, hombros-codos-muñecas) y se aplica en `bosque3d.js › setEspejo()` (cada
  hueso del brazo apunta hacia donde va el tuyo; la cabeza gira alrededor de los ejes de Uku).
- **Depurar la cámara** (tecla `D`): la ventana del video crece y muestra lo que ve y lo que entiende:
  el esqueleto del cuerpo, los 21 puntos de cada mano con el gesto y su confianza, la caja de cada
  cara con quién es, los puntos clave de la cara y, debajo, los cuadros por segundo de la visión,
  las expresiones (pestañeo, sonrisa, boca, cejas), lo que entra al espejo (giro, cabeceo,
  inclinación) y lo que sale del control por manos.

## Senderos: por dónde se navega

El claro tiene **corredores** (`assets/bosque3d.js › SENDEROS`) que salen de la plazuela entre
los canteros y unen todos los lugares: la puerta de la casa, la orilla del lago, la cascada (por
detrás del lago), la banca con el farol, el huerto con la cerca y la bandera, el letrero a la
entrada del bosque (pasando entre el farol y la cerca, junto a la leña) y el puente sobre el arroyo.

- Son **corredores siempre libres**: nada se pone encima (la tortuga, las hojas grandes y las
  heliconias se corrieron a los lados) y los árboles del bosque los esquivan. `senderosChocan()`
  revisa el diseño y dice qué cosa queda sobre un sendero.
- **No se dibujan** (un bosque no tiene caminos de tierra): son corredores invisibles. La única pista
  son los **farolitos** en las esquinas y el **poste indicador** entre el lago y la cascada.
- Con escenario el claro se **puebla** (`decoEsc()`), regado por todo el claro hasta el borde del
  bosque y con mucho espacio libre: unas 150 matas, 70 margaritas, 50 florcitas silvestres, 22
  helechitos, 18 arbustos y 14 piedras, bien separados, sin pisar los corredores, la plazuela, el
  lago ni lo que hay puesto.
- **Uku pasea por ellos** (su planificador los usa porque son celdas libres) y por ahí se lo
  guía en «Guíame». El claro es más ancho (2,4 m a los lados, hasta 0,85 m al frente).
- Cada sendero termina en un **destino con nombre** (`destinos()`: plaza, casa, lago, cascada,
  banca, huerto, letrero, puente). En «Guíame» Uku elige uno al azar y lo dice; «llévame al lago»
  o «mejor a la banca» lo cambia a mitad de camino. Arranca en el rincón más lejano al destino.

## El claro, más amplio

- Uku pasea por todo el claro (más de 4 m de ancho, hasta el borde del bosque): rodea los canteros,
  el lago, la casa, la banca, los árboles… y la cámara lo sigue.
- **Todo repartido**: a la izquierda el huerto con su cerca; al frente a la
  izquierda la banca con el farol; la leña y el buzón junto a la casa; a la derecha el lago con la
  cascada detrás, el arroyo que sale al frente con su puente y la tortuga en la orilla; al fondo a la
  izquierda, a la entrada del bosque, el letrero. Nada queda amontonado en el centro.
- **No atraviesa nada**: antes de salir a un sitio planea el camino sobre una rejilla del claro (5 cm,
  búsqueda en anchura) y lo estira en tramos rectos; si el tramo directo está libre va derecho. Primero
  se orienta y luego camina, y si un paso cae sobre algo (el lago, la casa, la banca…) se detiene y
  vuelve a planear (hasta tres veces). Solo bloquean el paso las cosas que están puestas de verdad (la
  casa y los guayacanes que hay, no todos los huecos posibles). Para probar:
  `Mimo.escena.mundo().caminarA(x, z)` y `dondeEsta()`.
- **Visita lugares**: dos de cada tres paseos van a un sitio concreto (la orilla del lago por tres
  lados, la banca, el huerto, el farol, el letrero, la cascada, el puente, los hongos, el buzón, la leña,
  la tortuga, la bandera, la cerca, la puerta de su casa, cada guayacán, los canteros), siempre uno distinto al
  anterior y entre los cinco más cercanos; llega, se queda un rato mirándolo (a veces asiente o se
  alegra) y sigue. El tercer paseo es a un punto cualquiera del claro.
- **Flechas del teclado**: lo manejas tú (arriba = hacia el fondo). Si estaba al frente, se suelta;
  al soltar las flechas sigue paseando por su cuenta.
- Más **guayacanes** en flor repartidos por el claro, y el **letrero** es de bosque (dos postes cortos y una tabla de madera a la altura de la
  vista de Uku, con el número en una ficha) y está a la **entrada del bosque, al fondo a la izquierda**:
  hay que ir hasta allá para verlo.
- Si un sitio queda rodeado (la cascada, tras el lago), Uku lo mira desde más lejos en vez de saltárselo.

## Bosque nublado (Chocó Andino, con aires de Mindo)

Uku vive en el bosque nublado, así que con escenario no hay pinos:

- **Árboles de copa ancha** en capas, con **musgo colgando** de las ramas y una **bromelia** amarilla
  en la horqueta; entre ellos, **helechos arbóreos** (roseta de nueve frondas sobre un tronco).
- **Heliconias** (tallo, dos hojas y brácteas amarillas en zigzag) y **hojas grandes** a ras de suelo
  repartidas por el claro.
- **Cascada** al fondo del lago: pared de roca en dos peldaños, el agua cae ancha y blanca, espuma
  abajo, musgo y helechos en la roca y una **neblina** que sube (cuatro motas suaves que respiran).
- Del lago sale un **arroyo** hacia el frente y lo cruza un **puentecito de tablas con barandas de
  cuerda**, como los de Mindo.
- **Sentado**: las piernas y los brazos se doblan en los ejes del personaje (no en los locales de cada
  hueso de Mixamo), así que los muslos van adelante y las pantorrillas abajo sin abrirse de lado.

## Oficina con ruido: solo responde cuando le dicen «Uku»

Con varias personas hablando alrededor, el reconocedor transcribe todo y Uku respondía a conversaciones
ajenas. Ahora, con la opción del inicio **«Solo responde cuando le dicen Uku»** (encendida por defecto y
recordada en el navegador):

- Lo que no empieza por «Uku» se muestra en gris en el subtítulo y no se responde.
- Después de responderte, Uku sigue atento **25 segundos** sin que repitas su nombre, para seguir la
  conversación («Uku, ¿te gusta la miel?» … «¿y el chocolate?»). Cada respuesta renueva ese tiempo.
- En ese tiempo, una palabra suelta («sí», «ya») en medio del ruido no cuenta.
- Lo que se oye mientras Uku habla se descarta: es su propia voz o gente hablando encima.
- El piedra, papel o tijera y las tareas («Uku, recuérdame…») no cambian.

Si se apaga la opción, Uku vuelve a responder a todo lo que oye, como antes.

## Tareas por voz: «Uku…», recordatorios y post-its

Con el micrófono encendido, cualquier cosa que empiece por «Uku» (también «uko», «ucu») es para él:

- **Recordatorios**: «Uku, recuérdame en 10 minutos tomar agua», «Uku, recuérdame a las 15:30 llamar a
  Ana», «…a las 7 de la noche pagar el arriendo». Uku confirma la hora y, cuando llega, lo dice en voz alta
  con «¡Recordatorio!». Si la hora ya pasó hoy, es para mañana.
- **Post-its**: «Uku, pon un post-it que diga comprar pan» o «Uku, anota que mañana reviso el presupuesto».
  Aparecen en un muro arriba a la derecha (en el celular, abajo); cada uno tiene su ×.
  Los recordatorios pendientes también aparecen en el muro, con su hora (⏰), hasta que suenan.
- **Consultar y borrar**: «Uku, qué recordatorios tengo», «Uku, qué post-its hay», «Uku, borra los post-its»,
  «Uku, borra todo».
- Lo que no es una tarea sigue como conversación («Uku, ¿cómo estás?»). Solo «Uku» a secas responde «Dime.».

Todo se guarda en **este navegador** (`localStorage`, clave `mimo_tareas`): no sale nada y no se comparte
entre equipos. Los recordatorios suenan mientras la página esté abierta; si el navegador la duerme, se
avisan al volver. El código es `tareas.js` (el analizador de frases, sin red) y el muro está en
`mimo.js` (`pintarPostits`).

## Cámara que no se tapa y límite de tokens

- **Nada tapa a Uku**: un rayo va de su cabeza a la cámara, contra el escenario. Si algo se interpone,
  la cámara sube y se aleja poco a poco, y vuelve a su sitio cuando el camino se despeja (con histéresis:
  no tiembla). Las plantas altas que quedaban frente a la cámara (heliconias, hojas grandes) se
  reubicaron a los costados.
- **Cuotas del modelo: apagadas** (uso libre). Para volver a limitar hay dos interruptores:
  - En el navegador, abrir la página con `?cuotas=on`: 300 respuestas al día y 25 cada 10 minutos (`mente.js › CUOTA`).
  - En el Worker `uku-cerebro`, sin volver a subir código: Cloudflare › Workers & Pages › uku-cerebro › Settings ›
    Variables and Secrets, variable de texto `LIMITES` = `on`. Para apagarlo, `off` o borrar la variable. Con
    `on`, aplican los topes del Worker (20 por minuto y 400 al día por IP, 3 000 al día en total). Pasado el tope, Uku responde con sus frases. Las tareas («Uku…
  recuérdame», post-its) y el piedra, papel o tijera nunca llegan al modelo.
- **Siempre activo, en el Worker**: 10 mensajes de contexto como máximo, 500 caracteres por mensaje y 160
  tokens de respuesta. Así cada respuesta sigue siendo corta, con o sin cuotas. Son topes por instancia del Worker: para un límite duro conviene fijar el gasto en el
  proveedor (Groq o Anthropic).

## Permisos antes que pantalla completa

Al empezar, Uku pide primero la cámara y después el micrófono (si está encendido), y solo cuando ambos
están resueltos entra en pantalla completa. Antes entraba en pantalla completa de inmediato, y el aviso de
permiso del navegador quedaba tapado. Si el navegador exige un gesto para la pantalla completa, entra con el
siguiente toque. La tecla `F` la alterna en cualquier momento.

## Controles de vidrio (HUD)

- **Ocultos por defecto**: en pantalla quedan Uku, su globo de texto, el reloj y el clima. Se
  muestran con `X`, tocando el reloj o marcando «Mostrar los controles» en el inicio. Los
  paneles (Quién vino, ayuda) aparecen igual cuando se abren, el estado aparece si hay un error y
  la tarjeta de descargas se ve mientras algo baja (se va sola al terminar).
- **Estilo Liquid Glass, sobrio**: vidrio translúcido que desenfoca y satura lo de atrás, con un
  borde de luz y un brillo suave arriba, sin sombras. Textos de 14 px y peso medio; radios de 8
  (botones), 12 (contenedores) y 16 (hojas). De día el vidrio es claro; de noche, ahumado con
  texto claro. Los paneles y tarjetas usan un vidrio más lechoso para que se lean bien.

## El sueño (atmósfera)

Todo el claro parece un sueño idílico (`sueno.js` y `mimo.css`):

- **Desenfoque que sigue a Uku**: él se ve nítido y, alrededor, el mundo se desenfoca en dos
  capas (como una lente abierta) y se funde con el cielo.
- **Polvo de luz**: unas 300 motas doradas flotan despacio entre los árboles (pequeñas y nítidas,
  y otras grandes y suaves) y respiran con la luz.
- **Bokeh**: discos grandes y borrosos muy cerca de la cámara, que se mueven con ella.
- **Bruma**, un **brillo cálido** que entra por arriba a la derecha y **rayos de luz** que se
  mecen muy despacio. De noche todo baja de intensidad.
- `?sueno=0` apaga el polvo y el bokeh.
- El **cartel de días sin accidentes** es sobrio: pizarra de papel claro con un filete fino, fichas
  blancas con el número azul oscuro, letras en gris y un marco oscuro, sin franjas ni colores vivos.

## Reloj y clima

Arriba a la derecha: la **hora local** y la fecha, y el **clima del lugar** (`assets/clima.js`:
Open-Meteo con tu ubicación; sin permiso o sin red, Quito).

- Uku **se viste según el clima**: paraguas con lluvia (y llueve), gorro con frío, sombrero de
  paja y gafas de sol con calor, guayabera y palmeras en la costa.
- El **entorno sigue la hora**: día, atardecer (desde las 17:30) y noche (desde las 19:00); con
  lluvia, lluvia. Si alguien elige un entorno a mano (teclas `1`–`6`, gestos, voz), se respeta.
- Uku contesta «¿qué tiempo hace?» con el clima real, y «¿qué hora es?» con la hora real.
- Para probar: `?clima=gye|uio-rain|uio-cold|cuenca|tena` y `?hora=21:05`.

## Compendio de frases

Uku responde con un compendio de **unas 570 frases** (`frases.js`) repartidas
en ~110 listas. Cada lista se reparte como una baraja: **no se repite ninguna
frase hasta haber dicho todas**, y la primera de la baraja nueva nunca es la
última de la anterior. Responde a:

- **Saludos, despedidas y cortesías**, el regreso de Fran, los gestos y los pensamientos
  que dice en voz alta cuando está solo.
- **Preguntas típicas**: quién eres, qué puedes hacer, dónde está Fran, en cuánto regresa,
  cómo estás, si eres un robot, tu edad, quién es Fran, tu número (no lo da).
- **Con la hora y la fecha reales** («¿qué hora es?», «¿qué día es hoy?») y **cuentas**
  («dos más dos», «15 por 3», «7 entre 0»).
- **Charla**: chistes, adivinanzas (con tres intentos y «me rindo»), cuentos, secretos,
  datos curiosos, consejos de oso, canciones, piropos, insultos (los contesta con
  gracia), hambre, café, cansancio, aburrimiento, tristeza, clima, cumpleaños, buenas noches.
- **«Otro»** repite la última categoría (otro chiste, otra adivinanza) y **«repite»** vuelve a decir lo último.
- Cada respuesta puede traer **efecto en pantalla** (emojis que suben, caen o explotan) y un
  **movimiento de la escena** (tiembla, salta, baila, cabecea).

## Qué hace

| Con el cuerpo | Uku |
| --- | --- |
| 👋 mano abierta que va y viene de lado a lado | Te saluda (por tu nombre si te conoce) |
| 👍 / 👍👍 | Me gusta / fuegos artificiales y se hace de noche |
| 👎 / 👎👎 | No me gusta / se pone a llover |
| ✌️ / ✌️✌️ | Globos / confeti |
| 🤟 | Fiesta (luces de colores) |
| 👌 | Asiente: "¡OK!" |
| 🫶 corazón con las dos manos | Corazones |
| ☝️ | Un consejo de oso (agua, estirarse, descansar la vista…) |
| ✊ | Crece un jardín: saltan flores |
| 🙌 los dos brazos arriba | Sale el sol |

- **Camina solo**: sin nadie, pasea despacio por su claro
  del planeta, mira el paisaje y las mariposas amarillas (que se le posan en la
  mano cuando está quieto). **Al llegar** alguien, viene al centro a
  saludar (por su nombre si está registrado); si la persona no hace nada un
  rato, pasea cerca y vuelve con cualquier gesto. **Al irse**, se despide.
- **Paleta de sueño:** todos los entornos son azul gris y amarillo, con los
  bordes desenfocados que se funden con el cielo.
- **Su mundo** (`assets/bosque3d.js`): planeta redondeado,
  colores planos de ilustración, flores, guayacanes y brotes amarillos. De noche
  y en la fiesta usa su paleta oscura; con lluvia, Uku saca el paraguas.
- **Quieto** un rato: Uku sugiere un gesto o comparte un consejo de oso.
- **Voz** (apagada por defecto; se enciende en el inicio o con `M`): Uku dice
  sus frases en voz alta. Lo que escucha está en «Habla con Uku».

## Para quien opera la demo

| Tecla | |
| --- | --- |
| `F` | Pantalla completa |
| `P` | Quién vino (visitas y personas) |
| `H` / `?` | Ayuda en pantalla |
| `D` | Depurar la cámara: esqueleto, manos con gesto y confianza, caras, expresiones, espejo y control |
| `K` / `O` / `E` | Modo control (tercera persona) / vista de pájaro / modo espejo |
| `C` | Mostrar u ocultar tu imagen en espejo |
| `X` | Muestra u oculta los controles (también tocando el reloj). **Por defecto están ocultos**: quedan Uku, su globo, el reloj y el clima |
| `M` / `V` | Voz de Uku / oído (micrófono) |
| `A` | Cómo va la descarga de la IA |
| `G` / `7` / `Z` | Jugar piedra, papel o tijera / guíame / una travesura al azar |
| `S` | Pantalla despierta: encender o apagar |
| `N` | Modo guardián / modo demo |
| `← ↑ → ↓` | Manejar a Uku por su claro |
| `B` / `0` | Cartel: un día más / accidente (a cero) |
| `1`–`6` | Entorno: día, atardecer, noche, lluvia, fiesta, jardín |
| `Q W E R Y U I O J K L T` | Simular 👍 ✌️ 🫶 👌 👋 🙌 ✊ 🤟, fuegos, lluvia, confeti, consejo |

### Gestos nuevos

| Gesto | Uku |
| --- | --- |
| 🖕 El dedo del medio | «Si tuviera dedos te respondería… pero solo tengo garras de peluche.» (y otras 11), monitos tapándose los ojos y la escena tiembla |
| 🤘 Rock | Cabeceo y fiesta con guitarras |
| 🤙 Shaka | Playa, surf y atardecer |
| 🤏 Un poquito | «Poquito a poquito se llena el panal» |
| 3 o 4 dedos (quietos) | Cuenta con una gracia |
| ✋ Palma abierta quieta | «¡Choca esos cinco!» |
| 👏 Aplauso · 🙏 Manos juntas | Aplausos de vuelta · suma un día al cartel de días sin accidentes |
| 😝 Lengua · 😘 Beso · 😉 Guiño · 🥱 Bostezo · 😮 Sorpresa | Le contesta a cada cara |
| 😊 Sonrisa sostenida · 😠 Ceño fruncido | Un piropo · «¿Quién te hizo enojar?» |
| Cabeza arriba y abajo · de lado a lado | «¡Un sí!» · «¿Es un no? Entendido» |
| ❌ Brazos cruzados · una mano levantada | Accidente: el cartel vuelve a cero · «Mano arriba: tiene la palabra» |

- **Identificación más estable**: un gesto que aparece y desaparece en menos de 120 ms
  (ruido del modelo) ya no cambia nada, y los gestos de la forma de la mano
  (🖕 🤘 🤙 🤏 3 y 4 dedos) se calculan de los 21 puntos, no de la etiqueta del modelo.
  Probado con manos reales (✌️ 👍 ✊ ☝️ siguen dando lo de antes) y con manos sintéticas.
  Los gestos de cara, cabeza y cuerpo se probaron con datos simulados: conviene ajustarlos
  con una cámara real.
- Las reacciones de cara no interrumpen una conversación (se ignoran 7 s después de oír algo).
- **Juego: piedra, papel o tijera** (di «jugamos» o tecla `G`): Uku cuenta, lee tu mano
  (puño, palma o V) o lo que digas, y juega. Gana, pierde o empata con frases distintas.
- **Travesuras** (tecla `Z`): una reacción al azar. Cuando nadie está, Uku piensa en voz alta
  de vez en cuando y a veces se mueve.

**Probar sin cámara** en el inicio deja jugar solo con el teclado.

## Cómo está hecho

| Archivo | |
| --- | --- |
| `index.html`, `mimo.css` | Pantalla, globo, pistas de gestos, paneles. Variables de color y radio en `:root`. |
| `mimo.js` | Orquesta: cámara, bucle de visión, reacciones, frases, personas, teclado, modos (control, vista, espejo), depurar. |
| `escena.js` | Adapta el mundo de Uku (`assets/bosque3d.js`) a la pantalla grande: el claro de Fran, Uku con sus gestos, paseo y mariposas; cielo y entornos detrás del lienzo; cámaras, control y espejo. |
| `vision.js` | MediaPipe Tasks Vision: manos con gesto, cuerpo (pose lite) y cara (puntos clave y expresiones). |
| `gestos.js` | De los puntos a eventos: gestos sostenidos, de una o dos manos, 👌, 🫶, 👋 y 🙌. |
| `efectos.js` | Reacciones en 2D: la tabla de emojis y el respaldo si no hay WebGL (lo normal es `efectos3d.js`). |
| `caras.js` | face-api: huella y foto de cada cara; identifica (o crea un visitante sin nombre), renombra, junta y marca al dueño. |
| `visitas.js` | Historial de visitas: quién, desde y hasta cuándo, gestos y si Fran ya la vio. |
| `panel.js` | Panel «Quién vino»: visitas y personas. |
| `voz.js` | Voz de Uku (speechSynthesis) y palabras de juego. |
| `oido.js` | Oído: el reconocimiento de voz del navegador (Whisper y MiniLM quedan solo para pruebas). |
| `tareas.js` | Tareas por voz: «Uku…» con recordatorios y post-its (en este navegador, sin red). |
| `mente.js` | Conversación: el cerebro en la nube (Groq por el Worker); el modelo local queda solo para pruebas (`?llm=`). |
| `cerebro/worker.js` | Worker de Cloudflare `uku-cerebro` que conecta a Uku con Groq o Claude; la key queda en el Worker. |
| `atiende.js` | Estado de Fran, entender, responder y mensajes. El prompt (ficha, estilo, tono, memoria, situación). |
| `memoria.js` | Hechos que Uku sabe de Fran, diario, relación y el claro que crece. |
| `tono.js` | Lee el tono de cada frase y dice cómo responder. |
| `efectos3d.js` | Efectos en el mundo 3D (globos, corazones, confeti, fuegos, monedas, sol, emojis). |
| `sueno.js` | Atmósfera de sueño: polvo de luz, bokeh y bruma (el desenfoque, el brillo y los rayos son CSS). |
| `tiempo.js` | Reloj, clima del lugar y entorno según la hora. |
| `cartel.js` | Cartel «X días sin accidentes»: días, récord y qué lo cambia. |
| `despierto.js` | Mantiene la pantalla despierta (Wake Lock y, si no, un video diminuto). |
| `descargas.js` | Tarjeta «La IA de Uku»: avance de la descarga de cada modelo. |
| `frases.js` | Lo que dice Uku, sus respuestas al toque (`CHARLA`), las adivinanzas y los consejos de oso (`TIPS`). |
| `assets/bosque3d.js` | El mundo 3D: planeta, claro, escenario, Uku (`assets/uku-rig.js` y `assets/oso/`), mariposas, cámara y paseo. |
| `assets/clima.js` | Clima del lugar (Open-Meteo) y cómo se viste Uku. |

- **Sin imitación:** se probó que Uku copiara cabeza y brazos, pero la cabeza quedaba mirando hacia arriba; se quitó. Uku queda en su animación de reposo y responde con gestos.
- **La visión corre en el navegador** (MediaPipe y face-api desde su CDN, ~24 MB la primera vez;
  luego en caché). La conversación va a Groq por el Worker: no se descarga ningún modelo de lenguaje.

### Sin internet

Servir copias locales y pasarlas por la URL:

```
_local/mp       ← npm pack @mediapipe/tasks-vision@0.10.14 (carpeta package)
_local/modelos  ← gesture_recognizer.task, pose_landmarker_lite.task, face_landmarker.task
_local/fa       ← npm pack @vladmandic/face-api@1.7.15 (carpeta package)
_local/tf       ← npm pack @huggingface/transformers@3.7.6 (carpeta package; ?tf=./_local/tf/dist/transformers.min.js)

/?mp=./_local/mp&modelos=./_local/modelos&faceapi=./_local/fa
```

`_local/` no se versiona ni se publica.

## Que la computadora no entre en reposo

Al empezar, Uku pide mantener la pantalla despierta (casilla marcada por defecto;
la tecla `S` la enciende o apaga y arriba se ve «☀️ Pantalla despierta»):

1. **Screen Wake Lock API** (Chrome, Edge, Safari 16.4+; funciona en https como en Pages).
   El navegador la suelta si ocultas la pestaña; Uku la vuelve a pedir al regresar.
2. Si el navegador no la ofrece, un **video diminuto en bucle** (como NoSleep.js).

Con eso no se apaga la pantalla ni empieza el protector, pero **no puede con lo que el
sistema imponga**: el bloqueo por política de la empresa, cerrar la tapa del portátil o
bloquear la sesión a mano. Para esos casos: en Mac `caffeinate -d` en una terminal; en
Windows, Ajustes › Sistema › Energía › «Nunca» para apagar pantalla y suspender (o PowerToys
› Awake). Pon la pantalla de Uku a pantalla completa (`F`) y deja la pestaña visible.

## Límites conocidos (POC)

- La boca de Uku está pintada: no se abre al hablar.
- El reconocimiento de caras es para una demo con pocas personas y buena luz;
  no es una verificación de identidad. Con poca luz o de perfil, la misma
  persona puede quedar como dos visitantes: se juntan desde el panel.
- El reconocimiento del navegador entiende bien frases cortas; con mucho ruido puede equivocarse (se ve en el subtítulo «…» lo que entendió).
- El modelo de conversación puede equivocarse en datos. Por eso lo
  importante (mensajes, dónde está Fran, lo que recuerda) sale de los datos.
