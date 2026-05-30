import { useValuationStore } from '../store/useValuationStore';
import { KPICard } from '../components/dashboard/KPICard';
import { ValuationTrendChart } from '../components/dashboard/ValuationTrendChart';
import { ShareDistributionChart } from '../components/dashboard/ShareDistributionChart';
import { AnomalySummary } from '../components/dashboard/AnomalySummary';
import { Wallet, AlertCircle, Clock, CheckCircle2, FileX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatLargeNumber } from '../utils/formatters';
import { useShallow } from 'zustand/react/shallow';

export function Dashboard() {
  const navigate = useNavigate();
  const { getStats, setFilters } = useValuationStore(useShallow((state) => ({
    getStats: state.getStats,
    setFilters: state.setFilters,
  })));
  const stats = getStats();
  
  const handlePendingClick = () => {
    setFilters({ statuses: ['pending'], fundIds: [], hasAnomaly: null });
    navigate('/workbench');
  };
  
  const handleAnomalyClick = () => {
    setFilters({ statuses: ['anomaly'], fundIds: [], hasAnomaly: null });
    navigate('/workbench');
  };
  
  const handleReturnedClick = () => {
    setFilters({ statuses: ['returned'], fundIds: [], hasAnomaly: null });
    navigate('/workbench');
  };
  
  const handleProcessedClick = () => {
    setFilters({ statuses: ['processed'], fundIds: [], hasAnomaly: null });
    navigate('/records');
  };
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-slate-800">估值概览</h2>
          <p className="text-sm text-slate-500 mt-1">查看私募基金侧袋估值整体情况</p>
        </div>
        <div className="text-sm text-slate-500">
          数据更新时间: {new Date().toLocaleString('zh-CN')}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="基金总数"
          value={stats.totalFunds}
          subtitle="只"
          icon={Wallet}
          color="navy"
          delay={50}
        />
        <KPICard
          title="估值总额"
          value={`¥${formatLargeNumber(stats.totalValuation)}`}
          subtitle="最新估值日"
          trend={2.3}
          icon={Wallet}
          color="sky"
          delay={100}
        />
        <KPICard
          title="待确认"
          value={stats.pendingCount}
          subtitle="条记录"
          icon={Clock}
          color="amber"
          delay={150}
          onClick={handlePendingClick}
        />
        <KPICard
          title="异常"
          value={stats.anomalyCount}
          subtitle="条记录"
          icon={AlertCircle}
          color="rose"
          delay={200}
          onClick={handleAnomalyClick}
        />
        <KPICard
          title="已处理"
          value={stats.processedCount}
          subtitle="条记录"
          icon={CheckCircle2}
          color="emerald"
          delay={250}
          onClick={handleProcessedClick}
        />
      </div>
      
      <AnomalySummary />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ValuationTrendChart />
        </div>
        <div className="lg:col-span-1">
          <ShareDistributionChart />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 opacity-0 animate-fade-in-up animate-delay-250 [animation-fill-mode:forwards]">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <h4 className="font-medium text-slate-800">待确认记录</h4>
          </div>
          <p className="text-3xl font-bold font-mono text-amber-600 mb-3">{stats.pendingCount}</p>
          <button
            onClick={handlePendingClick}
            className="w-full py-2 px-4 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors btn-click"
          >
            立即处理
          </button>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 p-5 opacity-0 animate-fade-in-up animate-delay-300 [animation-fill-mode:forwards]">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-rose-100">
              <FileX className="w-5 h-5 text-rose-600" />
            </div>
            <h4 className="font-medium text-slate-800">退回补材料</h4>
          </div>
          <p className="text-3xl font-bold font-mono text-rose-600 mb-3">{stats.returnedCount}</p>
          <button
            onClick={handleReturnedClick}
            className="w-full py-2 px-4 bg-rose-500 text-white text-sm font-medium rounded-lg hover:bg-rose-600 transition-colors btn-click"
          >
            查看详情
          </button>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 p-5 opacity-0 animate-fade-in-up animate-delay-350 [animation-fill-mode:forwards]">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-emerald-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <h4 className="font-medium text-slate-800">已处理完成</h4>
          </div>
          <p className="text-3xl font-bold font-mono text-emerald-600 mb-3">{stats.processedCount}</p>
          <button
            onClick={handleProcessedClick}
            className="w-full py-2 px-4 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors btn-click"
          >
            查看历史
          </button>
        </div>
      </div>
    </div>
  );
}
