import { Search, X } from 'lucide-react';
import type { ApplicationFilters, ApplicationStatus, Supplier } from '../types';
import { STATUS_LABELS } from '../types';

interface FilterPanelProps {
  filters: ApplicationFilters;
  suppliers: Supplier[];
  onFilterChange: (filters: Partial<ApplicationFilters>) => void;
  onClear: () => void;
}

export function FilterPanel({
  filters,
  suppliers,
  onFilterChange,
  onClear,
}: FilterPanelProps) {
  const statuses = Object.keys(STATUS_LABELS) as ApplicationStatus[];
  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined && v !== '');

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-700">筛选条件</h3>
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <X size={14} />
            清除筛选
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">关键词搜索</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filters.keyword || ''}
              onChange={(e) => onFilterChange({ keyword: e.target.value || undefined })}
              placeholder="申请编号 / 供应商名称"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">供应商</label>
          <select
            value={filters.supplierId || ''}
            onChange={(e) => onFilterChange({ supplierId: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
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
          <label className="block text-sm text-gray-600 mb-1">审批状态</label>
          <select
            value={filters.status || ''}
            onChange={(e) =>
              onFilterChange({ status: (e.target.value as ApplicationStatus) || undefined })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="">全部状态</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">折扣率范围 (%)</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              value={filters.minDiscountRate ? filters.minDiscountRate * 100 : ''}
              onChange={(e) =>
                onFilterChange({
                  minDiscountRate: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                })
              }
              placeholder="最低"
              className="w-1/2 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <input
              type="number"
              step="0.1"
              value={filters.maxDiscountRate ? filters.maxDiscountRate * 100 : ''}
              onChange={(e) =>
                onFilterChange({
                  maxDiscountRate: e.target.value ? parseFloat(e.target.value) / 100 : undefined,
                })
              }
              placeholder="最高"
              className="w-1/2 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">创建日期起</label>
          <input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => onFilterChange({ startDate: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">创建日期止</label>
          <input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => onFilterChange({ endDate: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
      </div>
    </div>
  );
}
