import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-slate-900/8 bg-slate-900 text-white',
        secondary: 'border-border/70 bg-secondary/90 text-secondary-foreground',
        destructive: 'border-red-200 bg-red-50 text-red-700',
        outline: 'border-border/80 bg-white/80 text-foreground',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        warning: 'border-amber-200 bg-amber-50 text-amber-700',
        premium:
          'border-amber-200 bg-[linear-gradient(135deg,rgba(255,249,235,0.98),rgba(255,255,255,0.98))] text-slate-800',
        buy: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        sell: 'border-red-200 bg-red-50 text-red-700',
        hold: 'border-slate-200 bg-slate-100 text-slate-700',
        completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        running: 'border-amber-200 bg-amber-50 text-amber-700',
        error: 'border-red-200 bg-red-50 text-red-700',
        pending: 'border-slate-200 bg-slate-100 text-slate-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
