import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../../lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'w-full rounded-lg border border-input bg-black px-[14px] py-[13px] text-[15px] text-foreground [color-scheme:dark]',
        'focus-visible:outline-none focus-visible:border-white',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
