import React, { useState } from 'react';
import { AlertTriangle, Check, X, ChevronDown, ChevronUp, Info, Lightbulb } from 'lucide-react';
import type { Anomaly } from '@/types';
import { StatusBadge } from './StatusBadge';
import { getAnomalyTypeLabel } from '@/utils/anomalyDetector';
import { useAppStore } from '@/store/appStore';

interface AnomalyCardProps {
  anomaly: Anomaly;
}

export const AnomalyCard: React.FC<AnomalyCardProps> = ({ anomaly }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { resolveAnomaly, ignoreAnomaly, currentOperator } = useAppStore();

  const handleResolve = () => {
    resolveAnomaly(anomaly.id, currentOperator);
  };

  const handleIgnore = () => {
    ignoreAnomaly(anomaly.id);
  };

  return (
    <div className={`border ${
      anomaly.status === 'open' 
        ? anomaly.severity === 'critical' || anomaly.severity === 'high'
          ? 'border-danger-300 bg-danger-50/30'
          : 'border-warning-300 bg-warning-50/30'
        : 'border-primary-200 bg-white'
    }`}>
      <div 
        className="p-4 cursor-pointer hover:bg-primary-50/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 mt-0.5 ${
              anomaly.severity === 'critical' || anomaly.severity === 'high'
                ? 'text-danger-500'
                : 'text-warning-500'
            }`} />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={anomaly.severity} size="sm" />
                <StatusBadge status={anomaly.status} size="sm" />
                <span className="font-mono text-xs text-primary-500">
                  {getAnomalyTypeLabel(anomaly.type)}
                </span>
              </div>
              <h4 className="font-medium text-primary-800">{anomaly.description}</h4>
              <p className="text-xs text-primary-500 mt-1 font-mono">
                影响记录: {anomaly.recordId} | 
                发现时间: {new Date(anomaly.detectedAt).toLocaleString()}
              </p>
              {anomaly.fieldName && (
                <p className="text-xs font-mono text-primary-500 mt-1">
                  字段: <span className="text-primary-700">{anomaly.fieldName}</span>
                  {anomaly.expectedValue !== undefined && (
                    <> | 预期: <span className="text-success-600">{anomaly.expectedValue}</span></>
                  )}
                  {anomaly.actualValue !== undefined && (
                    <> | 实际: <span className="text-danger-600">{anomaly.actualValue}</span></>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {anomaly.status === 'open' && (
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={handleResolve}
                  className="p-1.5 hover:bg-success-100 text-success-600 transition-colors"
                  title="标记已解决"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={handleIgnore}
                  className="p-1.5 hover:bg-primary-100 text-primary-500 transition-colors"
                  title="忽略此异常"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-primary-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-primary-400" />
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-primary-200 bg-white">
          <div className="grid md:grid-cols-2 gap-4 pt-4">
            <div className="p-3 bg-primary-50 border border-primary-200">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-info-500" />
                <h5 className="font-mono text-sm font-medium text-primary-700">异常原因解释</h5>
              </div>
              <p className="text-sm text-primary-600">{anomaly.explanation}</p>
            </div>
            <div className="p-3 bg-success-50/50 border border-success-200">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-success-600" />
                <h5 className="font-mono text-sm font-medium text-success-700">处理建议</h5>
              </div>
              <p className="text-sm text-primary-600">{anomaly.suggestion}</p>
            </div>
          </div>
          
          {anomaly.resolvedAt && (
            <div className="mt-3 p-2 bg-primary-50 text-xs text-primary-500 font-mono">
              {anomaly.status === 'resolved' ? '已解决' : '已忽略'} 于 {new Date(anomaly.resolvedAt).toLocaleString()} 
              {anomaly.resolvedBy && ` 由 ${anomaly.resolvedBy}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
