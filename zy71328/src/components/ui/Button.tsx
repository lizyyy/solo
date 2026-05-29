import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/50 hover:bg-accent-cyan/20 hover:shadow-neon hover:border-accent-cyan",
  secondary:
    "bg-accent-purple/10 text-accent-purple border border-accent-purple/50 hover:bg-accent-purple/20 hover:shadow-neon-purple hover:border-accent-purple",
  danger:
    "bg-accent-red/10 text-accent-red border border-accent-red/50 hover:bg-accent-red/20 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:border-accent-red",
  ghost:
    "bg-transparent text-text-secondary border border-transparent hover:bg-bg-tertiary hover:text-text-primary",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2.5",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-primary",
          variantStyles[variant],
          sizeStyles[size],
          isDisabled && "opacity-50 cursor-not-allowed",
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {!loading && leftIcon}
        {children && <span>{children}</span>}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
