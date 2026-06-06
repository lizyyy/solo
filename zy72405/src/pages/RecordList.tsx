import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { RecordCard } from '@/components/RecordCard';
import { StatusBadge } from '@/components/StatusBadge';
import { RecordStatus } from '@/types';
import { Filter, ListTodo, AlertTriangle, CheckCircle, Clock, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

const statusFilters: { value: RecordStatus | 'all' | 'boundary'; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: '全部', icon: <ListTodo className="w-4 h-4" /> },
  { value: 'pending', label: '待处理', icon: <Clock className="w-4 h-4" /> },
  { value: 'alias_mapped', label: '已匹配别名', icon: <CheckCircle className="w-4 h-4" /> },
  { value: 'review_needed', label: '待巡演统筹复核', icon: <AlertTriangle className="w-4 h-4" /> },
  { value: 'confirmed', label: '已确认', icon: <CheckCircle className="w-4 h-4" /> },
  { value: 'reviewed', label: '已复核', icon: <Eye className="w-4 h-4" /> },
  { value: 'boundary', label: '边界场景', icon: <AlertTriangle className="w-4 h-4" /> },
];

export function RecordList() {
  const records = useStore(state => state.records);
  const [statusFilter, setStatusFilter] = useState<RecordStatus | 'all' | 'boundary'>('all');

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'boundary') return r.isBoundaryCase;
      return r.status === statusFilter;
    });
  }, [records, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: records.length,
      pending: records.filter(r => r.status === 'pending').length,
      reviewNeeded: records.filter(r => r.status === 'review_needed').length,
      confirmed: records.filter(r => r.status === 'confirmed' || r.status === 'reviewed').length,
      boundary: records.filter(r => r.isBoundaryCase).length,
    };
  }, [records]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800 mb-1">黑胶预售缺货提醒</h1>
        <p className="text-stone-500 text-sm">合同页截图证据链完整，每一步改动可追溯</p>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-sm">
          <div className="text-2xl font-bold text-stone-800">{stats.total}</div>
          <div className="text-sm text-stone-500">总记录数</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-sm">
          <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
          <div className="text-sm text-stone-500">待处理</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-red-200 shadow-sm">
          <div className="text-2xl font-bold text-red-600">{stats.reviewNeeded}</div>
          <div className="text-sm text-stone-500">待巡演统筹复核</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-sm">
          <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
          <div className="text-sm text-stone-500">已确认/已复核</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-red-200 shadow-sm">
          <div className="text-2xl font-bold text-red-600">{stats.boundary}</div>
          <div className="text-sm text-stone-500">边界场景</div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Filter className="w-4 h-4 text-stone-400" />
        {statusFilters.map(filter => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              statusFilter === filter.value
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            {filter.icon}
            {filter.label}
          </button>
        ))}
      </div>

      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-stone-200 text-center">
          <ListTodo className="w-12 h-12 mx-auto text-stone-300 mb-3" />
          <p className="text-stone-500">暂无符合条件的记录</p>
          <Link
            to="/import"
            className="inline-block mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
          >
            导入合同页截图
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map(record => (
            <RecordCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}
