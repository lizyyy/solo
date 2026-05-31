import { cn } from "@/lib/utils";

type SeverityLevel = "low" | "medium" | "high" | "critical";

interface SeverityTagProps {
  level: SeverityLevel;
  className?: string;
}

const severityConfig: Record<SeverityLevel, { bg: string; text: string; label: string }> = {
  low: { bg: "bg-slate-100", text: "text-slate-600", label: "低" },
  medium: { bg: "bg-amber-100", text: "text-amber-700", label: "中" },
  high: { bg: "bg-orange-100", text: "text-orange-700", label: "高" },
  critical: { bg: "bg-red-100", text: "text-red-700", label: "严重" },
};

export default function SeverityTag({ level, className }: SeverityTagProps) {
  const config = severityConfig[level];

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold",
        config.bg,
        config.text,
        className
      )}
    >
      {config.label}
    </span>
  );
}
