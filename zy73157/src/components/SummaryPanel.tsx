import { useAppStore } from '@/store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { CheckCircle2, Clock, AlertOctagon, AlertTriangle, Ban, Wind } from 'lucide-react';

export function SummaryPanel() {
  const {
    processed, pending, blocked,
    anomalies, withdrawn, driftEvents: _driftCount,
    setActiveView, setSelectedAnomaly, setSelectedStation, stations,
    driftEvents,
  } = useAppStore(useShallow((s) => ({
    ...s.getSummary(),
    anomalies: s.anomalies,
    stations: s.stations,
    driftEvents: s.driftEvents,
    setActiveView: s.setActiveView,
    setSelectedAnomaly: s.setSelectedAnomaly,
    setSelectedStation: s.setSelectedStation,
  })));

  const blockedAnomalies = anomalies.filter((a) => a.evidenceStatus === 'none');
  const pendingAnomalies = anomalies.filter((a) => a.evidenceStatus === 'partial');
  const processedAnomalies = anomalies.filter((a) => a.evidenceStatus === 'complete');

  const handleBlockedClick = () => {
    if (blockedAnomalies.length > 0) setSelectedAnomaly(blockedAnomalies[0].id);
  };
  const handlePendingClick = () => {
    if (pendingAnomalies.length > 0) setSelectedAnomaly(pendingAnomalies[0].id);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-status-processed shadow-glow" />
          值班汇总 — 6月17日
        </span>
        <button onClick={() => setActiveView('report')} className="btn btn-primary">
          导出交代视图 →
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 p-3">
        <button
          onClick={() => {
            if (processedAnomalies.length > 0) setSelectedAnomaly(processedAnomalies[0].id);
          }}
          className="stat-card border-status-processed/30 bg-status-processed/5 text-left"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-status-processed">已处理</span>
            <CheckCircle2 size={14} className="text-status-processed" />
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold text-deepsea-50">{processed}</div>
          <div className="mt-0.5 text-[11px] text-deepsea-300">采样点正常入账</div>
        </button>

        <button
          onClick={handlePendingClick}
          className="stat-card border-status-pending/30 bg-status-pending/5 text-left"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-status-pending">待补证据</span>
            <Clock size={14} className="text-status-pending" />
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold text-deepsea-50">{pending}</div>
          <div className="mt-0.5 text-[11px] text-deepsea-300">{pendingAnomalies.length} 条异常等证据</div>
        </button>

        <button
          onClick={handleBlockedClick}
          className="stat-card border-status-blocked/30 bg-status-blocked/5 text-left shadow-danger"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-status-blocked">卡着的</span>
            <AlertOctagon size={14} className="text-status-blocked animate-pulseSlow" />
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold text-deepsea-50">{blocked}</div>
          <div className="mt-0.5 text-[11px] text-deepsea-300">{blockedAnomalies.length} 条异常阻塞</div>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 px-3 pb-3">
        <div className="rounded-md border border-deepsea-700/60 bg-deepsea-700/20 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] text-status-anomaly">
            <AlertTriangle size={12} />
            <span>异常点</span>
          </div>
          <div className="mt-0.5 font-mono text-lg font-semibold">{anomalies.length}</div>
        </div>
        <div className="rounded-md border border-deepsea-700/60 bg-deepsea-700/20 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] text-status-withdrawn">
            <Ban size={12} />
            <span>撤回记录</span>
          </div>
          <div className="mt-0.5 font-mono text-lg font-semibold">{withdrawn}</div>
        </div>
        <div className="rounded-md border border-deepsea-700/60 bg-deepsea-700/20 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] text-status-drift">
            <Wind size={12} />
            <span>传感器漂移</span>
          </div>
          <div className="mt-0.5 font-mono text-lg font-semibold">{driftEvents.length}</div>
        </div>
      </div>

      <div className="border-t border-deepsea-700 px-3 py-2">
        <div className="mb-1.5 text-[11px] text-deepsea-300">采样站位</div>
        <div className="flex flex-wrap gap-1.5">
          {stations.map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStation(st.id)}
              className="rounded-md border border-deepsea-600 bg-deepsea-700/40 px-2 py-1 text-[11px] text-deepsea-100 transition hover:bg-deepsea-600/60"
            >
              {st.name} · {st.depth}m
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
