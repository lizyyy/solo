import type { ShotStatus } from '@/types';
import { STATUS_LABELS } from '@/types';
import { Lock, FileText, Eye } from 'lucide-react';

interface StatusBadgeProps {
  status: ShotStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const configs = {
    draft: {
      bg: 'bg-film-success/20',
      text: 'text-film-success',
      border: 'border-film-success/30',
      icon: FileText,
    },
    review: {
      bg: 'bg-film-warning/20',
      text: 'text-film-warning',
      border: 'border-film-warning/30',
      icon: Eye,
    },
    locked: {
      bg: 'bg-film-danger/20',
      text: 'text-film-danger',
      border: 'border-film-danger/50',
      icon: Lock,
    },
  };

  const config = configs[status];
  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs gap-1' : 'px-3 py-1 text-sm gap-2';

  return (
    <span
      className={`inline-flex items-center ${sizeClasses} rounded-full border ${config.bg} ${config.text} ${config.border} font-medium`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      {STATUS_LABELS[status]}
    </span>
  );
}
