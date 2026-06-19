import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatBlockProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  tone?: "neutral" | "anomaly" | "unit-missing" | "normal";
  className?: string;
}

const VALUE_TONE: Record<NonNullable<StatBlockProps["tone"]>, string> = {
  neutral: "text-ink",
  anomaly: "text-anomaly",
  "unit-missing": "text-unit-missing",
  normal: "text-normal",
};

export function StatBlock({ label, value, unit, hint, tone = "neutral", className }: StatBlockProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="font-mono-data text-[10px] uppercase tracking-wider text-ink-mute">
        {label}
      </span>
      <span className={cn("font-mono-data text-2xl font-semibold leading-none", VALUE_TONE[tone])}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-ink-mute">{unit}</span>}
      </span>
      {hint && <span className="text-[11px] leading-snug text-ink-mute">{hint}</span>}
    </div>
  );
}
