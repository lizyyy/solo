import { cn } from "@/lib/utils";

type StatusType = "normal" | "warning" | "critical" | "corrected";

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

const statusConfig: Record<StatusType, { bg: string; text: string; dot: string }> = {
  normal: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  warning: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  critical: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  corrected: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
};

const defaultLabels: Record<StatusType, string> = {
  normal: "正常",
  warning: "警告",
  critical: "严重",
  corrected: "已修正",
};

export default function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
      {label ?? defaultLabels[status]}
    </span>
  );
}
