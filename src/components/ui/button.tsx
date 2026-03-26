import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'border border-slate-900/10 bg-primary text-primary-foreground shadow-[0_18px_34px_-24px_rgba(15,23,42,0.85)] hover:-translate-y-px hover:bg-primary/95',
        destructive:
          'border border-red-700/10 bg-red-600 text-white shadow-[0_16px_30px_-22px_rgba(220,38,38,0.65)] hover:-translate-y-px hover:bg-red-700',
        outline:
          'border border-border/80 bg-white/88 text-foreground shadow-sm hover:border-slate-300 hover:bg-accent/70',
        secondary:
          'border border-border/70 bg-secondary/88 text-secondary-foreground shadow-sm hover:border-border hover:bg-secondary',
        ghost:
          'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
        link: 'rounded-none px-0 text-primary underline-offset-4 hover:text-primary/80 hover:underline',
        premium:
          'border border-amber-300/70 bg-[linear-gradient(135deg,rgba(255,249,235,0.98),rgba(255,255,255,0.98))] text-slate-950 shadow-[0_20px_38px_-28px_rgba(217,119,6,0.4)] hover:-translate-y-px hover:border-amber-400 hover:bg-[linear-gradient(135deg,rgba(255,245,225,1),rgba(255,255,255,1))]',
        success:
          'border border-emerald-700/10 bg-emerald-600 text-white shadow-[0_16px_30px_-22px_rgba(5,150,105,0.6)] hover:-translate-y-px hover:bg-emerald-700',
      },
      size: {
        default: 'h-11 px-5 py-2.5',
        sm: 'h-9 px-3.5 text-xs',
        lg: 'h-12 px-6 text-sm',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
