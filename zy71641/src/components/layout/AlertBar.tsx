import { AlertTriangle, X, ChevronDown } from 'lucide-react';
import { useSwingStore } from '@/store/useSwingStore';
import { getAnomalyTypeLabel } from '@/utils/anomalyDetector';

export function AlertBar() {
  const { 
    currentSession, 
    showAlertBar, 
    setShowAlertBar,
    setSelectedAnomalyId,
    setActivePanel,
    flyToFrame,
  } = useSwingStore();
  
  if (!showAlertBar || !currentSession || currentSession.anomalies.length === 0) return null;
  
  const unconfirmedAnomalies = currentSession.anomalies.filter(a => !a.isConfirmed && !a.isFalsePositive);
  const highSeverity = unconfirmedAnomalies.filter(a => a.severity === 'high').length;
  
  const handleAnomalyClick = (anomalyId: string) => {
    setSelectedAnomalyId(anomalyId);
    setActivePanel('anomalies');
    
    const anomaly = currentSession.anomalies.find(a => a.anomalyId === anomalyId);
    if (anomaly?.frameRange) {
      flyToFrame(anomaly.frameRange.start);
    } else if (anomaly?.frameId) {
      const idx = currentSession.frames.findIndex(f => f.frameId === anomaly.frameId);
      if (idx >= 0) flyToFrame(idx);
    }
  };
  
  if (unconfirmedAnomalies.length === 0) return null;
  
  return (
    <div className="animate-slide-down bg-gradient-to-r from-golf-red/90 to-golf-orange/90 backdrop-blur-sm border-b border-golf-red/50 shadow-lg">
      <div className="flex items-center gap-3 px-4 py-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-white animate-pulse" />
          <span className="text-white font-medium">
            检测到 {unconfirmedAnomalies.length} 个异常
            {highSeverity > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs">
                {highSeverity} 个严重
              </span>
            )}
          </span>
        </div>
        
        <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {unconfirmedAnomalies.slice(0, 5).map(anomaly => (
            <button
              key={anomaly.anomalyId}
              onClick={() => handleAnomalyClick(anomaly.anomalyId)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs text-white transition-all hover:bg-white/20 ${
                anomaly.severity === 'high' ? 'bg-golf-red/50 border border-golf-red' : 'bg-golf-orange/50 border border-golf-orange'
              }`}
            >
              {getAnomalyTypeLabel(anomaly.type)}
              {anomaly.frameRange && (
                <span className="ml-1 opacity-75">
                  #{anomaly.frameRange.start}
                </span>
              )}
            </button>
          ))}
          {unconfirmedAnomalies.length > 5 && (
            <button 
              onClick={() => setActivePanel('anomalies')}
              className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-xs text-white/80 hover:text-white transition-colors"
            >
              +{unconfirmedAnomalies.length - 5} 更多
              <ChevronDown className="w-3 h-3" />
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActivePanel('anomalies')}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs text-white transition-colors"
          >
            查看全部
          </button>
          <button
            onClick={() => setShowAlertBar(false)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X className="w-4 h-4 text-white/80" />
          </button>
        </div>
      </div>
    </div>
  );
}
