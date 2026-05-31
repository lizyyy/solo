import React from 'react';
import type { QueryFilters, RecordStatus, RecordSource } from '../types';
import { STATUS_LABELS, SOURCE_LABELS } from '../types';

interface FilterPanelProps {
  filters: QueryFilters;
  onChange: (filters: QueryFilters) => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ filters, onChange }) => {
  const handleChange = (key: keyof QueryFilters, value: any) => {
    if (value === '' || value === undefined || value === null) {
      const { [key]: _, ...rest } = filters;
      onChange(rest);
    } else {
      onChange({ ...filters, [key]: value });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
          <select
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
            value={filters.status || ''}
            onChange={(e) => handleChange('status', e.target.value as RecordStatus || undefined)}
          >
            <option value="">全部状态</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">来源</label>
          <select
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
            value={filters.source || ''}
            onChange={(e) => handleChange('source', e.target.value as RecordSource || undefined)}
          >
            <option value="">全部来源</option>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">保证函编号</label>
          <input
            type="text"
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
            value={filters.guaranteeNo || ''}
            onChange={(e) => handleChange('guaranteeNo', e.target.value)}
            placeholder="搜索保证函编号"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">客户名称</label>
          <input
            type="text"
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
            value={filters.customerName || ''}
            onChange={(e) => handleChange('customerName', e.target.value)}
            placeholder="搜索客户名称"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">是否重复</label>
          <select
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
            value={filters.isDuplicate === undefined ? '' : String(filters.isDuplicate)}
            onChange={(e) => handleChange('isDuplicate', e.target.value === '' ? undefined : e.target.value === 'true')}
          >
            <option value="">全部</option>
            <option value="true">是（疑似重复）</option>
            <option value="false">否</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
          <input
            type="date"
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
            value={filters.startDate || ''}
            onChange={(e) => handleChange('startDate', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
          <input
            type="date"
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
            value={filters.endDate || ''}
            onChange={(e) => handleChange('endDate', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">处理人</label>
          <input
            type="text"
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
            value={filters.currentOperator || ''}
            onChange={(e) => handleChange('currentOperator', e.target.value)}
            placeholder="当前处理人"
          />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
          onClick={() => onChange({})}
        >
          重置筛选
        </button>
      </div>
    </div>
  );
};
