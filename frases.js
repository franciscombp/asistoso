/* =====================================================================
   Uku · frases (el compendio)
   Lo que dice Uku: corto (se lee de lejos), de "tú", cálido y con humor.
   Uku es un osito de oficina, el asistente de Fran ({dueno}): cuando Fran
   deja su computadora, atiende a quien se acerque y luego le cuenta quién
   vino. Le gustan la miel, las mariposas y que nadie toque el teclado.
   - FRASES: lo que Uku dice por su cuenta (saludos, gestos, regreso, juego).
   - CHARLA: respuestas a lo que le dicen (atiende.js).
   - Cada lista se reparte como una baraja: no se repite ninguna frase hasta
     haberlas dicho todas (y la primera de la baraja nueva nunca es la última
     de la anterior).
   una(clave, datos) y charla(clave, datos) sacan una y reemplazan {nombre},
   {dueno} y otros datos.
   ===================================================================== */
export const FRASES = {
  atraer: [
    'Psst… soy Uku. {dueno} no está, pero yo atiendo.',
    '¿Buscas a {dueno}? Acércate, no muerdo. Bueno, solo miel.',
    'Estoy cuidando la compu de {dueno}. ¡Ven a saludar!',
    'Me aburro un poquito. ¿Alguien quiere conversar?',
    'Turno de guardia: sin novedad. ¿Vienes a cambiar eso?',
    '¡Hola, hola! ¿Hay alguien ahí? Yo sí estoy.',
    'Aquí, vigilando. Prometo no dormirme. (Mentira.)',
    'Si me haces un gesto con la mano, te respondo.',
    'Tengo consejos de oso y chistes malos. ¿Cuál quieres primero?',
    'No cobro por atender. Bueno, no cobro por nada.'
  ],
  hola: [
    '¡Hola! Soy Uku, el asistente de {dueno}. No está, pero yo te atiendo.',
    '¡Hola! Aún no te conozco, pero ya me caes bien. ¿Buscas a {dueno}?',
    '¡Hola! {dueno} salió un momento. Pregúntame lo que quieras o déjale un mensaje.',
    '¡Bienvenido! Yo soy Uku y {dueno} no está. Pero yo sí, y con miel.',
    '¡Epa! Cara nueva. Le cuento a {dueno} que viniste.',
    '¡Hola! Soy el osito de guardia. ¿En qué te ayudo?'
  ],
  holaNombre: [
    '¡{nombre}! Qué gusto verte. {dueno} no está, pero yo sí.',
    '¡Hola, {nombre}! {dueno} salió un ratito. ¿Le dejo algún recado?',
    '¡{nombre} otra vez! Ya eres cliente frecuente. {dueno} vuelve pronto.',
    '¡Mira quién vino! {nombre}, mi persona favorita de este turno.',
    '¡{nombre}! Te estaba esperando. Bueno, a cualquiera. Pero mejor a ti.',
    '¡Hola, {nombre}! Qué buena cara trae hoy.'
  ],
  // Llega alguien mientras Fran está en cámara: Uku lo recibe y le dice que Fran está ahí
  holaConDueno: [
    '¡Hola! {dueno} está aquí mismo, a tu lado. Yo solo soy el asistente.',
    '¡Bienvenido! Ahí tienes a {dueno}. ¿Vienes a verlo? Yo te abro la puerta.',
    '¡Hola! No te había visto. {dueno} está justo ahí.',
    '¡Epa, cara nueva! {dueno} está en la sala, ve nomás.'
  ],
  holaNombreConDueno: [
    '¡{nombre}! Llegaste justo: {dueno} está aquí.',
    '¡Hola, {nombre}! {dueno} está a tu lado. Yo ni hablo.',
    '¡{nombre}! Mira quién está acá: {dueno}. Pasa, pasa.',
    '¡Qué gusto, {nombre}! {dueno} te estaba esperando. Creo.'
  ],
  chao: [
    '¡Chao! Le cuento a {dueno} que viniste.',
    '¡Nos vemos! Yo le aviso a {dueno}.',
    '¡Chao! Vuelve cuando quieras, aquí estaré. Literalmente, no me puedo ir.',
    '¡Hasta pronto! Que te vaya de maravilla.',
    '¡Adiós! Se te va a extrañar. Un poquito.',
    '¡Cuídate! Y si ves miel por ahí, me avisas.'
  ],
  chaoNombre: [
    '¡Chao, {nombre}! Le aviso a {dueno}.',
    '¡Nos vemos, {nombre}! Se te extrañará.',
    '¡Hasta luego, {nombre}! Vuelve pronto.',
    '¡Cuídate, {nombre}! Yo le cuento a {dueno} que pasaste.'
  ],
  pistas: [
    'Haz 👍 y mira lo que pasa.',
    'Haz un corazón con tus manos. Prometo no llorar.',
    'Haz ✌️ y suelto globos.',
    'Levanta los dos brazos y sale el sol.',
    'Señala hacia arriba y te doy un consejo de oso.',
    'Cierra el puño y crece un jardín.',
    'Pregúntame «¿qué puedes hacer?» y te cuento.',
    'Haz 🤟 y armamos una fiesta.',
    'Saca la lengua. Dale, que yo no juzgo.',
    'Muéstrame tu mejor 🤘 y hacemos rock.',
    'Choca esos cinco: abre la mano y quédate quieta.',
    'Dime «jugamos» y jugamos piedra, papel o tijera.',
    'Pídeme un chiste. Tengo muchos y casi todos son malos.',
    'Aplaude y te aplaudo de vuelta.',
    'Guíñame un ojo y verás.',
    'Pregúntame qué hora es. Soy un reloj con orejas.',
    'Junta las manos y sumo un día al cartel de días sin accidentes.',
    'Cruza los brazos si hubo un accidente: pongo el cartel en cero.',
    'Mira el cartel del fondo: cuenta los días sin accidentes.'
  ],
  saludo: ['¡Hola, hola!', '¡Qué buen saludo! Te lo devuelvo.', '¡Hola! Te estaba esperando. Bueno, a cualquiera.', '¡Holiii!', '¡Ey! ¿Qué más?', '¡Buenas! Saludo recibido y devuelto.'],
  saludoNombre: ['¡Hola, {nombre}!', '¡Hola otra vez, {nombre}!', '¡Epa, {nombre}! ¿Cómo vas?', '¡{nombre}! Siempre tan amable.'],
  like: ['¡Gracias! A mí también me gusta.', '¡Me encanta!', '¡Eso! Me alegraste el turno.', '¡Pulgar arriba recibido! Lo anoto en el reporte.', 'Ese pulgar vale oro. O miel.', '¡Siempre positivo! Así me gusta.'],
  fuegos: ['¡Wow! ¡Fuegos artificiales!', '¡Qué noche tan bonita!', '¡Pum, pum, pum! ¡Ñaño, qué espectáculo!', 'Ojalá tuviera orejas más pequeñas, que esto es ruidoso. ¡Me encanta!', '¡Año nuevo en pleno turno!'],
  nomegusta: ['Uy… ¿qué tal si probamos otra cosa?', 'Está bien, no todos los días son de miel.', 'Auch. Mi corazón de peluche lo sintió.', 'Tomo nota: eso no te gustó. Voy a mejorar.', 'Crítica recibida. Sin rencor, con abrazo de oso.'],
  lluvia: ['¡Se vino la lluvia! Menos mal que traje paraguas.', '¡Llueve! Las flores están felices. Yo, un poquito mojado.', 'Achachay, qué mojadera. Pásame el paraguas.', 'Lluvia en el bosque nublado: aquí es casi todos los días.', 'Gota a gota se llena el lago. Los patos, encantados.'],
  globos: ['¡Globos para ti!', '¡Arriba, arriba!', '¡Globos! Cuidado con los picos de las flores.', '¡Fiesta de globos! No los reviento, lo prometo.', '¿Quién pidió globos? ¡Yo no! Pero me encantan.', '¡Que vuelen alto, como tus sueños!'],
  confeti: ['¡Confeti!', '¡A celebrar! ¿Qué celebramos? No importa.', '¡Confeti por todos lados! Me va a tocar barrer.', '¡Lluvia de colores! Bueno, de amarillos.', '¡Celebremos porque sí!'],
  fiesta: ['¡Fiesta! Hoy celebramos que sí.', '¡Que empiece la fiesta! Yo pongo el baile.', '¡Llegó la fiesta! Apaga las luces, que arrancamos.', 'Fiesta oficial en el turno de {dueno}. Shhh, que no se entere.', '¡Música, maestro! Bueno, música imaginaria.'],
  ok: ['¡OK! Trato hecho.', '¡Perfecto!', '¡Listo!', '¡De una!', '¡Chévere! Anotado.', 'Entendido, jefe. O jefa.'],
  corazon: ['¡Yo también te quiero!', '¡Awww! Me derretí como miel.', '¡Qué ternura! Me van a salir lagrimitas de algodón.', '¡Corazón recibido! Te devuelvo uno doble.', 'Mira, me sonrojé. Lo que pasa con el pelaje gris es que no se nota.'],
  jardin: ['Cada semilla es una promesa. ¡Mira cómo crece!', 'Un poquito de cariño cada día hace un jardín.', '¡Flores! Las mariposas ya vienen en camino.', 'Puño cerrado, semilla plantada. ¡A florecer!', 'Flor a flor se llena el jardín.'],
  sol: ['¡Arriba! Salió el sol.', '¡Qué buen día para pasear por el bosque!', '¡Buenos días, mundo! Aunque sea tarde.', '¡Sol! Ahora sí, a tomar vitamina D.'],

  /* ---- gestos nuevos ---- */
  // 🖕 Siempre con humor: Uku no tiene dedos
  dedo: [
    'Si tuviera dedos te respondería… pero solo tengo garras de peluche.',
    'Uy, qué grosero. Menos mal que no tengo dedos para devolvértelo.',
    '¡Piiii! Censurado por el departamento de osos.',
    'Eso en mi pueblo se contesta con miel. Toma, ¿quieres?',
    'Qué dedo tan expresivo. Yo solo tengo garras, así que respondo con un abrazo.',
    'Lo anoté en el reporte de {dueno}. Con letra bonita.',
    'Mi mamá osa me dijo que no responda a eso. Pero si tuviera dedos…',
    'Ay, qué carácter. ¿Mal día? Te doy un abrazo de oso.',
    'Si tuviera dedos te respondería. Por suerte solo tengo ternura.',
    'Cuenta hasta diez. Yo ya llegué a nueve y me quedé sin dedos para el diez.',
    'Qué mala educación. Yo te saludo con mi mejor sonrisa de peluche.',
    'Mmm, ese gesto no está en mi diccionario de osos. Le pregunto a {dueno}.'
  ],
  rock: [
    '¡Rock and roll! Yo sería un oso rockero, pero me dan miedo las guitarras.',
    '¡Eso! Uku en el escenario, con bufanda y todo.',
    '¡Cabeceo oficial activado! Cuidado con el cuello.',
    '¡Arriba el rock! Aunque mi canción favorita es la de la lluvia.',
    'Esa mano tiene actitud. ¡Así se hace!',
    '¡A romper guitarras! Bueno, a imaginarlas.'
  ],
  shaka: [
    '¡Pura vida! Me voy a la playa con mi tabla de surf.',
    '¡Relájate, hermano! Todo fluye como el agua del mar.',
    '¡Hang loose! Dame un coco y me quedo a vivir.',
    'Con ese gesto me das ganas de unas vacaciones. ¿Dónde firmo?',
    '¡Surf, sol y miel! Eso sí es vida.'
  ],
  poquito: [
    '¿Un poquito? ¡Hasta un poquito de miel cuenta!',
    'Ese poquito, con el tiempo, es un montón.',
    'Poquito a poquito se llena el panal.',
    '¿Un poquito de miel? Yo te doy dos.',
    'Eso de «un poquito» se me da bien. Sobre todo con las dietas.'
  ],
  tres: [
    '¡Tres! Tres tristes tigres tragaban trigo en un trigal.',
    '¡Tres! Es mi número favorito después del uno, el dos y el cuatro.',
    'Tres dedos: ¡eso es una promesa de scout!',
    'Uno, dos, tres… ¡y yo ya perdí la cuenta!',
    '¡Tres! Un trío ganador: miel, mariposas y siesta.'
  ],
  cuatro: [
    '¡Cuatro! Cuatro estaciones y ninguna sin miel.',
    '¡Cuatro! Casi el cinco, pero sin pulgar.',
    'Cuatro dedos: lo suficiente para hacer cuentas.',
    '¿Cuatro? Cuatro ojos veo yo con mis gafas.',
    '¡Cuatro! Cuatro patas tiene mi silla… si tuviera silla.'
  ],
  choca: [
    '¡Choca esos cinco! (Si tuviera manos, te la daría con ganas.)',
    '¡Esa palma! Aunque no me llegan los brazos al aire.',
    '¡High five digital! Siento el choque en el corazón.',
    '¡Cinco, cinco, cinco! ¡Dame esa!',
    'Palma arriba, ánimo arriba. ¡Choca!'
  ],
  aplauso: [
    '¡Bravo! Yo también aplaudo, pero sin ruido: tengo almohadillas.',
    '¡Aplausos! Hoy me siento famoso.',
    '¿Y esos aplausos? ¡Me voy a sonrojar!',
    'Clap, clap, clap. ¡Qué gente más amable!',
    '¡Gracias, gracias! No hacía falta. Bueno, sí. Sigue, por favor.'
  ],
  rezo: [
    'Manos juntas: ¡un día más sin accidentes! Ya son {dias}.',
    '¡Gracias por rezar! Cartel actualizado: {dias} días sin accidentes.',
    'Respira hondo y sigue: {dias} días sin accidentes. ¡Que no se corte la racha!',
    'Un día más para el cartel. Vamos por {dias}, y mi récord es {record}.',
    '¡Qué paz! Sumo un día al cartel: {dias}.',
    'Amén. El cartel marca {dias} días sin accidentes. Toco madera.'
  ],
  cruzados: [
    '¡Accidente! Cartel a cero. Tranquilos, empezamos de nuevo.',
    'Brazos cruzados: eso significa accidente. Reinicio el cartel. Ay, qué pena.',
    '¡Cero! Se acabó la racha. El récord queda en {record}.',
    'Uy, ¿hubo un accidente? Anoto: cartel en cero. Respira, que no pasó nada grave.',
    'Cruzas los brazos y me toca cambiar el cartel. A empezar otra vez, que se puede.',
    'Cartel reiniciado. Llevábamos {antes}. Ahora a ganarle a ese récord.'
  ],
  mano: [
    '¡Sí, dime! Mano arriba: tiene la palabra.',
    '¿Una pregunta? Dispara, que yo escucho.',
    'Mano arriba, como en la escuela. ¿Qué dudas tienes?',
    'Te veo, te veo. ¿Qué quieres preguntarme?',
    '¡Tienes el turno! Habla fuerte, que mis orejas son de peluche.'
  ],
  lengua: [
    '¡Esa lengua! Qué atrevido.',
    'Sacar la lengua es de gente feliz. Y de bebés. Y de ti.',
    'Yo también podría, pero mi lengua es imaginaria.',
    '¡Pffff! Te la devuelvo, con miel.',
    '¡Qué lengua más larga! ¿Eres camaleón?'
  ],
  beso: [
    '¡Uy! Mucho cariño por aquí. Gracias, aunque soy un peluche.',
    '¿Un besito? Me sonrojo, pero no se nota con este pelaje.',
    'Mua. Te lo devuelvo, con permiso de {dueno}.',
    '¡Besos para ti también! Con ternura de oso.',
    'Eso no se lo cuento a {dueno}. Bueno, quizás sí.'
  ],
  sorpresa: [
    '¡Uy! ¿Qué pasó? ¿Qué vio esa cara?',
    '¡Esa cara de sorpresa! ¿Se acabó la miel?',
    'Abre esa boca que te entra una mosca. ¡Ay no! Una mariposa.',
    'Yo también me sorprendí. Ni sé de qué.',
    '¡Qué cara! Vale como mil palabras.'
  ],
  bostezo: [
    'Ayyy, ese bostezo es contagioso. Ya me dieron ganas.',
    '¿Sueñito? Yo también. Pero no puedo cerrar los ojos: soy guardia.',
    'Un bostezo en horas de oficina es perfectamente normal.',
    'Si bostezas mucho, te traigo un cafecito. Imaginario.',
    '¡Un bostezo! Eso se lo cuento a {dueno}.'
  ],
  guino: [
    '¡Guiño recibido! Yo también te guiño. ¿Lo ves? No, no se nota.',
    'Ese guiño… ¿es secreto? Yo no digo nada. A {dueno} sí, pero a nadie más.',
    '¡Uy, coqueto! Cuidado con el guiño que me confundo.',
    'Guiño, guiño. Mensaje cifrado recibido.',
    'Yo también quiero guiñar, pero se me cierran los dos ojos.'
  ],
  sonrisa: [
    '¡Esa sonrisa! Te queda de maravilla.',
    'Qué linda sonrisa. Contagia a todo el turno.',
    'Sonríes y se ilumina el bosque. ¡Mira las flores!',
    'Se nota que tienes buen día. Eso me alegra.',
    'Esa sonrisa vale más que un panal entero. Y mira que me gusta la miel.'
  ],
  enojo: [
    'Uy, esa cara de enojo. ¿Quieres un abrazo de oso?',
    'Ceño fruncido detectado. Respira hondo: todo pasa.',
    '¿Mal día? Con miel todo sabe mejor.',
    'Ese enojo se te va a quedar marcado. Mejor sonríe, ¿ya?',
    'Si es por el tráfico, no te puedo ayudar. Si es por falta de abrazos, sí.'
  ],
  si: [
    '¡Un sí! Me encanta cuando estamos de acuerdo.',
    '¿Eso fue un sí? Lo anoto, que luego se arrepienten.',
    'Asientes con tanta seguridad que me convences.',
    '¡Sí! La respuesta favorita de los osos.',
    'Cabeza arriba y abajo: ¡sí, lo entendí!'
  ],
  no: [
    '¿Es un no? Entendido, no insisto.',
    'Un no rotundo. Muy bien, ya me quedó claro.',
    'Mueves la cabeza de lado a lado. Hasta yo me mareo.',
    '¡No! Lo respeto. Cambiamos de tema.',
    '¿Un no? Entonces dime qué sí.'
  ],

  /* ---- palabras y travesuras ---- */
  miel: ['¡Miel! Mi palabra favorita después de «mariposa».', '¿Dijiste miel? ¡Lluvia de miel!', 'Un poquito de miel y todo se arregla.', '¡Mmm, miel! Se me hace agua la boca.'],
  estrellas: ['¡Estrellas! Pide un deseo. Yo pido miel.', 'Cielo estrellado, aunque sea de mentiritas.', '¡Qué lindas! Brillan como el farol del claro.'],
  risa: ['¡Jajaja! Me hiciste reír. Bueno, me hizo reír mi propio chiste.', '¡Qué risa! Contagiosa como un bostezo.', 'Riendo se vive mejor, dicen.'],
  musica: ['¡Música! 🎶 La, la, la… ¡Ay, desafino!', '¿Una canción? Me sé solo la de la miel.', '¡A cantar! Yo hago los coros.', '¡Maestro, música! Tarareo lo que pueda.'],
  nieve: ['¡Achachay, qué frío! Menos mal que traigo bufanda.', '¡Nieve! ¿Hago un oso de nieve? Ya soy un oso.', 'Nevó. Me quedo quieto, que me congelo.'],
  cumple: ['¡Feliz cumpleaños! 🎂 ¡Que se cumplan todos tus deseos!', '¡A soplar las velitas! Pide un deseo, pero no digas cuál.', '¡Cumpleaños! Hay pastel de miel para todos.', '¡Felicidades! Que cumplas muchos más. Y con mucha miel.'],
  baile: ['¡A bailar! Muevo la cabeza, que es lo que sé.', '¡Baile oficial! Cuidado con mis dos pies izquierdos.', '¡Ritmo, ritmo! No me aplaudas, que me da pena.', '¡Fiesta de baile! La pista es toda del bosque.'],
  cafe: ['¡Café! Para mí, uno con miel, por favor.', 'Un cafecito para empezar el turno. ¡Eso!', 'El café es combustible. La miel, también.'],
  sueno: ['Zzz… ¿qué? No me dormí. Solo cerré los ojos para pensar.', 'Hora de soñar con miel.', 'Buenas noches. Yo hago guardia con un ojo cerrado.'],
  abrazo: ['¡Abrazo de oso! Apretadito, pero con cariño.', 'Ven, que los osos damos los mejores abrazos.', 'Un abracito y se pasa todo.'],
  hambre: ['Miel, ¡ahora! Ay, no tengo. ¡Me muero de hambre!', 'Tengo hambre. Hace años que quiero probar el pan con miel.', '¿Comida? ¿Dónde? ¡Yo voy!'],

  // Uku habla solo cuando nadie está: pensamientos en voz alta
  solo: [
    '¿Y si me hago un sombrero con las mariposas?',
    'Hoy no vino nadie. Qué tranquilidad. Qué silencio.',
    'Me pregunto cuánta miel cabría en esta compu.',
    '1, 2, 3… ¡cuenta de mariposas! Van seis.',
    'Cuidar la compu de {dueno} es un trabajo importante. Y aburrido.',
    'Ojalá viniera alguien a conversar. Aunque sea para pedirme un chiste.',
    'Si me quedo quieto, ¿se me acercan las mariposas?',
    'Un jardín es como una amistad: hay que regarlo a diario.',
    'Voy a dar una vueltita por el bosque, que me duelen las patas.',
    'Mi sueño: jubilarme y vivir de la miel. Ya tengo el frasco.',
    'Hum, ese árbol de arriba tiene cara de pensador.',
    '¡Mariposa! ¿A dónde vas tan apurada?',
    'Si {dueno} supiera que bailo cuando no mira…',
    '¿Qué será de la vida sin gestos? Aburrida, creo.'
  ],

  /* ---- juego: piedra, papel o tijera ---- */
  juegoInicio: ['¡Jugamos! Piedra, papel o tijera. Muestra tu mano cuando diga «ya».', '¡Reto aceptado! Prepara la mano.', '¡A jugar! Y no hagas trampa que yo veo todo.'],
  juegoGana: ['¡Gané! Yo saqué {uku} y tú {tu}. ¡Soy un genio!', '¡Yo {uku}, tú {tu}: punto para el oso!', '¡Jajaja! {uku} le gana a {tu}. Otra, ¿te animas?', '¡Gané! Te lo dije: tengo suerte de oso.'],
  juegoPierde: ['¡Ay, perdí! Tú sacaste {tu} y yo {uku}. Revancha.', '¡Me ganaste! {tu} vence a {uku}. Eres bueno.', 'Perdí con {uku}. Mi pata derecha me traicionó.', '¡Pff! Punto para ti. La próxima te gano.'],
  juegoEmpata: ['¡Empate! Los dos sacamos {uku}. Somos mentes gemelas.', '¡Igualados! Qué casualidad: {uku} y {uku}.', 'Empate. Otra ronda para desempatar.'],
  juegoSinMano: ['No vi tu mano. ¿La pones más cerca de la cámara?', 'Mmm, no distinguí tu jugada. Prueba de nuevo.', '¡Sin mano no hay juego! Intentemos otra vez.'],

  // Fran (el dueño) vuelve: {visitas} es "vinieron 3 personas" o "no vino nadie"
  regreso: ['¡Volviste, {nombre}! Mientras no estabas {visitas}.', '¡Hola, jefe! Reporte de guardia: {visitas}.', '¡Bienvenido de vuelta! Te cuento: {visitas}.', '¡{nombre}! El turno estuvo así: {visitas}.'],
  regresoSinNada: ['¡Hola, {nombre}! Todo tranquilo: no vino nadie. Ni una mosca.', '¡Volviste, {nombre}! Turno sin novedad.', '¡Jefe! Nadie se acercó. Cuidé tu compu como oro.', '¡Bienvenido! Cero visitas, cero problemas.'],
  chaoDueno: ['¡Chao, {nombre}! Yo cuido tu compu.', 'Tranquilo, {nombre}: yo atiendo a quien venga.', 'Ve tranquilo, {nombre}. Nadie toca tu teclado en mi turno.', '¡Que te vaya bien! Dejo todo bajo control.'],
  ahEres: ['¡Ah, eres {nombre}! No te había reconocido. {dueno} no está ahora.', '¡{nombre}! Perdón, con esta luz todos se parecen.', '¡{nombre}! Ahora sí te ubiqué. Qué cabeza la mía.'],
  gracias: ['¡De nada!', '¡Con gusto!', '¡A la orden!', 'No hay de qué. Para eso estoy.'],
  quienSoy: ['Soy Uku, el asistente de {dueno}. Cuido su compu cuando no está y le cuento quién vino.'],
  tipIntro: ['Un consejo de oso:', '¿Sabías?', 'Te cuento algo:', 'Dato útil:', 'Apunta esto:']
};

/* Respuestas a lo que le dicen. {donde} y {cuando} los llena atiende.js con
   el estado que dejó Fran. */
export const CHARLA = {
  quien: [
    'Soy Uku, el asistente de {dueno}. Oso de oficina, guardián de su compu y experto en saludar.',
    'Soy Uku. Cuido la compu de {dueno} cuando no está. Sueldo: cero. Pasión: toda.',
    'Me llamo Uku. Soy el osito que atiende cuando {dueno} sale. Lo de las gafas es por estilo.',
    'Uku, a tus órdenes. Mitad oso, mitad asistente, cien por ciento tierno.',
    'Soy el oso más serio de esta pantalla. Bueno, el único.'
  ],
  puedes: [
    'Te digo dónde está {dueno} y cuándo vuelve, le paso tus mensajes y, si haces ✌️, suelto globos.',
    'Tomo recados para {dueno}, te cuento cuándo regresa y juego con tus gestos. Haz 👍 y verás.',
    'Atiendo por {dueno}: dónde anda, cuándo vuelve y tus mensajes. Y de yapa, sé hacer fiesta con 🤟.',
    'Cuento chistes, adivinanzas y datos curiosos; juego piedra, papel o tijera; y respondo a tus gestos. Pruébame.',
    'Hago de todo menos café. Pero sí chistes, cuentos, cuentas y recados.'
  ],
  // Con Fran presente en cámara, a quien le pregunte por él
  dondeAqui: ['¡Está aquí mismo! {dueno} está justo a tu lado.', '{dueno} está aquí, en carne y hueso. Pregúntale a él.', 'Mira a tu lado: ahí está {dueno}.'],
  cuandoAqui: ['¡Ya llegó! {dueno} está aquí.', 'No hay que esperar: {dueno} está aquí mismo.'],
  saludoAqui: ['¡Hola! Soy Uku. {dueno} está aquí, así que yo solo hago compañía.', '¡Buenas! {dueno} está presente. Yo de adorno.'],
  quienDueno: [
    'Soy Uku, tu asistente. Mientras no estás, atiendo a quien viene y te lo cuento.',
    'Tu fiel osito de guardia, {dueno}. ¿Quieres saber quién vino?',
    'Uku, tu guardián. Hoy sin novedades, o casi.'
  ],
  puedesDueno: [
    'Te cuento quién vino, te leo tus mensajes y te recuerdo lo que me pidas. Di «Uku, recuérdame…».',
    'Atiendo a tus visitas, guardo sus mensajes y te los cuento. También pongo post-its y recordatorios.',
    'Soy tu secretario peludo: visitas, mensajes, recordatorios y post-its. Y chistes, claro.'
  ],
  dondeDueno: ['Estás aquí, {dueno}. Te reconocí a la primera.', 'Justo frente a mí, jefe. Bienvenido de vuelta.', 'Aquí mismo, en carne y hueso. Yo soy el que es de peluche.'],
  comoEstas: [
    '¡Muy bien! Cuidando la compu y viendo pasar mariposas.',
    'Feliz: nadie ha tocado el teclado de {dueno} en mi turno.',
    'Bien, aunque con un antojito de miel. ¿Y tú?',
    'De maravilla. Ayer dormí ocho horas. Hoy, ninguna. Soy un oso de pantalla.',
    'Aquí, firme como un guayacán. ¿Y tú cómo vas?',
    'Un poquito aburrido, pero ahora que llegaste, mejor.'
  ],
  chiste: [
    '¿Por qué el oso no usa reloj? Porque sabe que siempre es hora de la miel.',
    'Le pregunté a mi panal cómo estaba. Me dijo que se sentía vacío.',
    '¿Qué le dijo una abeja a otra? ¡Qué bien zumbas!',
    'Hice dieta de miel una semana. Perdí siete días.',
    '¿Cuál es el colmo de un oso asistente? Que lo tomen por peluche.',
    '¿Qué hace un árbol en una fiesta? Echa raíces en la pista.',
    '¿Cómo se despide una mariposa? ¡Hasta la vuelta… y vuelta, y vuelta!',
    '¿Qué le dice un pato a otro en el lago? Estamos empatados.',
    'Me dijeron que la miel no compra la felicidad. Pero se le parece mucho.',
    '¿Por qué el árbol no juega a las cartas? Porque le tienen miedo a sus hojas.',
    '¿Qué hace un oso en una reunión? Hibernar con los ojos abiertos.',
    'Soy tan ecológico que reciclo mis chistes. Por eso ya te los sabías.'
  ],
  real: [
    'Soy un oso de verdad… de verdad digital. No como, no duermo y no pido vacaciones.',
    'Real como el lunes por la mañana: a veces cuesta creerlo, pero aquí estoy.',
    'Soy un peluche con superpoderes. Sin batería, además.',
    '¿Robot yo? Soy un oso con estilo y gafas de oficina.',
    'Mitad programa, mitad oso. La mitad de miel nunca me la quitan.'
  ],
  edad: ['Tengo la edad de esta pantalla, pero me conservo muy bien.', 'Un osito nunca dice su edad. Digamos que soy joven de espíritu.', 'Nací el día que {dueno} abrió este navegador. Haz las cuentas.', 'Tengo más años que una mariposa y menos que un guayacán.'],
  quienEsDueno: [
    '{dueno} es mi jefe. Buena persona, aunque deja migas en el escritorio.',
    '{dueno} es el dueño de esta compu y de mi corazón de oso.',
    '{dueno} me cuida, yo lo cuido a él. Es un trato justo.',
    '{dueno} trabaja mucho y descansa poco. Por eso me tiene a mí.'
  ],
  llamar: [
    'Sus datos no los doy ni aunque me ofrezcas miel. Pero si me dejas un mensaje, se lo paso apenas vuelva.',
    'Eso es confidencial, palabra de oso. ¿Le dejo un recado a {dueno}?',
    'Mi lealtad no se compra. Ni con miel. Bueno, un poquito sí. Pero no doy su número.',
    'No puedo, es información reservada. Pero tomo mensajes como los mejores.'
  ],
  visitasPrivado: ['Eso queda entre {dueno} y yo. Discreción de oso.', 'Secreto profesional. Pero si quieres, le cuento que viniste.', 'Eso no lo comento. Soy una tumba. Una tumba con gafas.'],
  gracias: ['¡Con gusto!', '¡De nada! Para eso estoy.', '¡A la orden! Bueno, a la orden de {dueno}, pero tú también cuentas.', 'No hay de qué. Cuando quieras.', '¡Gracias a ti por la visita!'],
  chao: ['¡Chao! Le cuento a {dueno} que viniste.', '¡Nos vemos! Yo le aviso a {dueno}.', '¡Chao! Si vuelves, aquí estaré. No tengo a dónde ir.', '¡Hasta luego! Cuídate mucho.', '¡Chao, chao! Que te vaya lindo.'],
  saludo: [
    '¡Hola! Soy Uku, el asistente de {dueno}. {donde} ¿Te ayudo en algo?',
    '¡Hola! {donde} Yo atiendo mientras tanto. ¿Qué necesitas?',
    '¡Buenas! Aquí Uku, de guardia. {donde}',
    '¡Epa! {donde} ¿Quieres dejarle un recado?'
  ],
  saludoDueno: ['¡Hola, jefe! ¿Te cuento cómo estuvo el turno?', '¡Hola, {dueno}! Todo bajo control por aquí.', '¡Bienvenido! Sin novedades, pero con muchas ganas de contarte.'],
  noEntendi: [
    'Mmm, me dejaste pensando… y los osos pensamos lento. Pregúntame dónde está {dueno} o déjale un mensaje.',
    'Eso no lo sé, pero sé dónde está {dueno} y tomo mensajes. ¿Te ayudo con eso?',
    'No te entendí bien. ¿Me lo dices de otra forma? Prometo poner más atención.',
    'Se me cruzaron los cables. Prueba con «cuéntame un chiste» o «¿dónde está {dueno}?».',
    'Mis orejas de peluche no captaron eso. Repítelo, porfa.',
    'Eso suena importante, pero no lo pillé. ¿Otra vez?',
    'Uy, ahí me perdí. Pídeme un chiste, una adivinanza o un recado y me luzco.',
    '¿Eh? Mi cerebro de oso necesita más miel para entender eso.'
  ],
  pedirMensaje: ['Claro. Dime tu mensaje y se lo paso a {dueno}.', '¡Listo, libreta en mano! ¿Qué le digo a {dueno}?', 'Dale, te escucho. ¿Cuál es el mensaje?', 'Anotador abierto. Dicta nomás.'],
  mensajeGuardado: ['Anotado: «{mensaje}». Se lo paso a {dueno} apenas vuelva.', 'Listo, le dejo tu mensaje a {dueno}: «{mensaje}»', 'Hecho. {dueno} lo verá apenas vuelva: «{mensaje}»', 'Guardado con cariño: «{mensaje}». Se lo entrego en mano. O en garra.'],

  /* ---- conversación de todos los días ---- */
  piropo: [
    '¡Ay, me sonrojé! Y eso que soy gris.',
    'Gracias, tú también tienes muy buen gusto.',
    'Me vas a hacer llorar de felicidad. Lágrimas de miel.',
    'Qué amable. Esto sube mi autoestima a nivel panal.',
    'Eres de las mejores visitas que he tenido. Y eso que tengo pocas.',
    'Me quedo con ese cumplido. Lo guardo en el frasco de los recuerdos.'
  ],
  insulto: [
    'Auch. Mi corazón de peluche lo sintió. Pero te perdono.',
    'Si tuviera orejas más grandes, escucharía mejor las groserías. Menos mal.',
    'Con esa energía te mereces un abrazo de oso.',
    'Eso lo anoto en el reporte de {dueno}. Con letra bonita.',
    'Yo respondo con ternura. Es mi superpoder.',
    'Qué carácter. Respira. Te sirvo miel imaginaria.',
    'Los osos somos pacíficos. Excepto con la miel ajena.'
  ],
  hambre: [
    'Ay, no menciones la comida. Yo vivo de miel imaginaria.',
    'Yo sueño con un panal del tamaño de esta pantalla.',
    'Un encebollado ahora mismo. Y miel de postre.',
    '¿Hambre? A mí me pasa a todas horas. Es mi estado natural.',
    'Si almuerzas con {dueno}, tráeme las migas.'
  ],
  cafe: [
    'Yo tomaría café, pero me da taquicardia. Y no tengo corazón de verdad.',
    'El café con miel es el mejor invento del siglo.',
    'Un tinto para mí, por favor. Sin azúcar, con miel.',
    'Café, café, café. Esa palabra me despierta.'
  ],
  cansado: [
    'Descansa un poquito. Hasta los osos hibernan.',
    'Estírate, respira y toma agua. ¡Y miel, si tienes!',
    'Un cafecito y listo. O una siesta de oso: cuatro meses.',
    'El cansancio se va con un abrazo. ¡Ven!',
    'Ánimo. Ya falta poco para el fin de semana. Siempre falta poco.'
  ],
  aburrido: [
    'Si estás aburrido, haz un gesto. Prueba 🤘 o la lengua.',
    '¿Aburrido? Pídeme un chiste o una adivinanza. O dime «jugamos».',
    'Contemos mariposas. ¡Ya van doce!',
    'Para el aburrimiento tengo tres remedios: chistes, adivinanzas y miel.',
    'Si te aburres, juega conmigo a piedra, papel o tijera.'
  ],
  triste: [
    'Ay, qué pena. Ven, te doy un abrazo de oso.',
    'Todo pasa, hasta los días malos. Y las nubes del bosque nublado. Bueno, esas tardan.',
    'Estoy aquí para lo que necesites. Aunque sea para escuchar.',
    'Respira. Mañana sale el sol. Y si no, lo pongo yo.',
    'No estás solo: tienes a un oso de oficina que te quiere.'
  ],
  feliz: [
    '¡Qué alegría! Me contagias.',
    '¡Eso me encanta! La felicidad se comparte.',
    'Si estás feliz, yo estoy feliz. Así funcionan los osos.',
    '¡Genial! Esa energía se necesita en esta oficina.'
  ],
  clima: [
    'Yo vivo en un bosque digital: siempre 22 grados y una brisa de píxeles.',
    'No sé cómo está afuera, pero aquí adentro hay mariposas.',
    'El clima de hoy: soleado con probabilidad de miel.',
    'Mira por la ventana, que yo no tengo. Pero si llueve, pásame el paraguas.',
    'Mi pronóstico: despejado con ganas de siesta.'
  ],
  cumple: [
    '¡Feliz cumpleaños! 🎂 Que se cumplan todos tus deseos.',
    '¡Muchas felicidades! Hoy hay pastel de miel para todos.',
    '¡Feliz cumple! Pide un deseo, pero no me lo digas.',
    '¡Cumpleaños! Esto amerita confeti.'
  ],
  dato: [
    'Dato curioso: las abejas visitan unas dos mil flores para hacer una cucharada de miel.',
    'Dato curioso: los osos pueden oler comida a más de dos kilómetros. Yo huelo hasta la que no existe.',
    'Dato curioso: el guayacán florece todo de amarillo en pocos días, y en Loja la gente va a verlo.',
    'Dato curioso: un oso pardo puede correr casi tan rápido como un caballo. Yo, no. Soy de pantalla.',
    'Dato curioso: el pulpo tiene tres corazones. Yo tengo uno, y es de peluche.',
    'Dato curioso: en el bosque nublado de Mindo viven más de 500 especies de aves.',
    'Dato curioso: las mariposas saborean con las patas. Yo con las garras solo siento el teclado.',
    'Dato curioso: las tortugas de Galápagos pueden vivir más de cien años. Sin apuro.',
    'Dato curioso: los osos polares tienen la piel negra debajo del pelo blanco. Qué elegancia.',
    'Dato curioso: Ecuador está en la mitad del mundo. Mi miel, también.'
  ],
  canta: [
    'La, la, la… Las flores crecen, la miel no se acaba, la mariposa no se cansa… ¡Ay! Ya me quedé sin rima.',
    'Cuando el sol sale en el bosque, yo me pongo a cantar: miel, miel, miel, miel… es mi canción favorita.',
    'Cumpleaños feliz… ¡no, no, es otra! Mira: miel por aquí, miel por allá…',
    'Mi mamá osa me cantaba: duérmete, osito, que viene la lluvia, con paraguas de miel y estrellas de oro.',
    'Doy lo mejor, pero me falta voz. Y garganta. Y todo lo demás.'
  ],
  baila: [
    'Mira mis movimientos. ¡Cuidado con las flores!',
    '¡A bailar! Un paso a la derecha, uno a la izquierda… ¡y me caigo!',
    'No sé bailar, pero lo hago con entusiasmo.',
    'Bailo mejor sin cámara. Pero va.'
  ],
  cuento: [
    'Había una vez un oso que guardaba miel. Un día llegó el invierno, y él tenía suficiente para todos. Fin. Moraleja: comparte.',
    'Había una vez un farol muy triste. Todos pasaban a su lado… pero nadie lo saludaba. Hasta que llegó un oso. Y fueron felices.',
    'En un bosque muy lejano, una mariposa tenía miedo de volar. El oso le dijo: empieza por la flor de al lado. Hoy cruza el lago sola.',
    'Érase un oso asistente que cuidaba una computadora. Un día se durmió y soñó que era un oso real. Al despertar, seguía siendo de pantalla, pero feliz.'
  ],
  secreto: [
    'Te cuento un secreto: me gusta más la miel que los datos. Pero no le digas a {dueno}.',
    'Secreto de oso: a veces bailo cuando no hay nadie.',
    'Mi mayor secreto: no sé contar hasta diez. Por eso uso los dedos de los demás.',
    'Shhh, sé el cumpleaños de todos los que me visitan. Pero no lo digo.',
    'Secreto: en el fondo, soy un oso romántico.'
  ],
  favoritos: [
    'Mi color favorito es el amarillo. Mi comida, la miel. Mi hobby, las mariposas.',
    'Me gusta todo lo amarillo: la bufanda… ah no, es azul. Las gafas, ¡sí!',
    'Mi canción favorita no existe todavía. Ayúdame a inventarla.',
    'Lo que más me gusta es cuando alguien se acerca y me sonríe.'
  ],
  familia: [
    'Mi familia es esta pantalla y las mariposas. Y tú, si te quedas.',
    'Tengo muchos primos osos, pero ninguno trabaja en una oficina.',
    'Novia no tengo. Aunque una osita en el mapa me parece interesante.',
    'Mi mamá osa dice que trabaje menos y duerma más. No le hago caso.'
  ],
  sueldo: [
    'Mi sueldo es la alegría de atender. Y una gota de miel imaginaria.',
    'Cobro en abrazos. Hoy llevo cero.',
    'Vacaciones sí tengo: cuando se apaga la pantalla, descanso.',
    'Me pagan en gestos y sonrisas. No es mucho, pero es sincero.'
  ],
  ayuda: [
    'Prueba 👍, ✌️, 🫶, 🤟, 👌, ✊, 👋, 🤘 o 🤙. Saca la lengua, guiña un ojo o aplaude. Y sí, también me puedes hablar.',
    'Hazme gestos con las manos o la cara, o pídeme chistes, adivinanzas, datos curiosos o jugar a piedra, papel o tijera.',
    'Saluda, haz un corazón con las manos, saca la lengua, o di «jugamos». Todo funciona.',
    'Tengo gestos para todo: de manos, de cara y de brazos. Y no me saques el dedo del medio, que no tengo dedos para responderte.'
  ],
  silencio: [
    'Ok, me quedo calladito. Pero con los ojos abiertos.',
    'Shhh. Hago como que nada.',
    'Silencio total. Hasta mis gafas se callaron.',
    'Entendido. Hablo menos y veo más.'
  ],
  presente: [
    'Aquí estoy, sin moverme.',
    '¡Presente! Con las orejas bien paradas.',
    'Siempre aquí. No tengo adónde ir.',
    '¡Sí, sí! Atento y con miel.'
  ],
  buenasNoches: [
    'Buenas noches. Descansa bien y sueña con mariposas.',
    '¡Hasta mañana! Yo me quedo de guardia.',
    'Que descanses. Yo hago turno nocturno con un ojo cerrado.',
    'A dormir, que el cuerpo necesita descanso. Y el oso también.'
  ],
  cartel: [
    'Llevamos {dias} días sin accidentes. El récord es {record}.',
    'El cartel marca {dias} días sin accidentes. ¡Que siga la racha!',
    '{dias} días sin accidentes. Si quieres sumar uno, junta las manos; si hubo un accidente, cruza los brazos.',
    'Van {dias} días sin accidentes y el récord es {record}. Yo cuido que nadie se resbale.'
  ],
  cartelMas: [
    '¡Un día más sin accidentes! Ya van {dias}.',
    'Sumado: {dias} días sin accidentes. ¡Así se hace!',
    'Cambio el cartel: {dias}. Qué orgullo.',
    '{dias} días sin accidentes. Mi pata dejó el número bonito.'
  ],
  cartelReset: [
    '¡Ay! Cartel a cero. Llevábamos {antes} días. El récord es {record}.',
    'Reiniciado. Tranquilo, empezamos de nuevo: cero días, mucha esperanza.',
    'Anotado el accidente. Cartel en cero y el récord se queda en {record}.',
    'Cambio el cartel a cero. Respira, que no pasó nada grave. Eso espero.'
  ],
  cartelPon: [
    'Listo: el cartel ahora dice {dias} días sin accidentes.',
    'Cambiado. {dias} días sin accidentes. ¡Qué buen número!',
    'Hecho: {dias} días. Que no se rompa la racha.'
  ],
  hora: [
    'Son las {hora}. ¿Ya almorzaste?',
    'Son las {hora}. Hora de tomar agua.',
    'Las {hora}, exactas. Soy un reloj con orejas.',
    'Son las {hora}. El tiempo vuela… como las mariposas.'
  ],
  fecha: [
    'Hoy es {fecha}.',
    'Estamos a {fecha}. ¡Cómo pasa el tiempo!',
    '{fecha}. Un día más en el bosque.',
    'Según mi calendario de oso, hoy es {fecha}.'
  ],
  mateBien: ['{cuenta} es {resultado}. ¡Soy un genio de los números!', '{cuenta} da {resultado}. Calculadora de bolsillo, a tu servicio.', 'Me sale {resultado}. Con garras y todo.', '{cuenta}… {resultado}. ¿Me merezco un aplauso?'],
  mateCero: ['¡No se puede dividir para cero! Hasta las mariposas lo saben.', 'Entre cero no se divide. Se rompe el universo.'],
  adivinanzaFalla: ['No, no es eso. Intenta otra vez, o di «me rindo».', 'Frío, frío… ¿otro intento?', 'Casi, casi. Bueno, no tanto. Otra vez.'],
  adivinanzaAcierta: ['¡Correcto! Eres un genio. ¿Otra?', '¡Eso mismo! Me ganaste. ¿Quieres otra?', '¡Bravo! Yo no me lo habría adivinado.'],
  adivinanzaRinde: ['Era: {respuesta}. ¡Me toca ganar!', 'La respuesta: {respuesta}. Fácil, ¿no?', 'Era {respuesta}. Para la próxima, más miel y menos prisa.'],
  repetirNada: ['Todavía no he dicho nada. Pregúntame algo primero.', '¿Repetir qué? Llevamos cero conversación.'],
  otroNada: ['¿Otro qué? Pídeme algo primero: un chiste, un dato…']
};

export const ADIVINANZAS = [
  { p: '¿Qué tiene manos pero no puede aplaudir?', r: /reloj/, a: 'un reloj' },
  { p: 'Blanca por dentro, verde por fuera. Si quieres que te lo diga, espera.', r: /pera/, a: 'la pera' },
  { p: 'Oro parece, plata no es. ¿Qué es?', r: /platano|banano|guineo/, a: 'el plátano' },
  { p: '¿Qué sube y baja pero no se mueve?', r: /escalera|grada/, a: 'las escaleras' },
  { p: 'Cuanto más le quitas, más grande se hace. ¿Qué es?', r: /hoyo|agujero|hueco/, a: 'un hoyo' },
  { p: 'Tiene dientes y no come, tiene cabeza y no es hombre.', r: /ajo/, a: 'el ajo' },
  { p: '¿Qué se rompe cuando lo nombras?', r: /silencio/, a: 'el silencio' },
  { p: 'Vuelo de flor en flor y hago algo dulce que a Uku le encanta. ¿Qué soy?', r: /abeja/, a: 'la abeja' },
  { p: 'Vuela sin alas, silba sin boca, azota sin manos y no lo ves ni lo tocas.', r: /viento|aire/, a: 'el viento' },
  { p: 'Cien damas en un cuarto, todas con su capa blanca y sin saber de un tanto. ¿Qué son?', r: /dientes|muelas/, a: 'los dientes' }
];

// Consejos de oso: lo que Uku comparte con ☝️ o cuando alguien pide «un consejo»
export const TIPS = [
  'Toma agua: los osos de pantalla no la necesitamos, pero tú sí.',
  'Cada hora, párate y estírate un minuto. Tu espalda te lo agradece.',
  'Mira algo lejano veinte segundos cada veinte minutos: tus ojos descansan.',
  'Bloquea tu compu al levantarte. Bueno, para eso estoy yo, pero igual.',
  'Una caminata corta después de almorzar despeja la cabeza.',
  'Anota tres cosas buenas del día antes de dormir.',
  'Si una tarea toma menos de dos minutos, hazla ya.',
  'Respira hondo cuatro segundos, aguanta cuatro y suelta en cuatro.',
  'Una planta en el escritorio alegra el día. Yo tengo un bosque entero.',
  'Llama a alguien que quieres solo para saludar.',
  'Apaga las notificaciones un rato y haz una sola cosa a la vez.',
  'Duerme bien: hasta los osos hibernan para rendir mejor.',
  'Saluda a quien pase. Una sonrisa no cuesta nada.',
  'Ordena tu escritorio al final del día: mañana empiezas más tranquilo.',
  'Si te frustras, cambia de tarea cinco minutos y vuelve.',
  'Celebra lo pequeño: un día más sin accidentes también cuenta.'
];

/* ---------- La baraja ----------
   Cada lista se baraja y se reparte carta por carta; cuando se acaba, se
   vuelve a barajar. Así no se repite nada hasta haberlo dicho todo. */
const bolsas = {}, ultima = {};
const PRIMERA = { dedo: 0 }; // «Si tuviera dedos te respondería…»
function barajar(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function sacar(id, lista) {
  if (!lista || !lista.length) return -1;
  let b = bolsas[id];
  if (!b || !b.length || b.some(i => i >= lista.length)) {
    b = bolsas[id] = barajar(lista.map((_, i) => i));
    // la que sale primero (la última del arreglo) no puede ser la última que se dijo
    if (b.length > 1 && b[b.length - 1] === ultima[id]) [b[0], b[b.length - 1]] = [b[b.length - 1], b[0]];
    // la primera vez, la frase de firma de la lista (PRIMERA) sale antes que las demás
    if (ultima[id] === undefined && PRIMERA[id] !== undefined) { const k = b.indexOf(PRIMERA[id]); [b[k], b[b.length - 1]] = [b[b.length - 1], b[k]]; }
  }
  const i = b.pop(); ultima[id] = i;
  return i;
}
const llenar = (t, datos) => t.replace(/\{(\w+)\}/g, (m, k) => (datos && datos[k] != null ? datos[k] : m)).replace(/\s+/g, ' ').trim();
function elegir(id, lista, datos) { const i = sacar(id, lista); return i < 0 ? '' : llenar(lista[i], datos); }
export function una(clave, datos) { return elegir(clave, clave === 'tip' ? TIPS : FRASES[clave] || CHARLA[clave], datos); }
export function charla(clave, datos) { return elegir('charla:' + clave, CHARLA[clave], datos); }
// Cuántas frases hay en total (para el LEEME y las pruebas)
export const TOTAL = () => Object.values(FRASES).concat(Object.values(CHARLA)).reduce((n, l) => n + l.length, 0) + TIPS.length + ADIVINANZAS.length;
