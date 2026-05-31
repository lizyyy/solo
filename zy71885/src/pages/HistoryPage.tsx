import { useState, useMemo } from "react";
import {
  History,
  User,
  Clock,
  Filter,
  X,
  ArrowLeftRight,
  CheckCircle,
  XCircle,
  Edit3,
  FilePlus,
  GitCompare,
} from "lucide-react";
import { useAppStore } from "@/store";
import type { HistoryAction, HistoryEntry, Record as LensRecord } from "@/types";

const actionLabels: { [key in HistoryAction]: string } = {
  create: "创建记录",
  review_approve: "复核通过",
  review_reject: "复核驳回",
  calibration_correct: "修正标定表",
  edit: "编辑记录",
};

const actionColors: { [key in HistoryAction]: string } = {
  create: "text-blue-300 bg-blue-500/20 border-blue-500/30",
  review_approve: "text-lab-success bg-lab-success/20 border-lab-success/30",
  review_reject: "text-lab-danger bg-lab-danger/20 border-lab-danger/30",
  calibration_correct: "text-lab-accent bg-lab-accent/20 border-lab-accent/30",
  edit: "text-purple-300 bg-purple-500/20 border-purple-500/30",
};

const actionIcons: { [key in HistoryAction]: React.FC<{ className?: string }> } = {
  create: FilePlus,
  review_approve: CheckCircle,
  review_reject: XCircle,
  calibration_correct: Edit3,
  edit: Edit3,
};

export function HistoryPage() {
  const { history, records, users } = useAppStore();

  const [filters, setFilters] = useState({
    recordId: "",
    operatorId: "",
    action: "" as HistoryAction | "",
    startDate: "",
    endDate: "",
  });

  const [compareHistory, setCompareHistory] = useState<HistoryEntry | null>(
    null
  );

  const filteredHistory = useMemo(() => {
    let result = [...history];

    if (filters.recordId) {
      result = result.filter((h) => h.recordId === filters.recordId);
    }
    if (filters.operatorId) {
      result = result.filter((h) => h.operatorId === filters.operatorId);
    }
    if (filters.action) {
      result = result.filter((h) => h.action === filters.action);
    }
    if (filters.startDate) {
      result = result.filter((h) => h.createdAt >= filters.startDate);
    }
    if (filters.endDate) {
      result = result.filter((h) => h.createdAt <= filters.endDate + "T23:59:59");
    }

    return result.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [history, filters]);

  const getOperatorName = (id: string) => {
    return users.find((u) => u.id === id)?.name || "未知";
  };

  const getRecordName = (id: string) => {
    return records.find((r) => r.id === id)?.experimentName || "未知记录";
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const clearFilters = () => {
    setFilters({
      recordId: "",
      operatorId: "",
      action: "",
      startDate: "",
      endDate: "",
    });
  };

  const getFieldDiff = (
    field: string,
    before: LensRecord,
    after: LensRecord
  ): { before: string; after: string; changed: boolean } => {
    const keys = field.split(".");
    let beforeVal: any = before;
    let afterVal: any = after;
    for (const k of keys) {
      if (Array.isArray(beforeVal) && !isNaN(parseInt(k))) {
        const idx = parseInt(k);
        beforeVal = beforeVal[idx];
        afterVal = afterVal[idx];
      } else if (beforeVal && typeof beforeVal === "object") {
        beforeVal = beforeVal[k as keyof typeof beforeVal];
        afterVal = afterVal[k as keyof typeof afterVal];
      }
    }
    const beforeStr =
      typeof beforeVal === "object"
        ? JSON.stringify(beforeVal, null, 2)
        : String(beforeVal ?? "");
    const afterStr =
      typeof afterVal === "object"
        ? JSON.stringify(afterVal, null, 2)
        : String(afterVal ?? "");
    return {
      before: beforeStr,
      after: afterStr,
      changed: beforeStr !== afterStr,
    };
  };

  const getFieldLabel = (field: string): string => {
    const labels: { [key: string]: string } = {
      status: "状态",
      reviewerId: "复核人",
      rejectReason: "驳回原因",
      error: "总误差",
      measuredFocalLength: "实测焦距",
      zeroDrift: "零点漂移",
      imageDistance: "像距",
      objectDistance: "物距",
      calibrationTable: "标定表",
      "calibrationTable[].measuredValue": "实测值",
      "calibrationTable[].theoreticalValue": "理论值",
      "calibrationTable[].error": "误差",
    };
    if (field.startsWith("calibrationTable")) {
      const match = field.match(/calibrationTable\[(\d+)\]\.(\w+)/);
      if (match) {
        const idx = parseInt(match[1]);
        const subField = match[2];
        return `标定表[${idx + 1}].${labels[`calibrationTable[].${subField}`] || subField}`;
      }
    }
    return labels[field] || field;
  };

  const hasActiveFilters =
    filters.recordId ||
    filters.operatorId ||
    filters.action ||
    filters.startDate ||
    filters.endDate;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-lab-text flex items-center gap-2">
          <History className="w-6 h-6 text-lab-accent" />
          历史追溯
        </h1>
        <p className="text-sm text-lab-textMuted mt-1">
          所有操作变更记录，支持按记录、操作人、时间筛选
        </p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium flex items-center gap-2">
            <Filter className="w-4 h-4 text-lab-accent" />
            筛选条件
          </h3>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-lab-textMuted hover:text-lab-text flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              清除筛选
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-lab-textMuted mb-1">记录</label>
            <select
              value={filters.recordId}
              onChange={(e) =>
                setFilters({ ...filters, recordId: e.target.value })
              }
              className="input-field text-sm"
            >
              <option value="">全部记录</option>
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.experimentName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-lab-textMuted mb-1">操作人</label>
            <select
              value={filters.operatorId}
              onChange={(e) =>
                setFilters({ ...filters, operatorId: e.target.value })
              }
              className="input-field text-sm"
            >
              <option value="">全部操作人</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-lab-textMuted mb-1">操作类型</label>
            <select
              value={filters.action}
              onChange={(e) =>
                setFilters({ ...filters, action: e.target.value as HistoryAction | "" })
              }
              className="input-field text-sm"
            >
              <option value="">全部操作</option>
              {(Object.keys(actionLabels) as HistoryAction[]).map((action) => (
                <option key={action} value={action}>
                  {actionLabels[action]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-lab-textMuted mb-1">开始日期</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                setFilters({ ...filters, startDate: e.target.value })
              }
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-lab-textMuted mb-1">结束日期</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                setFilters({ ...filters, endDate: e.target.value })
              }
              className="input-field text-sm"
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-medium mb-4">
          变更记录
          <span className="text-xs text-lab-textMuted ml-2 font-normal">
            共 {filteredHistory.length} 条
          </span>
        </h3>

        {filteredHistory.length === 0 ? (
          <div className="text-center py-12 text-lab-textMuted">
            <History className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>暂无变更记录</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-lab-bgLighter" />

            <div className="space-y-6">
              {filteredHistory.map((entry) => {
                const ActionIcon = actionIcons[entry.action];
                return (
                  <div key={entry.id} className="relative pl-14">
                    <div
                      className={`absolute left-4 w-5 h-5 rounded-full border-2 border-lab-bg flex items-center justify-center ${
                        actionColors[entry.action].split(" ")[2]
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          actionColors[entry.action].split(" ")[0]
                        }`}
                      />
                    </div>

                    <div className="bg-lab-bg rounded-lg border border-lab-bgLighter p-4 hover:border-lab-accent/30 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`badge ${actionColors[entry.action]}`}
                          >
                            <ActionIcon className="w-3 h-3 mr-1" />
                            {actionLabels[entry.action]}
                          </span>
                          <span className="text-sm font-medium">
                            {getRecordName(entry.recordId)}
                          </span>
                        </div>
                        <button
                          onClick={() => setCompareHistory(entry)}
                          className="text-xs text-lab-accent hover:text-lab-accentHover flex items-center gap-1"
                        >
                          <GitCompare className="w-3 h-3" />
                          查看前后对比
                        </button>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-lab-textMuted mb-2">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {getOperatorName(entry.operatorId)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(entry.createdAt)}
                        </span>
                      </div>

                      <p className="text-sm bg-lab-bgLight/50 p-2 rounded border border-lab-bgLighter/50">
                        {entry.reason || "无原因说明"}
                      </p>

                      {entry.changedFields.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          <span className="text-xs text-lab-textMuted mr-1">
                            变更字段：
                          </span>
                          {entry.changedFields.slice(0, 5).map((field) => (
                            <span
                              key={field}
                              className="text-xs bg-lab-bgLighter/50 px-2 py-0.5 rounded"
                            >
                              {getFieldLabel(field)}
                            </span>
                          ))}
                          {entry.changedFields.length > 5 && (
                            <span className="text-xs text-lab-textMuted">
                              +{entry.changedFields.length - 5} 项
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {compareHistory && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
          <div className="card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-lab-accent" />
                变更前后对比
              </h3>
              <button
                onClick={() => setCompareHistory(null)}
                className="text-lab-textMuted hover:text-lab-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs text-lab-textMuted mb-4 pb-3 border-b border-lab-bgLighter">
              <span>
                记录：<span className="text-lab-text">{getRecordName(compareHistory.recordId)}</span>
              </span>
              <span>
                操作：
                <span className={`badge ${actionColors[compareHistory.action]} ml-1`}>
                  {actionLabels[compareHistory.action]}
                </span>
              </span>
              <span>
                操作人：<span className="text-lab-text">{getOperatorName(compareHistory.operatorId)}</span>
              </span>
            </div>

            <div className="overflow-y-auto flex-1 pr-2">
              {compareHistory.changedFields.length === 0 ? (
                <div className="text-center py-8 text-lab-textMuted">
                  无字段变更（创建操作）
                </div>
              ) : (
                <div className="space-y-4">
                  {compareHistory.changedFields.map((field) => {
                    const diff = getFieldDiff(
                      field,
                      compareHistory.before,
                      compareHistory.after
                    );
                    return (
                      <div
                        key={field}
                        className="border border-lab-bgLighter rounded-lg overflow-hidden"
                      >
                        <div className="bg-lab-bgLighter/30 px-3 py-2 text-sm font-medium">
                          {getFieldLabel(field)}
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-lab-bgLighter">
                          <div className="p-3">
                            <p className="text-xs text-lab-textMuted mb-1">
                              变更前
                            </p>
                            <pre className="text-sm font-mono whitespace-pre-wrap break-all text-lab-danger line-through">
                              {diff.before || "(空)"}
                            </pre>
                          </div>
                          <div className="p-3">
                            <p className="text-xs text-lab-textMuted mb-1">
                              变更后
                            </p>
                            <pre className="text-sm font-mono whitespace-pre-wrap break-all text-lab-success">
                              {diff.after || "(空)"}
                            </pre>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-lab-bgLighter">
                <p className="text-xs text-lab-textMuted mb-1">操作原因</p>
                <p className="text-sm bg-lab-bg p-2 rounded border border-lab-bgLighter">
                  {compareHistory.reason || "无原因说明"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
