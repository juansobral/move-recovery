import * as LabelPrimitive from '@radix-ui/react-label';
import { forwardRef } from 'react';
import { cn } from '../../../lib/cn';

export const Label = forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('mb-2 block text-xs uppercase tracking-wide text-muted-foreground', className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;
