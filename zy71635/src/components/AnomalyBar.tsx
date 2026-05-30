import { AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import type { AnomalyRecord, AnomalyStatus } from '@/utils/types';
import { useHallStore } from '@/store/useHallStore';

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/50',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
};

interface AnomalyBarProps {
  anomalies: AnomalyRecord[];
}

export default function AnomalyBar({ anomalies }: AnomalyBarProps) {
  const setFocusTarget = useHallStore((s) => s.setFocusTarget);
  const setAnomalyStatus = useHallStore((s) => s.setAnomalyStatus);

  if (anomalies.length === 0) return null;

  const handleStatusChange = (id: string, status: AnomalyStatus) => {
    setAnomalyStatus(id, status);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gray-900/95 border-t border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-amber-400" />
        <span className="text-white font-semibold">异常检测 ({anomalies.length})</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {anomalies.map((anomaly) => (
          <div
            key={anomaly.id}
            className={`flex-shrink-0 w-64 p-3 rounded-lg border ${severityColors[anomaly.severity]} ${
              anomaly.status === 'dismissed' ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wide">
                {anomaly.severity}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => handleStatusChange(anomaly.id, 'confirmed')}
                  className="p-1 hover:bg-green-500/20 rounded"
                  title="确认"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleStatusChange(anomaly.id, 'dismissed')}
                  className="p-1 hover:bg-red-500/20 rounded"
                  title="忽略"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-sm mb-2">{anomaly.description}</p>
            <button
              onClick={() =>
                setFocusTarget({
                  type: anomaly.sourceType.toLowerCase(),
                  id: anomaly.sourceId,
                })
              }
              className="text-xs underline hover:text-white"
            >
              定位到 {anomaly.sourceType}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
