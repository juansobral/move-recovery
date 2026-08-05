import { SectionHeading } from '../SectionHeading';
import { ToolCard } from '../ToolCard';

const TOOLS = [
  { icon: '🦵', title: 'Botas de presoterapia', description: 'Compresión secuencial que favorece el retorno venoso y linfático y reduce la sensación de piernas cargadas.' },
  { icon: '❤️‍🩹', title: 'Luz roja e infrarroja', description: 'Fotobiomodulación para acompañar la recuperación muscular y celular.' },
  { icon: '🔥', title: 'Sauna infrarrojo', description: 'Calor infrarrojo que ayuda a relajar la musculatura y a la termorregulación.' },
  { icon: '🧘', title: 'Meditación y respiración', description: 'Prácticas guiadas para bajar revoluciones y regular el sistema nervioso.' },
  { icon: '💺', title: 'Sillón de gravedad cero', description: 'Posición que descarga la columna y las piernas para un descanso profundo.' },
];

export const RecoveryRoomSection = (): JSX.Element => (
  <section id="recovery" className="mx-auto max-w-site border-b border-border px-8 py-24 max-md:px-5 max-md:py-16">
    <SectionHeading tag="04 — Novedad">
      Recovery Room <span className="font-normal text-muted-foreground">by MOVE</span>
    </SectionHeading>
    <p className="max-w-[720px] text-lg text-neutral-300">
      Un concepto nuevo en Uruguay: un espacio diseñado para optimizar la recuperación física y mental,
      combinando distintas tecnologías y estrategias basadas en evidencia para ayudar al cuerpo a recuperarse
      mejor. Cada herramienta actúa sobre un mecanismo diferente; juntas crean el entorno ideal para favorecer la
      recuperación, disminuir la fatiga, regular el sistema nervioso y ayudarte a sentirte y rendir mejor.
    </p>
    <div className="mt-11 grid gap-5 max-[420px]:grid-cols-1 max-md:grid-cols-2 md:grid-cols-5">
      {TOOLS.map((t) => (
        <ToolCard key={t.title} {...t} />
      ))}
    </div>
  </section>
);
