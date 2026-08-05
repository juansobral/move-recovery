interface ServiceCardProps {
  icon: string;
  title: string;
  description: string;
}

export const ServiceCard = ({ icon, title, description }: ServiceCardProps): JSX.Element => (
  <article className="rounded-lg border border-border bg-card p-8 transition hover:-translate-y-1 hover:border-neutral-600">
    <span className="mb-[18px] block text-[28px]">{icon}</span>
    <h3 className="mb-3 text-[22px] uppercase tracking-wide">{title}</h3>
    <p className="text-[15px] text-muted-foreground">{description}</p>
  </article>
);
