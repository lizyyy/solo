import type { AuditEntry } from '@/types';
import { Clock, User, FileText, ArrowRight, Download, Upload } from 'lucide-react';

const ACTION_ICONS: Record<string, React.ReactNode> = {
  create: <FileText className="h-4 w-4" />,
  update: <ArrowRight className="h-4 w-4" />,
  status_change: <ArrowRight className="h-4 w-4" />,
  export: <Download className="h-4 w-4" />,
  import: <Upload className="h-4 w-4" />,
};

const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  update: '更新',
  status_change: '状态变更',
  export: '导出',
  import: '导入',
};

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700',
  update: 'bg-blue-100 text-blue-700',
  status_change: 'bg-amber-100 text-amber-700',
  export: 'bg-purple-100 text-purple-700',
  import: 'bg-cyan-100 text-cyan-700',
};

interface AuditTimelineProps {
  entries: AuditEntry[];
}

export default function AuditTimeline({ entries }: AuditTimelineProps) {
  if (entries.length === 0) {
    return <div className="py-8 text-center text-sm text-stone-400">暂无审计记录</div>;
  }

  return (
    <div className="relative space-y-0">
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-stone-200" />
      {entries.map((entry, idx) => (
        <div key={entry.id} className="relative flex gap-3 pb-6 last:pb-0">
          <div
            className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ACTION_COLORS[entry.action] || 'bg-stone-100 text-stone-600'}`}
          >
            {ACTION_ICONS[entry.action]}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-stone-800">{ACTION_LABELS[entry.action]}</span>
              <span className="flex items-center gap-1 text-xs text-stone-400">
                <User className="h-3 w-3" />
                {entry.operator}
              </span>
            </div>
            <p className="mt-1 text-sm text-stone-600">{entry.reason}</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-stone-400">
              <Clock className="h-3 w-3" />
              {new Date(entry.timestamp).toLocaleString('zh-CN')}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
