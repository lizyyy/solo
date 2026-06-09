import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Thermometer,
  AlertTriangle,
  Clock,
  CheckCircle,
  Filter,
  RefreshCw,
  Trash2,
  List,
  Package,
  User,
} from 'lucide-react';
import { useThresholdStore } from '../store/thresholdStore';
import StatsCard from '../components/StatsCard';
import ImportPanel from '../components/ImportPanel';
import ThresholdList from '../components/ThresholdList';
import BatchHistory from '../components/BatchHistory';
import { cn } from '../lib/utils';

type FilterType = 'all' | 'unitMix' | 'pending' | 'approved';
type TabType = 'thresholds' | 'batches';

const Home = () => {
  const navigate = useNavigate();
  const {
    thresholds,
    currentRole,
    setCurrentRole,
    loadPersisted,
    resetState,
    batches,
  } = useThresholdStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [activeTab, setActiveTab] = useState<TabType>('thresholds');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'warning' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'warning' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

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

  const handleRefresh = () => {
    loadPersisted();
    showToast('已从本地存储重新加载数据', 'success');
  };

  const handleReset = () => {
    const ok = window.confirm(
      '⚠️ 确定要清空所有数据并重置到初始状态吗？此操作不可撤销！'
    );
    if (ok) {
      resetState();
      showToast('所有数据已重置', 'warning');
    }
  };

  const handleRoleSwitch = (role: 'engineer' | 'coach') => {
    setCurrentRole(role);
    showToast(`已切换到${role === 'engineer' ? '设备工程师 何工' : '训练教练'}`, 'success');
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={cn(
            'fixed top-6 right-6 z-50 px-5 py-3 rounded-lg shadow-xl border animate-pulse',
            toast.type === 'success'
              ? 'bg-success-500/20 text-success-400 border-success-500/30'
              : 'bg-warning-500/20 text-warning-400 border-warning-500/30'
          )}
        >
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">阈值数据概览</h1>
          <div className="flex items-center gap-4">
            <p className="text-industrial-300">
              当前角色：
              <span className="text-primary-400 font-medium">
                {currentRole === 'engineer' ? '设备工程师 何工' : '训练教练'}
              </span>
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => handleRoleSwitch('engineer')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all',
                  currentRole === 'engineer'
                    ? 'bg-primary-500 text-white'
                    : 'bg-industrial-700 text-industrial-400 hover:bg-industrial-500 hover:text-white'
                )}
              >
                <User className="w-3 h-3" />
                何工
              </button>
              <button
                onClick={() => handleRoleSwitch('coach')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all',
                  currentRole === 'coach'
                    ? 'bg-success-500 text-white'
                    : 'bg-industrial-700 text-industrial-400 hover:bg-industrial-500 hover:text-white'
                )}
              >
                <User className="w-3 h-3" />
                训练教练
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-2 bg-industrial-700 hover:bg-industrial-500 text-white rounded-lg text-sm transition-colors"
            title="从本地存储重新加载"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg text-sm transition-colors"
            title="清空所有数据并重置"
          >
            <Trash2 className="w-4 h-4" />
            重置数据
          </button>
          <ImportPanel />
        </div>
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
        <div className="border-b border-industrial-500">
          <div className="flex items-center">
            <button
              onClick={() => setActiveTab('thresholds')}
              className={cn(
                'flex items-center gap-2 px-6 py-4 font-medium text-sm transition-all border-b-2',
                activeTab === 'thresholds'
                  ? 'text-white border-primary-500 bg-industrial-700/30'
                  : 'text-industrial-400 border-transparent hover:text-white hover:bg-industrial-700/20'
              )}
            >
              <List className="w-4 h-4" />
              阈值列表
            </button>
            <button
              onClick={() => setActiveTab('batches')}
              className={cn(
                'flex items-center gap-2 px-6 py-4 font-medium text-sm transition-all border-b-2',
                activeTab === 'batches'
                  ? 'text-white border-primary-500 bg-industrial-700/30'
                  : 'text-industrial-400 border-transparent hover:text-white hover:bg-industrial-700/20'
              )}
            >
              <Package className="w-4 h-4" />
              导入批次
              <span className="text-xs bg-industrial-700 text-industrial-300 px-2 py-0.5 rounded-full">
                {batches.length}
              </span>
            </button>
          </div>
        </div>

        {activeTab === 'thresholds' ? (
          <>
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
          </>
        ) : (
          <div className="p-5">
            <BatchHistory
              onSelectThresholdId={(id) => navigate(`/threshold/${id}`)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
