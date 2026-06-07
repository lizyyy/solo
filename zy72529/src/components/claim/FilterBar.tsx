import { Search } from 'lucide-react';
import type { RecordStatus } from '../../types/claim';
import { STATUS_LABELS } from '../../types/claim';

interface FilterBarProps {
  filter: RecordStatus | 'all';
  searchKeyword: string;
  onFilterChange: (status: RecordStatus | 'all') => void;
  onSearchChange: (keyword: string) => void;
  counts: Record<RecordStatus | 'all', number>;
}

const statusOptions: (RecordStatus | 'all')[] = [
  'all',
  'pending_import',
  'pending_review',
  'pending_verify',
  'conflict',
  'completed',
];

export function FilterBar({ filter, searchKeyword, onFilterChange, onSearchChange, counts }: FilterBarProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {statusOptions.map((status) => {
            const isActive = filter === status;
            const label = status === 'all' ? '全部' : STATUS_LABELS[status];
            return (
              <button
                key={status}
                onClick={() => onFilterChange(status)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-blue-500/30' : 'bg-white/60'
                  }`}
                >
                  {counts[status]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索记录编号、用户名称、材料类型..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
          />
        </div>
      </div>
    </div>
  );
}
