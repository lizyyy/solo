import { useReviewStore } from '../store/useReviewStore';
import { getSupplierList } from '../data/mockData';
import { Search, Filter, X } from 'lucide-react';

export function FilterPanel() {
  const { filters, setFilters } = useReviewStore();
  const suppliers = getSupplierList();

  const resetFilters = () => {
    setFilters({
      supplierId: '',
      status: 'all',
      anomalyType: 'all',
      dateRange: { start: '', end: '' },
      searchKeyword: '',
    });
  };

  const hasActiveFilters =
    filters.supplierId ||
    filters.status !== 'all' ||
    filters.anomalyType !== 'all' ||
    filters.dateRange.start ||
    filters.dateRange.end ||
    filters.searchKeyword;

  return (
    <div className="bg-bg-secondary border-b border-bg-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-text-muted" />
        <span className="text-data-sm font-medium text-text-primary">筛选条件</span>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="ml-auto flex items-center gap-1 text-data-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            <X className="w-3 h-3" />
            重置
          </button>
        )}
      </div>

      <div className="grid grid-cols-5 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="搜索流水号/供应商..."
            value={filters.searchKeyword}
            onChange={(e) => setFilters({ searchKeyword: e.target.value })}
            className="input-field pl-9"
          />
        </div>

        <div>
          <select
            value={filters.supplierId}
            onChange={(e) => setFilters({ supplierId: e.target.value })}
            className="input-field"
          >
            <option value="">全部供应商</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters({ status: e.target.value as any })
            }
            className="input-field"
          >
            <option value="all">全部状态</option>
            <option value="normal">正常</option>
            <option value="pending">待确认</option>
            <option value="anomaly">异常</option>
          </select>
        </div>

        <div>
          <select
            value={filters.anomalyType}
            onChange={(e) =>
              setFilters({ anomalyType: e.target.value as any })
            }
            className="input-field"
          >
            <option value="all">全部异常类型</option>
            <option value="duplicate">重复入账</option>
            <option value="cross_period">手续费跨期</option>
            <option value="pending">退款挂账</option>
            <option value="late_attachment">晚到附件</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.dateRange.start}
            onChange={(e) =>
              setFilters({
                dateRange: { ...filters.dateRange, start: e.target.value },
              })
            }
            className="input-field flex-1"
          />
          <span className="text-text-muted">~</span>
          <input
            type="date"
            value={filters.dateRange.end}
            onChange={(e) =>
              setFilters({
                dateRange: { ...filters.dateRange, end: e.target.value },
              })
            }
            className="input-field flex-1"
          />
        </div>
      </div>
    </div>
  );
}
