import React from 'react';
import {
  Upload,
  Calculator,
  Layers,
  Edit3,
  RefreshCw,
  Download,
  User,
} from 'lucide-react';
import type { AuditLogEntry, AuditAction } from '../../shared/types';
import { useAppStore } from '../store/useAppStore';

interface EvidenceTimelineProps {
  recordId: string;
}

const ACTION_ICONS: Record<AuditAction, React.ReactNode> = {
  import: <Upload className="w-4 h-4" />,
  calculate: <Calculator className="w-4 h-4" />,
  cad_update: <Layers className="w-4 h-4" />,
  manual_correct: <Edit3 className="w-4 h-4" />,
  rerun: <RefreshCw className="w-4 h-4" />,
  export: <Download className="w-4 h-4" />,
};

const ACTION_LABELS: Record<AuditAction, string> = {
  import: '导入数据',
  calculate: '计算长度',
  cad_update: '更新CAD',
  manual_correct: '人工修正',
  rerun: '重跑计算',
  export: '导出截图',
};

const ACTION_COLORS: Record<AuditAction, string> = {
  import: 'bg-blue-500',
  calculate: 'bg-green-500',
  cad_update: 'bg-purple-500',
  manual_correct: 'bg-amber-500',
  rerun: 'bg-cyan-500',
  export: 'bg-pink-500',
};

export const EvidenceTimeline: React.FC<EvidenceTimelineProps> = ({ recordId }) => {
  const logs = useAppStore((state) => state.getLogsByRecordId(recordId));

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-industrial-muted">
        <p>暂无操作记录</p>
        <p className="text-sm mt-1">完成导入等操作后，证据链将在此显示</p>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-industrial-text mb-4 flex items-center gap-2">
        <User className="w-4 h-4" />
        证据链 · 操作时间线
      </h4>
      <div className="relative pl-6 space-y-4">
        <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-industrial-border" />

        {logs.map((log, index) => (
          <TimelineItem
            key={log.id}
            log={log}
            formatTime={formatTime}
            isLast={index === logs.length - 1}
          />
        ))}
      </div>
    </div>
  );
};

interface TimelineItemProps {
  log: AuditLogEntry;
  formatTime: (ts: string) => string;
  isLast: boolean;
}

const TimelineItem: React.FC<TimelineItemProps> = ({ log, formatTime, isLast }) => {
  const Icon = ACTION_ICONS[log.action];
  const actionLabel = ACTION_LABELS[log.action];
  const colorClass = ACTION_COLORS[log.action];

  return (
    <div className="relative animate-slide-in" style={{ animationDelay: `${isLast ? 0 : 0}ms` }}>
      <div
        className={`absolute -left-6 w-6 h-6 rounded-full ${colorClass} flex items-center justify-center text-white shadow-lg`}
      >
        {Icon}
      </div>

      <div className="bg-industrial-card rounded-lg p-3 border border-industrial-border">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-industrial-text text-sm">
            {actionLabel}
          </span>
          <span className="text-xs text-industrial-muted font-mono">
            {formatTime(log.timestamp)}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-industrial-muted mb-2">
          <User className="w-3 h-3" />
          <span>{log.operator}</span>
        </div>

        <p className="text-sm text-industrial-text mb-2">{log.remark}</p>

        {log.fieldName && (
          <div className="mt-2 p-2 bg-industrial-bg rounded text-xs font-mono">
            <div className="text-industrial-muted mb-1">
              字段: <span className="text-primary-400">{log.fieldName}</span>
            </div>
            {log.oldValue !== undefined && log.oldValue !== '' && (
              <div className="text-red-400 line-through">
                - {log.oldValue}
              </div>
            )}
            {log.newValue !== undefined && (
              <div className="text-green-400">
                + {log.newValue}
              </div>
            )}
          </div>
        )}

        <div className="mt-2 text-xs text-industrial-muted font-mono opacity-50">
          {log.id}
        </div>
      </div>
    </div>
  );
};
