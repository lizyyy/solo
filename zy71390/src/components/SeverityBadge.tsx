import { AnomalySeverity, SEVERITY_COLORS, SEVERITY_LABELS } from '../../shared/types';
import { cn } from '../lib/utils';

interface SeverityBadgeProps {
  severity: AnomalySeverity;
}

function SeverityBadge({ severity }: SeverityBadgeProps) {
  const color = SEVERITY_COLORS[severity];
  const label = SEVERITY_LABELS[severity];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        severity === 'critical' && 'bg-red-500/10 text-red-400',
        severity === 'warning' && 'bg-yellow-500/10 text-yellow-400',
        severity === 'info' && 'bg-blue-500/10 text-blue-400'
      )}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

export { SeverityBadge };
