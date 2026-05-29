import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  prefix?: string;
  suffix?: string;
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      prefix,
      suffix,
      label,
      error,
      type = "number",
      ...props
    },
    ref
  ) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm text-text-secondary">{label}</label>
        )}
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            type={type}
            className={cn(
              "w-full px-4 py-2.5 text-sm text-text-primary bg-bg-tertiary border border-border-default rounded-lg",
              "placeholder:text-text-muted",
              "focus:outline-none focus:border-accent-cyan focus:shadow-neon-sm",
              "transition-all duration-200",
              prefix && "pl-8",
              suffix && "pr-8",
              error && "border-accent-red focus:border-accent-red focus:shadow-[0_0_10px_rgba(239,68,68,0.3)]",
              className
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-accent-red">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
