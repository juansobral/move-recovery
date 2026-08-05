interface StatTileProps {
  label: string;
  value: number;
  hint: string;
}

export const StatTile = ({ label, value, hint }: StatTileProps): JSX.Element => (
  <div className="rounded-lg border border-border bg-card p-5">
    <span className="block text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className="font-heading text-3xl font-extrabold">{value}</span>
    <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
  </div>
);
