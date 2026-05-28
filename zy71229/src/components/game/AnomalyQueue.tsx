import React from 'react';
import { AlertTriangle, Clock, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { Anomaly, AnomalyStatus, ANOMALY_TYPE_LABELS, ANOMALY_STATUS_LABELS } from '../../game/types';
import { SourceBadge } from '../common/SourceBadge';
import { formatGameTime } from '../../game/engine';

interface AnomalyQueueProps {
  onSelectAnomaly: (anomalyId: string) => void;
}

export const AnomalyQueue: React.FC<AnomalyQueueProps> = ({ onSelectAnomaly }) => {
  const { state } = useGameStore();

  const pendingAnomalies = state.anomalies
    .filter(a => a.detectedTime !== null && a.status === AnomalyStatus.PENDING)
    .sort((a, b) => (a.triggerTime) - (b.triggerTime));

  const resolvedAnomalies = state.anomalies
    .filter(a => a.status !== AnomalyStatus.PENDING)
    .sort((a, b) => (b.resolvedTime || 0) - (a.resolvedTime || 0));

  const getStatusIcon = (anomaly: Anomaly) => {
    if (anomaly.status === AnomalyStatus.PENDING) {
      return <AlertTriangle size={14} className="text-alert-red animate-blink" />;
    }
    if (anomaly.playerChoice === anomaly.correctAction) {
      return <CheckCircle size={14} className="text-alert-green" />;
    }
    return <XCircle size={14} className="text-alert-red" />;
  };

  const getStatusColor = (anomaly: Anomaly) => {
    if (anomaly.status === AnomalyStatus.PENDING) {
      return 'border-l-alert-red';
    }
    if (anomaly.playerChoice === anomaly.correctAction) {
      return 'border-l-alert-green';
    }
    return 'border-l-alert-yellow';
  };

  const renderAnomalyCard = (anomaly: Anomaly, isPending: boolean) => (
    <div
      key={anomaly.id}
      className={`anomaly-card ${getStatusColor(anomaly)} ${!isPending ? 'opacity-70' : ''}`}
      onClick={() => isPending && onSelectAnomaly(anomaly.id)}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          {getStatusIcon(anomaly)}
          <span className="text-sm font-medium text-gray-200">
            {ANOMALY_TYPE_LABELS[anomaly.type]}
          </span>
        </div>
        <SourceBadge source={anomaly.source} showLabel={false} />
      </div>
      <p className="text-xs text-gray-400 mb-2">{anomaly.description}</p>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-gray-500">
          <Clock size={12} />
          <span className="font-mono">{formatGameTime(anomaly.triggerTime)}</span>
        </div>
        {anomaly.status !== AnomalyStatus.PENDING && (
          <span className={`font-mono ${
            anomaly.playerChoice === anomaly.correctAction ? 'text-alert-green' : 'text-alert-red'
          }`}>
            {ANOMALY_STATUS_LABELS[anomaly.status!]}
          </span>
        )}
        {isPending && (
          <span className="text-alert-yellow animate-pulse">点击处理 →</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <span className="panel-title">异常队列</span>
        <span className={`text-xs font-mono ${pendingAnomalies.length > 0 ? 'text-alert-red' : 'text-alert-green'}`}>
          {pendingAnomalies.length} 待处理 / {state.anomalies.length} 总数
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {pendingAnomalies.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-alert-red font-medium mb-2 flex items-center gap-1">
              <AlertTriangle size={12} />
              待处理异常
            </div>
            {pendingAnomalies.map(a => renderAnomalyCard(a, true))}
          </div>
        )}

        {resolvedAnomalies.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 font-medium mb-2 flex items-center gap-1">
              <CheckCircle size={12} />
              已处理 ({resolvedAnomalies.filter(a => a.playerChoice === a.correctAction).length}/{resolvedAnomalies.length} 正确)
            </div>
            {resolvedAnomalies.slice(0, 5).map(a => renderAnomalyCard(a, false))}
          </div>
        )}

        {pendingAnomalies.length === 0 && resolvedAnomalies.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <HelpCircle size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">暂无异常</p>
            <p className="text-xs mt-1">继续巡逻，保持警惕</p>
          </div>
        )}
      </div>
    </div>
  );
};
