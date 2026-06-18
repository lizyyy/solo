import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("glass clip-corner rounded-xl", className)}>{children}</div>;
}

export function SectionHeader({
  title,
  icon,
  right,
}: {
  title: string;
  icon?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
      <div className="flex items-center gap-2">
        {icon && <span className="text-glow-cyan">{icon}</span>}
        <span className="hud-label">{title}</span>
      </div>
      {right}
    </div>
  );
}

export function StatusDot({ color }: { color: string }) {
  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full", color)}
      style={{ boxShadow: "0 0 8px currentColor" }}
    />
  );
}
