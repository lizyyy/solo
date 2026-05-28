import { useState } from 'react';
import { AlertTriangle, AlertCircle, AlertOctagon, ChevronDown, ChevronUp, X, Info } from 'lucide-react';
import type { Anomaly } from '../../data/models/anomalies';
import { ANOMALY_TYPE_LABELS, ANOMALY_SEVERITY_LABELS, ANOMALY_SEVERITY_COLORS } from '../../data/models/anomalies';

interface AnomalyPanelProps {
  anomalies: Anomaly[];
}

export function AnomalyPanel({ anomalies }: AnomalyPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  if (anomalies.length === 0) return null;

  const stats = {
    high: anomalies.filter((a) => a.severity === 'high').length,
    medium: anomalies.filter((a) => a.severity === 'medium').length,
    low: anomalies.filter((a) => a.severity === 'low').length,
  };

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <AlertOctagon className="w-5 h-5 text-red-400" />;
      case 'medium':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-emerald-400" />;
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="px-4 py-3 bg-red-500/90 backdrop-blur-md rounded-xl border border-red-400/50 shadow-lg shadow-red-500/20 flex items-center gap-3 hover:bg-red-500 transition-all"
        >
          <AlertTriangle className="w-5 h-5 text-white animate-pulse" />
          <span className="text-sm font-semibold text-white">
            {anomalies.length} 个异常待处理
          </span>
          <div className="flex items-center gap-1 text-xs">
            {stats.high > 0 && (
              <span className="px-2 py-0.5 bg-red-700/50 rounded text-red-200">高{stats.high}</span>
            )}
            {stats.medium > 0 && (
              <span className="px-2 py-0.5 bg-amber-700/50 rounded text-amber-200">中{stats.medium}</span>
            )}
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-96 bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-2xl flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-700/50 flex items-center justify-between bg-gradient-to-r from-red-500/10 to-amber-500/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">数据异常检测</h3>
            <p className="text-xs text-slate-400">发现 {anomalies.length} 个问题需要注意</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {stats.high > 0 && (
              <span className="px-2 py-1 rounded-md bg-red-500/20 border border-red-400/30 text-xs font-semibold text-red-400">
                {stats.high} 高
              </span>
            )}
            {stats.medium > 0 && (
              <span className="px-2 py-1 rounded-md bg-amber-500/20 border border-amber-400/30 text-xs font-semibold text-amber-400">
                {stats.medium} 中
              </span>
            )}
            {stats.low > 0 && (
              <span className="px-2 py-1 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-xs font-semibold text-emerald-400">
                {stats.low} 低
              </span>
            )}
          </div>
          <button
            onClick={() => setIsMinimized(true)}
            className="w-8 h-8 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
        {anomalies.map((anomaly) => (
          <div
            key={anomaly.id}
            className="rounded-lg border overflow-hidden transition-all"
            style={{
              borderColor: `${ANOMALY_SEVERITY_COLORS[anomaly.severity]}30`,
              backgroundColor: `${ANOMALY_SEVERITY_COLORS[anomaly.severity]}08`,
            }}
          >
            <button
              className="w-full p-3 flex items-start justify-between hover:bg-slate-800/30 transition-colors"
              onClick={() => setExpandedId(expandedId === anomaly.id ? null : anomaly.id)}
            >
              <div className="flex items-start gap-3">
                {getIcon(anomaly.severity)}
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-200">{anomaly.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: `${ANOMALY_SEVERITY_COLORS[anomaly.severity]}20`,
                        color: ANOMALY_SEVERITY_COLORS[anomaly.severity],
                      }}
                    >
                      {ANOMALY_SEVERITY_LABELS[anomaly.severity]}
                    </span>
                    <span className="text-xs text-slate-500">
                      {ANOMALY_TYPE_LABELS[anomaly.type]}
                    </span>
                  </div>
                </div>
              </div>
              {expandedId === anomaly.id ? (
                <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
              )}
            </button>

            {expandedId === anomaly.id && (
              <div className="px-3 pb-3 pt-2 border-t border-slate-700/30">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                      <Info className="w-3 h-3" /> 问题描述
                    </p>
                    <p className="text-sm text-slate-300">{anomaly.description}</p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> 影响对象
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {anomaly.affectedIds.slice(0, 5).map((id) => (
                        <span
                          key={id}
                          className="text-xs px-2 py-0.5 rounded bg-slate-800/50 text-slate-400 font-mono"
                        >
                          {id}
                        </span>
                      ))}
                      {anomaly.affectedIds.length > 5 && (
                        <span className="text-xs px-2 py-0.5 text-slate-500">
                          +{anomaly.affectedIds.length - 5} 更多
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-400/20">
                    <p className="text-xs text-blue-400 font-semibold mb-1">💡 建议</p>
                    <p className="text-sm text-blue-300">{anomaly.suggestion}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
        <p className="text-xs text-slate-500 text-center">
          ⚠️ 上述异常可能影响分析结果准确性，建议修正后重新导入
        </p>
      </div>
    </div>
  );
}
