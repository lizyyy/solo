import { useState } from 'react';
import {
  Music,
  Plus,
  Trash2,
  Edit3,
  Upload,
  CheckCircle,
  FileDown,
  ChevronDown,
  ChevronUp,
  Clock
} from 'lucide-react';
import type { AuditLog } from '@shared/types';
import { cn } from '@/lib/utils';

interface TimelineProps {
  logs: AuditLog[];
}

function getActionIcon(action: string) {
  switch (action) {
    case 'create':
      return <Plus size={14} />;
    case 'update':
      return <Edit3 size={14} />;
    case 'delete':
      return <Trash2 size={14} />;
    case 'import':
      return <Upload size={14} />;
    case 'decision':
      return <CheckCircle size={14} />;
    case 'export':
      return <FileDown size={14} />;
    default:
      return <Music size={14} />;
  }
}

function getActionColor(action: string) {
  switch (action) {
    case 'create':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'update':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'delete':
      return 'bg-red/20 text-red border-red/30';
    case 'import':
      return 'bg-gold/20 text-gold border-gold/30';
    case 'decision':
      return 'bg-gold/20 text-gold border-gold/30';
    case 'export':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    default:
      return 'bg-neutral-700/50 text-neutral-400 border-neutral-600';
  }
}

function getActionLabel(action: string, entityType: string) {
  const actionLabels: Record<string, string> = {
    'create': '创建',
    'update': '更新',
    'delete': '删除',
    'import': '导入',
    'decision': '决策',
    'export': '导出'
  };
  const entityLabels: Record<string, string> = {
    'track': '曲目',
    'vote': '投票',
    'copyright': '版权',
    'decision': '曲单'
  };
  return `${actionLabels[action] || action} ${entityLabels[entityType] || entityType}`;
}

interface TimelineItemProps {
  log: AuditLog;
  isLast: boolean;
}

function TimelineItem({ log, isLast }: TimelineItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = log.beforeChange || log.afterChange;

  return (
    <div className="relative pl-8 pb-6 animate-fade-in-up">
      {!isLast && (
        <div className="absolute left-[11px] top-6 w-0.5 h-full bg-gradient-to-b from-gold/50 to-neutral-800" />
      )}

      <div
        className={cn(
          'absolute left-0 top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center',
          getActionColor(log.action)
        )}
      >
        {getActionIcon(log.action)}
      </div>

      <div className="card-stage p-4">
        <div
          className="flex items-start justify-between gap-4 cursor-pointer"
          onClick={() => hasDetails && setExpanded(!expanded)}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-white">
                {getActionLabel(log.action, log.entityType)}
              </span>
              <span className="text-xs text-neutral-500">
                {log.entityId && `#${log.entityId.slice(0, 8)}`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <Clock size={12} />
              <span>{log.timestamp}</span>
              <span className="mx-1">·</span>
              <span>操作人: {log.operator}</span>
            </div>
          </div>
          {hasDetails && (
            <button className="text-neutral-500 hover:text-gold transition-colors">
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          )}
        </div>

        {expanded && hasDetails && (
          <div className="mt-4 pt-4 border-t border-neutral-800 space-y-3 animate-fade-in-up">
            {log.beforeChange && (
              <div>
                <p className="text-xs text-neutral-500 mb-2">变更前</p>
                <pre className="text-xs font-mono text-neutral-400 bg-neutral-950 p-3 rounded-stage overflow-x-auto">
                  {JSON.stringify(log.beforeChange, null, 2)}
                </pre>
              </div>
            )}
            {log.afterChange && (
              <div>
                <p className="text-xs text-neutral-500 mb-2">变更后</p>
                <pre className="text-xs font-mono text-gold bg-neutral-950 p-3 rounded-stage overflow-x-auto">
                  {JSON.stringify(log.afterChange, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Timeline({ logs }: TimelineProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-neutral-500">
        <Clock size={48} className="mx-auto mb-4 opacity-30" />
        <p>暂无操作记录</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {logs.map((log, index) => (
        <TimelineItem
          key={log.id}
          log={log}
          isLast={index === logs.length - 1}
        />
      ))}
    </div>
  );
}
