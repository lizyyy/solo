import { ArrowLeft, Trophy, Clock, Calendar, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { HistoryRecord, ActionRecord } from '@/types/game';
import { loadHistory, clearHistory } from '@/utils/history';

export default function HistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    if (!isPlaying || !selectedRecord || replayIndex >= selectedRecord.actions.length - 1) {
      return;
    }

    const timer = setInterval(() => {
      setReplayIndex((prev) => Math.min(prev + 1, selectedRecord.actions.length - 1));
    }, 500);

    return () => clearInterval(timer);
  }, [isPlaying, selectedRecord, replayIndex]);

  const getGradeColor = (grade: string): string => {
    switch (grade) {
      case 'S':
        return 'bg-amber-500/20 text-amber-400';
      case 'A':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'B':
        return 'bg-sky-500/20 text-sky-400';
      case 'C':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-red-500/20 text-red-400';
    }
  };

  const getActionTypeLabel = (type: ActionRecord['type']): string => {
    const labels: Record<string, string> = {
      dispatch: '派遣',
      cancel: '取消',
      repair: '维修完成',
      timeout: '超时',
      waste: '资源浪费',
      bonus: '奖励',
      base: '基础',
    };
    return labels[type] || type;
  };

  const getActionTypeColor = (type: ActionRecord['type']): string => {
    const colors: Record<string, string> = {
      dispatch: 'text-sky-400',
      cancel: 'text-orange-400',
      repair: 'text-emerald-400',
      timeout: 'text-red-400',
      waste: 'text-yellow-400',
      bonus: 'text-amber-400',
      base: 'text-slate-400',
    };
    return colors[type] || 'text-slate-400';
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleClearHistory = () => {
    if (confirm('确定要清空所有历史记录吗？')) {
      clearHistory();
      setHistory([]);
      setSelectedRecord(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            返回
          </button>
          <h1 className="text-2xl font-bold text-white">历史记录</h1>
          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 size={18} />
              清空
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">暂无历史记录</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 space-y-2">
              {history.map((record) => (
                <button
                  key={record.id}
                  onClick={() => {
                    setSelectedRecord(record);
                    setReplayIndex(0);
                    setIsPlaying(false);
                  }}
                  className={`w-full p-4 rounded-lg border transition-all text-left ${
                    selectedRecord?.id === record.id
                      ? 'bg-slate-700 border-amber-500'
                      : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`px-2 py-0.5 rounded text-sm font-bold ${getGradeColor(record.grade)}`}>
                      {record.grade}
                    </div>
                    <span className="text-xs text-slate-500">{formatDate(record.timestamp)}</span>
                  </div>
                  <div className="text-xl font-bold text-white mb-1">{record.finalScore} 分</div>
                  <div className="text-xs text-slate-400">关卡 {record.level}</div>
                </button>
              ))}
            </div>

            <div className="md:col-span-2">
              {selectedRecord ? (
                <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
                  <div className="p-4 border-b border-slate-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getGradeColor(selectedRecord.grade)}`}>
                          <Trophy size={24} />
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-white">{selectedRecord.finalScore} 分</div>
                          <div className="text-sm text-slate-400">
                            关卡 {selectedRecord.level} · {formatDate(selectedRecord.timestamp)}
                          </div>
                        </div>
                      </div>
                      {selectedRecord.failureReason && (
                        <div className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
                          {selectedRecord.failureReason}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2 text-sm">
                      <div className="bg-slate-700/50 rounded p-2 text-center">
                        <div className="text-emerald-400 font-bold">+{selectedRecord.scoreBreakdown.baseScore}</div>
                        <div className="text-xs text-slate-500">基础分</div>
                      </div>
                      <div className="bg-slate-700/50 rounded p-2 text-center">
                        <div className="text-amber-400 font-bold">+{selectedRecord.scoreBreakdown.priorityBonus}</div>
                        <div className="text-xs text-slate-500">优先级</div>
                      </div>
                      <div className="bg-slate-700/50 rounded p-2 text-center">
                        <div className="text-sky-400 font-bold">+{selectedRecord.scoreBreakdown.timeBonus}</div>
                        <div className="text-xs text-slate-500">时间奖励</div>
                      </div>
                      <div className="bg-slate-700/50 rounded p-2 text-center">
                        <div className="text-orange-400 font-bold">-{selectedRecord.scoreBreakdown.errorPenalty}</div>
                        <div className="text-xs text-slate-500">错误</div>
                      </div>
                      <div className="bg-slate-700/50 rounded p-2 text-center">
                        <div className="text-red-400 font-bold">-{selectedRecord.scoreBreakdown.timeoutPenalty}</div>
                        <div className="text-xs text-slate-500">超时</div>
                      </div>
                      <div className="bg-slate-700/50 rounded p-2 text-center">
                        <div className="text-yellow-400 font-bold">-{selectedRecord.scoreBreakdown.wastePenalty}</div>
                        <div className="text-xs text-slate-500">浪费</div>
                      </div>
                      <div className="bg-slate-700/50 rounded p-2 text-center">
                        <div className="text-cyan-400 font-bold">-{selectedRecord.scoreBreakdown.routeCostPenalty ?? 0}</div>
                        <div className="text-xs text-slate-500">路线成本</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-slate-400">操作回放</h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setIsPlaying(!isPlaying);
                          }}
                          className="px-3 py-1 rounded bg-slate-700 text-slate-300 text-sm hover:bg-slate-600"
                        >
                          {isPlaying ? '暂停' : '播放'}
                        </button>
                        <button
                          onClick={() => {
                            setReplayIndex(0);
                            setIsPlaying(false);
                          }}
                          className="px-3 py-1 rounded bg-slate-700 text-slate-300 text-sm hover:bg-slate-600"
                        >
                          重置
                        </button>
                      </div>
                    </div>

                    <div className="h-1 bg-slate-700 rounded-full mb-4">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{
                          width: `${(replayIndex / Math.max(selectedRecord.actions.length - 1, 1)) * 100}%`,
                        }}
                      />
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {selectedRecord.actions.slice(0, replayIndex + 1).map((action, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-2 rounded text-sm ${
                            idx === replayIndex
                              ? 'bg-slate-700/70'
                              : 'bg-slate-700/30'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-xs ${getActionTypeColor(action.type)}`}>
                              [{getActionTypeLabel(action.type)}]
                            </span>
                            <span className="text-slate-300">{action.details}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {action.scoreChange !== 0 && (
                              <span
                                className={`text-xs font-medium ${
                                  action.scoreChange > 0 ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              >
                                {action.scoreChange > 0 ? '+' : ''}{action.scoreChange}
                              </span>
                            )}
                            <span className="text-xs text-slate-500">
                              {Math.round(action.gameTime)}s
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-8 text-center">
                  <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">选择一条记录查看详情</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
