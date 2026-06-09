import type { MaterialStatus, AnomalyStatus, AnomalySeverity } from "@/types";

type BadgeType = "material" | "anomaly" | "severity";

interface StatusBadgeProps {
  type: BadgeType;
  value: string;
}

const materialClassMap: Record<MaterialStatus, string> = {
  已复核: "badge-success",
  待复核: "badge-warn",
  异常: "badge-danger",
};

const anomalyClassMap: Record<AnomalyStatus, string> = {
  已确认正常: "badge-success",
  待确认: "badge-warn",
  已确认异常: "badge-danger",
};

const severityClassMap: Record<AnomalySeverity, string> = {
  一般: "badge-info",
  严重: "badge-danger",
};

function getBadgeClass(type: BadgeType, value: string): string {
  switch (type) {
    case "material":
      return materialClassMap[value as MaterialStatus] ?? "badge-info";
    case "anomaly":
      return anomalyClassMap[value as AnomalyStatus] ?? "badge-info";
    case "severity":
      return severityClassMap[value as AnomalySeverity] ?? "badge-info";
    default:
      return "badge-info";
  }
}

export default function StatusBadge({ type, value }: StatusBadgeProps) {
  const cls = getBadgeClass(type, value);
  return <span className={`badge ${cls}`}>{value}</span>;
}
