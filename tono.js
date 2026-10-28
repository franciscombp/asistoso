/* =====================================================================
   Uku · tono (qué energía trae cada frase y cómo responder)
   Tolan lee la emoción de cada turno con un clasificador pequeño y, sin
   cambiar de personaje, ajusta cómo contesta: a un chiste le sigue el
   juego; a algo serio baja la voz, acompaña y no bromea. Aquí lo mismo,
   con palabras clave y signos (sin red, al instante):
   leer(texto) → { tono, guia, gesto, animo, efecto }
   - tono: triste, estresado, enojado, feliz, bromista, serio, cansado, neutro
   - guia: la instrucción que viaja en el prompt («Acompaña, no bromees…»)
   - gesto/animo: cómo se mueve Uku (bosque3d) mientras contesta
   ===================================================================== */
const norm = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const TONOS = [
  ['triste', /\b(triste|deprimid|llorar|llore|solo|sola|me siento mal|no puedo mas|pena|duele|extrano|perdi|murio|fallecio|se fue|ruptura|terminamos|me dejo)/],
  ['estresado', /\b(estresad|agobiad|ansios|nervios|preocupad|no llego|no alcanzo|demasiado|me ahogo|presion|miedo|angustia|panico|abrumad)/],
  ['enojado', /\b(enojad|furios|harto|harta|odio|me cae mal|insoportable|rabia|injusto|mala leche|me saca)/],
  ['cansado', /\b(cansad|agotad|sueno|exhaust|no doy mas|rendid|desvelad|sin energia)/],
  ['feliz', /\b(feliz|contento|contenta|genial|increible|me fue bien|lo logre|aprobe|me dieron|gane|excelente|emocionad|celebr|por fin|que alegria|buenisimo|buenisima)/],
  ['bromista', /\b(jaja|jeje|lol|xd|chiste|broma|tonto|tontito|osito|peluche|gordito|que feo|que lindo)\b|🤣|😂|😜/],
  ['serio', /\b(necesito|importante|urgente|ayudame|ayudame|que hago|consejo|decidir|decision|no se que hacer|tengo que|debo)\b/]
];
const GUIA = {
  triste: 'Quien te habla está triste. Baja el ritmo: acompaña, nombra lo que siente, nada de chistes ni consejos rápidos. Una pregunta suave como mucho, o ninguna.',
  estresado: 'Quien te habla está agobiado. Ayuda a aterrizar: una cosa a la vez, concreta y pequeña. Sin bromas, sin listas largas. Puedes proponer el primer paso.',
  enojado: 'Quien te habla está enojado. No lo contradigas de entrada ni le quites importancia; valida un momento y, si cabe, ofrece otra mirada con calma.',
  cansado: 'Quien te habla está cansado. Sé breve y cálido; sugiere descanso o cerrar el día, sin sermón.',
  feliz: 'Quien te habla está contento. Celebra con él con energía, pregunta un detalle para que lo cuente.',
  bromista: 'Quien te habla viene jugando. Sigue el juego con humor, responde con gracia y ligero.',
  serio: 'Quien te habla necesita ayuda concreta. Sé claro y útil primero; el humor, si acaso, al final y chiquito.',
  neutro: 'Tono normal: cálido, curioso y con un toque de humor.'
};
const GESTO = { triste: ['nod', 'tranquilo'], estresado: ['nod', 'tranquilo'], enojado: ['worried', 'pensativo'], cansado: ['nod', 'tranquilo'], feliz: ['happy', 'feliz'], bromista: ['happy', 'feliz'], serio: ['nod', 'pensativo'], neutro: ['talk', null] };
const EFECTO = { feliz: 'sonrisa', bromista: 'risa', triste: 'abrazo' };
export function leer(texto) {
  const t = norm(texto);
  let tono = 'neutro';
  for (const [k, re] of TONOS) { if (re.test(t)) { tono = k; break; } }
  // Un «jaja» con algo triste sigue siendo triste; muchos signos de admiración suben la energía
  if (tono === 'neutro' && (t.match(/!/g) || []).length >= 2) tono = 'feliz';
  const [gesto, animo] = GESTO[tono];
  return { tono, guia: GUIA[tono], gesto, animo, efecto: EFECTO[tono] || null };
}
export const TONOS_LISTA = Object.keys(GUIA);
