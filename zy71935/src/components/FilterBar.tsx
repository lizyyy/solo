import { Search, Filter } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export default function FilterBar() {
  const { filters, setFilters } = useAppStore();

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-700">筛选</span>
        </div>

        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索变更或问题..."
              value={filters.searchText}
              onChange={(e) => setFilters({ searchText: e.target.value })}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">变更类型：</span>
          <select
            value={filters.changeTypes[0] || ''}
            onChange={(e) =>
              setFilters({ changeTypes: e.target.value ? [e.target.value] : [] })
            }
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">全部</option>
            <option value="material">补材料</option>
            <option value="conclusion">结论变更</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">严重程度：</span>
          <select
            value={filters.severities[0] || ''}
            onChange={(e) =>
              setFilters({ severities: e.target.value ? [e.target.value] : [] })
            }
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">全部</option>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">状态：</span>
          <select
            value={filters.resolvedStatus}
            onChange={(e) => setFilters({ resolvedStatus: e.target.value })}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="all">全部</option>
            <option value="pending">待处理</option>
            <option value="resolved">已解决</option>
          </select>
        </div>
      </div>
    </div>
  );
}
