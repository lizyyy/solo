import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  pending: {
    label: "待确认",
    className: "bg-amber-100 text-amber-700",
  },
  confirmed: {
    label: "已确认",
    className: "bg-emerald-100 text-emerald-700",
  },
  withdrawn: {
    label: "已撤回",
    className: "bg-slate-100 text-slate-500",
  },
  conflict: {
    label: "异常冲突",
    className: "bg-red-100 text-red-700",
  },
} as const;

type Status = keyof typeof STATUS_CONFIG;

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
