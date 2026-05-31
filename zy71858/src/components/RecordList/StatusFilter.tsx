import { RecordStatus } from '@/types';
import { statusLabels } from '@/utils/statusUtils';

interface StatusFilterProps {
  selectedStatus: RecordStatus | 'all';
  onStatusChange: (status: RecordStatus | 'all') => void;
  counts: Record<RecordStatus | 'all', number>;
}

export function StatusFilter({ selectedStatus, onStatusChange, counts }: StatusFilterProps) {
  const filters: Array<{ key: RecordStatus | 'all'; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: statusLabels.pending },
    { key: 'confirmed', label: statusLabels.confirmed },
    { key: 'to_supplement', label: statusLabels.to_supplement },
    { key: 'modified', label: statusLabels.modified },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <button
          key={filter.key}
          onClick={() => onStatusChange(filter.key)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            selectedStatus === filter.key
              ? 'bg-primary-600 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          {filter.label}
          <span className="ml-2 opacity-75">({counts[filter.key]})</span>
        </button>
      ))}
    </div>
  );
}
