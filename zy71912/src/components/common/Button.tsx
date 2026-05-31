import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', size = 'md', children, className, ...props }: ButtonProps) {
  const baseClass = 'inline-flex items-center justify-center gap-2 transition-colors duration-200 font-medium tracking-wide';
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
  };
  const variantClasses = {
    primary: 'btn-raw',
    secondary: 'px-3 py-1.5 border border-border-primary text-text-secondary bg-bg-tertiary hover:bg-bg-secondary hover:text-text-primary text-sm',
    ghost: 'btn-ghost',
    danger: 'px-3 py-1.5 border border-status-anomaly text-status-anomaly bg-transparent hover:bg-status-anomaly hover:text-white text-sm',
  };

  return (
    <button
      className={twMerge(baseClass, sizeClasses[size], variantClasses[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}
