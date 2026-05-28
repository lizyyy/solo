import { useAnomalyStore } from '@/store/useAnomalyStore';
import { AlertTriangle, X, Target, RefreshCw } from 'lucide-react';
import { getSeverityColor, getSeverityBgColor } from '@/utils/anomalyDetection';

export const AnomaliesPanel = () => {
  const { anomalies, isDetecting, runDetection, dismissAnomaly, locateAnomaly } = useAnomalyStore();

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'color_scale':
        return '🎨';
      case 'missing_sensor':
        return '📡';
      case 'wind_reversed':
        return '🌬️';
      default:
        return '⚠️';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'color_scale':
        return '色阶失真';
      case 'missing_sensor':
        return '采样点缺失';
      case 'wind_reversed':
        return '风向异常';
      default:
        return '未知异常';
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 backdrop-blur-sm border border-slate-700/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-400" />
          异常检测 ({anomalies.length})
        </h3>
        <button
          onClick={runDetection}
          disabled={isDetecting}
          className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-slate-300 ${isDetecting ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      {anomalies.length === 0 ? (
        <div className="text-center py-6 text-slate-400 text-sm">
          <div className="text-2xl mb-2">✅</div>
          <p>未检测到异常</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {anomalies.map((anomaly) => (
            <div
              key={anomaly.id}
              className={`p-3 rounded-lg border transition-all ${getSeverityBgColor(anomaly.severity)}`}
              style={{ borderColor: `${getSeverityColor(anomaly.severity)}40` }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getTypeIcon(anomaly.type)}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ 
                      backgroundColor: `${getSeverityColor(anomaly.severity)}20`,
                      color: getSeverityColor(anomaly.severity)
                    }}>
                    {getTypeLabel(anomaly.type)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => locateAnomaly(anomaly.id)}
                    className="p-1 rounded hover:bg-slate-600/50 transition-colors"
                    title="定位"
                  >
                    <Target className="w-3.5 h-3.5 text-slate-400 hover:text-cyan-400" />
                  </button>
                  <button
                    onClick={() => dismissAnomaly(anomaly.id)}
                    className="p-1 rounded hover:bg-slate-600/50 transition-colors"
                    title="忽略"
                  >
                    <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-400" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {anomaly.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
