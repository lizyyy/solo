import { cn } from '@/lib/utils';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface SeverityBadgeProps {
  severity: 'low' | 'medium' | 'high';
  className?: string;
}

const severityConfig = {
  high: {
    label: '高',
    className: 'bg-red-100 text-red-700',
    Icon: AlertCircle,
  },
  medium: {
    label: '中',
    className: 'bg-amber-100 text-amber-700',
    Icon: AlertTriangle,
  },
  low: {
    label: '低',
    className: 'bg-blue-100 text-blue-700',
    Icon: Info,
  },
};

export default function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = severityConfig[severity];
  const Icon = config.Icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
