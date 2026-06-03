import { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'warning' | 'success' | 'secondary';
  children: ReactNode;
}

export default function Button({ variant = 'primary', children, className, ...props }: ButtonProps) {
  const variantClasses = {
    primary: 'btn-primary',
    warning: 'btn-warning',
    success: 'btn-success',
    secondary: 'btn-secondary'
  };

  return (
    <button
      className={cn(variantClasses[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}
