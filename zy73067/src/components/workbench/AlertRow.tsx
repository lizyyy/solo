import {
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Flame,
  TrendingUp,
} from "lucide-react";
import type { AlertRecord, AlertStatus } from "@/types";
import { useReviewStore } from "@/store/reviewStore";

interface AlertRowProps {
  record: AlertRecord;
  index: number;
}

const statusBadgeClass: Record<AlertStatus, string> = {
  pending: "badge-pending",
  reviewing: "badge-reviewing",
  approved: "badge-approved",
  rejected: "badge-rejected",
};

const statusIcon: Record<AlertStatus, any> = {
  pending: Clock,
  reviewing: AlertTriangle,
  approved: CheckCircle2,
  rejected: XCircle,
};

const statusText: Record<AlertStatus, string> = {
  pending: "待复核",
  reviewing: "复核中",
  approved: "已通过",
  rejected: "已驳回",
};

function ThresholdCompare({
  value,
  threshold,
  unit,
  label,
}: {
  value: number;
  threshold: number;
  unit: string;
  label: string;
}) {
  const over = value > threshold;
  const pct = ((value - threshold) / threshold) * 100;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className="flex items-baseline gap-1.5 font-mono">
        <span className={`font-semibold ${over ? "text-alert-600" : "text-success-600"}`}>
          {value.toFixed(1)}
        </span>
        <span className="text-xs text-gray-400">/</span>
        <span className="text-xs text-gray-500">{threshold.toFixed(1)}</span>
        <span className="text-[10px] text-gray-400">{unit}</span>
      </div>
      {over && (
        <div className="flex items-center gap-1 text-[10px] text-alert-600 font-medium">
          <TrendingUp size={10} />
          <span>超阈值 {pct.toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}

export default function AlertRow({ record, index }: AlertRowProps) {
  const {
    selectedRecordId,
    expandedRowIds,
    selectRecord,
    toggleRowExpanded,
  } = useReviewStore();
  const isSelected = selectedRecordId === record.id;
  const isExpanded = expandedRowIds.includes(record.id);

  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-chevron]")) return;
    selectRecord(isSelected ? null : record.id);
  };

  const StatusIcon = statusIcon[record.status];

  return (
    <>
      <tr
        onClick={handleRowClick}
        className={`group cursor-pointer transition-colors relative
          ${index % 2 === 1 ? "bg-gray-50/60" : "bg-white"}
          ${isSelected ? "bg-industrial-50/70" : "hover:bg-industrial-50/40"}
          ${record.isTempThresholdAdjusted ? "!bg-alert-50/40 hover:!bg-alert-50/70" : ""}`}
      >
        {isSelected && (
          <td
            colSpan={0}
            className="absolute left-0 top-0 bottom-0 w-0.5 bg-industrial-600 row-selected-indicator"
          />
        )}
        <td className="table-cell w-10 pl-3">
          <button
            data-chevron
            onClick={(e) => {
              e.stopPropagation();
              toggleRowExpanded(record.id);
            }}
            className="p-1.5 rounded-industrial hover:bg-white text-gray-500 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown size={14} strokeWidth={2.5} />
            ) : (
              <ChevronRight size={14} strokeWidth={2.5} />
            )}
          </button>
        </td>
        <td className="table-cell">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono font-semibold text-industrial-700 text-sm tracking-wide">
              {record.unifiedDeviceId}
            </span>
            <span className="text-[10px] text-gray-400">统一编号格式</span>
          </div>
        </td>
        <td className="table-cell">
          <div className="tooltip-wrapper">
            <span className="text-xs text-gray-500 italic font-serif">
              {record.originalDeviceIds.slice(0, 2).join(", ")}
              {record.originalDeviceIds.length > 2 && (
                <span className="text-gray-400 not-italic">
                  +{record.originalDeviceIds.length - 2}
                </span>
              )}
            </span>
            <div className="tooltip-content !left-auto !right-0 !-translate-x-0 !whitespace-normal !max-w-[240px] !text-left p-2 space-y-0.5">
              <div className="text-industrial-300 text-[10px] font-semibold mb-1 uppercase tracking-wider">
                全部原始写法
              </div>
              {record.originalDeviceIds.map((oid, i) => (
                <div key={i} className="font-mono text-[11px]">
                  {oid}
                </div>
              ))}
            </div>
          </div>
        </td>
        <td className="table-cell">
          <div className="text-xs text-gray-600">{record.source}</div>
        </td>
        <td className="table-cell">
          <ThresholdCompare
            value={record.bladeAngle}
            threshold={record.bladeAngleThreshold}
            unit="°"
            label="攻角 (°)"
          />
        </td>
        <td className="table-cell">
          <ThresholdCompare
            value={record.vibrationLevel}
            threshold={record.vibrationThreshold}
            unit="mm/s"
            label="振动 (mm/s)"
          />
        </td>
        <td className="table-cell">
          {record.isTempThresholdAdjusted ? (
            <span className="badge badge-temp gap-1">
              <Flame size={11} strokeWidth={2.5} />
              <span>临时调高</span>
            </span>
          ) : (
            <span className="text-gray-300 text-xs">—</span>
          )}
        </td>
        <td className="table-cell">
          <span className={`badge ${statusBadgeClass[record.status]} gap-1`}>
            <StatusIcon size={12} strokeWidth={2.5} />
            <span>{statusText[record.status]}</span>
          </span>
        </td>
        <td className="table-cell">
          <div className="font-mono text-[11px] text-gray-500">
            {new Date(record.updatedAt).toLocaleString("zh-CN", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className={`${record.isTempThresholdAdjusted ? "bg-alert-50/20" : "bg-gray-50/40"}`}>
          <td></td>
          <td colSpan={8} className="py-4 pl-4 pr-6 border-b border-gray-100 animate-fade-in">
            <div className="bg-white rounded-industrial border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-industrial-700 font-semibold text-sm">
                  <AlertTriangle size={16} className="text-alert-500" strokeWidth={2} />
                  <span>异常拉动因素分析</span>
                  <span className="text-xs text-gray-400 font-normal">
                    — 点击汇总卡片的数字可联动过滤
                  </span>
                </div>
                {record.isTempThresholdAdjusted && (
                  <span className="text-xs text-alert-600 bg-alert-50 border border-alert-200 rounded-industrial px-2 py-1">
                    ⚠ 该记录使用临时阈值，请重点关注
                  </span>
                )}
              </div>
              <div className="grid grid-cols-5 gap-3">
                {record.factors.map((f, i) => (
                  <div
                    key={f.name}
                    className={`p-3 rounded-industrial border transition-all ${
                      f.isPulling
                        ? "bg-alert-50 border-alert-200"
                        : "bg-gray-50 border-gray-100"
                    }`}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-gray-700">{f.name}</span>
                      {f.isPulling && (
                        <TrendingUp size={12} className="text-alert-500" strokeWidth={2.5} />
                      )}
                    </div>
                    <div className="flex items-baseline gap-1 font-mono mb-2">
                      <span
                        className={`font-bold text-sm ${
                          f.isPulling ? "text-alert-600" : "text-success-600"
                        }`}
                      >
                        {f.value.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-gray-400">/</span>
                      <span className="text-[10px] text-gray-500">{f.threshold.toFixed(1)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          f.isPulling ? "bg-alert-500" : "bg-success-400"
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(20, (f.value / f.threshold) * 80))}%`,
                        }}
                      />
                    </div>
                    <div
                      className={`mt-1.5 text-[10px] font-medium ${
                        f.isPulling ? "text-alert-600" : "text-gray-500"
                      }`}
                    >
                      {f.deviationPct > 0 ? "+" : ""}
                      {f.deviationPct.toFixed(1)}% {f.isPulling && "→ 拉动异常"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
