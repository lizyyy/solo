import { useEffect } from 'react';
import { Scene3D } from '@/components/Scene3D';
import { FilterPanel } from '@/components/FilterPanel';
import { Sidebar } from '@/components/Sidebar';
import { Timeline } from '@/components/Timeline';
import { ExportButton } from '@/components/ExportButton';
import { useAppStore } from '@/store/useAppStore';
import { AlertTriangle, Volume2, Box } from 'lucide-react';

export default function Home() {
  const init = useAppStore(s => s.init);
  const points = useAppStore(s => s.points);
  const filterSummary = useAppStore(s => s.filterSummary);
  const conflicts = useAppStore(s => s.conflicts);
  const selectedPointId = useAppStore(s => s.selectedPointId);
  const selectPoint = useAppStore(s => s.selectPoint);

  useEffect(() => {
    init();
  }, [init]);

  const anomalyCount = points.filter(
    p => p.status !== 'normal' && p.status !== 'warning'
  ).length;
  const chamberCount = points.filter(p => p.isReflectionChamber).length;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0f1a] overflow-hidden">
      <header className="h-12 flex items-center justify-between px-4 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Box size={18} className="text-amber-500" />
            <h1 className="text-sm font-bold text-slate-200 tracking-wide">
              音乐厅声线反射舱
            </h1>
          </div>
          <span className="text-xs text-slate-500 font-serif-cn">巡检系统</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-amber-400">
              <Volume2 size={12} />
              <span>{chamberCount} 反射舱</span>
            </div>
            {anomalyCount > 0 && (
              <div className="flex items-center gap-1.5 text-red-400">
                <AlertTriangle size={12} />
                <span>{anomalyCount} 异常</span>
              </div>
            )}
            {conflicts.length > 0 && (
              <div className="flex items-center gap-1.5 text-orange-400">
                <AlertTriangle size={12} />
                <span>{conflicts.length} 冲突</span>
              </div>
            )}
          </div>

          <div className="text-xs text-slate-600 hidden lg:block max-w-[200px] truncate">
            筛选: {filterSummary}
          </div>

          <ExportButton />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative" data-scene-container>
          <Scene3D />

          <div
            className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-xl p-4 w-64 max-h-[calc(100%-100px)] overflow-y-auto custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <FilterPanel />
          </div>

          {selectedPointId && (
            <button
              onClick={() => selectPoint(null)}
              className="absolute top-3 right-3 bg-slate-800/90 backdrop-blur border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              取消选中
            </button>
          )}
        </div>

        <div className="w-80 shrink-0">
          <Sidebar />
        </div>
      </div>

      <div className="h-14 border-t border-slate-700/50 bg-slate-900/80 backdrop-blur shrink-0">
        <Timeline />
      </div>
    </div>
  );
}
