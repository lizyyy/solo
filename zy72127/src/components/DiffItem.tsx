import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Copy, Plus, Minus, CircleDot, AlertOctagon } from 'lucide-react';
import type { Difference, DifferenceType } from '@/types';
import { DIFFERENCE_TYPE_LABELS, SEVERITY_BG_COLORS, SEVERITY_COLORS } from '@/types';
import { cn } from '@/lib/utils';

interface DiffItemProps {
  difference: Difference;
  showDetails?: boolean;
}

const typeIcons: Record<DifferenceType, React.ReactNode> = {
  changed: <CircleDot className="w-4 h-4" />,
  added: <Plus className="w-4 h-4" />,
  removed: <Minus className="w-4 h-4" />,
  null: <AlertTriangle className="w-4 h-4" />,
  duplicate: <Copy className="w-4 h-4" />,
  boundary: <AlertOctagon className="w-4 h-4" />,
};

export function DiffItem({ difference, showDetails = false }: DiffItemProps) {
  const [expanded, setExpanded] = useState(showDetails);

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '∅ (空值)';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  return (
    <div className={cn(
      'rounded-lg border overflow-hidden transition-all duration-200',
      SEVERITY_BG_COLORS[difference.severity]
    )}>
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-1.5 rounded-md',
            difference.type === 'null' ? 'bg-accent-coral/30 text-accent-coral' :
            difference.type === 'duplicate' ? 'bg-accent-amber/30 text-accent-amber' :
            difference.type === 'boundary' ? 'bg-accent-amber/30 text-accent-amber' :
            'bg-accent-neon/30 text-accent-neon'
          )}>
            {typeIcons[difference.type]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-synth-text">{difference.field}</span>
              <span className={cn('text-xs px-2 py-0.5 rounded-full bg-synth-card', SEVERITY_COLORS[difference.severity])}>
                {DIFFERENCE_TYPE_LABELS[difference.type]}
              </span>
            </div>
            <span className="text-xs text-synth-muted">
              严重程度: {difference.severity === 'high' ? '高' : difference.severity === 'medium' ? '中' : '低'}
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-synth-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-synth-muted" />
        )}
      </div>

      {expanded && (
        <div className="p-3 border-t border-synth-border bg-synth-card/50">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-synth-muted mb-1">基准值</div>
              <pre className="p-2 bg-synth-bg rounded font-mono text-xs text-accent-neon overflow-x-auto">
                {formatValue(difference.baseValue)}
              </pre>
            </div>
            <div>
              <div className="text-xs text-synth-muted mb-1">目标值</div>
              <pre className="p-2 bg-synth-bg rounded font-mono text-xs text-primary-400 overflow-x-auto">
                {formatValue(difference.targetValue)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
