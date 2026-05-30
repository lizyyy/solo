import { useDrumStore } from '../store/useDrumStore';
import { Music, TrendingUp, AlertTriangle } from 'lucide-react';

export default function FreqResult() {
  const { result, params } = useDrumStore();

  if (!result) {
    return (
      <div className="bg-drum-card rounded-xl border border-drum-border p-8 flex flex-col items-center justify-center min-h-[200px]">
        <Music className="w-10 h-10 text-drum-textDim mb-3" />
        <p className="text-drum-textDim text-sm">输入参数后点击「换算」查看结果</p>
      </div>
    );
  }

  const absDeviation = Math.abs(result.deviation);
  const deviationColor =
    absDeviation <= 5 ? 'text-drum-green' :
    absDeviation <= 10 ? 'text-drum-amber' :
    'text-drum-red';

  const deviationBarColor =
    absDeviation <= 5 ? 'bg-drum-green' :
    absDeviation <= 10 ? 'bg-drum-amber' :
    'bg-drum-red';

  const deviationBarWidth = Math.min(absDeviation * 5, 100);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-drum-card rounded-xl border border-drum-border p-6">
        <div className="flex items-center gap-2 text-drum-copper font-semibold mb-4">
          <Music className="w-4 h-4" />
          估算基频
        </div>
        <div className="flex items-baseline gap-3 mb-2">
          <span className="font-display text-5xl text-drum-text tracking-tight">
            {result.frequency.toFixed(1)}
          </span>
          <span className="text-drum-textMuted text-lg">Hz</span>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-drum-copperLight font-display text-2xl">{result.noteName}</span>
          {result.octaveWarning && (
            <span className="flex items-center gap-1 text-drum-amber text-xs bg-drum-amber/10 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              疑似倍频
            </span>
          )}
        </div>

        {params.targetFreq > 0 && (
          <>
            <div className="border-t border-drum-border pt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-drum-textMuted">目标频率</span>
                <span className="text-drum-text">{params.targetFreq.toFixed(1)} Hz {params.targetNote && `(${params.targetNote})`}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-drum-textMuted">偏差</span>
                <span className={`font-semibold ${deviationColor}`}>
                  {result.deviation >= 0 ? '+' : ''}{result.deviation.toFixed(2)}%
                </span>
              </div>
              <div className="w-full bg-drum-bg rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${deviationBarColor}`}
                  style={{ width: `${deviationBarWidth}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-drum-textMuted">音分差</span>
                <span className={`font-mono ${deviationColor}`}>
                  {result.centsDiff >= 0 ? '+' : ''}{result.centsDiff.toFixed(1)} 音分
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-drum-textMuted">达到目标所需张力</span>
                <span className="text-drum-text font-medium">
                  {result.requiredTension.toFixed(1)} {params.tensionUnit}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {result.errors.length > 0 && (
        <div className="bg-drum-card rounded-xl border border-drum-border p-5 space-y-2">
          <div className="flex items-center gap-2 text-drum-amber font-semibold text-sm mb-1">
            <AlertTriangle className="w-4 h-4" />
            注意事项
          </div>
          {result.errors.map((e, i) => (
            <div
              key={i}
              className={`text-xs px-3 py-2 rounded-lg ${
                e.recovered
                  ? 'bg-drum-amber/10 text-drum-amber border-l-2 border-drum-amber'
                  : 'bg-drum-red/10 text-drum-red border-l-2 border-drum-red'
              }`}
            >
              {e.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
