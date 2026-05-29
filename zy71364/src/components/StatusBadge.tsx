import type { Artwork, Restoration, MaterialBatch } from "../../shared/types";
import {
  ARTWORK_STATUS_LABELS,
  RESTORATION_STATUS_LABELS,
} from "../../shared/types";

type StatusType = Artwork["status"] | Restoration["status"] | MaterialBatch["status"];

const colorMap: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  in_progress: "bg-amber-50 text-amber-700 border border-amber-200",
  completed: "bg-green-50 text-green-700 border border-green-200",
  archived: "bg-gray-100 text-gray-500",
  draft: "bg-gray-100 text-gray-600",
  under_review: "bg-blue-50 text-blue-700 border border-blue-200",
  approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  rejected: "bg-red-50 text-red-700 border border-red-200",
  normal: "bg-green-50 text-green-700 border border-green-200",
  expired: "bg-anomaly-red-50 text-anomaly-red border border-anomaly-red-100",
  batch_error: "bg-anomaly-red-50 text-anomaly-red border border-anomaly-red-100",
};

const labelMap: Record<string, string> = {
  ...ARTWORK_STATUS_LABELS,
  ...RESTORATION_STATUS_LABELS,
  normal: "正常",
  expired: "已过期",
  batch_error: "批号异常",
};

interface StatusBadgeProps {
  status: StatusType;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const color = colorMap[status] || "bg-gray-100 text-gray-600";
  const label = labelMap[status] || status;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
