import { useState } from 'react';
import { TableState, FilterCondition, SortConfig, GroupConfig } from '../types';
import { TABLE_COLUMNS } from '../data/mockData';

interface FilterPanelProps {
  state: TableState;
  onChange: (state: TableState) => void;
}

const OPERATORS = [
  { value: 'equals', label: '等于' },
  { value: 'contains', label: '包含' },
  { value: 'startsWith', label: '开头是' },
  { value: 'endsWith', label: '结尾是' },
  { value: 'greaterThan', label: '大于' },
  { value: 'lessThan', label: '小于' },
  { value: 'in', label: '在列表中' },
  { value: 'between', label: '范围' },
];

export default function FilterPanel({ state, onChange }: FilterPanelProps) {
  const [newFilter, setNewFilter] = useState<Partial<FilterCondition>>({
    field: TABLE_COLUMNS[0].key,
    operator: 'contains',
    value: '',
  });

  const updateSearch = (value: string) => {
    onChange({ ...state, searchText: value, pagination: { ...state.pagination, page: 1 } });
  };

  const updateSort = (field: string, direction: 'asc' | 'desc' | null) => {
    let sort: SortConfig | null = null;
    if (field && direction) {
      sort = { field, direction };
    }
    onChange({ ...state, sort });
  };

  const updateGroup = (field: string | null) => {
    let groupBy: GroupConfig | null = null;
    if (field) {
      groupBy = { field };
    }
    onChange({ ...state, groupBy });
  };

  const addFilter = () => {
    if (!newFilter.field || !newFilter.operator || newFilter.value === undefined) return;
    
    let value = newFilter.value;
    if (newFilter.operator === 'in' || newFilter.operator === 'between') {
      if (typeof value === 'string') {
        value = value.split(',').map(v => v.trim());
      }
    } else if (newFilter.operator === 'greaterThan' || newFilter.operator === 'lessThan') {
      const num = Number(value);
      if (!Number.isNaN(num)) {
        value = num;
      }
    }
    
    if (newFilter.operator === 'between' && Array.isArray(value)) {
      value = value.map(v => {
        const num = Number(v);
        return Number.isNaN(num) ? v : num;
      });
    }

    const filter: FilterCondition = {
      field: newFilter.field,
      operator: newFilter.operator as FilterCondition['operator'],
      value: value as FilterCondition['value'],
    };

    onChange({
      ...state,
      filters: [...state.filters, filter],
      pagination: { ...state.pagination, page: 1 },
    });
    
    setNewFilter({
      field: TABLE_COLUMNS[0].key,
      operator: 'contains',
      value: '',
    });
  };

  const removeFilter = (index: number) => {
    onChange({
      ...state,
      filters: state.filters.filter((_, i) => i !== index),
      pagination: { ...state.pagination, page: 1 },
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">全局搜索</label>
        <input
          type="text"
          value={state.searchText}
          onChange={(e) => updateSearch(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="输入搜索文本..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">排序字段</label>
          <select
            value={state.sort?.field || ''}
            onChange={(e) => {
              const field = e.target.value;
              if (field) {
                updateSort(field, state.sort?.direction || 'asc');
              } else {
                updateSort('', null);
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">不排序</option>
            {TABLE_COLUMNS.map(col => (
              <option key={col.key} value={col.key}>{col.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">排序方向</label>
          <select
            value={state.sort?.direction || 'asc'}
            onChange={(e) => {
              if (state.sort) {
                updateSort(state.sort.field, e.target.value as 'asc' | 'desc');
              }
            }}
            disabled={!state.sort}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="asc">升序</option>
            <option value="desc">降序</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">分组字段</label>
        <select
          value={state.groupBy?.field || ''}
          onChange={(e) => updateGroup(e.target.value || null)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">不分组</option>
          {TABLE_COLUMNS.map(col => (
            <option key={col.key} value={col.key}>{col.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">筛选条件</label>
        
        {state.filters.length > 0 && (
          <div className="space-y-2 mb-3">
            {state.filters.map((filter, index) => (
              <div key={index} className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded">
                <span className="text-sm">
                  <strong>{TABLE_COLUMNS.find(c => c.key === filter.field)?.label || filter.field}</strong>
                  {' '}
                  {OPERATORS.find(o => o.value === filter.operator)?.label}
                  {' '}
                  "{Array.isArray(filter.value) ? filter.value.join(', ') : filter.value}"
                </span>
                <button
                  onClick={() => removeFilter(index)}
                  className="ml-auto text-red-600 hover:text-red-800"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <select
            value={newFilter.field}
            onChange={(e) => setNewFilter({ ...newFilter, field: e.target.value })}
            className="flex-1 min-w-[120px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TABLE_COLUMNS.map(col => (
              <option key={col.key} value={col.key}>{col.label}</option>
            ))}
          </select>
          <select
            value={newFilter.operator}
            onChange={(e) => setNewFilter({ ...newFilter, operator: e.target.value as FilterCondition['operator'] })}
            className="flex-1 min-w-[120px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {OPERATORS.map(op => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={String(newFilter.value ?? '')}
            onChange={(e) => setNewFilter({ ...newFilter, value: e.target.value })}
            placeholder={newFilter.operator === 'in' || newFilter.operator === 'between' ? '用逗号分隔' : '值'}
            className="flex-1 min-w-[150px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addFilter}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            添加
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">每页条数</label>
          <select
            value={state.pagination.pageSize}
            onChange={(e) => onChange({
              ...state,
              pagination: { page: 1, pageSize: Number(e.target.value) }
            })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
    </div>
  );
}
