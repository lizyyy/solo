import { AlertTriangle, AlertCircle, ArrowUp, X, Minimize2, Maximize2 } from 'lucide-react';
import { useState } from 'react';
import type { ActiveAnomaly } from '../../types';

interface AnomalyAlertProps {
  anomalies: ActiveAnomaly[];
  onUpgrade: (configId: string) => void;
  onDismiss: (configId: string) => void;
}

export function AnomalyAlert({ anomalies, onUpgrade, onDismiss }: AnomalyAlertProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Set<string>>(new Set());

  const unhandledAnomalies = anomalies.filter(a => !a.isHandled);
  
  if (unhandledAnomalies.length === 0) return null;

  const handleDismiss = (configId: string) => {
    setDismissedAnomalies(prev => {
      const next = new Set(prev);
      if (next.has(configId)) {
        next.delete(configId);
      } else {
        next.add(configId);
      }
      return next;
    });
    onDismiss(configId);
  };

  const visibleAnomalies = unhandledAnomalies.filter(a => !dismissedAnomalies.has(a.configId));

  return (
    <div className="fixed right-4 top-20 z-40 w-80 animate-slide-in">
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl overflow-hidden">
        <div 
          className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-industrial-yellow/20 to-slate-800 border-b border-slate-700 cursor-pointer"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-industrial-yellow animate-pulse" />
            <span className="font-semibold text-white">
              异常告警 ({unhandledAnomalies.length})
            </span>
          </div>
          <button className="text-slate-400 hover:text-white transition-colors">
            {isCollapsed ? (
              <Maximize2 className="w-4 h-4" />
            ) : (
              <Minimize2 className="w-4 h-4" />
            )}
          </button>
        </div>

        {!isCollapsed && (
          <div className="p-3 max-h-96 overflow-y-auto scrollbar-thin">
            {visibleAnomalies.length > 0 ? (
              <div className="space-y-3">
                {visibleAnomalies.map((anomaly) => (
                  <div
                    key={anomaly.configId}
                    className={`relative p-3 rounded-lg border ${
                      anomaly.severity === 'critical' 
                        ? 'bg-industrial-red/10 border-industrial-red/50' 
                        : 'bg-industrial-yellow/10 border-industrial-yellow/50'
                    }`}
                  >
                    <button
                      onClick={() => handleDismiss(anomaly.configId)}
                      className="absolute top-2 right-2 text-slate-500 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    
                    <div className="flex items-start gap-2 pr-6">
                      {anomaly.severity === 'critical' ? (
                        <AlertCircle className="w-5 h-5 text-industrial-red flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-industrial-yellow flex-shrink-0 mt-0.5" />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${
                            anomaly.severity === 'critical' 
                              ? 'bg-industrial-red text-white' 
                              : 'bg-industrial-yellow text-slate-900'
                          }`}>
                            {anomaly.severity === 'critical' ? '严重' : '警告'}
                          </span>
                          <span className="text-xs text-slate-400">
                            {anomaly.type === 'temperature' ? '温度' : 
                             anomaly.type === 'door' ? '门禁' : '设备'}
                          </span>
                        </div>
                        
                        <p className="text-sm text-white mb-2">{anomaly.description}</p>
                        
                        {anomaly.severity === 'critical' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpgrade(anomaly.configId);
                            }}
                            disabled={anomaly.isUpgraded}
                            className="flex items-center gap-1 px-2 py-1 bg-industrial-red hover:bg-red-700 text-white text-xs rounded transition-colors disabled:opacity-50"
                          >
                            <ArrowUp className="w-3 h-3" />
                            {anomaly.isUpgraded ? '已上报' : '立即上报'}
                          </button>
                        )}
                        
                        <p className="text-xs text-slate-500 mt-2">
                          点击地图上闪烁的巡检点处理
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-2">
                已隐藏所有告警，点击地图上闪烁的巡检点处理异常
              </p>
            )}
            
            <div className="mt-3 pt-3 border-t border-slate-700">
              <p className="text-xs text-slate-500">
                <span className="text-industrial-yellow">●</span> 黄色闪烁的巡检点表示有异常待处理
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
