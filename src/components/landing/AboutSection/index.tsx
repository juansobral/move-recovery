import { SectionHeading } from '../SectionHeading';

export const AboutSection = (): JSX.Element => (
  <section id="nosotros" className="mx-auto max-w-site border-b border-border px-8 py-24 max-md:px-5 max-md:py-16">
    <SectionHeading tag="01 — Nosotros">
      Entrenamos el rendimiento.
      <br />
      Cuidamos la recuperación.
    </SectionHeading>
    <p className="max-w-[720px] text-lg text-neutral-300">
      MOVE® es un gimnasio de performance y rehabilitación donde cada plan parte de la evidencia y se ajusta a tu
      cuerpo, tu deporte y tu momento. Trabajamos el ciclo completo: desarrollar capacidades físicas, volver de
      una lesión con seguridad y sostener el progreso en el tiempo. La recuperación no es un extra: es parte del
      entrenamiento, y por eso sumamos el Recovery Room.
    </p>
  </section>
);
