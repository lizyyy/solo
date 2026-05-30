import React, { useMemo } from 'react';
import { Input, Select, DatePicker, Button, Tag } from 'antd';
import { Search, X, Filter } from 'lucide-react';
import { useFilterStore } from '@/store';
import { COUNTERPARTIES, CURRENCIES } from '@/utils/constants';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

const FilterBar: React.FC = () => {
  const filters = useFilterStore();

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.contractNo) count++;
    if (filters.counterparty) count++;
    if (filters.currency) count++;
    if (filters.dateRange) count++;
    if (filters.status.length > 0) count++;
    return count;
  }, [filters]);

  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      filters.setFilter('dateRange', [dates[0].toDate(), dates[1].toDate()]);
    } else {
      filters.setFilter('dateRange', null);
    }
  };

  const handleReset = () => {
    filters.resetFilters();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Filter size={18} className="text-primary-700" />
        <span className="font-semibold text-gray-700">筛选条件</span>
        {activeFilterCount > 0 && (
          <Tag color="primary">{activeFilterCount} 个筛选条件</Tag>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1.5">合约编号</label>
          <Input
            placeholder="请输入合约编号"
            prefix={<Search size={14} />}
            value={filters.contractNo}
            onChange={(e) => filters.setFilter('contractNo', e.target.value)}
            allowClear
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1.5">交易对手</label>
          <Select
            placeholder="请选择交易对手"
            value={filters.counterparty || undefined}
            onChange={(value) => filters.setFilter('counterparty', value)}
            allowClear
            style={{ width: '100%' }}
            options={COUNTERPARTIES.map((c) => ({ label: c, value: c }))}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1.5">币种</label>
          <Select
            placeholder="请选择币种"
            value={filters.currency || undefined}
            onChange={(value) => filters.setFilter('currency', value)}
            allowClear
            style={{ width: '100%' }}
            options={CURRENCIES.map((c) => ({ label: c, value: c }))}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1.5">交易日期</label>
          <RangePicker
            style={{ width: '100%' }}
            value={
              filters.dateRange
                ? [dayjs(filters.dateRange[0]), dayjs(filters.dateRange[1])]
                : null
            }
            onChange={handleDateChange}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1.5">异常状态</label>
          <Select
            mode="multiple"
            placeholder="请选择异常状态"
            value={filters.status}
            onChange={(value) => filters.setFilter('status', value)}
            allowClear
            style={{ width: '100%' }}
            options={[
              { label: '错误', value: 'error' },
              { label: '警告', value: 'warning' },
              { label: '提示', value: 'info' },
            ]}
          />
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100">
          <span className="text-sm text-gray-500">已选条件：</span>
          {filters.contractNo && (
            <Tag
              closable
              onClose={() => filters.setFilter('contractNo', '')}
              color="blue"
            >
              合约编号：{filters.contractNo}
            </Tag>
          )}
          {filters.counterparty && (
            <Tag
              closable
              onClose={() => filters.setFilter('counterparty', '')}
              color="blue"
            >
              交易对手：{filters.counterparty}
            </Tag>
          )}
          {filters.currency && (
            <Tag
              closable
              onClose={() => filters.setFilter('currency', '')}
              color="blue"
            >
              币种：{filters.currency}
            </Tag>
          )}
          {filters.dateRange && (
            <Tag
              closable
              onClose={() => filters.setFilter('dateRange', null)}
              color="blue"
            >
              日期：{dayjs(filters.dateRange[0]).format('YYYY-MM-DD')} ~{' '}
              {dayjs(filters.dateRange[1]).format('YYYY-MM-DD')}
            </Tag>
          )}
          {filters.status.length > 0 && (
            <Tag
              closable
              onClose={() => filters.setFilter('status', [])}
              color="blue"
            >
              状态：{filters.status.join(', ')}
            </Tag>
          )}
          <Button
            size="small"
            type="text"
            icon={<X size={14} />}
            onClick={handleReset}
            className="ml-auto text-gray-500 hover:text-gray-700"
          >
            重置全部
          </Button>
        </div>
      )}
    </div>
  );
};

export default FilterBar;
