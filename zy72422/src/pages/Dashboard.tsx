import { useState, useEffect } from 'react';
import { Filter, Plus, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRoyaltyStore } from '../store/useRoyaltyStore';
import RecordCard from '../components/RecordCard';
import StatusBadge from '../components/StatusBadge';
import type { RecordStatus } from '../types';

const statusFilters: { value: RecordStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '处理中' },
  { value: 'normal', label: '正常' },
  { value: 'review', label: '待复核' },
  { value: 'completed', label: '已完成' },
];

export default function Dashboard() {
  const { records, initData } = useRoyaltyStore();
  const [statusFilter, setStatusFilter] = useState<RecordStatus | 'all'>('all');

  useEffect(() => {
    initData();
  }, [initData]);

  const filteredRecords = statusFilter === 'all'
    ? records
    : records.filter(r => r.status === statusFilter);

  const stats = {
    total: records.length,
    review: records.filter(r => r.status === 'review').length,
    completed: records.filter(r => r.status === 'completed').length,
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-primary-800">分账看板</h1>
          <p className="text-primary-500 mt-1">管理所有唱片店寄售分账记录</p>
        </div>
        <Link
          to="/import"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-700 hover:bg-primary-600 text-white rounded-lg transition-colors shadow-sm"
        >
          <Upload className="w-4 h-4" />
          导入合同
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-card border border-primary-100">
          <div className="text-sm text-primary-500 mb-1">总记录数</div>
          <div className="text-3xl font-serif font-semibold text-primary-800">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-card border border-primary-100">
          <div className="text-sm text-primary-500 mb-1">待复核</div>
          <div className="text-3xl font-serif font-semibold text-accent-warning">{stats.review}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-card border border-primary-100">
          <div className="text-sm text-primary-500 mb-1">已完成</div>
          <div className="text-3xl font-serif font-semibold text-accent-success">{stats.completed}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card border border-primary-100 mb-6">
        <div className="p-4 border-b border-primary-100 flex items-center gap-4">
          <Filter className="w-4 h-4 text-primary-400" />
          <div className="flex gap-2 flex-wrap">
            {statusFilters.map(filter => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === filter.value
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-primary-500 hover:bg-primary-50'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredRecords.map((record, index) => (
          <div key={record.id} style={{ animationDelay: `${index * 0.05}s` }} className="animate-slide-up">
            <RecordCard record={record} />
          </div>
        ))}
      </div>

      {filteredRecords.length === 0 && (
        <div className="text-center py-16">
          <div className="text-primary-300 text-6xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-primary-600 mb-2">暂无分账记录</h3>
          <p className="text-primary-400 mb-4">点击"导入合同"开始创建第一条分账记录</p>
        </div>
      )}
    </div>
  );
}
