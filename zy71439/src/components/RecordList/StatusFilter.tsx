import React from 'react';
import { WorkflowStatus } from '../../types';
import { getStatusLabel } from '../../utils/formatters';

interface StatusFilterProps {
  currentFilter: WorkflowStatus | 'all';
  onFilterChange: (filter: WorkflowStatus | 'all') => void;
  counts: Record<WorkflowStatus, number>;
}

export const StatusFilter: React.FC<StatusFilterProps> = ({
  currentFilter,
  onFilterChange,
  counts
}) => {
  const filters: { value: WorkflowStatus | 'all'; label: string; icon: string }[] = [
    { value: 'all', label: '全部', icon: '📋' },
    { value: WorkflowStatus.PENDING, label: getStatusLabel(WorkflowStatus.PENDING), icon: '⏳' },
    { value: WorkflowStatus.APPROVED, label: getStatusLabel(WorkflowStatus.APPROVED), icon: '✅' },
    { value: WorkflowStatus.RETURNED, label: getStatusLabel(WorkflowStatus.RETURNED), icon: '❌' }
  ];

  const getCount = (value: WorkflowStatus | 'all'): number => {
    if (value === 'all') {
      return Object.values(counts).reduce((a, b) => a + b, 0);
    }
    return counts[value];
  };

  return (
    <div className="flex flex-wrap gap-3">
      {filters.map(filter => {
        const count = getCount(filter.value);
        const isActive = currentFilter === filter.value;

        return (
          <button
            key={filter.value}
            onClick={() => onFilterChange(filter.value)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${
              isActive
                ? 'bg-slate-700 border-slate-500 text-white shadow-lg'
                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
            }`}
          >
            <span className="text-lg">{filter.icon}</span>
            <span className="font-medium">{filter.label}</span>
            <span
              className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                isActive
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default StatusFilter;
