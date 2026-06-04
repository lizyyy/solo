import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const statusMap: Record<string, { label: string; classes: string }> = {
  normal: { label: "正常", classes: "bg-emerald-100 text-emerald-700" },
  sensor_id_changed: {
    label: "编号变更",
    classes: "bg-amber-100 text-amber-700",
  },
  anomaly: { label: "异常", classes: "bg-red-100 text-red-700" },
  pending_review: { label: "待复核", classes: "bg-amber-100 text-amber-700" },
  confirmed: { label: "已确认", classes: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "已驳回", classes: "bg-red-100 text-red-700" },
  pass: { label: "通过", classes: "bg-emerald-100 text-emerald-700" },
  warning: { label: "警告", classes: "bg-amber-100 text-amber-700" },
  fail: { label: "失败", classes: "bg-red-100 text-red-700" },
};

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusMap[status] ?? {
    label: status,
    classes: "bg-gray-100 text-gray-600",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        config.classes
      )}
    >
      {config.label}
    </span>
  );
}
