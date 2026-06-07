import { useState } from 'react';
import { Filter } from 'lucide-react';
import { useInventoryStore } from '@/store/inventoryStore';
import { RecordCard } from '@/components/common/RecordCard';
import type { RecordStatus } from '@/types';

const statusFilters: { value: RecordStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'normal', label: '正常' },
  { value: 'pending_review', label: '待复核' },
  { value: 'supplementary', label: '补录返工' },
  { value: 'completed', label: '已完成' }
];

export function RecordList() {
  const { records } = useInventoryStore();
  const [statusFilter, setStatusFilter] = useState<RecordStatus | 'all'>('all');

  const filteredRecords = statusFilter === 'all' 
    ? records 
    : records.filter(r => r.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-slate-600">
            <Filter className="w-5 h-5" />
            <span className="text-sm font-medium">筛选：</span>
          </div>
          <div className="flex gap-2">
            {statusFilters.map(filter => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${statusFilter === filter.value
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600'}
                `}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-sm text-slate-500">
          共 <span className="font-semibold text-slate-700">{filteredRecords.length}</span> 条记录
        </div>
      </div>

      {filteredRecords.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecords.map(record => (
            <RecordCard key={record.id} record={record} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Filter className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-700 mb-2">暂无记录</h3>
          <p className="text-slate-500">没有找到符合筛选条件的记录</p>
        </div>
      )}
    </div>
  );
}
