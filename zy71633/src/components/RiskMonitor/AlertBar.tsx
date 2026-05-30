import { useState } from 'react';
import { AlertTriangle, CheckCircle, X, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { Anomaly, AnomalySeverity } from '../../types';

const severityConfig: Record<AnomalySeverity, { bg: string; border: string; icon: any; label: string }> = {
  error: { bg: 'bg-danger-500/20', border: 'border-danger-500', icon: AlertTriangle, label: '错误' },
  warning: { bg: 'bg-warning-500/20', border: 'border-warning-500', icon: AlertTriangle, label: '警告' },
  info: { bg: 'bg-cyber-500/20', border: 'border-cyber-500', icon: Info, label: '提示' },
};

interface AlertItemProps {
  anomaly: Anomaly;
  onResolve: (id: string) => void;
  onFocus: (objectId?: string) => void;
}

function AlertItem({ anomaly, onResolve, onFocus }: AlertItemProps) {
  const [expanded, setExpanded] = useState(false);
  const config = severityConfig[anomaly.severity];
  const Icon = config.icon;

  return (
    <div className={`p-3 rounded-lg ${config.bg} border ${config.border} mb-2`}>
      <div className="flex items-start gap-2">
        <Icon size={18} className={`${anomaly.severity === 'error' ? 'text-danger-500' : anomaly.severity === 'warning' ? 'text-warning-500' : 'text-cyber-500'} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-jetbrains text-white truncate">{anomaly.description}</span>
            <div className="flex items-center gap-1 ml-2">
              {anomaly.objectId && (
                <button
                  onClick={() => onFocus(anomaly.objectId)}
                  className="text-xs text-cyber-400 hover:text-cyber-300 px-2 py-0.5 rounded bg-cyber-500/20"
                >
                  定位
                </button>
              )}
              <button
                onClick={() => onResolve(anomaly.id)}
                className="text-xs text-green-400 hover:text-green-300 px-2 py-0.5 rounded bg-green-500/20"
              >
                确认
              </button>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-gray-400 mt-1 hover:text-gray-300"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? '收起详情' : '查看详情'}
          </button>
          {expanded && (
            <div className="mt-2 p-2 bg-space-900/50 rounded text-xs text-gray-300 font-jetbrains">
              <p className="mb-1"><span className="text-gray-500">类型:</span> {anomaly.type}</p>
              <p className="mb-1"><span className="text-gray-500">建议:</span> {anomaly.suggestion}</p>
              <p><span className="text-gray-500">时间:</span> {anomaly.timestamp.toLocaleTimeString('zh-CN')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AlertBar() {
  const { anomalies, actions } = useSimulationStore();
  const [showPanel, setShowPanel] = useState(true);

  const unresolvedAnomalies = anomalies.filter((a) => !a.resolved);
  const hasError = unresolvedAnomalies.some((a) => a.severity === 'error');
  const hasWarning = unresolvedAnomalies.some((a) => a.severity === 'warning');

  if (unresolvedAnomalies.length === 0) return null;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 w-full max-w-2xl px-4">
      <div className={`p-3 rounded-lg backdrop-blur-md border ${
        hasError ? 'bg-danger-500/20 border-danger-500' :
        hasWarning ? 'bg-warning-500/20 border-warning-500' :
        'bg-cyber-500/20 border-cyber-500'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasError ? (
              <AlertTriangle size={20} className="text-danger-500 animate-pulse" />
            ) : hasWarning ? (
              <AlertTriangle size={20} className="text-warning-500" />
            ) : (
              <Info size={20} className="text-cyber-500" />
            )}
            <span className="font-jetbrains text-white">
              检测到 {unresolvedAnomalies.length} 个异常
              {hasError && <span className="text-danger-500 ml-2">（含严重错误）</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPanel(!showPanel)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              {showPanel ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
        </div>

        {showPanel && (
          <div className="mt-3 max-h-60 overflow-y-auto">
            {unresolvedAnomalies.map((anomaly) => (
              <AlertItem
                key={anomaly.id}
                anomaly={anomaly}
                onResolve={actions.resolveAnomaly}
                onFocus={(objectId) => objectId && actions.focusObject(objectId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
