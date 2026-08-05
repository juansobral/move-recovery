import { Button } from '../../ui/button';
import { SectionHeading } from '../SectionHeading';

const MAPS_PLACE_URL =
  'https://www.google.com/maps/place/MOVE+Strength%26Conditioning/@-34.877308,-56.0762192,17z/data=!4m6!3m5!1s0x959f8730c171b183:0x6e7a19d4869b4b26!8m2!3d-34.877308!4d-56.0762192!16s%2Fg%2F11g22zyvcy';
const MAPS_EMBED_URL = 'https://maps.google.com/maps?q=MOVE%20Strength%26Conditioning%2C-34.877308%2C-56.0762192&hl=es&z=16&output=embed';

export const LocationSection = (): JSX.Element => (
  <section id="ubicacion" className="mx-auto max-w-site border-b border-border px-8 py-24 max-md:px-5 max-md:py-16">
    <SectionHeading tag="06 — Ubicación">Dónde estamos</SectionHeading>
    <div className="grid gap-6 max-md:grid-cols-1 md:grid-cols-[0.8fr_1.2fr]">
      <div className="flex flex-col gap-6 rounded-lg border border-border bg-card p-[30px]">
        <div>
          <span className="mb-2 block text-[11px] uppercase tracking-[2.5px] text-muted-foreground">Dirección</span>
          {/* TODO: reemplazar por la dirección exacta (calle y número) */}
          <p className="text-base leading-relaxed text-neutral-200">
            MOVE® Strength &amp; Conditioning
            <br />
            Montevideo, Uruguay
          </p>
        </div>
        <div>
          <span className="mb-2 block text-[11px] uppercase tracking-[2.5px] text-muted-foreground">Horarios</span>
          <p className="text-base leading-relaxed text-neutral-200">
            Lunes a viernes
            <br />
            7:00 – 11:00 · 15:00 – 20:00
          </p>
        </div>
        <div>
          <span className="mb-2 block text-[11px] uppercase tracking-[2.5px] text-muted-foreground">Contacto</span>
          <p className="text-base leading-relaxed text-neutral-200">
            <a
              href="https://www.instagram.com/move_strengthconditioning/"
              target="_blank"
              rel="noopener"
              className="border-b border-neutral-700 hover:border-foreground"
            >
              @move_strengthconditioning
            </a>
          </p>
        </div>
        <Button asChild className="mt-auto text-center">
          <a href={MAPS_PLACE_URL} target="_blank" rel="noopener">
            Abrir en Google Maps
          </a>
        </Button>
      </div>

      <div className="relative min-h-[420px] overflow-hidden rounded-lg border border-border bg-bg-soft max-md:min-h-[340px]">
        <iframe
          title="Mapa de la ubicación de MOVE® Strength &amp; Conditioning"
          src={MAPS_EMBED_URL}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          className="map-iframe absolute inset-0 h-full w-full border-0"
        />
      </div>
    </div>
  </section>
);
