import { SectionHeading } from '../SectionHeading';
import { ServiceCard } from '../ServiceCard';

const SERVICES = [
  {
    icon: '➕',
    title: 'Sport Performance',
    description:
      'Entrenamiento orientado al rendimiento deportivo: fuerza, potencia, velocidad y capacidad física estructuradas por objetivos y medibles en el tiempo.',
  },
  {
    icon: '♻️',
    title: 'Sport Readaptation',
    description:
      'Readaptación deportiva para volver de una lesión con criterio. Puente entre la etapa clínica y el retorno a la actividad, con progresiones seguras y controladas.',
  },
  {
    icon: '🔝',
    title: 'Personal Training',
    description: 'Entrenamiento personalizado 1:1. Un plan diseñado para vos, con seguimiento cercano y ajustes constantes según tu progreso.',
  },
];

export const ServicesSection = (): JSX.Element => (
  <section id="servicios" className="mx-auto max-w-site border-b border-border px-8 py-24 max-md:px-5 max-md:py-16">
    <SectionHeading tag="03 — Servicios">Qué hacemos</SectionHeading>
    <div className="grid gap-5 max-md:grid-cols-1 md:grid-cols-3">
      {SERVICES.map((s) => (
        <ServiceCard key={s.title} {...s} />
      ))}
    </div>
  </section>
);
