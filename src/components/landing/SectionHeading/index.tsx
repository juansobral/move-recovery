import { ReactNode } from 'react';

interface SectionHeadingProps {
  tag: string;
  children: ReactNode;
}

export const SectionHeading = ({ tag, children }: SectionHeadingProps): JSX.Element => (
  <div className="mb-10">
    <span className="mb-4 inline-block text-xs uppercase tracking-[3px] text-muted-foreground">{tag}</span>
    <h2 className="font-heading text-[clamp(30px,5vw,54px)] font-extrabold uppercase leading-[1.02] tracking-tight">{children}</h2>
  </div>
);
