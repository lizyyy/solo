import { AlertTriangle } from "lucide-react";
import { ANOMALY_TYPE_LABELS } from "../../shared/types";
import type { AnomalyType, Anomaly } from "../../shared/types";

const severityColor: Record<string, string> = {
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  error: "bg-anomaly-red-50 text-anomaly-red border-anomaly-red-100",
};

interface AnomalyBadgeProps {
  type?: AnomalyType;
  anomaly?: Anomaly;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export default function AnomalyBadge({ type, anomaly, showLabel = true, size = "sm" }: AnomalyBadgeProps) {
  const anomalyType = type || anomaly?.type;
  const severity = anomaly?.severity || "warning";
  const status = anomaly?.status;

  if (!anomalyType) return null;

  const color = severityColor[severity];
  const label = ANOMALY_TYPE_LABELS[anomalyType];
  const iconSize = size === "sm" ? 12 : 14;

  if (status === "corrected" || status === "confirmed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        <AlertTriangle size={iconSize} />
        {showLabel && label}
        <span className="ml-1 opacity-70">({status === "corrected" ? "已修正" : "已确认"})</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      <AlertTriangle size={iconSize} />
      {showLabel && label}
    </span>
  );
}
