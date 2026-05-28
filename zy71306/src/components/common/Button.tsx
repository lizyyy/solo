import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-300 ease-out rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98]";

    const variants = {
      primary:
        "bg-walnut-900 text-brass-300 border border-brass-500 shadow-lg hover:bg-walnut-800 hover:text-brass-200 hover:border-brass-400 hover:shadow-xl focus:ring-brass-500/50",
      secondary:
        "bg-walnut-700 text-brass-200 border border-walnut-500 hover:bg-walnut-600 hover:text-brass-100 hover:border-walnut-400 focus:ring-walnut-400/50",
      danger:
        "bg-danger-600 text-white border border-danger-500 hover:bg-danger-500 hover:border-danger-400 focus:ring-danger-500/50",
    };

    const sizes = {
      sm: "h-8 px-3 text-sm gap-1.5",
      md: "h-10 px-4 text-base gap-2",
      lg: "h-12 px-6 text-lg gap-2.5",
    };

    const disabledStyles =
      "opacity-50 cursor-not-allowed hover:scale-100 active:scale-100";

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          (disabled || loading) && disabledStyles,
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" size={size === "sm" ? 14 : size === "md" ? 16 : 18} />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
