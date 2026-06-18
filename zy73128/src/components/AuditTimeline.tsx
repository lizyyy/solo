import {
  Plus,
  Edit3,
  FilePlus2,
  AlertTriangle,
  CheckCircle2,
  CloudFog,
  Download,
  Clock,
  User,
  MapPin,
} from 'lucide-react';
import type { AuditTrail } from '@/shared/types';
import { cn } from '@/lib/utils';

interface AuditTimelineProps {
  trails: AuditTrail[];
  onJumpToAnchor?: (anchor: string) => void;
  className?: string;
}

const actionIcon: Record<string, typeof Plus> = {
  创建: Plus,
  改判: Edit3,
  补录: FilePlus2,
  标记异常: AlertTriangle,
  确认: CheckCircle2,
  标记云遮挡: CloudFog,
  导出: Download,
};

const actionColor: Record<string, string> = {
  创建: 'bg-status-normal text-white',
  改判: 'bg-status-anomaly text-white',
  补录: 'bg-status-supplement text-white',
  标记异常: 'bg-status-anomaly text-white',
  确认: 'bg-ocean-400 text-white',
  标记云遮挡: 'bg-status-cloud text-white',
  导出: 'bg-ocean-300 text-white',
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatFullTime = (iso: string) => {
  return new Date(iso).toLocaleString('zh-CN');
};

export default function AuditTimeline({ trails, onJumpToAnchor, className }: AuditTimelineProps) {
  const sorted = [...trails].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div className={cn('flex flex-col gap-0', className)}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ocean-600/40 bg-ocean-700/40">
        <Clock size={15} className="text-coral-300" />
        <h3 className="font-serif font-semibold text-ocean-50 text-sm">改判线索时间轴</h3>
        <span className="ml-auto text-[11px] text-ocean-300 font-mono">{trails.length} 条线索</span>
      </div>

      <div className="relative flex-1 overflow-y-auto py-4 px-4">
        <div className="absolute left-[26px] top-4 bottom-4 w-px bg-gradient-to-b from-ocean-300/40 via-ocean-300/20 to-transparent" />

        {sorted.length === 0 && (
          <div className="text-center text-ocean-400 text-sm py-8">暂无线索记录</div>
        )}

        {sorted.map((trail, idx) => {
          const Icon = actionIcon[trail.action] ?? Plus;
          const color = actionColor[trail.action] ?? 'bg-ocean-400 text-white';
          const isLatest = idx === 0;

          return (
            <div
              key={trail.id}
              className={cn(
                'relative pl-14 pb-5 animate-fade-up',
                isLatest && 'opacity-100',
                !isLatest && 'opacity-80',
              )}
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div
                className={cn(
                  'absolute left-4 top-0 w-7 h-7 rounded-full flex items-center justify-center shadow-lg ring-2 ring-ocean-800',
                  color,
                  isLatest && 'ring-coral-300/50',
                )}
              >
                <Icon size={14} />
              </div>

              {isLatest && (
                <div className="absolute left-4 top-0 w-7 h-7 rounded-full bg-coral-400/30 animate-ping" />
              )}

              <div
                className={cn(
                  'rounded-lg p-3 border transition-all',
                  isLatest
                    ? 'bg-ocean-700/60 border-coral-400/40 shadow-[0_2px_12px_rgba(255,122,89,0.12)]'
                    : 'bg-ocean-800/40 border-ocean-600/30 hover:bg-ocean-700/40',
                )}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      'text-[11px] px-2 py-0.5 rounded-full font-medium',
                      color,
                    )}
                  >
                    {trail.action}
                  </span>
                  <span className="text-[11px] text-ocean-300 font-mono">
                    {formatTime(trail.timestamp)}
                  </span>
                  {isLatest && (
                    <span className="text-[10px] text-coral-300 font-medium ml-auto">最新</span>
                  )}
                </div>

                <div className="mt-2 text-[13px] text-ocean-100 leading-relaxed">
                  {trail.reason}
                </div>

                {trail.fieldChanged && (
                  <div className="mt-2 text-[11px] flex flex-wrap gap-1.5">
                    <span className="text-ocean-400">变更字段：</span>
                    {trail.fieldChanged.split(',').map((f) => (
                      <span
                        key={f}
                        className="px-1.5 py-0.5 bg-ocean-600/40 rounded text-ocean-200 font-mono"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                {trail.oldValue && trail.newValue && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-status-anomaly/10 border border-status-anomaly/20 rounded p-1.5">
                      <div className="text-status-anomaly/70 mb-0.5">变更前</div>
                      <div className="text-ocean-200 font-mono text-[10px] truncate" title={trail.oldValue}>
                        {trail.oldValue}
                      </div>
                    </div>
                    <div className="bg-status-normal/10 border border-status-normal/20 rounded p-1.5">
                      <div className="text-status-normal/70 mb-0.5">变更后</div>
                      <div className="text-ocean-200 font-mono text-[10px] truncate" title={trail.newValue}>
                        {trail.newValue}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-ocean-400">
                  <div className="flex items-center gap-1.5">
                    <User size={11} />
                    <span>{trail.operator}</span>
                  </div>
                  {trail.screenshotAnchor && onJumpToAnchor && (
                    <button
                      onClick={() => onJumpToAnchor(trail.screenshotAnchor!)}
                      className="flex items-center gap-1 text-coral-300 hover:text-coral-200 transition-colors"
                    >
                      <MapPin size={11} />
                      <span>跳转截图锚点</span>
                    </button>
                  )}
                </div>

                <div className="mt-1 text-[10px] text-ocean-500 font-mono">
                  {formatFullTime(trail.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
