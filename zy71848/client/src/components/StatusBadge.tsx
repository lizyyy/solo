import { getStatusLabel, getStatusBgClass } from '../utils/format';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const label = getStatusLabel(status);
  const bgClass = getStatusBgClass(status);
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  return (
    <span className={`inline-flex items-center font-medium border-2 rounded ${bgClass} ${sizeClass}`}>
      <span className="w-2 h-2 rounded-full bg-current mr-2"></span>
      {label}
    </span>
  );
}
