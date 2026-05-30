import { Zap, Mountain, BookOpen, Download, GitCompare } from 'lucide-react';
import type { AuditEntry, OperationType } from '@/types';

const operationConfig: Record<OperationType, { icon: typeof Zap; label: string; color: string }> = {
  fit: { icon: Zap, label: '拟合', color: 'text-synth-green' },
  peak_detect: { icon: Mountain, label: '峰值检测', color: 'text-blue-400' },
  param_interpret: { icon: BookOpen, label: '参数解释', color: 'text-purple-400' },
  chart_export: { icon: Download, label: '图表导出', color: 'text-cyan-400' },
  history_compare: { icon: GitCompare, label: '历史对比', color: 'text-synth-amber' },
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
        暂无审计记录
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-[15px] top-0 bottom-0 w-px bg-white/10" />
      <div className="space-y-0">
        {entries.map((entry, index) => {
          const config = operationConfig[entry.operationType];
          const Icon = config.icon;
          const isEven = index % 2 === 0;

          return (
            <div
              key={entry.id}
              className={`relative flex items-start gap-4 px-4 py-3 ${
                isEven ? 'bg-white/[0.015]' : ''
              }`}
            >
              <div className={`relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-synth-card ${config.color}`}>
                <Icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
                  <span className="text-[10px] text-gray-600 font-mono-display">
                    {formatTimestamp(entry.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed break-words">
                  {entry.judgment}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
