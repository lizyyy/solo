import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { RecordStatus, statusLabels } from '../types';
import StatusBadge from '../components/StatusBadge';
import { Clock, User, AlertCircle, ChevronRight, Filter } from 'lucide-react';

const RecordList = () => {
  const { records, currentFilter, setFilter } = useStore();

  const filteredRecords = useMemo(() => {
    if (currentFilter === 'all') return records;
    return records.filter((r) => r.status === currentFilter);
  }, [records, currentFilter]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const stats = useMemo(() => {
    return {
      total: records.length,
      pending: records.filter((r) => r.status === 'pending').length,
      completed: records.filter((r) => r.status === 'completed').length,
      materialOnly: records.filter((r) => r.status === 'material_only').length,
      conclusionChanged: records.filter((r) => r.status === 'conclusion_changed').length,
    };
  }, [records]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary-800 font-serif">
            复核记录
          </h2>
          <p className="text-slate-500 mt-1">
            共 {stats.total} 条记录，{stats.pending} 条待处理
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="全部" value={stats.total} color="primary" />
        <StatCard label="待处理" value={stats.pending} color="amber" />
        <StatCard label="补材料" value={stats.materialOnly} color="blue" />
        <StatCard label="改结论" value={stats.conclusionChanged} color="red" />
      </div>

      <div className="bg-white rounded-xl shadow-card p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-primary-600" />
          <span className="font-medium text-slate-700">筛选状态</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'pending', 'completed', 'material_only', 'conclusion_changed'] as const).map(
            (filter) => (
              <button
              key={filter}
              onClick={() => setFilter(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                currentFilter === filter
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {statusLabels[filter]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredRecords.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>暂无符合条件的记录</p>
          </div>
        ) : (
          filteredRecords.map((record) => (
            <Link
              key={record.id}
              to={`/record/${record.id}`}
              className="block"
            >
              <div className="card cursor-pointer group">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-semibold text-slate-800 group-hover:text-primary-700 transition-colors">
                        {record.source}
                      </h3>
                      <StatusBadge status={record.status} />
                    </div>
                    <p className="text-sm text-slate-500">
                      题目ID: {record.questionBankData.questionId}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
                </div>
                
                <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                  <div className="flex items-center space-x-1">
                    <User className="w-4 h-4" />
                    <span>{record.reviewer}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-medium">
                      {record.currentDifficulty}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>{formatDate(record.updatedAt)}</span>
                  </div>
                </div>

                {record.pendingReason && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                      <p className="text-sm text-amber-800">
                        {record.pendingReason}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: number;
  color: 'primary' | 'amber' | 'blue' | 'red' | 'green';
}

const StatCard = ({ label, value, color }: StatCardProps) => {
  const colorClasses: Record<string, string> = {
    primary: 'from-primary-500 to-primary-700',
    amber: 'from-amber-500 to-amber-600',
    blue: 'from-blue-500 to-blue-600',
    red: 'from-red-500 to-red-600',
    green: 'from-green-500 to-green-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-card p-4">
      <div className={`text-2xl font-bold text-slate-800">
        <span className={`bg-gradient-to-r ${colorClasses[color]} bg-clip-text text-transparent`}>
          {value}
        </span>
      </div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
};

export default RecordList;
