import { Search, Filter, X } from 'lucide-react';
import { useShotStore } from '@/store/useShotStore';
import { mockUsers } from '@/data/mockData';
import type { ShotStatus } from '@/types';

export function ShotFilters() {
  const { filters, setFilters, shots } = useShotStore();

  const scenes = Array.from(new Set(shots.map((s) => s.scene))).sort();

  const statusOptions: { value: ShotStatus | 'all'; label: string }[] = [
    { value: 'all', label: '全部状态' },
    { value: 'draft', label: '草稿' },
    { value: 'review', label: '待审' },
    { value: 'locked', label: '已锁定' },
  ];

  const clearFilters = () => {
    setFilters({
      search: '',
      scene: '',
      status: 'all',
      modifiedBy: '',
      dateRange: null,
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.scene ||
    filters.status !== 'all' ||
    filters.modifiedBy ||
    filters.dateRange;

  return (
    <div className="bg-film-panel border-b border-film-border p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-film-text-muted" />
          <span className="text-sm font-medium text-film-text-secondary">筛选</span>
        </div>

        <div className="flex-1 min-w-[200px] max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-film-text-muted" />
            <input
              type="text"
              placeholder="搜索镜头号、标题..."
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 bg-film-card border border-film-border rounded-lg text-film-text-primary placeholder-film-text-muted focus:outline-none focus:border-film-primary transition-colors"
            />
          </div>
        </div>

        <select
          value={filters.scene}
          onChange={(e) => setFilters({ scene: e.target.value })}
          className="px-3 py-2 bg-film-card border border-film-border rounded-lg text-film-text-primary focus:outline-none focus:border-film-primary transition-colors"
        >
          <option value="">全部场景</option>
          {scenes.map((scene) => (
            <option key={scene} value={scene}>
              {scene}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value as ShotStatus | 'all' })}
          className="px-3 py-2 bg-film-card border border-film-border rounded-lg text-film-text-primary focus:outline-none focus:border-film-primary transition-colors"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={filters.modifiedBy}
          onChange={(e) => setFilters({ modifiedBy: e.target.value })}
          className="px-3 py-2 bg-film-card border border-film-border rounded-lg text-film-text-primary focus:outline-none focus:border-film-primary transition-colors"
        >
          <option value="">全部人员</option>
          {mockUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 text-film-text-muted hover:text-film-text-primary hover:bg-film-card rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            清除
          </button>
        )}
      </div>
    </div>
  );
}
