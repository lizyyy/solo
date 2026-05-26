import { AlertTriangle, AlertCircle, CheckCircle, ArrowUp, X } from 'lucide-react';
import type { ActiveAnomaly } from '../../types';

interface AnomalyAlertProps {
  anomalies: ActiveAnomaly[];
  onClose: () => void;
  onUpgrade: (configId: string) => void;
}

export function AnomalyAlert({ anomalies, onClose, onUpgrade }: AnomalyAlertProps) {
  const unhandledAnomalies = anomalies.filter(a => !a.isHandled);
  
  if (unhandledAnomalies.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-slate-800 rounded-xl p-6 max-w-lg w-full mx-4 border border-slate-700 animate-slide-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-industrial-yellow animate-pulse" />
            <h3 className="text-xl font-bold text-white">异常事件告警</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-4 max-h-80 overflow-y-auto scrollbar-thin">
          {unhandledAnomalies.map((anomaly) => (
            <div
              key={anomaly.configId}
              className={`p-4 rounded-lg border ${
                anomaly.severity === 'critical' 
                  ? 'bg-industrial-red/20 border-industrial-red' 
                  : 'bg-industrial-yellow/20 border-industrial-yellow'
              }`}
            >
              <div className="flex items-start gap-3">
                {anomaly.severity === 'critical' ? (
                  <AlertCircle className="w-6 h-6 text-industrial-red flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-industrial-yellow flex-shrink-0" />
                )}
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      anomaly.severity === 'critical' 
                        ? 'bg-industrial-red text-white' 
                        : 'bg-industrial-yellow text-slate-900'
                    }`}>
                      {anomaly.severity === 'critical' ? '严重' : '警告'}
                    </span>
                    <span className="text-sm text-slate-400">
                      {anomaly.type === 'temperature' ? '温度异常' : 
                       anomaly.type === 'door' ? '门禁异常' : '设备异常'}
                    </span>
                  </div>
                  
                  <p className="text-white mb-2">{anomaly.description}</p>
                  
                  {anomaly.severity === 'critical' && (
                    <button
                      onClick={() => onUpgrade(anomaly.configId)}
                      disabled={anomaly.isUpgraded}
                      className="flex items-center gap-2 px-3 py-1.5 bg-industrial-red hover:bg-red-700 text-white text-sm rounded transition-colors disabled:opacity-50"
                    >
                      <ArrowUp className="w-4 h-4" />
                      {anomaly.isUpgraded ? '已上报' : '立即上报'}
                    </button>
                  )}
                  
                  <p className="text-xs text-slate-500 mt-2">
                    点击对应的巡检点来处理此异常
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
          <p className="text-sm text-slate-400">
            <CheckCircle className="w-4 h-4 inline mr-1 text-green-500" />
            处理方式：点击地图上对应的巡检点即可处理异常
          </p>
        </div>
      </div>
    </div>
  );
}
