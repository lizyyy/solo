import { AuditLog, ROLE_LABELS } from '@/types';
import { formatDateTime } from '@/utils/version';
import {
  FileText,
  Edit3,
  Lock,
  Unlock,
  RotateCcw,
  Plus,
  GitCompare,
  Download,
} from 'lucide-react';

interface AuditLogListProps {
  logs: AuditLog[];
  limit?: number;
}

const ACTION_ICONS = {
  create: Plus,
  update: Edit3,
  lock: Lock,
  unlock: Unlock,
  rollback: RotateCcw,
  compare: GitCompare,
  export: Download,
};

const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  update: '更新',
  lock: '锁定',
  unlock: '解锁',
  rollback: '回滚',
  compare: '对比',
  export: '导出',
};

const ACTION_COLORS: Record<string, string> = {
  create: 'text-film-success bg-film-success/20',
  update: 'text-film-primary bg-film-primary/20',
  lock: 'text-film-warning bg-film-warning/20',
  unlock: 'text-film-warning bg-film-warning/20',
  rollback: 'text-film-danger bg-film-danger/20',
  compare: 'text-film-secondary bg-film-secondary/20',
  export: 'text-film-secondary bg-film-secondary/20',
};

export function AuditLogList({ logs, limit }: AuditLogListProps) {
  const displayLogs = limit ? logs.slice(0, limit) : logs;

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-film-text-muted">
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">暂无审计日志</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayLogs.map((log) => {
        const Icon = ACTION_ICONS[log.action] || FileText;
        return (
          <div
            key={log.id}
            className="flex items-start gap-4 p-4 bg-film-card border border-film-border rounded-lg"
          >
            <div
              className={`p-2 rounded-lg ${ACTION_COLORS[log.action] || 'text-film-text-muted bg-film-panel'}`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-film-text-primary">
                  <span className={ACTION_COLORS[log.action]?.split(' ')[0]}>
                    {ACTION_LABELS[log.action] || log.action}
                  </span>
                  {log.shotNumber && (
                    <span className="text-film-primary font-mono ml-2">
                      {log.shotNumber}
                    </span>
                  )}
                </p>
                <span className="text-xs text-film-text-muted flex-shrink-0 ml-2">
                  {formatDateTime(log.timestamp)}
                </span>
              </div>
              <p className="text-sm text-film-text-secondary mb-1">{log.message}</p>
              <div className="flex items-center gap-3 text-xs text-film-text-muted">
                <span>
                  {ROLE_LABELS[log.userRole] || log.userRole} · {log.userName}
                </span>
                {log.versionFrom && (
                  <span>
                    v{log.versionFrom} → v{log.versionTo}
                  </span>
                )}
                {log.fieldChanges && log.fieldChanges > 0 && (
                  <span>{log.fieldChanges} 处修改</span>
                )}
                {log.isRollback && (
                  <span className="text-film-danger">[回滚操作]</span>
                )}
              </div>
              {log.reason && (
                <p className="text-xs text-film-text-muted mt-2 italic">
                  理由: {log.reason}
                </p>
              )}
            </div>
          </div>
        );
      })}
      {limit && logs.length > limit && (
        <p className="text-center text-sm text-film-text-muted">
          还有 {logs.length - limit} 条记录...
        </p>
      )}
    </div>
  );
}
