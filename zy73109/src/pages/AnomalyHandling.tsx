import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  FileWarning,
  CheckCircle2,
  Clock,
  Eye,
  XCircle,
  ChevronDown,
  User,
  CalendarDays,
  Save,
  MapPin,
  FileQuestion,
  Lightbulb,
  ShieldAlert,
  GripVertical,
} from "lucide-react";
import { useAppStore } from "@/store";
import {
  ANOMALY_STATUS_META,
  SOURCE_META,
} from "@/types";
import type { AnomalyHandlingStatus, RecordItem } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { value: AnomalyHandlingStatus; label: string }[] = [
  { value: "open", label: "待处理" },
  { value: "in_progress", label: "处理中" },
  { value: "resolved", label: "已解决" },
  { value: "ignored", label: "已标记忽略" },
];

interface AnomalyState {
  status: AnomalyHandlingStatus;
  remark: string;
}

function StatCard({
  label,
  value,
  icon: Icon,
  colorClass,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
}) {
  return (
    <div className={cn(
      "rounded-xl border p-4 flex items-center gap-3 bg-white",
      colorClass
    )}>
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
        colorClass.replace("border-", "bg-").replace("50", "100").replace("border", "text")
      )}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-600 mb-0.5">{label}</p>
        <p className="font-serif text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function AnomalyCard({
  record,
  onSave,
  navigate,
}: {
  record: RecordItem;
  onSave: (recordId: string, status: AnomalyHandlingStatus, remark: string) => void;
  navigate: (path: string) => void;
}) {
  const anomaly = record.anomaly!;
  const meta = ANOMALY_STATUS_META[anomaly.handlingStatus];
  const [localState, setLocalState] = useState<AnomalyState>({
    status: anomaly.handlingStatus,
    remark: anomaly.handlingRemark ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const isCoordOffset = anomaly.type === "coord_offset";
  const offsetTimes = anomaly.offsetValue !== undefined && anomaly.expectedMax !== undefined
    ? Math.round(Math.abs(anomaly.offsetValue) / Math.abs(anomaly.expectedMax) * 10) / 10
    : 0;

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      onSave(record.id, localState.status, localState.remark);
      setIsSaving(false);
    }, 300);
  };

  return (
    <div className="doc-card overflow-hidden">
      <div className="flex">
        <div className="w-2 flex-shrink-0 bg-red-500 rounded-l" />
        <div className="flex-1 p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="w-14 h-14 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                {isCoordOffset ? (
                  <AlertTriangle className="w-7 h-7 text-red-500" />
                ) : (
                    <AlertCircle className="w-7 h-7 text-red-500" />
                  )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-slate-900">{anomaly.typeLabel}</h3>
                  <button
                    onClick={() => navigate(`/analysis/${record.id}`)}
                    className="inline-flex items-center gap-1 text-xs font-mono text-brand-blue bg-brand-blue/10 hover:bg-brand-blue/20 px-2 py-0.5 rounded transition-colors"
                  >
                    <FileQuestion className="w-3 h-3" />
                    {record.code}
                  </button>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
                    meta.bgColor,
                    meta.color,
                    "border-current/20"
                  )}>
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      anomaly.handlingStatus === "open" && "bg-red-500",
                      anomaly.handlingStatus === "in_progress" && "bg-orange-500 animate-pulse",
                      anomaly.handlingStatus === "resolved" && "bg-emerald-500",
                      anomaly.handlingStatus === "ignored" && "bg-slate-500"
                    )} />
                    {meta.label}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{record.title}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {record.buildingInfo}
                    {record.floorRange && ` · ${record.floorRange}`}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {record.createdAt}
                  </span>
                </div>
              </div>
            </div>

            {isCoordOffset && (
              <div className="lg:w-56 lg:flex-shrink-0 rounded-xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-white p-4">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-serif text-4xl font-bold text-red-600">
                    +{anomaly.offsetValue?.toFixed(2)}
                  </span>
                  <span className="text-sm font-semibold text-red-500">m</span>
                </div>
                <p className="text-[11px] font-semibold text-red-700 mb-1.5">{anomaly.axis}偏移量</p>
                <div className="rounded-lg bg-white/60 border border-red-100 px-2.5 py-1.5">
                  <p className="text-[11px] text-slate-600">
                    允许阈值 <span className="font-mono font-semibold">±{anomaly.expectedMax?.toFixed(2)}m</span>
                  </p>
                  <p className="text-[11px] text-red-600 font-semibold mt-0.5">
                    实际偏移超阈值 <span className="font-mono">{offsetTimes} 倍</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {isCoordOffset && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 border border-orange-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <ShieldAlert className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-orange-800 mb-0.5">⚠️ 静默放行拦截提示</p>
                <p className="text-xs text-orange-700 leading-relaxed">
                  本异常会导致 RZ-2026-008 等记录遮挡计算偏大约 <span className="font-semibold">18%</span>，系统已自动标记相关记录不得用于正式交底，直至模型重导后重跑。
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-1.5 mb-2">
              <AlertOctagon className="w-3.5 h-3.5 text-slate-500" />
              <p className="text-xs font-semibold text-slate-700">异常描述</p>
            </div>
              <p className="text-xs text-slate-600 leading-relaxed">{anomaly.description}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <FileWarning className="w-3.5 h-3.5 text-slate-500" />
                <p className="text-xs font-semibold text-slate-700">检测依据</p>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{anomaly.detectionBasis}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-3.5 h-3.5 text-slate-500" />
                <p className="text-xs font-semibold text-slate-700">处理建议</p>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{anomaly.handlingSuggestion}</p>
            </div>
          </div>

          {anomaly.handledBy && anomaly.handledAt && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-emerald-800">
                处理人：<span className="font-medium">{anomaly.handledBy}</span>
              </span>
              <span className="text-xs text-emerald-600">·</span>
              <span className="text-xs text-emerald-700">
                <CalendarDays className="w-3 h-3 inline mr-1" />
                {anomaly.handledAt}
              </span>
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-end gap-3 pt-1 border-t border-slate-100">
            <div className="flex-1 min-w-0">
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">异常处理状态</label>
              <div className="relative">
                <select
                  value={localState.status}
                  onChange={(e) =>
                    setLocalState((s) => ({
                      ...s,
                      status: e.target.value as AnomalyHandlingStatus,
                    }))
                  }
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-800 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex-[2] min-w-0">
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">处理备注</label>
              <input
                type="text"
                value={localState.remark}
                onChange={(e) =>
                  setLocalState((s) => ({ ...s, remark: e.target.value }))
                }
                placeholder="请输入处理备注（如：已通知BIM组王工重导模型...）"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-all",
                isSaving
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-brand-blue hover:bg-brand-blue/90 active:bg-brand-blue/80"
              )}
            >
              <Save className="w-4 h-4" />
              {isSaving ? "保存中..." : "保存处理"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnomalyHandling() {
  const navigate = useNavigate();
  const { records, updateAnomalyStatus } = useAppStore();

  const anomalyRecords = records.filter((r) => r.source === "anomaly" && r.anomaly);

  const stats = {
    total: anomalyRecords.length,
    open: anomalyRecords.filter((r) => r.anomaly?.handlingStatus === "open").length,
    in_progress: anomalyRecords.filter((r) => r.anomaly?.handlingStatus === "in_progress").length,
    resolved: anomalyRecords.filter((r) => r.anomaly?.handlingStatus === "resolved").length,
    ignored: anomalyRecords.filter((r) => r.anomaly?.handlingStatus === "ignored").length,
  };

  const handleSave = (recordId: string, status: AnomalyHandlingStatus, remark: string) => {
    updateAnomalyStatus(recordId, status, remark, "当前用户");
  };

  return (
    <div className="doc-container space-y-6">
      <div className="doc-card p-6 border-l-4 border-l-red-500">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">异常处理面板</h1>
            <p className="text-sm font-semibold text-red-600 leading-relaxed">
              ⚠️ 异常数据不静默放行，所有异常项必须标记处理状态后才能用于正式交底
            </p>
            <p className="text-xs text-slate-500 mt-1">
              系统已自动识别 <span className="font-semibold text-slate-700">{stats.total}</span> 条异常数据，
              {stats.open > 0 && <span className="text-red-600 font-semibold">{stats.open} 条待处理</span>}
              {stats.in_progress > 0 && <span>、{stats.in_progress} 条处理中</span>}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
          <StatCard
            label="异常总数"
            value={stats.total}
            icon={AlertTriangle}
            colorClass="border-red-200"
          />
          <StatCard
            label="待处理"
            value={stats.open}
            icon={Clock}
            colorClass="border-red-200"
          />
          <StatCard
            label="处理中"
            value={stats.in_progress}
            icon={Eye}
            colorClass="border-orange-200"
          />
          <StatCard
            label="已解决"
            value={stats.resolved}
            icon={CheckCircle2}
            colorClass="border-emerald-200"
          />
          <StatCard
            label="已忽略"
            value={stats.ignored}
            icon={XCircle}
            colorClass="border-slate-200"
          />
        </div>
      </div>

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-800">异常列表</h2>
            <span className="text-xs text-slate-500">共 {anomalyRecords.length} 条</span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1">
            {SOURCE_META.anomaly.icon} {SOURCE_META.anomaly.label}
          </span>
        </div>

        {anomalyRecords.length === 0 ? (
          <div className="doc-card p-8">
            <div className="h-64 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <div className="text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50 text-emerald-400" />
                <p className="font-medium text-slate-700 mb-1">暂无异常数据</p>
                <p className="text-sm text-slate-500">当前批次交底清单运行结果正常</p>
              </div>
            </div>
          </div>
        ) : (
          anomalyRecords.map((record) => (
            <AnomalyCard
              key={record.id}
              record={record}
              onSave={handleSave}
              navigate={navigate}
            />
          ))
        )}
      </div>
    </div>
  );
}
