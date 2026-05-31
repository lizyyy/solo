import { AlertTriangle, XCircle } from 'lucide-react';
import type { Anomaly } from '../../types';
import { anomalyTypeConfig, severityConfig, cn } from '../../utils/status';

interface AnomalyCardProps {
  anomaly: Anomaly;
}

export function AnomalyCard({ anomaly }: AnomalyCardProps) {
  const typeConfig = anomalyTypeConfig[anomaly.type];
  const sevConfig = severityConfig[anomaly.severity];
  const isError = anomaly.severity === 'error';

  return (
    <div
      className={cn(
        'border p-3',
        isError
          ? 'border-status-modified bg-red-50/80'
          : 'border-status-pending bg-amber-50/80'
      )}
    >
      <div className="flex items-start gap-2 mb-2">
        {isError ? (
          <XCircle size={16} className="text-status-modified mt-0.5 flex-shrink-0" />
        ) : (
          <AlertTriangle size={16} className="text-status-pending mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-mono-800">
              {typeConfig.icon} {typeConfig.label}
            </span>
            <span
              className={cn(
                'text-[10px] font-medium px-1.5 py-0.5',
                sevConfig.color,
                isError ? 'bg-red-100' : 'bg-amber-100'
              )}
            >
              {sevConfig.label}
            </span>
          </div>
          <p className="text-xs text-mono-600 mt-1">{anomaly.description}</p>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-mono-200/50">
        <p className="text-[11px] text-mono-700 leading-relaxed">
          <span className="font-medium">处理口径：</span>
          {anomaly.handlingRule}
        </p>
      </div>
    </div>
  );
}
