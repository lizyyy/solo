import React, { useState } from 'react';
import { AlertTriangle, Clock, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useCurlingStore } from '../../store/curlingStore';

export const AnalysisPanel: React.FC = () => {
  const { errors, collisions, dataSources, evidenceLogs, selectStone } = useCurlingStore();
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const getSourceName = (sourceId: string): string => {
    const source = dataSources.find(s => s.id === sourceId);
    return source?.name || '未知来源';
  };

  const getErrorIcon = (type: string) => {
    switch (type) {
      case 'friction_too_low':
        return <AlertTriangle className="text-yellow-400" size={16} />;
      case 'rotation_reversed':
        return <AlertCircle className="text-orange-400" size={16} />;
      case 'velocity_out_of_range':
        return <AlertCircle className="text-red-400" size={16} />;
      default:
        return <AlertTriangle className="text-yellow-400" size={16} />;
    }
  };

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold text-white">分析面板</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="text-yellow-400" size={18} />
            <h3 className="text-sm font-semibold text-white">
              错误与警告 ({errors.length})
            </h3>
          </div>

          {errors.length === 0 ? (
            <div className="flex items-center gap-2 p-3 bg-gray-800 rounded text-sm text-gray-400">
              <CheckCircle className="text-green-400" size={16} />
              <span>所有参数正常</span>
            </div>
          ) : (
            <div className="space-y-2">
              {errors.map(error => (
                <div
                  key={error.id}
                  className={`rounded overflow-hidden ${
                    error.severity === 'error'
                      ? 'border border-red-800'
                      : 'border border-yellow-900'
                  }`}
                >
                  <button
                    onClick={() => setExpandedError(
                      expandedError === error.id ? null : error.id
                    )}
                    className="w-full p-3 bg-gray-800 hover:bg-gray-750 flex items-start gap-2 text-left"
                  >
                    {getErrorIcon(error.type)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">
                        {error.message}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        来源: {getSourceName(error.sourceId)}
                      </div>
                    </div>
                    {expandedError === error.id ? (
                      <ChevronUp className="text-gray-400" size={14} />
                    ) : (
                      <ChevronDown className="text-gray-400" size={14} />
                    )}
                  </button>

                  {expandedError === error.id && (
                    <div className="p-3 bg-gray-850 border-t border-gray-700">
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">参数:</span>
                          <span className="text-white font-mono">
                            {error.evidence.parameterName}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">期望值:</span>
                          <span className="text-green-400 font-mono">
                            {error.evidence.expectedValue.toFixed(4)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">实际值:</span>
                          <span className="text-red-400 font-mono">
                            {error.evidence.actualValue.toFixed(4)}
                          </span>
                        </div>
                        
                        <div className="mt-2 p-2 bg-blue-900/30 border border-blue-700/50 rounded">
                          <div className="flex items-start gap-1.5">
                            <Info className="text-blue-400 mt-0.5" size={12} />
                            <span className="text-blue-300">{error.nextStep}</span>
                          </div>
                        </div>

                        {error.stoneId && (
                          <button
                            onClick={() => selectStone(error.stoneId!)}
                            className="w-full mt-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
                          >
                            定位到冰壶
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="text-orange-400" size={18} />
            <h3 className="text-sm font-semibold text-white">
              碰撞事件 ({collisions.length})
            </h3>
          </div>

          {collisions.length === 0 ? (
            <div className="p-3 bg-gray-800 rounded text-sm text-gray-400">
              未检测到碰撞
            </div>
          ) : (
            <div className="space-y-2">
              {collisions.map((collision, idx) => (
                <div
                  key={collision.id}
                  className="p-3 bg-gray-800 rounded border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white font-medium">
                      碰撞 #{idx + 1}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {collision.timestamp.toFixed(2)}s
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">位置:</span>
                      <span className="text-xs text-white font-mono">
                        ({collision.position.x.toFixed(2)}, {collision.position.y.toFixed(2)})
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="text-blue-400" size={18} />
            <h3 className="text-sm font-semibold text-white">
              操作记录 ({evidenceLogs.length})
            </h3>
          </div>

          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-700" />
            
            <div className="space-y-3">
              {evidenceLogs.map(log => (
                <div key={log.id} className="relative pl-6">
                  <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-gray-900" />
                  
                  <div>
                    <button
                      onClick={() => setExpandedLog(
                        expandedLog === log.id ? null : log.id
                      )}
                      className="text-left w-full"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white font-medium">
                          {log.action}
                        </span>
                        {expandedLog === log.id ? (
                          <ChevronUp className="text-gray-400" size={14} />
                        ) : (
                          <ChevronDown className="text-gray-400" size={14} />
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatTime(log.timestamp)}
                      </div>
                    </button>

                    {expandedLog === log.id && (
                      <div className="mt-2 p-2 bg-gray-800 rounded text-xs">
                        <div className="text-gray-300 mb-1">
                          {log.reason}
                        </div>
                        <div className="text-gray-500 font-mono text-[10px] bg-gray-900 p-2 rounded">
                          {JSON.stringify(log.dataSnapshot, null, 2)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
