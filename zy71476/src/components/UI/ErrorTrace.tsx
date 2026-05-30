import React, { useState } from 'react';
import { useExperimentStore } from '../../store/useExperimentStore';
import { formatTime, getErrorTypeLabel, getErrorTypeColor } from '../../utils/validation';
import { AlertCircle, ChevronDown, ChevronUp, X, CheckCircle, Trash2 } from 'lucide-react';

const ErrorTrace: React.FC = () => {
  const { errorTraces, conflictTraces, clearTraces, resolveError } = useExperimentStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'errors' | 'conflicts'>('errors');

  const totalCount = errorTraces.length + conflictTraces.length;

  if (totalCount === 0 && !isExpanded) return null;

  const displayItems = activeTab === 'errors' ? errorTraces : conflictTraces;

  return (
    <div className="absolute bottom-4 right-4 z-20 w-96 max-w-[90vw]">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full glass rounded-xl p-4 flex items-center justify-between transition-all ${
          isExpanded ? 'rounded-b-none border-b-0' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <AlertCircle size={20} className="text-yellow-400" />
            {totalCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {totalCount}
              </span>
            )}
          </div>
          <div className="text-left">
            <h4 className="font-semibold text-dark-200 text-sm">异常记录</h4>
            <p className="text-xs text-dark-500">
              {errorTraces.length} 条错误 · {conflictTraces.length} 条冲突
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown size={20} className="text-dark-400" />
        ) : (
          <ChevronUp size={20} className="text-dark-400" />
        )}
      </button>

      {isExpanded && (
        <div className="glass rounded-b-xl p-4 border-t-0 max-h-80 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setActiveTab('errors')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'errors'
                  ? 'bg-dark-700 text-dark-100'
                  : 'text-dark-400 hover:text-dark-200'
              }`}
            >
              错误 ({errorTraces.length})
            </button>
            <button
              onClick={() => setActiveTab('conflicts')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'conflicts'
                  ? 'bg-dark-700 text-dark-100'
                  : 'text-dark-400 hover:text-dark-200'
              }`}
            >
              冲突 ({conflictTraces.length})
            </button>
            <button
              onClick={clearTraces}
              className="p-2 rounded-lg text-dark-400 hover:text-red-400 hover:bg-dark-700/50 transition-all"
              title="清空记录"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {displayItems.length === 0 ? (
              <div className="text-center py-8 text-dark-500">
                <CheckCircle size={32} className="mx-auto mb-2 text-green-500/50" />
                <p className="text-sm">暂无{activeTab === 'errors' ? '错误' : '冲突'}记录</p>
              </div>
            ) : activeTab === 'errors' ? (
              errorTraces.map((error) => (
                <div
                  key={error.id}
                  className={`p-3 rounded-lg relative timeline-item ml-5 ${
                    error.resolved
                      ? 'bg-green-500/10 border border-green-500/20'
                      : 'bg-dark-800/50 border border-dark-700/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getErrorTypeColor(error.type) }}
                      />
                      <span className="text-xs font-medium" style={{ color: getErrorTypeColor(error.type) }}>
                        {getErrorTypeLabel(error.type)}
                      </span>
                      {error.resolved && (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <CheckCircle size={12} /> 已处理
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-dark-500">{formatTime(error.timestamp)}</span>
                  </div>
                  <p className="text-sm text-dark-300 mb-2">{error.message}</p>
                  <div className="text-xs text-dark-500 font-mono">
                    角度: {error.params.angle}° · 质量: {error.params.mass}kg · 摩擦: {error.params.frictionCoefficient}
                  </div>
                  {!error.resolved && (
                    <button
                      onClick={() => resolveError(error.id)}
                      className="absolute top-2 right-2 p-1 rounded text-dark-400 hover:text-green-400"
                    >
                      <CheckCircle size={14} />
                    </button>
                  )}
                </div>
              ))
            ) : (
              conflictTraces.map((conflict) => (
                <div
                  key={conflict.id}
                  className="p-3 rounded-lg relative timeline-item ml-5 bg-purple-500/10 border border-purple-500/20"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-medium text-purple-400">参数冲突</span>
                    <span className="text-xs text-dark-500">{formatTime(conflict.timestamp)}</span>
                  </div>
                  <div className="space-y-1 text-xs mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-dark-500 w-16">角度证据:</span>
                      <span className="text-dark-300 flex-1">{conflict.angleEvidence.evidence}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-dark-500 w-16">摩擦证据:</span>
                      <span className="text-dark-300 flex-1">{conflict.frictionEvidence.evidence}</span>
                    </div>
                  </div>
                  <div className="text-xs text-dark-400 bg-dark-800/50 p-2 rounded">
                    <span className="text-primary-400 font-medium">处理结果: </span>
                    {conflict.resolution}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ErrorTrace;
