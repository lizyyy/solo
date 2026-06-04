import { useGameStore } from '@/store/useGameStore';
import { groupAnomaliesBySource } from '@/utils/traceUtils';
import { FileText, AlertTriangle, CheckCircle2, Clock, HelpCircle, Play } from 'lucide-react';

export default function ReportPanel() {
  const { records, setAppView, startReplay } = useGameStore();

  const totalRecords = records.length;
  const smoothRecords = records.filter(r => !r.needsManualReview && r.anomalies.length === 0);
  const reviewRecords = records.filter(r => r.needsManualReview);
  const legacyRecords = records.filter(r => r.dataFormatVersion === 'v1');
  const allAnomalies = records.flatMap(r => r.anomalies);
  const anomalyGroups = groupAnomaliesBySource(allAnomalies);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium text-slate-100">结算报告</h2>
        <button
          onClick={() => setAppView('game')}
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          返回比赛
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <FileText size={14} /> 总记录
          </div>
          <div className="text-3xl font-mono font-bold text-slate-100">{totalRecords}</div>
        </div>
        <div className="p-4 bg-emerald-950/30 rounded-xl border border-emerald-700/30">
          <div className="flex items-center gap-2 text-emerald-400 text-sm mb-2">
            <CheckCircle2 size={14} /> 顺利通过
          </div>
          <div className="text-3xl font-mono font-bold text-emerald-300">{smoothRecords.length}</div>
        </div>
        <div className="p-4 bg-yellow-950/30 rounded-xl border border-yellow-700/30">
          <div className="flex items-center gap-2 text-yellow-400 text-sm mb-2">
            <HelpCircle size={14} /> 需人工确认
          </div>
          <div className="text-3xl font-mono font-bold text-yellow-300">{reviewRecords.length}</div>
        </div>
        <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <Clock size={14} /> 旧口径
          </div>
          <div className="text-3xl font-mono font-bold text-slate-300">{legacyRecords.length}</div>
        </div>
      </div>

      {allAnomalies.length > 0 && (
        <div className="p-4 bg-red-950/20 rounded-xl border border-red-700/30">
          <h3 className="flex items-center gap-2 text-red-300 text-sm font-medium mb-3">
            <AlertTriangle size={14} /> 异常汇总（共 {allAnomalies.length} 条，不会在总数里消失）
          </h3>
          <div className="space-y-3">
            {Array.from(anomalyGroups.entries()).map(([source, anomalies]) => (
              <div key={source} className="space-y-1">
                <div className="text-xs text-slate-400">来源：{source}</div>
                {anomalies.map((a, i) => (
                  <div key={i} className="text-xs text-red-400/80 pl-3">· {a}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-300">记录明细</h3>
        {records.map((record) => (
          <div
            key={record.id}
            className={`p-4 rounded-xl border ${
              record.needsManualReview
                ? 'bg-yellow-950/20 border-yellow-700/30'
                : record.dataFormatVersion === 'v1'
                ? 'bg-slate-800/40 border-slate-600/40'
                : 'bg-slate-800/60 border-slate-700/50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-200 font-medium">{record.configName}</span>
                  {record.dataFormatVersion === 'v1' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-600/50 text-slate-400">
                      旧口径
                    </span>
                  )}
                  {record.needsManualReview && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-600/30 text-yellow-300">
                      需确认
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(record.startTime).toLocaleString('zh-CN')}
                  {record.endTime && ` → ${new Date(record.endTime).toLocaleTimeString('zh-CN')}`}
                </div>
                <div className="text-[10px] text-slate-500">来源：{record.source}</div>
              </div>
              <div className="flex items-center gap-2">
                {record.eventLog.length > 0 && (
                  <button
                    onClick={() => startReplay(record)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded-lg transition-colors"
                  >
                    <Play size={12} /> 回放
                  </button>
                )}
              </div>
            </div>

            {record.finalResources && (
              <div className="flex gap-4 mt-2">
                {Object.entries(record.finalResources).map(([key, val]) => (
                  <span
                    key={key}
                    className={`text-xs font-mono ${val < 0 ? 'text-red-400' : 'text-slate-400'}`}
                  >
                    {key}: {val}
                  </span>
                ))}
              </div>
            )}

            {record.anomalies.length > 0 && (
              <div className="mt-2 space-y-1">
                {record.anomalies.map((a, i) => (
                  <div key={i} className="text-[11px] text-red-400/70">⚠ {a}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
