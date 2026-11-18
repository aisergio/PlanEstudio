export const totalSeconds = 600;

function lines(text) {
  const result = [];
  let phrase = '';
  for (const word of text.split(/\s+/)) {
    if (phrase && phrase.length + word.length > 102) { result.push(phrase); phrase = ''; }
    phrase += (phrase ? ' ' : '') + word;
    if (phrase.length > 38 && /[.?!]$/.test(word) && !/^\d+\.$/.test(word)) { result.push(phrase); phrase = ''; }
  }
  if (phrase) result.push(phrase);
  return result;
}

export function scenes(guide) {
  const planned = [
    ['01', 45, 'Objetivo', guide.outcome, [
      'Esta es tu guía audiovisual de PlanEstudio. Antes de empezar, ten a mano un lugar para anotar tu hipótesis.',
      guide.outcome, 'Durante el ejemplo, intenta predecir el resultado. Después, comprueba cómo llegaste a él.'
    ]],
    ['02', 150, 'Conceptos y diagrama', '', [
      'Sigue el diagrama de entrada a resultado. Fíjate en qué información aporta cada paso.',
      ...guide.theory.map(([title, explanation]) => title + '. ' + explanation),
      'Tómate un momento para describir las conexiones con tus palabras. Compáralas con el diagrama.'
    ]],
    ['03', 150, 'Ejemplo trabajado', '', [
      'Vuelve al punto de partida. Identifica qué conocemos, qué operación corresponde y qué esperamos comprobar.',
      guide.example, 'Repite el ejemplo sin mirar la respuesta. Escribe qué dato cambiarías para comprobar tu explicación.',
      'Comprueba primero el resultado intermedio y luego el resultado completo. Si te equivocas, localiza el primer paso donde cambió tu predicción.'
    ]],
    ['04', 130, 'Laboratorio y proyecto', 'Prueba · Mide · Guarda la evidencia', [
      ...guide.lab, 'Define qué observación contarías como evidencia del resultado. Guarda los datos, la configuración y una explicación de tu decisión.',
      'Si solo tienes el celular, puedes empezar ahora. ' + guide.mobile
    ]],
    ['05', 85, 'Preguntas de repaso', 'Intenta responder antes de escuchar la solución', [
      'Responde a cada pregunta y explica tu razonamiento. Haz una pausa si necesitas más tiempo.',
      ...guide.quiz.flatMap(([question, answer]) => [question, 'Comprueba tu respuesta. ' + answer])
    ]],
    ['06', 40, 'Cierre', 'Registra tus minutos y tu nivel de dominio', [
      guide.exit, 'En PlanEstudio, registra los minutos, una evidencia de tu trabajo y una duda para la siguiente sesión.'
    ]]
  ];
  return planned.map(([id, seconds, title, art, script]) => ({ id, seconds, title, art, lines: script.flatMap(lines) }));
}

const timestamp = seconds => new Date(Math.round(seconds * 1000)).toISOString().slice(11, 23).replace('.', ',');
export function makeSrt(captions) {
  return captions.map((item, index) => (index + 1) + '\n' + timestamp(item.start) + ' --> ' + timestamp(item.end) + '\n' + item.text).join('\n\n') + '\n';
}
