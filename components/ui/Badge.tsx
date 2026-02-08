import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md';
}

export function Badge({ className, variant = 'default', size = 'md', children, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-white/[0.06] text-text-secondary',
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/20',
    info: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
    purple: 'bg-primary-soft text-primary-text border border-indigo-500/20',
  };

  const sizes = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-xs',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
