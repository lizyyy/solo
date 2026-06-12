import { STATUS_LABELS, STATUS_COLORS, type RecordStatus } from "@shared/types";

interface StatusBadgeProps {
  status: RecordStatus;
  showLabel?: boolean;
}

export default function StatusBadge({ status, showLabel = true }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] || "bg-gray-100 text-gray-700 border-gray-300";
  const label = STATUS_LABELS[status] || status;

  return (
    <span className={`status-badge ${colorClass}`}>
      {showLabel && label}
    </span>
  );
}
