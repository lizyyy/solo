import { SummaryPanel } from '@/components/SummaryPanel';
import { StationMap } from '@/components/StationMap';
import { TimeSeriesChart } from '@/components/TimeSeriesChart';
import { LogbookPanel } from '@/components/LogbookPanel';
import { useAppStore } from '@/store/useAppStore';
import { Waves, Activity } from 'lucide-react';

export default function Home() {
  const summary = useAppStore((s) => s.getSummary());
  const setActiveView = useAppStore((s) => s.setActiveView);
  const selectedStationId = useAppStore((s) => s.selectedStationId);
  const stations = useAppStore((s) => s.stations);
  const station = stations.find((s) => s.id === selectedStationId);

  return (
    <div className="mx-auto max-w-[1480px] p-4">
      <header className="mb-3 flex items-center justify-between rounded-xl border border-deepsea-700 bg-deepsea-800/60 px-5 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-status-processed/30 to-deepsea-500/40 ring-1 ring-status-processed/40">
            <Waves size={18} className="text-status-processed" />
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold text-deepsea-50">深海采样时序回放 · 交班工具</h1>
            <p className="text-[11px] text-deepsea-300">
              不用翻船上记录本 — 从汇总一路追到异常记录行
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {station && (
            <span className="hidden items-center gap-1.5 rounded-md bg-deepsea-700/50 px-2.5 py-1.5 text-[11px] text-deepsea-100 ring-1 ring-inset ring-deepsea-600 md:flex">
              <Activity size={12} className="text-status-processed" />
              当前站位 {station.name} · {station.lat.toFixed(4)}°N {station.lon.toFixed(4)}°E · {station.depth}m
            </span>
          )}
          <button onClick={() => setActiveView('report')} className="btn btn-primary">
            进展交代视图 →
          </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-3">
        <aside className="col-span-12 space-y-3 lg:col-span-3">
          <SummaryPanel />
        </aside>

        <main className="col-span-12 space-y-3 lg:col-span-6">
          <StationMap />
          <TimeSeriesChart />
        </main>

        <aside className="col-span-12 lg:col-span-3">
          <LogbookPanel />
        </aside>
      </div>

      <footer className="mt-3 flex items-center justify-between rounded-xl border border-deepsea-700 bg-deepsea-800/40 px-4 py-2 text-[11px] text-deepsea-400">
        <span>值班：老何 · 港口工程师 · 6月17日 06:00–21:00 UTC</span>
        <span>
          已处理 <span className="font-mono text-status-processed">{summary.processed}</span> ·
          待补证据 <span className="font-mono text-status-pending">{summary.pending}</span> ·
          卡着的 <span className="font-mono text-status-blocked">{summary.blocked}</span>
        </span>
      </footer>
    </div>
  );
}
