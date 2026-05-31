import type { ChangeType } from '../../data/types';

interface StatusBadgeProps {
  type: ChangeType;
}

export default function StatusBadge({ type }: StatusBadgeProps) {
  const isMaterial = type === 'material-only';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-medium ${
        isMaterial
          ? 'bg-blue-50 text-blue-700 border border-blue-200'
          : 'bg-orange-50 text-orange-700 border border-orange-200'
      }`}
    >
      {isMaterial ? '补材料' : '改结论'}
    </span>
  );
}
