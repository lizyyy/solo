import { AlertTriangle, Check, X, MapPin, Clock } from 'lucide-react';
import { useSwingStore } from '@/store/useSwingStore';
import { getAnomalyTypeLabel, getSeverityLabel, getSeverityColor } from '@/utils/anomalyDetector';
import { Anomaly } from '@/types';

interface AnomalyCardProps {
  anomaly: Anomaly;
  isSelected: boolean;
  onSelect: () => void;
  onConfirm: (confirmed: boolean) => void;
  onLocate: () => void;
}

function AnomalyCard({ anomaly, isSelected, onSelect, onConfirm, onLocate }: AnomalyCardProps) {
  const severityColor = getSeverityColor(anomaly.severity);
  const bgColor = isSelected ? 'bg-golf-blue/10 border-golf-blue' : 'bg-golf-bg border-golf-border hover:border-golf-border/80';
  
  const statusBadge = anomaly.isConfirmed ? (
    <span className="text-[10px] px-1.5 py-0.5 bg-golf-green/20 text-golf-green rounded flex items-center gap-1">
      <Check className="w-3 h-3" /> 已确认
    </span>
  ) : anomaly.isFalsePositive ? (
    <span className="text-[10px] px-1.5 py-0.5 bg-golf-text-dim/20 text-golf-text-muted rounded flex items-center gap-1">
      <X className="w-3 h-3" /> 误报
    </span>
  ) : null;
  
  return (
    <div 
      className={`${bgColor} border rounded-lg p-3 mb-2 cursor-pointer transition-all ${
        anomaly.isConfirmed || anomaly.isFalsePositive ? 'opacity-60' : ''
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          severityColor === 'golf-red' ? 'bg-golf-red/20 text-golf-red' : 'bg-golf-orange/20 text-golf-orange'
        }`}>
          <AlertTriangle className="w-4 h-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-golf-text">
              {getAnomalyTypeLabel(anomaly.type)}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              severityColor === 'golf-red' ? 'bg-golf-red/20 text-golf-red' : 'bg-golf-orange/20 text-golf-orange'
            }`}>
              {getSeverityLabel(anomaly.severity)}
            </span>
            {statusBadge}
          </div>
          
          <p className="text-xs text-golf-text-muted line-clamp-2 mb-2">
            {anomaly.description}
          </p>
          
          <div className="flex items-center gap-3 text-[10px] text-golf-text-dim">
            {anomaly.frameRange && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                帧 {anomaly.frameRange.start}-{anomaly.frameRange.end}
              </span>
            )}
            {anomaly.detectedAt && (
              <span>
                {new Date(anomaly.detectedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
          
          {!anomaly.isConfirmed && !anomaly.isFalsePositive && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={(e) => { e.stopPropagation(); onLocate(); }}
                className="flex-1 text-xs px-2 py-1 bg-golf-blue/20 text-golf-blue rounded hover:bg-golf-blue/30 transition-colors flex items-center justify-center gap-1"
              >
                <MapPin className="w-3 h-3" /> 定位
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onConfirm(true); }}
                className="flex-1 text-xs px-2 py-1 bg-golf-green/20 text-golf-green rounded hover:bg-golf-green/30 transition-colors flex items-center justify-center gap-1"
              >
                <Check className="w-3 h-3" /> 确认
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onConfirm(false); }}
                className="flex-1 text-xs px-2 py-1 bg-golf-text-dim/20 text-golf-text-muted rounded hover:bg-golf-text-dim/30 transition-colors flex items-center justify-center gap-1"
              >
                <X className="w-3 h-3" /> 忽略
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AnomalyPanel() {
  const { 
    currentSession, 
    activePanel,
    selectedAnomalyId,
    setSelectedAnomalyId,
    confirmAnomaly,
    flyToFrame,
  } = useSwingStore();
  
  if (!currentSession || activePanel !== 'anomalies') return null;
  
  const anomalies = currentSession.anomalies;
  const unconfirmedCount = anomalies.filter(a => !a.isConfirmed && !a.isFalsePositive).length;
  const highCount = anomalies.filter(a => a.severity === 'high' && !a.isConfirmed && !a.isFalsePositive).length;
  
  const handleLocate = (anomaly: Anomaly) => {
    if (!currentSession) return;
    if (anomaly.frameRange) {
      flyToFrame(anomaly.frameRange.start);
    } else if (anomaly.frameId) {
      const idx = currentSession.frames.findIndex(f => f.frameId === anomaly.frameId);
      if (idx >= 0) flyToFrame(idx);
    }
  };
  
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-golf-orange" />
        <h2 className="text-lg font-semibold text-golf-text">异常检测</h2>
        {unconfirmedCount > 0 && (
          <span className="ml-auto px-2 py-0.5 bg-golf-red/20 text-golf-red text-xs rounded-full animate-pulse">
            {unconfirmedCount} 待处理
          </span>
        )}
      </div>
      
      {highCount > 0 && (
        <div className="mb-4 p-3 bg-golf-red/10 border border-golf-red/30 rounded-lg">
          <div className="flex items-center gap-2 text-golf-red text-sm">
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            <span>检测到 {highCount} 个严重异常需要立即处理</span>
          </div>
        </div>
      )}
      
      {anomalies.length === 0 ? (
        <div className="text-center py-12 text-golf-text-muted">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">暂无检测到异常</p>
          <p className="text-xs mt-1">系统将自动检测坐标抖动、杆面角反向等问题</p>
        </div>
      ) : (
        <div className="space-y-1">
          {anomalies.map(anomaly => (
            <AnomalyCard
              key={anomaly.anomalyId}
              anomaly={anomaly}
              isSelected={selectedAnomalyId === anomaly.anomalyId}
              onSelect={() => setSelectedAnomalyId(anomaly.anomalyId)}
              onConfirm={(confirmed) => confirmAnomaly(anomaly.anomalyId, confirmed)}
              onLocate={() => handleLocate(anomaly)}
            />
          ))}
        </div>
      )}
      
      <div className="mt-4 pt-4 border-t border-golf-border">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-golf-red rounded-full" />
            <span className="text-golf-text-muted">坐标抖动</span>
            <span className="ml-auto text-golf-text">
              {anomalies.filter(a => a.type === 'jitter').length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-golf-orange rounded-full" />
            <span className="text-golf-text-muted">杆面角反向</span>
            <span className="ml-auto text-golf-text">
              {anomalies.filter(a => a.type === 'faceAngleReverse').length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-golf-blue rounded-full" />
            <span className="text-golf-text-muted">击球点丢失</span>
            <span className="ml-auto text-golf-text">
              {anomalies.filter(a => a.type === 'impactPointMissing').length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-golf-text-dim rounded-full" />
            <span className="text-golf-text-muted">数据断层</span>
            <span className="ml-auto text-golf-text">
              {anomalies.filter(a => a.type === 'dataGap').length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
