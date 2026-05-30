import { useMemo } from 'react';
import { GitMerge, Check, X, AlertCircle, User, Clock } from 'lucide-react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useUILayoutStore } from '../../store/useUILayoutStore';
import { ConflictResolver } from '../../engine/ConflictResolver';

export function ConflictPanel() {
  const showConflictPanel = useUILayoutStore((state) => state.showConflictPanel);
  const toggleConflictPanel = useUILayoutStore((state) => state.toggleConflictPanel);
  const conflictLogs = useSimulationStore((state) => state.conflictLogs);
  const resolveConflict = useSimulationStore((state) => state.resolveConflict);

  const pendingConflicts = useMemo(() => {
    return conflictLogs
      .filter((c) => c.resolution === 'pending')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [conflictLogs]);

  const resolvedConflicts = useMemo(() => {
    return conflictLogs
      .filter((c) => c.resolution !== 'pending')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  }, [conflictLogs]);

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      station_hall: '站厅主信息',
      turnstile: '闸机补证据',
      escalator: '扶梯补证据',
    };
    return labels[source] || source;
  };

  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
      station_hall: '#00D4FF',
      turnstile: '#FFB800',
      escalator: '#FF9500',
    };
    return colors[source] || '#9CA3AF';
  };

  const handleAutoResolve = (conflictId: string) => {
    resolveConflict(conflictId, 'auto', '', '系统');
  };

  const handleManualResolve = (conflictId: string, decision: string) => {
    resolveConflict(conflictId, 'manual', decision, '操作员');
  };

  if (!showConflictPanel) return null;

  return (
    <div className="fixed bottom-24 left-4 w-96 bg-slate-900/90 backdrop-blur-md border border-purple-500/30 rounded-xl shadow-2xl z-40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-gradient-to-r from-purple-500/10 to-transparent">
        <div className="flex items-center gap-2">
          <GitMerge className="text-purple-400" size={20} />
          <h2 className="text-purple-400 font-bold text-sm">数据冲突留痕</h2>
          {pendingConflicts.length > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/30 text-purple-400 border border-purple-500/50">
              {pendingConflicts.length}待处理
            </span>
          )}
        </div>
        <button
          onClick={toggleConflictPanel}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {pendingConflicts.length === 0 && resolvedConflicts.length === 0 ? (
          <div className="p-6 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="text-green-400" size={20} />
            </div>
            <p className="text-slate-400 text-sm">暂无数据冲突</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {pendingConflicts.map((conflict) => {
              const needsManual = ConflictResolver.shouldManualResolve(conflict);
              return (
                <div key={conflict.id} className="p-3 bg-purple-500/5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="text-purple-400" size={14} />
                      <span className="text-white text-sm font-medium">{conflict.conflictType}</span>
                    </div>
                    <span className="text-purple-400 text-xs">待处理</span>
                  </div>

                  <div className="flex items-center gap-1 mb-2">
                    <Clock size={10} className="text-slate-500" />
                    <span className="text-slate-500 text-xs">{conflict.timestamp}</span>
                  </div>

                  <div className="bg-slate-800/50 rounded-lg p-2 mb-2">
                    <div className="text-xs text-slate-400 mb-1.5">数据源对比（置信度）</div>
                    <div className="space-y-1">
                      {Object.entries(conflict.sources)
                        .filter(([_, value]) => value !== undefined)
                        .map(([source, _], idx) => {
                          const scores = Object.values(conflict.confidenceScores);
                          return (
                            <div key={source} className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: getSourceColor(source) }}
                                />
                                <span className="text-slate-300 text-xs">{getSourceLabel(source)}</span>
                              </div>
                              <span
                                className="text-xs font-mono font-bold"
                                style={{ color: getSourceColor(source) }}
                              >
                                {Math.round(scores[idx] * 100)}%
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {conflict.rawValues && (
                    <div className="bg-slate-800/30 rounded px-2 py-1 mb-2">
                      <div className="text-xs text-slate-500">原始数据</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        {JSON.stringify(conflict.rawValues)}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {needsManual ? (
                      <>
                        <button
                          onClick={() => handleManualResolve(conflict.id, Object.keys(conflict.sources)[0] || 'concourse')}
                          className="flex-1 px-2 py-1.5 text-xs rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/30 transition-colors"
                        >
                          采信{getSourceLabel(Object.keys(conflict.sources)[0] || 'concourse')}
                        </button>
                        <button
                          onClick={() => handleManualResolve(conflict.id, Object.keys(conflict.sources)[1] || 'turnstile')}
                          className="flex-1 px-2 py-1.5 text-xs rounded bg-orange-500/20 text-orange-400 border border-orange-500/50 hover:bg-orange-500/30 transition-colors"
                        >
                          采信{getSourceLabel(Object.keys(conflict.sources)[1] || 'turnstile')}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleAutoResolve(conflict.id)}
                        className="flex-1 px-3 py-1.5 text-xs rounded bg-purple-500/20 text-purple-400 border border-purple-500/50 hover:bg-purple-500/30 transition-colors"
                      >
                        自动解决（采信{getSourceLabel(Object.keys(conflict.sources).find((k) => k !== undefined) || 'station_hall')}）
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {resolvedConflicts.map((conflict) => (
              <div key={conflict.id} className="p-3 opacity-60">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Check className="text-green-400" size={14} />
                    <span className="text-slate-300 text-sm">{conflict.conflictType}</span>
                  </div>
                  <span className={`text-xs ${
                    conflict.resolution === 'auto_resolved' ? 'text-cyan-400' : 'text-orange-400'
                  }`}>
                    {conflict.resolution === 'auto_resolved' ? '自动解决' : '人工解决'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock size={10} />
                  {conflict.timestamp}
                  {conflict.resolvedBy && (
                    <>
                      <User size={10} className="ml-1" />
                      {conflict.resolvedBy}
                    </>
                  )}
                </div>
                {conflict.notes && (
                  <div className="mt-1 text-xs text-slate-400 bg-slate-800/30 rounded px-2 py-0.5">
                    处理: {conflict.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
