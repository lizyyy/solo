import type { RecordStatus } from "@/types";
import { STATUS_LABELS } from "@/types";

const STATUS_COLORS: Record<RecordStatus, { bg: string; text: string; border: string }> = {
  pending_review: { bg: "#FEF3C7", text: "#92400E", border: "#F59E0B" },
  confirmed_normal: { bg: "#D1FAE5", text: "#065F46", border: "#10B981" },
  confirmed_anomaly: { bg: "#FEE2E2", text: "#991B1B", border: "#EF4444" },
  pending_field_review: { bg: "#FFEDD5", text: "#9A3412", border: "#F97316" },
  corrected: { bg: "#DBEAFE", text: "#1E40AF", border: "#3B82F6" },
  rolled_back: { bg: "#E5E7EB", text: "#374151", border: "#6B7280" },
};

interface StatusBadgeProps {
  status: RecordStatus;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];
  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${sizeClass}`}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        borderColor: colors.border,
      }}
    >
      {label}
    </span>
  );
}
