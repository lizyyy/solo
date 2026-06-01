import React from 'react';
import { AlertTriangle, AlertCircle, Check, X } from 'lucide-react';
import type { Anomaly } from '../../types';
import { formatTime, getAnomalyTypeName } from '../../utils/formatters';
import { cn } from '../../lib/utils';

interface AnomalyPanelProps {
  anomalies: Anomaly[];
  onAcknowledge: (id: string) => void;
  onHighlight: (dataIndex: number) => void;
  className?: string;
}

export function AnomalyPanel({
  anomalies,
  onAcknowledge,
  onHighlight,
  className,
}: AnomalyPanelProps) {
  const criticalCount = anomalies.filter((a) => a.severity === 'critical').length;
  const warningCount = anomalies.filter((a) => a.severity === 'warning').length;

  return (
    <div className={cn('rounded-lg bg-slate-800/50 p-6', className)}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-orange-400" />
          <h3 className="text-lg font-medium text-white">异常记录</h3>
        </div>
        <div className="flex items-center space-x-3 text-sm">
          <span className="flex items-center space-x-1 text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span>严重 {criticalCount}</span>
          </span>
          <span className="flex items-center space-x-1 text-orange-400">
            <AlertTriangle className="h-4 w-4" />
            <span>警告 {warningCount}</span>
          </span>
        </div>
      </div>

      <div className="max-h-96 space-y-2 overflow-y-auto">
        {anomalies.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-slate-500">
            <Check className="mb-2 h-8 w-8 text-green-500" />
            <p>未检测到异常</p>
          </div>
        ) : (
          anomalies.map((anomaly) => (
            <div
              key={anomaly.id}
              className={cn(
                'rounded-md p-3 transition-all',
                anomaly.severity === 'critical'
                  ? 'bg-red-500/10 border-l-4 border-red-500'
                  : 'bg-orange-500/10 border-l-4 border-orange-500',
                anomaly.acknowledged && 'opacity-60'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={cn(
                        'rounded px-2 py-0.5 text-xs font-medium',
                        anomaly.severity === 'critical'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-orange-500/20 text-orange-400'
                      )}
                    >
                      {anomaly.severity === 'critical' ? '严重' : '警告'}
                    </span>
                    <span className="text-sm font-medium text-white">
                      {getAnomalyTypeName(anomaly.type)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatTime(anomaly.timestamp)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{anomaly.reason}</p>
                  <div className="mt-1 flex items-center space-x-4 text-xs text-slate-400">
                    <span>数值: {anomaly.value.toFixed(2)}</span>
                    <span>阈值: {anomaly.threshold.toFixed(2)}</span>
                    <span>偏差: {anomaly.deviation.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onHighlight(anomaly.dataIndex)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-cyan-400"
                    title="在图表中定位"
                  >
                    <AlertCircle className="h-4 w-4" />
                  </button>
                  {!anomaly.acknowledged && (
                    <button
                      onClick={() => onAcknowledge(anomaly.id)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-green-400"
                      title="标记为已确认"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
