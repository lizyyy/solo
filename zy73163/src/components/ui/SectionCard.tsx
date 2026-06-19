import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  tone?: "default" | "anomaly" | "unit-missing";
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function SectionCard({
  title,
  subtitle,
  icon,
  action,
  tone = "default",
  className,
  bodyClassName,
  children,
}: SectionCardProps) {
  const borderTone =
    tone === "anomaly"
      ? "border-anomaly/40"
      : tone === "unit-missing"
        ? "border-unit-missing/40"
        : "border-line";

  return (
    <section
      className={cn(
        "paper-grain rounded-md border bg-surface shadow-atlas",
        borderTone,
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-start gap-2.5">
            {icon && <span className="mt-0.5 text-ink-mute">{icon}</span>}
            <div>
              {title && (
                <h3 className="font-display text-base font-semibold leading-tight text-ink">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="mt-0.5 text-xs text-ink-mute">{subtitle}</p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
