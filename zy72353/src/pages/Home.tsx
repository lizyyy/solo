import { useState } from 'react';
import { Thermometer, AlertTriangle, Clock, CheckCircle, Filter } from 'lucide-react';
import { useThresholdStore } from '../store/thresholdStore';
import StatsCard from '../components/StatsCard';
import ImportPanel from '../components/ImportPanel';
import ThresholdList from '../components/ThresholdList';

type FilterType = 'all' | 'unitMix' | 'pending' | 'approved';

const Home = () => {
  const { thresholds, currentRole } = useThresholdStore();
  const [filter, setFilter] = useState<FilterType>('all');

  const stats = {
    total: thresholds.length,
    unitMix: thresholds.filter((t) => t.hasUnitMix).length,
    pending: thresholds.filter((t) => t.status === 'pending' || t.status === 'reviewing').length,
    approved: thresholds.filter((t) => t.status === 'approved').length,
  };

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: stats.total },
    { key: 'unitMix', label: '单位混用', count: stats.unitMix },
    { key: 'pending', label: '待处理', count: stats.pending },
    { key: 'approved', label: '已通过', count: stats.approved },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">阈值数据概览</h1>
          <p className="text-industrial-300">
            当前角色：<span className="text-primary-400 font-medium">{currentRole === 'engineer' ? '设备工程师 何工' : '训练教练'}</span>
          </p>
        </div>
        <ImportPanel />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatsCard
          title="阈值总数"
          value={stats.total}
          icon={Thermometer}
          color="primary"
        />
        <StatsCard
          title="单位混用异常"
          value={stats.unitMix}
          icon={AlertTriangle}
          color="warning"
          trend="需要复核"
          trendUp={false}
        />
        <StatsCard
          title="待处理"
          value={stats.pending}
          icon={Clock}
          color="primary"
        />
        <StatsCard
          title="已通过"
          value={stats.approved}
          icon={CheckCircle}
          color="success"
        />
      </div>

      <div className="bg-industrial-600 rounded-xl border border-industrial-500">
        <div className="flex items-center gap-2 p-4 border-b border-industrial-500">
          <Filter className="w-5 h-5 text-industrial-300" />
          <span className="text-industrial-200 font-medium">筛选：</span>
          <div className="flex gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  filter === f.key
                    ? 'bg-primary-500 text-white'
                    : 'bg-industrial-700 text-industrial-300 hover:bg-industrial-500'
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>
        </div>

        <ThresholdList filter={filter} />
      </div>
    </div>
  );
};

export default Home;
