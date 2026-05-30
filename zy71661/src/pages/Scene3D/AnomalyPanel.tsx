import { useSimulationStore } from '@/store/useSimulationStore';
import { useUIStore } from '@/store/useUIStore';
import { ANOMALY_COLORS } from '@/constants/config';
import { AlertTriangle, Check, X, ChevronDown } from 'lucide-react';
import type { AnomalySeverity } from '@/types/simulation';

const SEVERITY_LABELS: Record<AnomalySeverity, string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
};

export default function AnomalyPanel() {
  const { currentSimulation, confirmAnomaly } = useSimulationStore();
  const { showAnomalyPanel, setShowAnomalyPanel } = useUIStore();
  const anomalies = currentSimulation?.anomalies.filter(a => !a.isConfirmed) ?? [];

  if (!showAnomalyPanel) return null;

  return (
    <div className="absolute top-4 right-4 w-80 max-h-[60vh] bg-gray-900/95 border border-gray-700 rounded-lg shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2 text-sm text-white font-medium">
          <AlertTriangle size={16} className="text-yellow-400" />
          异常面板
          <span className="text-xs text-gray-400">({anomalies.length})</span>
        </div>
        <button onClick={() => setShowAnomalyPanel(false)} className="text-gray-400 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {anomalies.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">暂无未确认异常</div>
        ) : (
          anomalies.map(anomaly => (
            <div key={anomaly.id} className="px-4 py-3 border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
              <div className="flex items-start gap-2">
                <div
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: ANOMALY_COLORS[anomaly.severity] ?? '#ef4444' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium text-white"
                      style={{ backgroundColor: ANOMALY_COLORS[anomaly.severity] ?? '#ef4444' }}
                    >
                      {SEVERITY_LABELS[anomaly.severity]}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">{anomaly.timestamp.toFixed(2)}s</span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{anomaly.description}</p>
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => confirmAnomaly(anomaly.id, true, '当前用户')}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-green-700/30 text-green-400 hover:bg-green-700/50 transition-colors"
                >
                  <Check size={12} />
                  确认
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2 border-t border-gray-700">
        <button
          onClick={() => setShowAnomalyPanel(false)}
          className="w-full flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
        >
          <ChevronDown size={14} />
          收起
        </button>
      </div>
    </div>
  );
}
