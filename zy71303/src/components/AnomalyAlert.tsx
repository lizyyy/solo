import { useWorkbenchStore } from '@/store/useWorkbenchStore';
import { ANOMALY_SEVERITY_COLORS } from '@/utils/presets';
import { AlertTriangle, X, Info } from 'lucide-react';
import { useState } from 'react';

export default function AnomalyAlert() {
  const allAnomalies = useWorkbenchStore(s => s.allAnomalies);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = allAnomalies.filter(a => !dismissed.has(`${a.type}-${a.stringId}-${a.message}`));

  if (visible.length === 0) return null;

  const severityIcon = (severity: string) => {
    if (severity === 'danger') return <AlertTriangle size={16} className="text-red-400 shrink-0" />;
    if (severity === 'warning') return <AlertTriangle size={16} className="text-amber-400 shrink-0" />;
    return <Info size={16} className="text-blue-400 shrink-0" />;
  };

  const severityBg = (severity: string) => {
    if (severity === 'danger') return 'bg-red-900/40 border-red-600/50';
    if (severity === 'warning') return 'bg-amber-900/30 border-amber-600/40';
    return 'bg-blue-900/30 border-blue-600/40';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={16} className="text-amber-400" />
        <h3 className="text-sm font-semibold text-amber-200">异常提示 ({visible.length})</h3>
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {visible.map((a, i) => {
          const key = `${a.type}-${a.stringId}-${a.message}`;
          return (
            <div
              key={`${key}-${i}`}
              className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${severityBg(a.severity)}`}
            >
              {severityIcon(a.severity)}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-stone-200 mb-0.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: ANOMALY_SEVERITY_COLORS[a.severity] }}
                  />
                  {a.stringId}弦 · {a.type === 'OCTAVE_ERROR' ? '频率八度异常' : a.type === 'UNIT_SUSPICION' ? '线密度单位可疑' : '总张力超限'}
                </div>
                <div className="text-stone-400 leading-relaxed">{a.message}</div>
                <div className="text-stone-500 mt-1 italic">{a.suggestion}</div>
              </div>
              <button
                onClick={() => setDismissed(prev => new Set(prev).add(key))}
                className="text-stone-500 hover:text-stone-300 shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
