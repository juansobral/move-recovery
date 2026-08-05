interface ToolCardProps {
  icon: string;
  title: string;
  description: string;
}

export const ToolCard = ({ icon, title, description }: ToolCardProps): JSX.Element => (
  <article className="rounded-lg border border-border bg-bg-soft p-5">
    <span className="mb-3.5 block text-[26px]">{icon}</span>
    <h4 className="mb-2.5 text-[15px] uppercase leading-tight tracking-wide">{title}</h4>
    <p className="text-[13px] text-muted-foreground">{description}</p>
  </article>
);
