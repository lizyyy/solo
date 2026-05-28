import { useWorkbenchStore } from '@/store/useWorkbenchStore';
import { TUNING_PRESETS, SAMPLE_CASES } from '@/utils/presets';
import { generateCSV, downloadCSV } from '@/utils/exportReport';
import { ArrowLeftRight, Download, FlaskConical } from 'lucide-react';

export default function TuningComparison() {
  const activePreset = useWorkbenchStore(s => s.activePreset);
  const comparisonPreset = useWorkbenchStore(s => s.comparisonPreset);
  const setComparisonPreset = useWorkbenchStore(s => s.setComparisonPreset);
  const results = useWorkbenchStore(s => s.results);
  const totalTension = useWorkbenchStore(s => s.totalTension);
  const comparisonResults = useWorkbenchStore(s => s.comparisonResults);
  const comparisonTotalTension = useWorkbenchStore(s => s.comparisonTotalTension);
  const strings = useWorkbenchStore(s => s.strings);
  const loadSampleCase = useWorkbenchStore(s => s.loadSampleCase);

  const handleExport = () => {
    const csv = generateCSV(strings, results, totalTension, activePreset);
    downloadCSV(csv);
  };

  const tensionDiff = comparisonTotalTension !== null && totalTension > 0
    ? ((comparisonTotalTension - totalTension) / totalTension * 100)
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <ArrowLeftRight size={16} className="text-amber-400" />
        <h3 className="text-sm font-semibold text-amber-200">调弦对比</h3>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TUNING_PRESETS.map(p => (
          <button
            key={p.name}
            onClick={() => setComparisonPreset(comparisonPreset === p.name ? null : p.name)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              comparisonPreset === p.name
                ? 'bg-amber-500 text-stone-900 shadow-lg shadow-amber-500/30'
                : 'bg-stone-700/60 text-stone-300 hover:bg-stone-600/80'
            }`}
          >
            {p.nameCN}
          </button>
        ))}
      </div>

      {comparisonPreset && comparisonResults && (
        <div className="bg-stone-800/50 rounded-lg p-3 border border-stone-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-stone-400">
              {activePreset} vs {comparisonPreset}
            </span>
            {tensionDiff !== null && (
              <span className={`text-xs font-mono font-bold ${
                Math.abs(tensionDiff) > 15 ? 'text-red-400' : Math.abs(tensionDiff) > 5 ? 'text-amber-400' : 'text-green-400'
              }`}>
                {tensionDiff > 0 ? '+' : ''}{tensionDiff.toFixed(1)}%
              </span>
            )}
          </div>
          <div className="grid grid-cols-6 gap-1">
            {results.map((r, i) => {
              const compR = comparisonResults[i];
              const diff = compR ? compR.tension - r.tension : 0;
              const pct = r.tension > 0 ? (diff / r.tension * 100) : 0;
              return (
                <div key={r.stringId} className="text-center">
                  <div className="text-[10px] text-stone-500 mb-0.5">{i + 1}弦</div>
                  <div className={`text-xs font-mono ${
                    Math.abs(pct) > 15 ? 'text-red-400' : Math.abs(pct) > 5 ? 'text-amber-400' : 'text-green-400'
                  }`}>
                    {diff > 0 ? '+' : ''}{diff.toFixed(1)}N
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-stone-700/50 flex justify-between">
            <span className="text-xs text-stone-400">总张力差</span>
            <span className={`text-xs font-mono font-bold ${
              comparisonTotalTension !== null && Math.abs(comparisonTotalTension - totalTension) > 100
                ? 'text-red-400'
                : 'text-amber-300'
            }`}>
              {comparisonTotalTension !== null
                ? `${(comparisonTotalTension - totalTension > 0 ? '+' : '')}${(comparisonTotalTension - totalTension).toFixed(1)}N`
                : '-'
              }
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <FlaskConical size={14} className="text-amber-400" />
        <h3 className="text-sm font-semibold text-amber-200">边界案例样例</h3>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SAMPLE_CASES.map((s, i) => (
          <button
            key={i}
            onClick={() => loadSampleCase(i)}
            className="px-2.5 py-1 rounded text-[11px] bg-stone-700/40 text-stone-300 hover:bg-amber-600/30 hover:text-amber-200 transition-all border border-stone-600/30"
            title={s.description}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="pt-3 border-t border-stone-700/50">
        <button
          onClick={handleExport}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-900 font-semibold text-sm transition-all shadow-lg shadow-amber-600/20 hover:shadow-amber-500/30"
        >
          <Download size={16} />
          导出报告 CSV
        </button>
      </div>
    </div>
  );
}
