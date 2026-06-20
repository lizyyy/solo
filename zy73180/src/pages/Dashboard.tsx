import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import StatsOverview from '@/components/anomaly/StatsOverview';
import FilterBar from '@/components/anomaly/FilterBar';
import AnomalyList from '@/components/anomaly/AnomalyList';
import AnomalyDetailDrawer from '@/components/anomaly/AnomalyDetailDrawer';
import { AlertTriangle, Sparkles } from 'lucide-react';

export default function Dashboard() {
  const initDefault = useAppStore(s => s.initDefault);
  const currentRun = useAppStore(s => s.currentRun);
  const selectedAnomalyId = useAppStore(s => s.selectedAnomalyId);

  useEffect(() => {
    if (!currentRun) {
      initDefault();
    }
  }, [currentRun, initDefault]);

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-ink-200 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-md bg-amber-50 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <h1 className="font-serif text-xl font-bold text-ink-900">异常队列看板</h1>
            </div>
            <p className="text-sm text-ink-400">
              边界样本、单位问题、坏数据一目了然 · 可直接拿去沟通
            </p>
          </div>

          {currentRun && (
            <div className="flex items-center gap-2 text-xs text-ink-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>验算于 {new Date(currentRun.createdAt).toLocaleString('zh-CN')}</span>
            </div>
          )}
        </div>
      </header>

      <div className="p-8 space-y-4 max-w-[1200px]">
        <StatsOverview />
        <FilterBar />

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-ink-700">
              异常记录
              <span className="text-ink-400 font-normal ml-2 text-xs">
                点击查看处理建议与原始记录
              </span>
            </h2>
          </div>
          <AnomalyList />
        </div>
      </div>

      {selectedAnomalyId && <AnomalyDetailDrawer />}
    </div>
  );
}
