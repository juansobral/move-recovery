import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../../lib/cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-heading font-extrabold uppercase tracking-wide transition-colors disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:border-white',
  {
    variants: {
      variant: {
        default: 'border border-primary bg-primary text-primary-foreground hover:bg-transparent hover:text-foreground',
        ghost: 'border border-primary bg-transparent text-foreground hover:bg-primary hover:text-primary-foreground',
        danger: 'border border-destructive bg-transparent text-destructive hover:bg-destructive hover:text-destructive-foreground',
      },
      size: {
        default: 'text-[13px] px-7 py-[15px]',
        sm: 'text-xs px-[18px] py-[10px]',
        block: 'w-full text-[13px] px-7 py-[15px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';
