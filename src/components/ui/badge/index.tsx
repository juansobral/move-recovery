import { HTMLAttributes } from 'react';
import { cn } from '../../../lib/cn';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  highlighted?: boolean;
}

export const Badge = ({ className, highlighted, ...props }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center rounded-md border border-border px-2.5 py-1 text-xs uppercase tracking-wide',
      highlighted ? 'border-success text-success' : 'text-foreground',
      className,
    )}
    {...props}
  />
);
