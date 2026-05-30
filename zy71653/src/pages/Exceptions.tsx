import { useState, useEffect } from "react";
import { Filter, X, RotateCcw, FilePlus, UserCheck, EyeOff } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import type { Exception } from "@/stores/appStore";

const TYPE_OPTIONS = [
  { value: "", label: "全部类型" },
  { value: "budget_overspend", label: "预算超花" },
  { value: "fatigue_missing", label: "疲劳度漏算" },
  { value: "conversion_delay", label: "转化延迟" },
  { value: "data_inconsistency", label: "数据不一致" },
  { value: "duplicate_import", label: "重复导入" },
];

const SEVERITY_OPTIONS = [
  { value: "", label: "全部严重程度" },
  { value: "critical", label: "严重" },
  { value: "warning", label: "警告" },
  { value: "info", label: "提示" },
];

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "open", label: "待处理" },
  { value: "in_progress", label: "处理中" },
  { value: "resolved", label: "已解决" },
  { value: "dismissed", label: "已忽略" },
];

function severityBadge(s: string) {
  if (s === "critical") return "badge-critical";
  if (s === "warning") return "badge-warning";
  return "badge-info";
}

function severityLabel(s: string) {
  if (s === "critical") return "严重";
  if (s === "warning") return "警告";
  return "提示";
}

function statusBadge(s: string) {
  if (s === "open") return "badge-critical";
  if (s === "in_progress") return "badge-warning";
  if (s === "resolved") return "badge-success";
  return "badge-info";
}

function statusLabel(s: string) {
  if (s === "open") return "待处理";
  if (s === "in_progress") return "处理中";
  if (s === "resolved") return "已解决";
  return "已忽略";
}

const SUGGESTION_ACTION_MAP: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  rollback: { label: "退回", icon: RotateCcw, cls: "btn-secondary" },
  supplement: { label: "补充材料", icon: FilePlus, cls: "btn-secondary" },
  confirm: { label: "人工确认", icon: UserCheck, cls: "btn-primary" },
  ignore: { label: "忽略", icon: EyeOff, cls: "btn-secondary" },
};

function typeLabel(t: string) {
  const m: Record<string, string> = {
    budget_overspend: "预算超花",
    fatigue_missing: "疲劳度漏算",
    conversion_delay: "转化延迟",
    data_inconsistency: "数据不一致",
    duplicate_import: "重复导入",
  };
  return m[t] ?? t;
}

function ExceptionDetail({
  exception,
  onClose,
  onAction,
}: {
  exception: Exception;
  onClose: () => void;
  onAction: (id: string, action: string, note?: string) => void;
}) {
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[560px] max-h-[80vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="font-semibold">异常详情</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex gap-2">
            <span className={severityBadge(exception.severity)}>
              {severityLabel(exception.severity)}
            </span>
            <span className={statusBadge(exception.status)}>
              {statusLabel(exception.status)}
            </span>
            <span className="badge-info">{typeLabel(exception.type)}</span>
          </div>
          <div>
            <p className="text-sm text-zinc-500 mb-1">消息</p>
            <p className="text-sm">{exception.message}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-500 mb-1">人话提示</p>
            <p className="text-sm text-zinc-700 bg-primary-50 border border-primary-200 rounded-lg p-3">
              {exception.humanReadableTip}
            </p>
          </div>
          <div>
            <p className="text-sm text-zinc-500 mb-1">处理建议</p>
            <p className="text-sm">{typeLabel(exception.suggestion)}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-500 mb-1">时间</p>
            <p className="text-sm font-mono">{exception.createdAt}</p>
          </div>

          {(exception.status === "open" || exception.status === "in_progress") && (
            <div className="border-t border-zinc-100 pt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  备注
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="可选：添加处理备注"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
                />
              </div>
              <div className="flex gap-2">
                {Object.entries(SUGGESTION_ACTION_MAP).map(([key, { label, icon: Icon, cls }]) => (
                  <button
                    key={key}
                    onClick={() => onAction(exception.id, key, note || undefined)}
                    className={`${cls} text-xs py-1.5 px-3 gap-1`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Exceptions() {
  const { exceptions, loading, fetchExceptions, takeExceptionAction } =
    useAppStore();

  const [filterType, setFilterType] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedException, setSelectedException] = useState<Exception | null>(null);

  useEffect(() => {
    fetchExceptions();
  }, [fetchExceptions]);

  const filtered = exceptions.filter((e) => {
    if (filterType && e.type !== filterType) return false;
    if (filterSeverity && e.severity !== filterSeverity) return false;
    if (filterStatus && e.status !== filterStatus) return false;
    return true;
  });

  const criticalCount = exceptions.filter((e) => e.severity === "critical").length;
  const warningCount = exceptions.filter((e) => e.severity === "warning").length;
  const infoCount = exceptions.filter((e) => e.severity === "info").length;

  const handleAction = (id: string, action: string, note?: string) => {
    takeExceptionAction(id, action, note);
    setSelectedException(null);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">异常中心</h2>

      <div className="flex gap-4">
        <div className="stat-card flex-1 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
            <span className="text-red-600 font-semibold text-sm">严</span>
          </div>
          <div>
            <p className="text-xs text-zinc-500">严重</p>
            <p className="text-lg font-semibold font-mono">{criticalCount}</p>
          </div>
        </div>
        <div className="stat-card flex-1 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
            <span className="text-amber-600 font-semibold text-sm">警</span>
          </div>
          <div>
            <p className="text-xs text-zinc-500">警告</p>
            <p className="text-lg font-semibold font-mono">{warningCount}</p>
          </div>
        </div>
        <div className="stat-card flex-1 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <span className="text-blue-600 font-semibold text-sm">提</span>
          </div>
          <div>
            <p className="text-xs text-zinc-500">提示</p>
            <p className="text-lg font-semibold font-mono">{infoCount}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-zinc-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {SEVERITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left">
                <th className="px-5 py-3 font-medium text-zinc-500">类型</th>
                <th className="px-5 py-3 font-medium text-zinc-500">严重程度</th>
                <th className="px-5 py-3 font-medium text-zinc-500">消息</th>
                <th className="px-5 py-3 font-medium text-zinc-500">人话提示</th>
                <th className="px-5 py-3 font-medium text-zinc-500">建议</th>
                <th className="px-5 py-3 font-medium text-zinc-500">状态</th>
                <th className="px-5 py-3 font-medium text-zinc-500">时间</th>
                <th className="px-5 py-3 font-medium text-zinc-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-zinc-400">
                    暂无异常记录
                  </td>
                </tr>
              ) : (
                filtered.map((ex) => {
                  const action = SUGGESTION_ACTION_MAP[ex.suggestion];
                  return (
                    <tr
                      key={ex.id}
                      className="border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer"
                      onClick={() => setSelectedException(ex)}
                    >
                      <td className="px-5 py-3">{typeLabel(ex.type)}</td>
                      <td className="px-5 py-3">
                        <span className={severityBadge(ex.severity)}>
                          {severityLabel(ex.severity)}
                        </span>
                      </td>
                      <td className="px-5 py-3 max-w-[200px] truncate">
                        {ex.message}
                      </td>
                      <td className="px-5 py-3 max-w-[200px] truncate text-zinc-500">
                        {ex.humanReadableTip}
                      </td>
                      <td className="px-5 py-3 text-zinc-500">
                        {typeLabel(ex.suggestion)}
                      </td>
                      <td className="px-5 py-3">
                        <span className={statusBadge(ex.status)}>
                          {statusLabel(ex.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs">
                        {ex.createdAt}
                      </td>
                      <td className="px-5 py-3">
                        {(ex.status === "open" || ex.status === "in_progress") && action && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(ex.id, ex.suggestion);
                            }}
                            className={`${action.cls} text-xs py-1 px-2.5 gap-1`}
                          >
                            <action.icon className="w-3 h-3" />
                            {action.label}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedException && (
        <ExceptionDetail
          exception={selectedException}
          onClose={() => setSelectedException(null)}
          onAction={handleAction}
        />
      )}
    </div>
  );
}
