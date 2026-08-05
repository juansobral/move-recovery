import { useCurrentYear } from '../../../hooks/useCurrentYear';

export const SiteFooter = (): JSX.Element => {
  const year = useCurrentYear();

  return (
    <footer id="contacto" className="mx-auto max-w-site px-8 pb-10 pt-[72px] max-md:px-5">
      <div className="flex flex-wrap items-start justify-between gap-7">
        <div>
          <a href="#top" className="font-heading text-4xl font-black tracking-[2px]">
            MOVE<span className="align-super text-xs font-semibold">®</span>
          </a>
          <p className="mt-2.5 text-sm tracking-wide text-muted-foreground">Strength &amp; Conditioning · Performance &amp; Rehab</p>
        </div>
        <div className="flex flex-col gap-2.5 text-right">
          <a
            href="https://www.instagram.com/move_strengthconditioning/"
            target="_blank"
            rel="noopener"
            className="text-[13px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            Instagram
          </a>
          <a href="#equipo" className="text-[13px] uppercase tracking-wide text-muted-foreground hover:text-foreground">Equipo</a>
          <a href="#servicios" className="text-[13px] uppercase tracking-wide text-muted-foreground hover:text-foreground">Servicios</a>
          <a href="#recovery" className="text-[13px] uppercase tracking-wide text-muted-foreground hover:text-foreground">Recovery Room</a>
          <a href="#ubicacion" className="text-[13px] uppercase tracking-wide text-muted-foreground hover:text-foreground">Ubicación</a>
          <a href="#reservar" className="text-[13px] uppercase tracking-wide text-muted-foreground hover:text-foreground">Reservar</a>
        </div>
      </div>
      <p className="mt-12 text-xs tracking-wide text-neutral-600">© {year} MOVE® Strength &amp; Conditioning. Uruguay.</p>
    </footer>
  );
};
