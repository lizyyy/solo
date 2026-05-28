import { useWorkbenchStore } from '@/store/useWorkbenchStore';
import { ChevronDown, ChevronUp, Sigma } from 'lucide-react';

export default function TensionResults() {
  const results = useWorkbenchStore(s => s.results);
  const totalTension = useWorkbenchStore(s => s.totalTension);
  const strings = useWorkbenchStore(s => s.strings);
  const showFormula = useWorkbenchStore(s => s.showFormula);
  const toggleFormula = useWorkbenchStore(s => s.toggleFormula);

  const tensionLevel = totalTension > 1000 ? 'danger' : totalTension > 800 ? 'warning' : 'safe';
  const tensionColor = tensionLevel === 'danger' ? 'text-red-400' : tensionLevel === 'warning' ? 'text-amber-400' : 'text-green-400';
  const tensionBg = tensionLevel === 'danger' ? 'from-red-900/30 to-red-950/10' : tensionLevel === 'warning' ? 'from-amber-900/20 to-amber-950/10' : 'from-green-900/20 to-green-950/10';

  return (
    <div className="space-y-3">
      <div className={`rounded-xl p-4 bg-gradient-to-br ${tensionBg} border border-stone-700/50`}>
        <div className="flex items-center gap-2 mb-1">
          <Sigma size={16} className="text-amber-400" />
          <span className="text-xs text-stone-400">总张力</span>
        </div>
        <div className={`text-3xl font-bold font-mono tracking-tight ${tensionColor}`}>
          {totalTension.toFixed(1)}
          <span className="text-sm font-normal text-stone-500 ml-1">N</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-stone-700/50 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                tensionLevel === 'danger' ? 'bg-red-500' : tensionLevel === 'warning' ? 'bg-amber-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(totalTension / 1200 * 100, 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-stone-500">1200N</span>
        </div>
        {tensionLevel !== 'safe' && (
          <div className={`text-xs mt-1.5 ${tensionColor}`}>
            {tensionLevel === 'danger' ? '⚠ 超过危险阈值 1000N' : '⚠ 超过警告阈值 800N'}
          </div>
        )}
      </div>

      <div className="space-y-1">
        {results.map((r, i) => {
          const s = strings[i];
          const pct = totalTension > 0 ? (r.tension / totalTension * 100) : 0;
          return (
            <div
              key={r.stringId}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
                r.isAnomalous ? 'bg-red-900/20 border border-red-800/30' : 'bg-stone-800/30'
              }`}
            >
              <span className="w-6 text-stone-500">{s.name}</span>
              <span className="w-10 text-stone-400 font-mono">{s.targetNote}</span>
              <div className="flex-1 mx-1">
                <div className="h-1 bg-stone-700/50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500/70 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className="w-16 text-right font-mono text-stone-300">{r.tension.toFixed(1)}N</span>
              <span className="w-10 text-right font-mono text-stone-500">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>

      <button
        onClick={toggleFormula}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-stone-500 hover:text-amber-300 transition-colors"
      >
        {showFormula ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        T = 4μL²f²
      </button>

      {showFormula && (
        <div className="bg-stone-800/50 rounded-lg p-3 border border-stone-700/50 text-xs text-stone-400 space-y-2">
          <div className="text-amber-300 font-mono text-center text-sm mb-2">
            T = 4 × μ × L² × f²
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-amber-200">T</span><span>张力 (N)</span>
            <span className="text-amber-200">μ</span><span>线密度 (kg/m)</span>
            <span className="text-amber-200">L</span><span>有效弦长 (m)</span>
            <span className="text-amber-200">f</span><span>振动频率 (Hz)</span>
          </div>
          <div className="border-t border-stone-700/50 pt-2 mt-2 space-y-1 text-stone-500">
            <div>单位转换：</div>
            <div>1 g/m = 0.001 kg/m</div>
            <div>1 lb/in ≈ 17.858 kg/m</div>
            <div>1 mm = 0.001 m</div>
          </div>
        </div>
      )}
    </div>
  );
}
