import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PillProps {
  children: ReactNode;
  tone?: "neutral" | "anomaly" | "unit-missing" | "normal" | "old-version" | "verbal";
  className?: string;
  title?: string;
}

const TONE_STYLE: Record<NonNullable<PillProps["tone"]>, string> = {
  neutral: "text-ink-soft border-line bg-surface-2",
  anomaly: "text-anomaly border-anomaly/40 bg-anomaly-soft",
  "unit-missing": "text-unit-missing border-unit-missing/40 bg-unit-missing-soft",
  normal: "text-normal border-normal/40 bg-normal-soft",
  "old-version": "text-old-version border-old-version/40 bg-old-version-soft",
  verbal: "text-verbal border-verbal/40 bg-verbal-soft",
};

export function Pill({ children, tone = "neutral", className, title }: PillProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-atlas border px-1.5 py-0.5 font-mono-data text-[10px] uppercase tracking-wider",
        TONE_STYLE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
