// Contenido editorial de los emails. Cambios de texto/contenido clínico van
// acá, no en las plantillas HTML de mail.service.ts.

export const LLEVAR: Array<[string, string]> = [
  ['Chancletas u ojotas', 'obligatorias para circular por el área de sauna y ducha.'],
  ['Toalla', 'una para el sauna y, si querés, otra para la ducha.'],
  ['Ropa deportiva cómoda y seca', 'para la sesión de presoterapia y luz roja.'],
  ['Botella de agua', 'la hidratación antes y después es parte del protocolo.'],
  ['Malla o remera y short livianos', 'si vas a usar el sauna infrarrojo.'],
];

export const PROTOCOLO: Array<[string, string]> = [
  ['1. Llegá 10 minutos antes', 'Así aprovechás el bloque completo. La sesión dura 1 hora e incluye la transición entre estaciones.'],
  ['2. Hidratación previa', 'Tomá agua antes de empezar, sobre todo si vas a usar sauna. Evitá venir en ayunas prolongado.'],
  ['3. Orden recomendado', 'Sauna infrarrojo o luz roja e infrarroja primero, después presoterapia y cerramos con sillón de gravedad cero + respiración. Trabajamos de lo más activo a lo más calmo.'],
  ['4. Duchate antes del sauna', 'Entrar con la piel limpia y seca mejora la tolerancia al calor y la experiencia.'],
  ['5. Escuchá tu cuerpo', 'Si sentís mareo, palpitaciones o mucho malestar con el calor, cortá la estación y avisale al profesional a cargo.'],
  ['6. Después de la sesión', 'Volvé a hidratarte y evitá entrenamientos de alta intensidad en las siguientes 2 horas: el objetivo es recuperar.'],
];

export const CUANDO_USAR: string[] = [
  'El mismo día o el día después de una sesión de entrenamiento o competencia intensa.',
  'En semanas de mucha carga o poco descanso, para bajar la fatiga acumulada.',
  'Como recuperación activa en días sin entrenamiento.',
  'Recomendado 1 a 3 veces por semana, según tu volumen de entrenamiento.',
];

export const AVISOS: string[] = [
  'Embarazo, o si estás buscando un embarazo.',
  'Trombosis venosa profunda, trombosis reciente o antecedentes de coágulos.',
  'Insuficiencia cardíaca, arritmias o hipertensión no controlada.',
  'Infección o fiebre en el momento de la sesión.',
  'Heridas abiertas, quemaduras o infecciones en la piel.',
  'Fractura reciente o sospecha de fractura.',
  'Marcapasos u otro dispositivo implantado.',
  'Medicación que afecte la presión arterial o la termorregulación.',
];
