import { forwardRef } from "react";
import { AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: "default" | "error" | "warning";
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { className, title, footer, variant = "default", children, ...props },
    ref
  ) => {
    const variants = {
      default:
        "bg-walnut-900 border-brass-500 shadow-[0_4px_20px_rgba(0,0,0,0.4)]",
      error:
        "bg-walnut-900 border-danger-500 shadow-[0_4px_20px_rgba(196,30,58,0.2)]",
      warning:
        "bg-walnut-900 border-amber-500 shadow-[0_4px_20px_rgba(245,158,11,0.2)]",
    };

    const VariantIcon = {
      default: null,
      error: <XCircle className="text-danger-500" size={20} />,
      warning: <AlertTriangle className="text-amber-500" size={20} />,
    }[variant];

    const titleColors = {
      default: "text-brass-300",
      error: "text-danger-500",
      warning: "text-amber-500",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border transition-all duration-300",
          variants[variant],
          className
        )}
        {...props}
      >
        {title && (
          <div
            className={cn(
              "flex items-center gap-2 px-5 py-4 border-b border-brass-500/30",
              titleColors[variant]
            )}
          >
            {VariantIcon}
            <h3 className="text-lg font-semibold tracking-wide">{title}</h3>
          </div>
        )}
        <div className="p-5 text-walnut-100">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-brass-500/30 text-walnut-300 text-sm">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

Card.displayName = "Card";

export { Card };
