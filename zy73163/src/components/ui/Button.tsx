import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  children?: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-bg hover:bg-ink/90 border-ink",
  secondary: "bg-surface-2 text-ink hover:bg-line/60 border-line",
  ghost: "bg-transparent text-ink-soft hover:bg-surface-2 hover:text-ink border-transparent",
  danger: "bg-transparent text-unit-missing hover:bg-unit-missing-soft border-unit-missing/50",
  outline: "bg-transparent text-ink hover:bg-surface-2 border-line-strong",
};

const SIZE: Record<Size, string> = {
  sm: "px-2 py-1 text-xs gap-1",
  md: "px-3 py-1.5 text-sm gap-1.5",
};

export function Button({
  variant = "secondary",
  size = "sm",
  icon,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-atlas border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
