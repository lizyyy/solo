import type { PointStatus } from '../../types';
import { STATUS_COLORS, STATUS_LABELS } from '../../types';

interface FilterTabsProps {
  currentFilter: PointStatus | 'all';
  onFilterChange: (filter: PointStatus | 'all') => void;
  counts: {
    all: number;
    success: number;
    pending: number;
    legacy: number;
  };
}

export function FilterTabs({ currentFilter, onFilterChange, counts }: FilterTabsProps) {
  const tabs: { key: PointStatus | 'all'; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'success', label: STATUS_LABELS.success },
    { key: 'pending', label: STATUS_LABELS.pending },
    { key: 'legacy', label: STATUS_LABELS.legacy },
  ];

  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
      {tabs.map((tab) => {
        const isActive = currentFilter === tab.key;
        const color = tab.key === 'all' ? '#3b82f6' : STATUS_COLORS[tab.key as PointStatus];
        
        return (
          <button
            key={tab.key}
            onClick={() => onFilterChange(tab.key)}
            className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
            style={{
              backgroundColor: isActive ? `${color}30` : 'transparent',
              color: isActive ? color : '#94a3b8',
              border: isActive ? `1px solid ${color}50` : '1px solid transparent',
            }}
          >
            <span className="block truncate">{tab.label}</span>
            <span
              className="block text-[10px] mt-0.5"
              style={{ opacity: 0.7 }}
            >
              {counts[tab.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
