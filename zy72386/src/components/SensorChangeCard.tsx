import { ArrowRight } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

interface SensorChange {
  id: string;
  oldSensorId: string;
  newSensorId: string;
  status: string;
  stuckAtStep: 1 | 2 | 3;
  reviewedBy?: string;
  reviewedAt?: string;
  note?: string;
}

interface SensorChangeCardProps {
  change: SensorChange;
  onConfirm?: () => void;
  onReject?: () => void;
}

const stepLabels: Record<number, string> = {
  1: "铭牌参数确认",
  2: "维修群截图补看",
  3: "安全提醒更新",
};

export default function SensorChangeCard({ change, onConfirm, onReject }: SensorChangeCardProps) {
  return (
    <div className="rounded-lg border border-l-4 border-l-amber-500 border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-gray-600">
            {change.oldSensorId}
          </span>
          <ArrowRight size={14} className="text-gray-400" />
          <span className="font-mono text-sm font-semibold text-gray-900">
            {change.newSensorId}
          </span>
        </div>
        <StatusBadge status={change.status} size="sm" />
      </div>

      <div className="mt-2 text-sm text-gray-500">
        卡在步骤{change.stuckAtStep}：
        <span className="font-medium text-amber-600">
          {stepLabels[change.stuckAtStep]}
        </span>
      </div>

      {change.reviewedBy && (
        <div className="mt-1 text-xs text-gray-400">
          复核人：{change.reviewedBy}
          {change.reviewedAt && ` · ${change.reviewedAt}`}
        </div>
      )}

      {change.note && (
        <div className="mt-1 text-xs text-gray-400">备注：{change.note}</div>
      )}

      {change.status === "pending_review" && (
        <div className="mt-3 flex gap-2">
          <button onClick={onConfirm} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700">
            确认
          </button>
          <button onClick={onReject} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700">
            驳回
          </button>
        </div>
      )}
    </div>
  );
}
