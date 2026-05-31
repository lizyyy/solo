import type { DataSource } from '../types';
import { SOURCE_LABELS } from '../types';
import { Database, FileEdit, History } from 'lucide-react';

interface SourceBadgeProps {
  source: DataSource;
}

const sourceConfig: Record<DataSource, { icon: React.ReactNode; bg: string; text: string }> = {
  system_import: {
    icon: <Database size={12} />,
    bg: 'bg-primary-50 text-primary-700',
    text: 'text-primary-700',
  },
  manual_entry: {
    icon: <FileEdit size={12} />,
    bg: 'bg-neutral-100 text-neutral-700',
    text: 'text-neutral-700',
  },
  historical_reconciliation: {
    icon: <History size={12} />,
    bg: 'bg-amber-50 text-amber-800',
    text: 'text-amber-800',
  },
};

export default function SourceBadge({ source }: SourceBadgeProps) {
  const config = sourceConfig[source];
  const label = SOURCE_LABELS[source];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs ${config.bg} rounded`}
    >
      {config.icon}
      {label}
    </span>
  );
}
