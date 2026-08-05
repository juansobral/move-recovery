import { Button } from '../../ui/button';

export const Hero = (): JSX.Element => (
  <section className="flex min-h-[88vh] items-center border-b border-border bg-[radial-gradient(1200px_500px_at_80%_-10%,rgba(255,255,255,0.06),transparent_60%)] px-8 py-10 max-md:px-5">
    <div className="mx-auto w-full max-w-site">
      <p className="mb-6 text-xs uppercase tracking-[4px] text-muted-foreground">Performance &amp; Rehab · Uruguay</p>
      <h1 className="font-heading text-[clamp(48px,9vw,118px)] font-black uppercase leading-[0.92] tracking-tight">
        Movete
        <br />
        mejor.
        <br />
        Recuperá
        <br />
        más rápido.
      </h1>
      <p className="my-7 max-w-[560px] text-lg text-neutral-300">
        Un espacio de entrenamiento y recuperación basado en evidencia. Rendimiento deportivo, readaptación de
        lesiones y entrenamiento personalizado, ahora con nuestro nuevo Recovery Room.
      </p>
      <div className="flex flex-wrap gap-3.5">
        <Button asChild>
          <a href="#reservar">Reservar Recovery Room</a>
        </Button>
        <Button asChild variant="ghost">
          <a href="#servicios">Ver servicios</a>
        </Button>
      </div>
    </div>
  </section>
);
