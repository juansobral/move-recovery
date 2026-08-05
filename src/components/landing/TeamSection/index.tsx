import { SectionHeading } from '../SectionHeading';
import { TeamMemberCard } from '../TeamMemberCard';

const TEAM = [
  {
    photoSrc: '/img/pierina-paladini.jpg',
    photoAlt: 'Pierina Paladini, Licenciada en Educación Física y entrenadora personal en MOVE®',
    name: 'Pierina Paladini',
    role: 'Educación Física · Fisioterapia · Entrenamiento personal',
    credentials: [
      'Licenciada en Educación Física',
      'Estudiante avanzada de Licenciatura en Fisioterapia',
      'Cursando Máster en Actividad Física y Salud',
      'Entrenadora personal',
      'Antropometrista ISAK',
      'Instructora de Zumba, Pilates, Danza Árabe, BodyPump, BodyBalance y CxWorx',
    ],
  },
  {
    photoSrc: '/img/gianluca-pasini.jpg',
    photoAlt: 'Gianluca Pasini, entrenador personal especializado en fuerza y potencia en MOVE®',
    name: 'Gianluca Pasini',
    role: 'Educación Física · Fuerza y potencia · Musculación',
    credentials: [
      'Estudiante avanzado de Licenciatura en Educación Física',
      'Entrenador personal e instructor en musculación',
      'Entrenador especializado en fuerza y potencia',
      'Instructor en Entrenamiento Funcional y CxWorx',
    ],
  },
];

export const TeamSection = (): JSX.Element => (
  <section id="equipo" className="mx-auto max-w-site border-b border-border px-8 py-24 max-md:px-5 max-md:py-16">
    <SectionHeading tag="02 — Quiénes somos">
      El equipo detrás
      <br />
      de MOVE®
    </SectionHeading>
    <p className="max-w-[720px] text-lg text-neutral-300">
      Formación académica, actualización constante y experiencia en piso. Detrás de cada plan hay profesionales
      que combinan educación física, fisioterapia y entrenamiento especializado para que entrenes con criterio.
    </p>
    <div className="mt-11 grid gap-6 sm:grid-cols-2">
      {TEAM.map((member) => (
        <TeamMemberCard key={member.name} {...member} />
      ))}
    </div>
  </section>
);
