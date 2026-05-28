import { AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import type { AnomalyRecord } from '@/types';
import { ANOMALY_LABELS, STATUS_LABELS } from '@/types';

interface AnomalyCardProps {
  anomaly: AnomalyRecord;
  onResolve?: (id: string) => void;
  onDrillDown?: (anomaly: AnomalyRecord) => void;
}

export default function AnomalyCard({ anomaly, onResolve, onDrillDown }: AnomalyCardProps) {
  const severityClass = anomaly.severity === 'HIGH' ? 'anomaly-high' : anomaly.severity === 'MEDIUM' ? 'anomaly-medium' : 'anomaly-low';
  const severityLabel = anomaly.severity === 'HIGH' ? '高风险' : anomaly.severity === 'MEDIUM' ? '中风险' : '低风险';
  const severityColor = anomaly.severity === 'HIGH' ? 'text-danger-500' : anomaly.severity === 'MEDIUM' ? 'text-warning-500' : 'text-success-500';

  return (
    <div className={`anomaly-card ${severityClass} ${anomaly.isResolved ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-5 h-5 ${severityColor} flex-shrink-0`} />
          <div>
            <h4 className="font-semibold text-navy-900">{ANOMALY_LABELS[anomaly.type]}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-medium ${severityColor}`}>{severityLabel}</span>
              {anomaly.fromStatus && anomaly.toStatus && (
                <span className="text-xs text-navy-500 font-mono">
                  {STATUS_LABELS[anomaly.fromStatus]} → {STATUS_LABELS[anomaly.toStatus]}
                </span>
              )}
            </div>
          </div>
        </div>
        {anomaly.isResolved && (
          <CheckCircle className="w-5 h-5 text-success-500 flex-shrink-0" />
        )}
      </div>

      <p className="text-sm text-navy-700 mb-3 leading-relaxed">{anomaly.description}</p>

      <div className="bg-navy-50 rounded-lg p-3 mb-3">
        <p className="text-xs text-navy-600">
          <span className="font-semibold">💡 建议：</span>
          {anomaly.suggestion}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-navy-500">
          {anomaly.sampleCount !== undefined && (
            <span>样本量: {anomaly.sampleCount}</span>
          )}
          {anomaly.distortionFactor !== undefined && (
            <span>差异度: {(anomaly.distortionFactor * 100).toFixed(1)}%</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onDrillDown && (anomaly.fromStatus || anomaly.affectedTransitions) && (
            <button
              onClick={() => onDrillDown(anomaly)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-navy-600 hover:text-navy-900 hover:bg-navy-100 rounded transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              查看数据
            </button>
          )}
          {onResolve && !anomaly.isResolved && (
            <button
              onClick={() => onResolve(anomaly.id)}
              className="flex items-center gap-1 px-3 py-1 text-xs text-success-700 bg-success-50 hover:bg-success-100 rounded transition-colors"
            >
              <CheckCircle className="w-3 h-3" />
              标记已处理
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
