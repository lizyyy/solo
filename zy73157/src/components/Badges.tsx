import { BadgeCheck, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecordStatus, AnomalyType, AnomalyMarker, SamplingParameter } from "@/types";

interface StatusBadgeProps {
  status: RecordStatus;
  size?: "sm" | "md";
}

const statusConfig: Record<RecordStatus, { label: string; className: string; icon: any }> = {
  resolved: {
    label: "已处理",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: BadgeCheck,
  },
  pending_evidence: {
    label: "待补证据",
    className: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Clock,
  },
  blocked: {
    label: "还卡着",
    className: "bg-rose-100 text-rose-700 border-rose-200",
    icon: AlertTriangle,
  },
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium",
        config.className,
        size === "sm" ? "text-[10px] px-1.5 py-0" : ""
      )}
    >
      <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {config.label}
    </span>
  );
}

const anomalyConfig: Record<AnomalyType, { label: string; className: string }> = {
  value_exceeded: {
    label: "数值超限",
    className: "bg-red-100 text-red-700 border-red-200",
  },
  sensor_drift: {
    label: "传感器漂移",
    className: "bg-orange-100 text-orange-700 border-orange-200",
  },
  withdrawal: {
    label: "已撤回",
    className: "bg-gray-200 text-gray-700 border-gray-300 line-through",
  },
  abnormal_trend: {
    label: "趋势异常",
    className: "bg-purple-100 text-purple-700 border-purple-200",
  },
  missing_data: {
    label: "数据缺失",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

const severityConfig: Record<AnomalyMarker["severity"], { label: string; className: string }> = {
  low: { label: "低", className: "border-slate-400" },
  medium: { label: "中", className: "border-amber-400" },
  high: { label: "高", className: "border-orange-500" },
  critical: { label: "严重", className: "border-red-600" },
};

interface AnomalyBadgeProps {
  type: AnomalyType;
  severity?: AnomalyMarker["severity"];
  showSeverity?: boolean;
}

export function AnomalyBadge({ type, severity, showSeverity = false }: AnomalyBadgeProps) {
  const config = anomalyConfig[type];
  const sevConfig = severity ? severityConfig[severity] : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium",
        config.className,
        sevConfig?.className
      )}
    >
      {config.label}
      {showSeverity && severity && <span className="opacity-75">({sevConfig?.label})</span>}
    </span>
  );
}

const parameterConfig: Record<SamplingParameter, { label: string; unit: string; color: string }> = {
  temperature: { label: "温度", unit: "℃", color: "text-red-500" },
  salinity: { label: "盐度", unit: "PSU", color: "text-blue-500" },
  pressure: { label: "压力", unit: "dbar", color: "text-indigo-500" },
  dissolved_oxygen: { label: "溶解氧", unit: "mg/L", color: "text-cyan-500" },
  ph: { label: "pH值", unit: "", color: "text-purple-500" },
};

interface ParameterValueProps {
  parameter: SamplingParameter;
  value: number | null;
  showUnit?: boolean;
}

export function ParameterValue({ parameter, value, showUnit = true }: ParameterValueProps) {
  const config = parameterConfig[parameter];
  if (value === null) {
    return <span className="text-slate-400 text-sm">— 缺失</span>;
  }
  return (
    <span className={cn("font-mono font-semibold", config.color)}>
      {value.toFixed(2)}
      {showUnit && <span className="text-xs text-slate-500 ml-1">{config.unit}</span>}
    </span>
  );
}

export { parameterConfig, statusConfig, anomalyConfig };
