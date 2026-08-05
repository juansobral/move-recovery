import { HTMLAttributes } from 'react';
import { cn } from '../../../lib/cn';

export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-lg border border-border bg-card', className)} {...props} />
);
