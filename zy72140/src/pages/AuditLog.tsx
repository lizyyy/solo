import { useState } from 'react';
import {
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Link,
  Clock,
  Filter,
} from 'lucide-react';
import { useAuditStore } from '@/stores/auditStore';
import { useScheduleStore } from '@/stores/scheduleStore';

const ACTION_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; color: string; bg: string; border: string }
> = {
  remark_edit: {
    icon: MessageSquare,
    label: '备注编辑',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  import_success: {
    icon: CheckCircle,
    label: '导入成功',
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
  },
  import_fail: {
    icon: XCircle,
    label: '导入失败',
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  conflict_detected: {
    icon: AlertTriangle,
    label: '冲突检测',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
  conflict_resolved: {
    icon: ShieldCheck,
    label: '冲突解决',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  material_linked: {
    icon: Link,
    label: '素材关联',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function highlightDiff(before: string, after: string) {
  const beforeParts = before.split('');
  const afterParts = after.split('');
  const changedFrom = new Set<number>();
  const changedTo = new Set<number>();
  const maxLen = Math.max(beforeParts.length, afterParts.length);
  for (let i = 0; i < maxLen; i++) {
    if (beforeParts[i] !== afterParts[i]) {
      if (i < beforeParts.length) changedFrom.add(i);
      if (i < afterParts.length) changedTo.add(i);
    }
  }
  const renderSpan = (parts: string[], changed: Set<number>) =>
    parts.map((ch, i) =>
      changed.has(i) ? (
        <span key={i} className="bg-amber-200 rounded px-0.5">
          {ch}
        </span>
      ) : (
        <span key={i}>{ch}</span>
      )
    );
  return (
    <span className="text-sm text-gray-700">
      {renderSpan(beforeParts, changedFrom)}
      <span className="mx-2 text-gray-400">→</span>
      {renderSpan(afterParts, changedTo)}
    </span>
  );
}

export default function AuditLog() {
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const logs = useAuditStore((s) => s.logs);
  const getLogsByScheduleId = useAuditStore((s) => s.getLogsByScheduleId);
  const schedules = useScheduleStore((s) => s.schedules);
  const getScheduleById = useScheduleStore((s) => s.getScheduleById);

  const filteredLogs = selectedScheduleId
    ? getLogsByScheduleId(selectedScheduleId)
    : logs;
  const sortedLogs = [...filteredLogs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">处理日志</h1>
        <p className="mt-1 text-sm text-gray-500">
          所有操作与决策的审计追踪，确保报告与明细一致
        </p>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={selectedScheduleId}
          onChange={(e) => setSelectedScheduleId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">全部排班</option>
          {schedules.map((s) => (
            <option key={s.id} value={s.id}>
              {s.volunteerName} ({s.id})
            </option>
          ))}
        </select>
      </div>

      {sortedLogs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">暂无处理日志</div>
      ) : (
        <div className="relative pl-8">
          <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />
          <div className="space-y-6">
            {sortedLogs.map((log) => {
              const config = ACTION_CONFIG[log.action] ?? ACTION_CONFIG.remark_edit;
              const Icon = config.icon;
              const schedule = getScheduleById(log.scheduleId);

              return (
                <div key={log.id} className="relative">
                  <div
                    className={`absolute -left-5 top-2 w-6 h-6 rounded-full flex items-center justify-center ${config.bg} border ${config.border}`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.color} ${config.border} border`}
                      >
                        {config.label}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(log.createdAt)}
                      </span>
                    </div>

                    {schedule && (
                      <p className="text-xs text-gray-500 mb-2">
                        关联排班: {schedule.volunteerName} ({log.scheduleId})
                      </p>
                    )}

                    {log.beforeValue && log.afterValue && (
                      <div className="mb-2 p-2 bg-gray-50 rounded-lg">
                        {highlightDiff(log.beforeValue, log.afterValue)}
                      </div>
                    )}

                    {log.evidence && (
                      <div className="mb-2 p-2 bg-gray-100 rounded-lg">
                        <span className="text-xs font-medium text-gray-500 mr-1">证据:</span>
                        <span className="text-sm text-gray-700">{log.evidence}</span>
                      </div>
                    )}

                    {log.suggestion && (
                      <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
                        <span className="text-xs font-medium text-amber-600 mr-1">建议:</span>
                        <span className="text-sm text-amber-800">{log.suggestion}</span>
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
  );
}
