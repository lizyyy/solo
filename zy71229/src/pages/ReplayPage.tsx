import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Home, ChevronsLeft, ChevronsRight, Info, CheckCircle, XCircle } from 'lucide-react';
import { useHistoryStore } from '../store/useHistoryStore';
import { useGameStore } from '../store/useGameStore';
import { useReplayPlayer } from '../hooks/useReplayPlayer';
import { HallMap } from '../components/game/HallMap';
import { DataPanel } from '../components/game/DataPanel';
import { SourceBadge } from '../components/common/SourceBadge';
import { ANOMALY_TYPE_LABELS, ANOMALY_STATUS_LABELS } from '../game/types';
import { formatGameTime, formatVirtualTime } from '../game/engine';

export const ReplayPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loadReplay, history } = useHistoryStore();
  const { state } = useGameStore();
  const [replayData, setReplayData] = useState<any>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    if (id) {
      const data = loadReplay(id);
      if (data) {
        setReplayData(data);
      } else {
        navigate('/');
      }
    }
  }, [id, loadReplay, navigate]);

  const player = useReplayPlayer(replayData, { autoPlay: false });

  const currentRecord = history.find(h => h.replayDataId === id);
  const currentAnomaly = player.currentDecision 
    ? replayData?.anomalies?.find((a: any) => a.id === player.currentDecision?.anomalyId)
    : null;

  const progress = player.totalTime > 0 ? (player.currentTime / player.totalTime) * 100 : 0;

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    player.seekTo(percentage * player.totalTime);
  };

  if (!replayData) {
    return (
      <div className="min-h-screen bg-night-700 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p>加载回放数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-night-700 flex flex-col">
      <header className="bg-night-600 border-b border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold font-mono text-white">复盘回放</h1>
            {currentRecord && (
              <span className="text-sm text-gray-400">
                {new Date(currentRecord.startTime).toLocaleString('zh-CN')} · 得分 {currentRecord.finalScore}
              </span>
            )}
          </div>
          <button
            onClick={() => navigate('/')}
            className="glow-btn px-3 py-1.5 text-xs flex items-center gap-1"
          >
            <Home size={14} />
            返回主页
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r border-gray-700 flex flex-col overflow-hidden">
          <div className="p-3 overflow-y-auto flex-1 scrollbar-thin">
            <DataPanel />
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 flex-1 overflow-hidden">
            <HallMap />
          </div>

          <div className="p-3 bg-night-600 border-t border-gray-700">
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="font-mono">{formatGameTime(player.currentTime)}</span>
                <span className="font-mono">{formatVirtualTime(player.currentTime)}</span>
                <span className="font-mono">{formatGameTime(player.totalTime)}</span>
              </div>
              <div
                className="w-full h-2 bg-night-700 rounded-sm cursor-pointer relative"
                onClick={handleTimelineClick}
              >
                <div
                  className="h-full bg-alert-blue transition-all"
                  style={{ width: `${progress}%` }}
                />
                {replayData?.decisions?.map((d: any, i: number) => {
                  const position = (d.timestamp / player.totalTime) * 100;
                  const isCurrent = i === player.currentDecisionIndex;
                  const isPast = i < player.currentDecisionIndex;
                  return (
                    <div
                      key={d.id}
                      className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full cursor-pointer transition-all ${
                        isCurrent
                          ? 'bg-alert-yellow scale-125 ring-2 ring-alert-yellow/50'
                          : isPast
                          ? 'bg-alert-green'
                          : 'bg-gray-600 hover:bg-gray-500'
                      }`}
                      style={{ left: `calc(${position}% - 6px)` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        player.seekTo(d.timestamp);
                      }}
                      title={`决策 ${i + 1}: ${ANOMALY_TYPE_LABELS[replayData.anomalies.find((a: any) => a.id === d.anomalyId)?.type] || '异常'}`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={player.reset}
                  className="p-2 text-gray-400 hover:text-gray-200 transition-colors"
                  title="重置"
                >
                  <RotateCcw size={18} />
                </button>
                <button
                  onClick={player.stepBackward}
                  className="p-2 text-gray-400 hover:text-gray-200 transition-colors"
                  title="上一个决策"
                >
                  <SkipBack size={18} />
                </button>
                <button
                  onClick={player.togglePlay}
                  className="p-3 bg-alert-blue text-white hover:bg-alert-blue/80 transition-colors rounded-sm"
                  title={player.isPlaying ? '暂停' : '播放'}
                >
                  {player.isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <button
                  onClick={player.stepForward}
                  className="p-2 text-gray-400 hover:text-gray-200 transition-colors"
                  title="下一个决策"
                >
                  <SkipForward size={18} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">速度:</span>
                {[0.5, 1, 2, 4].map(s => (
                  <button
                    key={s}
                    onClick={() => player.setSpeed(s)}
                    className={`px-2 py-1 text-xs font-mono border transition-colors ${
                      player.speed === s
                        ? 'border-alert-blue text-alert-blue bg-alert-blue/10'
                        : 'border-gray-600 text-gray-400 hover:border-gray-400'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              <div className="text-xs text-gray-500 font-mono">
                决策 {player.currentDecisionIndex + 1} / {player.totalDecisions}
              </div>
            </div>
          </div>
        </div>

        <div className="w-80 border-l border-gray-700 flex flex-col overflow-hidden">
          <div className="p-3 overflow-y-auto flex-1 scrollbar-thin">
            {player.currentDecision && currentAnomaly ? (
              <div className="space-y-4">
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">当前决策点</span>
                    <button
                      onClick={() => setShowExplanation(!showExplanation)}
                      className="p-1 text-gray-400 hover:text-alert-yellow transition-colors"
                      title="显示原理解释"
                    >
                      <Info size={16} />
                    </button>
                  </div>
                  <div className="p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      {player.currentDecision.isCorrect ? (
                        <CheckCircle size={20} className="text-alert-green" />
                      ) : (
                        <XCircle size={20} className="text-alert-red" />
                      )}
                      <span className={`font-semibold ${
                        player.currentDecision.isCorrect ? 'text-alert-green' : 'text-alert-red'
                      }`}>
                        {player.currentDecision.isCorrect ? '处理正确' : '处理有误'}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500 mb-1">异常类型</div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-200">
                          {ANOMALY_TYPE_LABELS[currentAnomaly.type]}
                        </span>
                        <SourceBadge source={currentAnomaly.source} />
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500 mb-1">异常描述</div>
                      <p className="text-sm text-gray-300">{currentAnomaly.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">玩家选择</div>
                        <div className={`text-sm font-medium ${
                          player.currentDecision.isCorrect ? 'text-alert-green' : 'text-alert-red'
                        }`}>
                          {ANOMALY_STATUS_LABELS[player.currentDecision.choice]}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">正确动作</div>
                        <div className="text-sm font-medium text-alert-green">
                          {ANOMALY_STATUS_LABELS[currentAnomaly.correctAction]}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500 mb-1">决策耗时</div>
                      <div className="text-sm text-gray-300 font-mono">
                        {player.currentDecision.timeSpent} 秒
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500 mb-1">查阅的数据源</div>
                      <div className="flex flex-wrap gap-1">
                        {player.currentDecision.evidenceUsed.length > 0 ? (
                          player.currentDecision.evidenceUsed.map((s, i) => (
                            <SourceBadge key={i} source={s} />
                          ))
                        ) : (
                          <span className="text-xs text-alert-red">未查看任何数据源</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {showExplanation && (
                  <div className="panel border-l-4 border-l-alert-yellow animate-slide-in">
                    <div className="panel-header">
                      <span className="panel-title text-alert-yellow">培训注解</span>
                    </div>
                    <div className="p-3">
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {currentAnomaly.explanation}
                      </p>
                      <div className="mt-3 p-3 bg-night-700 border border-gray-700">
                        <div className="text-xs text-gray-500 mb-2">相关证据</div>
                        <div className="space-y-2">
                          {currentAnomaly.evidence.map((ev: any, i: number) => (
                            <div key={i} className="text-xs">
                              <div className="flex items-center gap-1 mb-1">
                                <SourceBadge source={ev.source} />
                                <span className="text-gray-500 font-mono">
                                  {formatGameTime(ev.timestamp)}
                                </span>
                              </div>
                              <pre className="text-gray-400 font-mono bg-night-800 p-2 rounded-sm overflow-x-auto">
                                {JSON.stringify(ev.data, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {player.nextDecision && (
                  <button
                    onClick={player.stepForward}
                    className="w-full glow-btn-primary py-3 flex items-center justify-center gap-2"
                  >
                    跳转到下一个决策
                    <SkipForward size={16} />
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Info size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">点击播放或点击时间轴上的决策点</p>
                <p className="text-xs mt-1">查看决策详解</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
