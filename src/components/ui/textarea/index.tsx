import { TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../../lib/cn';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        'w-full rounded-lg border border-input bg-black px-[14px] py-[13px] text-[15px] text-foreground',
        'focus-visible:outline-none focus-visible:border-white',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
