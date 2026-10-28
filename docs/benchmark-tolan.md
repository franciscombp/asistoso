# Benchmark: Uku frente a Tolan

Tolan (Portola, San Francisco) es la app de compañía con IA que mejor funciona hoy: un alien
que vive en su planeta, habla por voz, recuerda lo que le cuentas y escribe un diario sobre ti.
Este documento resume cómo funciona (de lo que se sabe públicamente) y qué de eso se trajo a Uku.
Uku no es un clon: la parte de **asistente de trabajo** (atender a quien viene, notas,
recordatorios, mensajes, el cartel) es lo adicional que Tolan no tiene.

## Cómo conversa Tolan

| Qué hace Tolan | Fuente | En Uku |
| --- | --- | --- |
| **Voz primero.** Más del 70 % de los mensajes son de voz; la respuesta tiene un presupuesto de ~2 s de punta a punta (fin de frase → transcripción → primer token → voz). Medio segundo más de demora bajó la retención. | OpenAI case study; charla de Paula Dozsa (AI Engineer) | Igual: oído del navegador o Whisper, el globo muestra los puntos mientras piensa y el texto se escribe en vivo. Las respuestas al toque (datos y acciones) ni pasan por el modelo. |
| **Improvisa, no sigue guion.** Primero escribieron prompts muy detallados para estructurar la conversación; salía rígido. Ahora el personaje tiene una ficha y «situaciones» (una memoria, un chiste, un momento) a las que reacciona y que va tejiendo en su carácter. | Every, *AI & I* ep. 56 (Quinten Farmer y Eliot Peper) | El prompt se arma en cada turno (`atiende.js › sistema`): ficha de Uku, cómo conversa, tono, memoria, situación y ejemplos. La charla va al modelo; antes casi todo eran frases hechas. |
| **Corto, como un hermano menor.** Habla como un adolescente simpático; los usuarios lo ven entre hermano mayor, mascota y terapeuta. No pregunta en cada turno: sabe cuándo callar. | Reseñas (SoulLink, Automateed, Forest Scout) | Una o dos frases, de tú, español de Ecuador. Regla explícita: no preguntar siempre; cuando pregunta, una sola. |
| **Lee el tono y se adapta.** Un clasificador pequeño («tone router») lee la emoción de cada turno; lo casual va a un modelo barato y lo delicado al modelo grande. A un chiste le sigue el juego; a algo serio baja la voz y acompaña. | daily.dev / BigGo (Dozsa); reseñas | `tono.js`: triste, estresado, enojado, cansado, feliz, bromista, serio, neutro. Cada tono trae su guía en el prompt, un gesto y un ánimo del oso. |
| **No solo valida: empuja.** Le dice al usuario cuando lleva tres veces quejándose de lo mismo. Diseñado contra el enganche: sin romance, empuja a la vida real. Portola lo llama «guía», no chatbot ni amigo virtual. | Every; HBS case *When the Relationship Is the Product* | En el prompt: «no eres un espejo», «puedes discrepar», «empujas hacia la vida real». Ejemplo de tono incluido. |
| **Personalidad por frameworks.** Una entrevista corta al empezar; Big Five / MBTI para que el Tolan se sienta familiar. | Every; GeekWire | No hay entrevista: Uku tiene una sola personalidad (oso de anteojos, bosque nublado). Si sabe poco de Fran, le pregunta algo de su vida, una cosa a la vez. |
| **Alien a propósito.** Nadie proyecta un humano sobre él: lo raro se lee como encanto, y el alien tiene excusa para preguntar por la vida de la gente. | Fast Company; ai.engineer | Uku es un oso que nunca salió de su claro: el mundo de afuera le da curiosidad y lo entiende a su manera. |

## Cómo genera su mundo (el planeta)

| Qué hace Tolan | Fuente | En Uku |
| --- | --- | --- |
| **El planeta crece con la relación.** Cada usuario tiene un planeta; su vegetación, terreno y estructuras cambian según lo que conversan. Empieza árido y florece. | Fast Company; svgapp; reseñas | `memoria.js › mundo()`: con las conversaciones salen las flores; con los días, guayacanes y árboles; con lo que sabe, mariposas; la casa al segundo día, la tortuga a la semana, banderas por cada meta que recuerda; el lago se agranda. |
| **Energía.** Conversar da «energía» que se gasta decorando el mundo; las tareas diarias dan recompensas (plantas, decoraciones). | Medium (reseña de un mes); aisharenet | Cada hecho nuevo que Uku aprende hace brotar flores en el claro (`mimo:aprendio`). No hay tienda ni decoración manual (es lo que más critican de Tolan: opciones escasas). |
| **Procedural, no generado por IA.** Probaron objetos generados por IA y salían paisajes llenos de cosas sin sentido; se quedaron con semillas y generación procedural. | Fast Company | Igual: el claro es procedural con semilla fija (`bosque3d.js`), así no «salta» entre visitas. |
| **Mundo con lore.** Eliot Peper (novelista) escribió el planeta Portola: geografía, cultura, lengua, historia, para que la personalidad tenga base. | Every; eliotpeper.com | La ficha de Uku trae su lore mínimo (casa, lago, patos, cascada, banca, periódico «El Claro», mariposas, miedo a las guitarras). Se puede ampliar. |
| **Reacciona al toque, animaciones por estado.** El personaje responde al tacto; la primera versión animaba con una máquina de estados y keyframes porque el modelo no podía mover emociones de forma fiable. | ai.engineer | Igual: gestos del rig (saludar, asentir, contento, preocupado, leer), ánimo que se queda (`setMood`), reacciones a gestos de manos y cara. |

## Memoria y diario

| Qué hace Tolan | Fuente | En Uku |
| --- | --- | --- |
| **La memoria es una primitiva propia.** Cada conversación se registra y alimenta la memoria del personaje; en cada turno se rearma el contexto: mensajes recientes, ficha de persona, memorias recuperadas y guía de tono. Recuperación, no transcripciones completas. | OpenAI case study; Creative Conviction (Farmer) | `memoria.js`: hechos (de quién, cuándo, cuántas veces, si hay que preguntar después). `recordar(texto)` elige los que vienen al caso por palabras en común. Se aprende turno a turno con reglas y, al cerrar, el modelo extrae hechos nuevos. |
| **Diario desde su punto de vista.** Escribe una entrada diaria sobre ti «a través de sus ojos»: qué hablaron y lo que notó. Es lo más compartido en Reddit («mi Tolan me conoce mejor que nadie»). | Substack (giraffetales); Medium; reseñas | Al despedirse de Fran, Uku escribe dos o tres frases (`redactarDiario`). Se lee en P › Diario, junto a lo que sabe; todo se puede borrar. |
| **Saca el tema.** No espera a que el usuario lleve la conversación: propone temas, reacciona a fotos, sugiere una intención corta al empezar el día. | chatgate; SoulLink | `abrirTema()`: al rato de saludar a Fran pregunta cómo le fue con lo pendiente, cuánto hace que no hablan, o por la mañana «¿qué es lo único que tiene que salir hoy?». |
| **Insights.** La app resume patrones de las conversaciones en frases cortas. | SoulLink | No (pendiente). Los hechos repetidos suben de peso en la memoria, que es la base para esto. |
| **Fotos, planes de comida, listas.** Comparte fotos; arma un plan semanal de comidas; crea listas de pendientes. | SoulLink; mwm.ai | Fotos no. Listas: post-its y recordatorios por voz («Uku, recuérdame…»), que además viajan al prompt como «tiene pendiente hoy». |

## Lo que Uku tiene y Tolan no (el asistente de trabajo)

- Atiende a **quien se acerca** a la compu de Fran por la webcam: reconoce caras, saluda por el nombre, anota visitas y mensajes («dile que lo busqué») y se los cuenta a Fran cuando vuelve.
- **Recordatorios y post-its** por voz, con un muro en pantalla.
- **Estado** («Fran está en el Piso 10, vuelve a las 4») que responde a los demás.
- El **cartel de días sin accidentes**, el clima real, los gestos de manos y cara, piedra-papel-tijera.
- Modo **guardián**: con Fran enfrente solo lo saluda y sigue en lo suyo (no engancha).
- Todo corre en el navegador y la memoria se queda en el equipo; lo único que sale es lo que viaja al modelo cuando se conversa.

## El otro benchmark: el Alien Child de *Her* (2013)

En la película de Spike Jonze, Theodore juega en su sala con un holograma: un alienígena chiquito
(con la voz del propio Jonze, diseño de David OReilly) que lo guía por unos túneles mientras lo
insulta con gracia. No hay pantalla, ni mandos, ni HUD: el personaje está en el cuarto, se le habla
y entiende; tiene su propio carácter y su propia agenda; se mete en la conversación entre Theodore
y Samantha (los tres hablan a la vez); se aburre, se queja, se burla, se pierde. Es la escena que
mejor muestra un personaje de juego que se siente **presente** y con **genio propio**.

| Qué hace el Alien Child | En Uku |
| --- | --- |
| **Vive en la sala, sin pantalla ni mandos.** Se le habla directo y el personaje contesta; no hay interfaz. | Uku vive en la pantalla grande con los controles ocultos por defecto (solo él, su globo, el reloj y el clima). Se le habla y lo ve a uno por la webcam. |
| **Tiene genio propio.** Insulta, se burla, se queja, se niega, te apura. Lo grosero se lee como encanto porque es un bicho chiquito. | El prompt tiene **picardía con cariño**: Uku puede molestar un poquito, tener mal genio de mentira, negarse con humor («ya van cinco chistes, ¿me pagas en miel?») o pedir algo a cambio. Nunca hiere y lo deja a la primera señal de que algo es serio. Ejemplos en `atiende.js › EJEMPLOS_TONO`. |
| **Te guía por los túneles.** El juego es él llevándote; se pierde, te apura, comenta el camino. | Al revés, porque Uku es el que vive en el claro: en **«Guíame»** (tecla `7` o decir «guíame») Uku se pierde a la entrada del bosque y tú lo traes a casa con la voz («izquierda», «derecha», «arriba», «sigue», «para») o **señalando con la mano** (la mano a un lado de la cámara lo lleva para allá; arriba, al fondo). Comenta el camino («¿seguro que es por aquí?»), se queja si lo dejas plantado, avisa cuando choca con algo («por ahí no paso, ¿me rodeas eso?»), celebra al llegar y a los dos minutos se rinde con drama. |
| **Conversación a tres.** El alien, Theodore y Samantha se cruzan; el alien se mete en la charla de los dos. | Cuando Fran está en cámara y le habla una visita, el prompt dice que la conversación es a tres: Uku puede incluir a Fran, hacer de puente («Fran, ¿le contamos?») o bromear con los dos. |
| **Se mueve por el espacio con el cuerpo.** Theodore lo sigue por la sala. | Uku pasea por un claro de más de 4 m, rodea el lago y la casa, se sienta a leer en la banca; las flechas y, ahora, la mano y la voz lo manejan. |

## Lo que falta para estar a la par

1. **Latencia.** Tolan mide cada tramo y presupuesta 2 s. Uku no mide: convendría instrumentar (oído → respuesta → voz) y, como Tolan, usar un modelo pequeño para lo casual y el grande para lo delicado (el tono ya está clasificado; falta que el Worker elija el modelo).
2. **Memoria por recuperación semántica.** Hoy es por palabras en común; con muchos hechos conviene usar los vectores de MiniLM que ya carga `oido.js` (`vectores()`).
3. **Insights y entrevista inicial.** Un resumen semanal («esta semana te vi tres veces estresado por el comité») y tres preguntas al empezar para arrancar con memoria.
4. **Voz con más carácter.** Tolan tiene voces propias; Uku usa `speechSynthesis` del sistema.
5. **Evaluación.** Portola evalúa con expertos (Braintrust) qué es una buena respuesta. Hace falta un set de conversaciones de prueba y revisarlas (`tools/` es el sitio).

## Fuentes

- OpenAI, *How Tolan builds voice-first AI with GPT-5.1* (openai.com/index/tolan)
- Every, *This AI Alien Will Bring In $4 Million This Year in Revenue* (podcast y transcripción con Quinten Farmer y Eliot Peper)
- Fast Company, *Tolan, an adorable alien, is the AI companion we all need*
- GeekWire, rondas de $10M y $20M de Portola
- Paula Dozsa (Tolan) en AI Engineer, resumen en daily.dev y BigGo
- Creative Conviction, entrevista a Quinten Farmer
- ai.engineer/orgs/tolan; HBS case *Tolan: When the Relationship Is the Product*
- Reseñas: SoulLink (2026), Automateed, Forest Scout, Medium (@zhy9495), giraffetales.substack.com
- *Her* (Spike Jonze, 2013), escena del Alien Child; Vice, *Meet the real-world designers behind the fictional video games of Her* (David OReilly); SlashFilm, *10 fake video games from movies*
