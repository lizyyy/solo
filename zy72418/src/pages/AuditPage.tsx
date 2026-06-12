import { useState, useEffect } from "react";
import { Clock, User, FileText, ArrowRight, Filter, Search, RefreshCw } from "lucide-react";
import { api } from "@/api/client";
import { useAppStore } from "@/store/appStore";
import type { AuditLog, OperatorRole } from "@shared/types";

const ROLE_LABELS: Record<OperatorRole, string> = {
  admin: "系统管理员",
  coordinator: "巡演统筹",
  ticket: "票务同事",
  finance: "财务同事",
  system: "系统",
};

const ACTION_LABELS: Record<string, string> = {
  import: "导入记录",
  conflict_detected: "检测到冲突",
  conflict_resolved: "冲突处理",
  supplement: "信息补录",
  recalculate: "分账重算",
  review_substitute: "复核临时替补",
  status_change: "状态变更",
};

export default function AuditPage() {
  const { setLoading, setError, auditLogs, setAuditLogs } = useAppStore();
  const [recordIdFilter, setRecordIdFilter] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const recordId = recordIdFilter.trim() || undefined;
      const res = await api.audit.list(recordId);
      setAuditLogs(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const filteredLogs = auditLogs.filter((log) => {
    if (actionFilter !== "all" && log.action !== actionFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        log.operator.toLowerCase().includes(term) ||
        log.action.toLowerCase().includes(term) ||
        (log.fieldName && log.fieldName.toLowerCase().includes(term)) ||
        (log.oldValue && log.oldValue.toLowerCase().includes(term)) ||
        (log.newValue && log.newValue.toLowerCase().includes(term)) ||
        log.reason.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const actionOptions = [
    { value: "all", label: "全部操作" },
    { value: "import", label: "导入记录" },
    { value: "conflict_detected", label: "检测冲突" },
    { value: "conflict_resolved", label: "处理冲突" },
    { value: "supplement", label: "信息补录" },
    { value: "recalculate", label: "分账重算" },
    { value: "review_substitute", label: "复核替补" },
  ];

  const getChangeIndicator = (log: AuditLog) => {
    if (log.fieldName && log.oldValue !== null && log.newValue !== null) {
      return (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 line-through">{log.oldValue}</span>
          <ArrowRight size={14} className="text-primary-500" />
          <span className="text-primary-700 font-medium">{log.newValue}</span>
        </div>
      );
    }
    return null;
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "import":
        return <FileText size={16} className="text-primary-500" />;
      case "conflict_detected":
        return <FileText size={16} className="text-danger-500" />;
      case "conflict_resolved":
        return <FileText size={16} className="text-success-500" />;
      case "supplement":
        return <FileText size={16} className="text-warning-500" />;
      case "recalculate":
        return <RefreshCw size={16} className="text-primary-500" />;
      default:
        return <FileText size={16} className="text-gray-500" />;
    }
  };

  const stats = {
    total: auditLogs.length,
    byUser: auditLogs.reduce((acc, log) => {
      acc[log.operator] = (acc[log.operator] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-6">
          <p className="text-sm text-gray-500 mb-1">总操作记录</p>
          <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="card p-6 border-l-4 border-l-primary-500">
          <p className="text-sm text-gray-500 mb-1">操作人</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(stats.byUser).map(([user, count]) => (
              <span
                key={user}
                className="text-xs px-2 py-1 bg-primary-50 text-primary-700 rounded-full"
              >
                {user}: {count}次
              </span>
            ))}
          </div>
        </div>
        <div className="card p-6 border-l-4 border-l-warning-500">
          <p className="text-sm text-gray-500 mb-1">追踪说明</p>
          <p className="text-xs text-gray-600 mt-2">
            所有修改均记录：谁改了什么、为什么改、改完影响了哪条结果
          </p>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-400" />
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="input-field w-40"
              >
                {actionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Search size={18} className="text-gray-400" />
              <input
                type="text"
                placeholder="搜索操作人、字段或内容..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field w-60"
              />
            </div>

            <div className="flex items-center gap-2">
              <Search size={18} className="text-gray-400" />
              <input
                type="text"
                placeholder="按记录ID筛选..."
                value={recordIdFilter}
                onChange={(e) => setRecordIdFilter(e.target.value)}
                className="input-field w-48"
              />
            </div>
          </div>

          <button
            onClick={loadAuditLogs}
            className="btn-secondary flex items-center gap-2"
            disabled={useAppStore.getState().loading}
          >
            <RefreshCw
              size={16}
              className={useAppStore.getState().loading ? "animate-spin" : ""}
            />
            刷新
          </button>
        </div>

        <div className="card p-4 bg-blue-50 border-l-4 border-l-blue-500 mb-4">
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">💡 审计追踪说明</p>
            <p className="text-xs text-blue-600">
              每一条记录都包含：操作人 + 角色 + 操作类型 + 变更字段（旧值→新值）+ 理由 + 影响的结果ID列表。
              确保所有数据修改可追溯、可审计、可问责。
            </p>
          </div>
        </div>

        <div className="space-y-4 max-h-[600px] overflow-y-auto scrollbar-thin">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="card p-4 border-l-4 border-l-primary-200 hover:border-l-primary-500 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getActionIcon(log.action)}
                    <span className="font-semibold text-gray-800">
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      {ROLE_LABELS[log.operatorRole]}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      记录ID: {log.recordId}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-sm mb-2">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-gray-400" />
                      <span className="text-gray-600">操作人：</span>
                      <span className="font-medium text-gray-800">{log.operator}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-gray-400" />
                      <span className="text-gray-600">时间：</span>
                      <span className="font-mono text-gray-800">
                        {new Date(log.createdAt).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    {log.fieldName && (
                      <div>
                        <span className="text-gray-600">变更字段：</span>
                        <span className="font-medium text-primary-700">{log.fieldName}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600">理由：</span>
                      <span className="text-gray-800">{log.reason}</span>
                    </div>
                  </div>

                  {getChangeIndicator(log)}

                  {log.affectedResultIds.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500">影响的结果ID：</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {log.affectedResultIds.map((id, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-0.5 bg-warning-50 text-warning-700 rounded font-mono"
                          >
                            {id}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filteredLogs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              暂无审计记录
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
