import { Clock, User, FileText, CheckCircle2, Archive, Edit3 } from 'lucide-react';
import type { Preset } from '@/types';
import { formatTimestamp } from '@/utils/versionParser';
import { cn } from '@/lib/utils';

interface PresetCardProps {
  preset: Preset;
  selected?: boolean;
  onClick?: () => void;
  showSelect?: boolean;
  variant?: 'default' | 'base' | 'target';
}

const statusConfig = {
  draft: { icon: Edit3, color: 'text-accent-amber', bg: 'bg-accent-amber/20', label: '草稿' },
  confirmed: { icon: CheckCircle2, color: 'text-accent-neon', bg: 'bg-accent-neon/20', label: '已确认' },
  archived: { icon: Archive, color: 'text-synth-muted', bg: 'bg-synth-muted/20', label: '已归档' },
};

const variantConfig = {
  default: 'border-synth-border hover:border-accent-neon/50',
  base: 'border-accent-neon shadow-neon',
  target: 'border-primary-500 shadow-lg shadow-primary-500/30',
};

export function PresetCard({ preset, selected, onClick, showSelect = false, variant = 'default' }: PresetCardProps) {
  const status = statusConfig[preset.status];
  const StatusIcon = status.icon;

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative p-4 rounded-xl border-2 bg-synth-card cursor-pointer transition-all duration-300',
        'hover:translate-y-[-2px] hover:shadow-card',
        variantConfig[variant],
        selected && 'ring-2 ring-accent-neon ring-offset-2 ring-offset-synth-bg'
      )}
    >
      {showSelect && (
        <div className={cn(
          'absolute top-3 right-3 w-5 h-5 rounded-full border-2 transition-all',
          selected
            ? 'bg-accent-neon border-accent-neon shadow-neon'
            : 'border-synth-muted'
        )}>
          {selected && <div className="w-full h-full flex items-center justify-center">
            <div className="w-2 h-2 bg-synth-bg rounded-full" />
          </div>}
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-synth-text text-lg">{preset.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-sm text-accent-neon">v{preset.version}</span>
            <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs', status.bg, status.color)}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-synth-muted">
          <FileText className="w-4 h-4" />
          <span className="font-mono text-xs">{preset.filename}</span>
        </div>
        <div className="flex items-center gap-4 text-synth-muted">
          <User className="w-4 h-4" />
          <span>{preset.operator}</span>
        </div>
        <div className="flex items-center gap-2 text-synth-muted">
          <Clock className="w-4 h-4" />
          <span>{formatTimestamp(preset.createdAt)}</span>
        </div>
      </div>

      {preset.notes && (
        <div className="mt-3 pt-3 border-t border-synth-border">
          <p className="text-xs text-synth-muted line-clamp-2">{preset.notes}</p>
        </div>
      )}
    </div>
  );
}
