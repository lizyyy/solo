import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CadLayer, LayerStatus } from '@shared/types';

const statusDot: Record<LayerStatus, string> = {
  approved: 'bg-status-approved',
  needs_modify: 'bg-status-needs_modify',
  rejected: 'bg-status-rejected',
};

interface LayerRowProps {
  layer: CadLayer;
  selected: boolean;
  onClick: () => void;
  isLast?: boolean;
  className?: string;
}

export function LayerRow({ layer, selected, onClick, isLast, className }: LayerRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative w-full text-left transition-all duration-200',
        'px-4 py-3',
        !isLast && 'border-b border-bg-border/60',
        selected
          ? 'bg-bg-elevated shadow-inner'
          : 'hover:bg-bg-card/80',
        className,
      )}
    >
      {selected && (
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500 rounded-r" />
      )}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span
            className={cn(
              'h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-offset-1 ring-offset-bg transition-transform group-hover:scale-125',
              statusDot[layer.currentStatus],
              `ring-status-${layer.currentStatus}/30`,
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="truncate font-mono text-sm text-slate-100">
                {layer.originalName}
              </span>
              <span className="shrink-0 inline-flex items-center rounded-md bg-bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-slate-400 border border-bg-border">
                {layer.category}
              </span>
            </div>
            <p className="truncate text-xs text-slate-500 leading-snug">
              {layer.latestOpinion || <span className="italic text-slate-600">暂无复核意见</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="inline-flex items-center rounded-md bg-brand-600/15 px-2 py-0.5 text-[11px] font-semibold text-brand-100 border border-brand-500/30">
            v{layer.version}
          </span>
          <ChevronRight
            className={cn(
              'h-4 w-4 text-slate-500 transition-all',
              selected ? 'translate-x-0.5 text-brand-100' : 'group-hover:translate-x-0.5 group-hover:text-slate-300',
            )}
          />
        </div>
      </div>
    </button>
  );
}
