interface TeamMemberCardProps {
  photoSrc: string;
  photoAlt: string;
  name: string;
  role: string;
  bio: string;
  specialties: string[];
}

export const TeamMemberCard = ({
  photoSrc,
  photoAlt,
  name,
  role,
  bio,
  specialties,
}: TeamMemberCardProps): JSX.Element => (
  <article className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition hover:-translate-y-1 hover:border-neutral-600">
    <div className="relative aspect-[4/5] overflow-hidden bg-bg-soft">
      <img
        src={photoSrc}
        alt={photoAlt}
        width={720}
        height={960}
        loading="lazy"
        className="h-full w-full object-cover object-[center_18%] grayscale contrast-[1.05] transition-[filter,transform] duration-500 group-hover:scale-[1.03] group-hover:grayscale-0 group-hover:contrast-100"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 to-transparent to-45%" />
    </div>
    <div className="p-6">
      <h3 className="font-heading text-2xl uppercase leading-tight tracking-wide">{name}</h3>
      <p className="mb-5 mt-2.5 border-b border-border pb-4 text-xs uppercase leading-relaxed tracking-[2px] text-muted-foreground">
        {role}
      </p>
      <p className="mb-5 text-sm leading-relaxed text-neutral-300">{bio}</p>
      <ul className="grid gap-2.5">
        {specialties.map((s) => (
          <li key={s} className="relative pl-[18px] text-sm leading-relaxed text-neutral-300 before:absolute before:left-0 before:top-[9px] before:h-px before:w-[7px] before:bg-muted-foreground">
            {s}
          </li>
        ))}
      </ul>
    </div>
  </article>
);
