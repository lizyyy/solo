import { useState } from 'react';
import { Filter, ListChecks } from 'lucide-react';
import { RecordCard } from '@/components/RecordCard';
import { useRecordStore } from '@/store/recordStore';
import type { RecordStatus } from '@/types';

const statusFilters: { value: RecordStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending_review', label: '待策略产品复核' },
  { value: 'conflict', label: '有冲突' },
  { value: 'normal', label: '正常' },
  { value: 'completed', label: '已完成' },
];

export default function RecordList() {
  const { records } = useRecordStore();
  const [statusFilter, setStatusFilter] = useState<RecordStatus | 'all'>('all');

  const filteredRecords = statusFilter === 'all'
    ? records
    : records.filter((r) => r.status === statusFilter);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-600 flex items-center justify-center">
              <ListChecks className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 font-serif">批流特征一致性检查</h1>
              <p className="text-sm text-slate-500 mt-0.5">追踪特征版本变更，确保批流数据训练结果一致</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">按状态筛选</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`px-4 py-2 text-sm font-medium border-2 transition-colors ${
                  statusFilter === filter.value
                    ? 'bg-teal-600 text-white border-teal-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-teal-300 hover:text-teal-700'
                }`}
              >
                {filter.label}
                <span className="ml-2 opacity-70">
                  ({filter.value === 'all' ? records.length : records.filter((r) => r.status === filter.value).length})
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRecords.map((record) => (
            <RecordCard key={record.id} record={record} />
          ))}
        </div>

        {filteredRecords.length === 0 && (
          <div className="text-center py-16">
            <p className="text-slate-500">暂无符合条件的记录</p>
          </div>
        )}

        <div className="mt-8 p-4 bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800">
            <strong>样例说明：</strong>系统内置三条典型记录，分别代表「顺利记录」「重复训练记录」「旧口径补录记录」三种场景。点击卡片进入详情查看完整证据链。
          </p>
        </div>
      </main>
    </div>
  );
}
