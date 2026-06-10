import type { DrawingStatus } from '@/types';
import { STATUS_LABELS } from '@/types';

interface StatusBadgeProps {
  status: DrawingStatus;
  size?: 'sm' | 'md';
}

const STATUS_STYLES: Record<DrawingStatus, string> = {
  normal: 'border-blueprint-green text-blueprint-green bg-blueprint-green/10',
  abnormal: 'border-blueprint-red text-[#E74C3C] bg-[#C0392B]/15',
  reviewing: 'border-blueprint-orange text-blueprint-orange bg-[#E67E22]/15',
  closed: 'border-steel-400 text-steel-300 bg-steel-700/40',
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const label = STATUS_LABELS[status];
  const sizeCls = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`stamp-badge ${STATUS_STYLES[status]} ${sizeCls}`}>
      <span className="mr-1.5 inline-block w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}
