import { Input, Select, DatePicker, Button, Space, Tag } from 'antd';
import { Search, RefreshCw, Filter } from 'lucide-react';
import type { ReportFilters, ReportStatus } from '@/types';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

interface FilterBarProps {
  filters: ReportFilters;
  onChange: (filters: Partial<ReportFilters>) => void;
  onReset: () => void;
  seaAreas: string[];
  abnormalCount: number;
}

const statusOptions: { label: string; value: ReportStatus | '' }[] = [
  { label: '全部状态', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '部分完成', value: 'partial' },
  { label: '已完成', value: 'complete' },
  { label: '异常', value: 'abnormal' },
];

export default function FilterBar({
  filters,
  onChange,
  onReset,
  seaAreas,
  abnormalCount,
}: FilterBarProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-700">筛选条件</span>
        {filters.onlyAbnormal && (
          <Tag color="orange" className="ml-2">
          仅看异常 ({abnormalCount})
          </Tag>
        )}
      </div>
      <Space wrap size="middle">
        <Input
          placeholder="搜索报告编号..."
          prefix={<Search className="w-4 h-4 text-slate-400" />}
          value={filters.keyword}
          onChange={(e) => onChange({ keyword: e.target.value })}
          style={{ width: 200 }}
          allowClear
        />

        <Select
          placeholder="选择海区"
          value={filters.seaArea || undefined}
          onChange={(value) => onChange({ seaArea: value || '' })}
          style={{ width: 150 }}
          allowClear
        >
          {seaAreas.map((area) => (
            <Select.Option key={area} value={area}>
              {area}
            </Select.Option>
          ))}
        </Select>

        <Select
          placeholder="报告状态"
          value={filters.status || undefined}
          onChange={(value) => onChange({ status: (value as ReportStatus) || '' })}
          style={{ width: 140 }}
          allowClear
        >
          {statusOptions.map((opt) => (
            <Select.Option key={opt.value} value={opt.value}>
              {opt.label}
            </Select.Option>
          ))}
        </Select>

        <RangePicker
          placeholder={['开始日期', '结束日期']}
          value={
            filters.dateRange
              ? [dayjs(filters.dateRange[0]), dayjs(filters.dateRange[1])]
              : null
          }
          onChange={(dates) => {
            if (dates && dates[0] && dates[1]) {
              onChange({
                dateRange: [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')],
              });
            } else {
              onChange({ dateRange: null });
            }
          }}
          style={{ width: 280 }}
        />

        <Button
          type={filters.onlyAbnormal ? 'primary' : 'default'}
          danger={filters.onlyAbnormal}
          onClick={() => onChange({ onlyAbnormal: !filters.onlyAbnormal })}
        >
          {filters.onlyAbnormal ? '显示全部' : '仅看异常'}
        </Button>

        <Button icon={<RefreshCw className="w-4 h-4" />} onClick={onReset}>
          重置筛选
        </Button>
      </Space>
    </div>
  );
}
