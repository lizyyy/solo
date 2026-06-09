import { useMemo } from 'react';
import { useReviewStore } from '@/store/useReviewStore';
import {
  GitCompare,
  X,
  Plus,
  Minus,
  ArrowRightLeft,
  FileText,
  MessageSquareText,
  GitBranch,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DiffKind, DiffItem } from '@/types';

const sectionConfig: Record<string, { icon: typeof FileText; label: string; color: string }> = {
  materialItems: { icon: FileText, label: '材料送审表', color: 'accent-blue' },
  remarks: { icon: MessageSquareText, label: '审核备注', color: 'accent-green' },
  conclusions: { icon: GitBranch, label: '复核结论', color: 'accent-orange' },
  activeRevision: { icon: GitCompare, label: '版本切换', color: 'metal-light' },
};

const kindConfig: Record<
  DiffKind,
  {
    icon: typeof Plus;
    label: string;
    badgeClass: string;
    iconClass: string;
    rowClass: string;
  }
> = {
  added: {
    icon: Plus,
    label: '新增',
    badgeClass: 'border-accent-green/50 bg-accent-green/10 text-accent-green',
    iconClass: 'text-accent-green',
    rowClass: 'bg-accent-green/[0.03]',
  },
  removed: {
    icon: Minus,
    label: '移除',
    badgeClass: 'border-accent-red/50 bg-accent-red/10 text-accent-red',
    iconClass: 'text-accent-red',
    rowClass: 'bg-accent-red/[0.03]',
  },
  changed: {
    icon: ArrowRightLeft,
    label: '变更',
    badgeClass: 'border-accent-orange/50 bg-accent-orange/10 text-accent-orange',
    iconClass: 'text-accent-orange',
    rowClass: 'bg-accent-orange/[0.03]',
  },
};

export default function DiffModal() {
  const uiState = useReviewStore((s) => s.uiState);
  const closeDiff = useReviewStore((s) => s.closeDiff);
  const computeDiff = useReviewStore((s) => s.computeDiff);
  const timelineEvents = useReviewStore((s) => s.timelineEvents);

  const open = uiState.openDiffModal;
  const diff = useMemo(() => (open ? computeDiff() : []), [open, computeDiff]);

  const beforeEvent = uiState.diffBeforeEventId
    ? timelineEvents.find((e) => e.id === uiState.diffBeforeEventId)
    : null;
  const afterEvent = uiState.diffAfterEventId
    ? timelineEvents.find((e) => e.id === uiState.diffAfterEventId)
    : null;

  const grouped = useMemo(() => {
    const groups: Record<string, DiffItem[]> = {};
    diff.forEach((d) => {
      if (!groups[d.section]) groups[d.section] = [];
      groups[d.section].push(d);
    });
    return groups;
  }, [diff]);

  const counts = useMemo(() => {
    return {
      added: diff.filter((d) => d.kind === 'added').length,
      changed: diff.filter((d) => d.kind === 'changed').length,
      removed: diff.filter((d) => d.kind === 'removed').length,
    };
  }, [diff]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center transition-all duration-200',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      )}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeDiff}
      />

      <div
        className={cn(
          'relative w-full max-w-3xl max-h-[85vh] panel shadow-2xl flex flex-col transition-all duration-200',
          open ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4',
        )}
      >
        <div className="panel-header flex-shrink-0">
          <div className="flex items-center gap-3">
            <GitCompare className="w-4 h-4 text-accent-orange" />
            <span className="panel-title text-[12px]">变更对比</span>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="chip border-metal/20 bg-metal/5 text-metal/70">
                新增 {counts.added}
              </span>
              <span className="chip border-metal/20 bg-metal/5 text-metal/70">
                变更 {counts.changed}
              </span>
              <span className="chip border-metal/20 bg-metal/5 text-metal/70">
                移除 {counts.removed}
              </span>
            </div>
          </div>
          <button
            onClick={closeDiff}
            className="p-1 text-metal/50 hover:text-metal-light hover:bg-metal/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-metal/10 bg-metal/[0.02] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0 p-2.5 border border-metal/15 bg-metal/[0.03]">
              <div className="flex items-center gap-1.5 text-[10px] text-metal/50 uppercase tracking-wider mb-1">
                <Clock className="w-2.5 h-2.5" />
                之前
              </div>
              <div className="text-[11px] font-medium text-metal-light truncate">
                {beforeEvent?.title ?? '初始状态'}
              </div>
              <div className="text-[10px] text-metal/50 font-mono mt-0.5">
                {beforeEvent
                  ? new Date(beforeEvent.timestamp).toLocaleString('zh-CN')
                  : '—'}
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <ChevronRight className="w-5 h-5 text-accent-orange" />
              <span className="text-[9px] text-accent-orange uppercase tracking-wider font-semibold">
                Diff
              </span>
            </div>

            <div className="flex-1 min-w-0 p-2.5 border border-accent-orange/30 bg-accent-orange/[0.05]">
              <div className="flex items-center gap-1.5 text-[10px] text-accent-orange/70 uppercase tracking-wider mb-1">
                <Clock className="w-2.5 h-2.5" />
                之后
              </div>
              <div className="text-[11px] font-medium text-white truncate">
                {afterEvent?.title ?? '当前状态'}
              </div>
              <div className="text-[10px] text-accent-orange/60 font-mono mt-0.5">
                {afterEvent
                  ? new Date(afterEvent.timestamp).toLocaleString('zh-CN')
                  : '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto scrollbar-thin p-3 space-y-4">
          {Object.keys(grouped).length > 0 ? (
            Object.entries(grouped).map(([section, items]) => {
              const cfg = sectionConfig[section] ?? {
                icon: FileText,
                label: section,
                color: 'metal-light',
              };
              const Icon = cfg.icon;

              return (
                <div key={section}>
                  <div className="flex items-center gap-1.5 mb-2 px-1">
                    <Icon
                      className={cn('w-3.5 h-3.5', `text-${cfg.color}`)}
                      style={{
                        color:
                          cfg.color === 'accent-blue'
                            ? '#5B8DEF'
                            : cfg.color === 'accent-green'
                              ? '#3E935A'
                              : cfg.color === 'accent-orange'
                                ? '#F08A3E'
                                : '#8A9BA8',
                      }}
                    />
                    <span className="text-[11px] font-semibold text-metal-light uppercase tracking-wider">
                      {cfg.label}
                    </span>
                    <span className="chip text-[9px] px-1.5 py-px border-metal/20 bg-metal/5 text-metal/60">
                      {items.length} 项
                    </span>
                    <div className="flex-1 h-px bg-metal/10 ml-2" />
                  </div>

                  <div className="space-y-1.5">
                    {items.map((item, idx) => {
                      const kCfg = kindConfig[item.kind];
                      const KIcon = kCfg.icon;

                      return (
                        <div
                          key={`${section}-${idx}`}
                          className={cn(
                            'p-2.5 border-l-2 border transition-colors',
                            kCfg.rowClass,
                            item.kind === 'added' && 'border-l-accent-green/60',
                            item.kind === 'removed' && 'border-l-accent-red/60',
                            item.kind === 'changed' && 'border-l-accent-orange/60',
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={cn(
                                'chip text-[9px] px-1.5 py-px mt-0.5 flex-shrink-0',
                                kCfg.badgeClass,
                              )}
                            >
                              <KIcon className={cn('w-2.5 h-2.5', kCfg.iconClass)} />
                              {kCfg.label}
                            </span>

                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-medium text-metal-light">
                                {item.summary}
                              </div>

                              {item.field && (
                                <div className="text-[10px] text-metal/50 mt-0.5 font-mono">
                                  字段：{item.field}
                                </div>
                              )}

                              {item.kind === 'changed' && item.before !== undefined && item.after !== undefined && (
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <div className="p-2 border border-accent-red/20 bg-accent-red/[0.03]">
                                    <div className="text-[9px] text-accent-red/70 uppercase tracking-wider mb-0.5">
                                      之前
                                    </div>
                                    <div className="text-[10px] font-mono text-metal-light line-clamp-2 break-all">
                                      {item.before}
                                    </div>
                                  </div>
                                  <div className="p-2 border border-accent-green/20 bg-accent-green/[0.03]">
                                    <div className="text-[9px] text-accent-green/70 uppercase tracking-wider mb-0.5">
                                      之后
                                    </div>
                                    <div className="text-[10px] font-mono text-metal-light line-clamp-2 break-all">
                                      {item.after}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {(item.kind === 'added' || item.kind === 'removed') && item.after !== undefined && (
                                <div
                                  className={cn(
                                    'mt-1.5 p-2 font-mono text-[10px]',
                                    item.kind === 'added'
                                      ? 'border border-accent-green/20 bg-accent-green/[0.03] text-metal-light'
                                      : 'border border-accent-red/20 bg-accent-red/[0.03] text-metal-light line-through opacity-70',
                                  )}
                                >
                                  {item.kind === 'added' ? '+' : '-'} {item.after}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-metal/50 gap-3">
              <GitCompare className="w-10 h-10 opacity-30" />
              <div className="text-sm">未检测到变更</div>
              <div className="text-[11px] text-metal/40">
                前后状态完全一致
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-metal/10 flex items-center justify-between flex-shrink-0 bg-metal/[0.02]">
          <div className="text-[10px] text-metal/50">
            共 {diff.length} 处差异
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={closeDiff}
              className="btn btn-primary"
            >
              确认变更
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
