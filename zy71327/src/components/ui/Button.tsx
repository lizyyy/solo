import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants: Record<ButtonVariant, string> = {
      primary:
        'bg-[#E8B86D] text-[#1A1A2E] hover:bg-[#d4a75c] focus:ring-[#E8B86D]/50 shadow-md hover:shadow-lg transform hover:-translate-y-0.5',
      secondary:
        'bg-[#4A7C59] text-white hover:bg-[#3d6649] focus:ring-[#4A7C59]/50',
      danger:
        'bg-[#B85450] text-white hover:bg-[#9c4643] focus:ring-[#B85450]/50',
      ghost:
        'bg-transparent text-[#1A1A2E] hover:bg-gray-100 focus:ring-gray-200',
      outline:
        'bg-transparent border-2 border-[#E8B86D] text-[#E8B86D] hover:bg-[#E8B86D] hover:text-[#1A1A2E] focus:ring-[#E8B86D]/30',
    };

    const sizes: Record<ButtonSize, string> = {
      sm: 'px-3 py-1.5 text-sm gap-1.5',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-6 py-3 text-base gap-2',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
