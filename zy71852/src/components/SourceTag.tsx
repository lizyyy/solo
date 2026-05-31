import type { DataSource } from '@/types';
import { sourceLabels } from '@/types';

interface SourceTagProps {
  source: DataSource;
  isSupplementary?: boolean;
  size?: 'sm' | 'md';
}

export function SourceTag({ source, isSupplementary, size = 'sm' }: SourceTagProps) {
  const label = sourceLabels[source];
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  if (isSupplementary) {
    return (
      <span
        className={`inline-flex items-center border rounded font-medium ${sizeClass} bg-gray-100 text-gray-600 border-gray-300 italic`}
      >
        [补录] {label.label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center border rounded font-medium ${sizeClass} ${label.color}`}
    >
      {label.label}
    </span>
  );
}
