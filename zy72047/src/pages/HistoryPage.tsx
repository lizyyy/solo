import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Zap,
  Heart,
  AlertTriangle,
  Clock,
  User,
  Music,
  Trash2,
  ChevronRight,
  Gauge,
  FastForward,
} from 'lucide-react';
import { useHistoryStore } from '@/store/useHistoryStore';
import { HistoryReplayer } from '@/engine/HistoryReplayer';
import { cn } from '@/lib/utils';
import type { GameRound } from '@/types/game';
import type { TimelineEvent } from '@/types/audit';

export default function HistoryPage() {
  const {
    rounds,
    loadAllData,
    selectedRoundId,
    setSelectedRound,
    getRoundWithData,
    deleteRound,
    clearAllHistory,
  } = useHistoryStore();

  const [replayer, setReplayer] = useState<HistoryReplayer | null>(null);
  const [replayState, setReplayState] = useState(replayer?.getState() || null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000);
  const replayerRef = useRef<HistoryReplayer | null>(null);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    if (selectedRoundId) {
      const data = getRoundWithData(selectedRoundId);
      if (data.round) {
        const newReplayer = new HistoryReplayer(
          data.round,
          data.operations,
          data.notes,
          data.conflicts
        );
        replayerRef.current = newReplayer;
        setReplayer(newReplayer);
        setTimeline(newReplayer.getTimeline());
        setReplayState(newReplayer.getState());

        const unsubscribe = newReplayer.subscribe((state) => {
          setReplayState({ ...state });
        });

        return () => {
          unsubscribe();
          newReplayer.destroy();
        };
      }
    } else {
      setReplayer(null);
      setTimeline([]);
      setReplayState(null);
    }
  }, [selectedRoundId, getRoundWithData]);

  const selectedData = selectedRoundId ? getRoundWithData(selectedRoundId) : null;

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 bg-green-500/20';
      case 'active':
        return 'text-blue-400 bg-blue-500/20';
      case 'paused':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'cancelled':
        return 'text-red-400 bg-red-500/20';
      default:
        return 'text-vinyl-400 bg-vinyl-500/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'active':
        return '进行中';
      case 'paused':
        return '已暂停';
      case 'cancelled':
        return '已取消';
      default:
        return status;
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'operation':
        return <Zap size={14} className="text-blue-400" />;
      case 'note':
        return <Music size={14} className="text-purple-400" />;
      case 'conflict':
        return <AlertTriangle size={14} className="text-orange-400" />;
      case 'status_change':
        return <Clock size={14} className="text-green-400" />;
      case 'judgement':
        return <Gauge size={14} className="text-gold-400" />;
      default:
        return <Clock size={14} className="text-vinyl-400" />;
    }
  };

  const handlePlay = () => {
    replayer?.play(playbackSpeed);
  };

  const handlePause = () => {
    replayer?.stop();
  };

  const handleReset = () => {
    replayer?.reset();
  };

  const handlePrev = () => {
    replayer?.prevStep();
  };

  const handleNext = () => {
    replayer?.nextStep();
  };

  const handleGoToStep = (index: number) => {
    replayer?.goToStep(index);
  };

  const handleDeleteRound = (roundId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这条记录吗？')) {
      deleteRound(roundId);
    }
  };

  const handleClearAll = () => {
    if (confirm('确定要清空所有历史记录吗？此操作不可恢复。')) {
      clearAllHistory();
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <History className="text-gold-500" size={40} />
            <div>
              <h1 className="text-3xl font-bold text-gold-500">历史记录</h1>
              <p className="text-vinyl-400">查看和回放历史比赛记录</p>
            </div>
          </div>
          {rounds.length > 0 && (
            <button
              onClick={handleClearAll}
              className="bg-red-600/20 text-red-400 px-4 py-2 rounded-lg hover:bg-red-600/30 transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} />
              清空记录
            </button>
          )}
        </div>

        <div className="grid grid-cols-12 gap-6 min-h-[600px]">
          <div className="col-span-4 bg-vinyl-800/80 backdrop-blur rounded-xl border border-vinyl-700 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-vinyl-700">
              <h2 className="font-semibold text-vinyl-200">比赛局列表</h2>
              <p className="text-xs text-vinyl-500 mt-1">共 {rounds.length} 条记录</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {rounds.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-vinyl-500 py-20">
                  <History size={48} className="mb-4 opacity-50" />
                  <p>暂无历史记录</p>
                </div>
              ) : (
                <AnimatePresence>
                  {rounds.map((round: GameRound, index: number) => (
                    <motion.div
                      key={round.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setSelectedRound(round.id)}
                      className={cn(
                        'p-4 border-b border-vinyl-700 cursor-pointer transition-colors group',
                        selectedRoundId === round.id
                          ? 'bg-gold-500/10 border-l-4 border-l-gold-500'
                          : 'hover:bg-vinyl-700/50 border-l-4 border-l-transparent'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <User size={14} className="text-vinyl-400 flex-shrink-0" />
                            <span className="font-medium text-vinyl-100 truncate">{round.playerName}</span>
                            <span className={cn('px-1.5 py-0.5 rounded text-xs flex-shrink-0', getStatusColor(round.status))}>
                              {getStatusLabel(round.status)}
                            </span>
                          </div>
                          <div className="text-sm text-vinyl-400 mb-2 truncate">{round.levelName}</div>
                          <div className="flex items-center gap-3 text-xs text-vinyl-500">
                            <span className="flex items-center gap-1">
                              <Heart size={12} className="text-pink-400" />
                              {round.finalScore}/{round.targetScore}
                            </span>
                            <span className="flex items-center gap-1">
                              <Zap size={12} className="text-yellow-400" />
                              {round.finalResources}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {formatDateTime(round.startTime)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={(e) => handleDeleteRound(round.id, e)}
                            className="p-1.5 text-vinyl-500 hover:text-red-400 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                          <ChevronRight size={16} className={cn(
                            'text-vinyl-500 transition-transform',
                            selectedRoundId === round.id && 'rotate-90 text-gold-400'
                          )} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          <div className="col-span-8 flex flex-col gap-6 h-full">
            {!selectedData?.round ? (
              <div className="flex-1 bg-vinyl-800/80 backdrop-blur rounded-xl border border-vinyl-700 flex items-center justify-center">
                <div className="text-center text-vinyl-500">
                  <History size={64} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg">请选择一条比赛记录查看详情</p>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-vinyl-800/80 backdrop-blur rounded-xl border border-vinyl-700 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-vinyl-100">
                        {selectedData.round.playerName} - {selectedData.round.levelName}
                      </h2>
                      <p className="text-sm text-vinyl-400">
                        {formatDateTime(selectedData.round.startTime)} -{' '}
                        {selectedData.round.endTime ? formatDateTime(selectedData.round.endTime) : '进行中'}
                      </p>
                    </div>
                    <span className={cn('px-3 py-1 rounded-lg font-medium', getStatusColor(selectedData.round.status))}>
                      {getStatusLabel(selectedData.round.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-vinyl-900/50 rounded-lg p-4 flex items-center gap-3">
                      <Zap className="text-yellow-400" size={24} />
                      <div>
                        <div className="text-xs text-vinyl-500">资源</div>
                        <div className="text-xl font-bold text-yellow-400 font-mono">
                          {replayState ? replayState.resources : selectedData.round.finalResources}
                        </div>
                      </div>
                    </div>
                    <div className="bg-vinyl-900/50 rounded-lg p-4 flex items-center gap-3">
                      <Heart className="text-pink-400" size={24} />
                      <div>
                        <div className="text-xs text-vinyl-500">分数</div>
                        <div className="text-xl font-bold text-pink-400 font-mono">
                          {replayState ? replayState.score : selectedData.round.finalScore}
                          <span className="text-sm text-vinyl-500">/{selectedData.round.targetScore}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-vinyl-900/50 rounded-lg p-4 flex items-center gap-3">
                      <AlertTriangle className="text-orange-400" size={24} />
                      <div>
                        <div className="text-xs text-vinyl-500">风险</div>
                        <div className="text-xl font-bold text-orange-400 font-mono">
                          {replayState ? replayState.risk : selectedData.round.finalRisk}
                        </div>
                      </div>
                    </div>
                  </div>

                  {replayState && (
                    <div className="bg-vinyl-900/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleReset}
                            className="p-2 bg-vinyl-700 rounded-lg hover:bg-vinyl-600 text-vinyl-300 transition-colors"
                          >
                            <RotateCcw size={18} />
                          </button>
                          <button
                            onClick={handlePrev}
                            className="p-2 bg-vinyl-700 rounded-lg hover:bg-vinyl-600 text-vinyl-300 transition-colors"
                          >
                            <SkipBack size={18} />
                          </button>
                          {replayState.isPlaying ? (
                            <button
                              onClick={handlePause}
                              className="p-3 bg-gold-500 rounded-lg hover:bg-gold-400 text-vinyl-900 transition-colors"
                            >
                              <Pause size={20} />
                            </button>
                          ) : (
                            <button
                              onClick={handlePlay}
                              className="p-3 bg-gold-500 rounded-lg hover:bg-gold-400 text-vinyl-900 transition-colors"
                            >
                              <Play size={20} />
                            </button>
                          )}
                          <button
                            onClick={handleNext}
                            className="p-2 bg-vinyl-700 rounded-lg hover:bg-vinyl-600 text-vinyl-300 transition-colors"
                          >
                            <SkipForward size={18} />
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <FastForward size={14} className="text-vinyl-400" />
                            <select
                              value={playbackSpeed}
                              onChange={(e) => {
                                const speed = Number(e.target.value);
                                setPlaybackSpeed(speed);
                                if (replayer && replayState.isPlaying) {
                                  replayer.setPlaybackSpeed(speed);
                                }
                              }}
                              className="bg-vinyl-700 border border-vinyl-600 rounded px-2 py-1 text-sm text-vinyl-200 focus:border-gold-500 focus:outline-none"
                            >
                              <option value={2000}>0.5x</option>
                              <option value={1000}>1x</option>
                              <option value={500}>2x</option>
                              <option value={250}>4x</option>
                            </select>
                          </div>
                          <span className="text-sm text-vinyl-400 font-mono">
                            {replayState.stepIndex + 1} / {timeline.length}
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-vinyl-700 rounded-full h-2 mb-2">
                        <motion.div
                          className="bg-gold-500 h-2 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${replayState.stepIndex >= 0 ? ((replayState.stepIndex + 1) / timeline.length) * 100 : 0}%` }}
                        />
                      </div>

                      {replayState.currentEvent && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-vinyl-300 bg-vinyl-800/80 p-2 rounded"
                        >
                          <span className="text-vinyl-500 mr-2">
                            {formatDateTime(replayState.currentEvent.timestamp)}
                          </span>
                          <span className="text-gold-400 font-medium">
                            {replayState.currentEvent.title}
                          </span>
                          <span className="text-vinyl-400 ml-2">
                            - {replayState.currentEvent.description}
                          </span>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 bg-vinyl-800/80 backdrop-blur rounded-xl border border-vinyl-700 flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-vinyl-700">
                    <h2 className="font-semibold text-vinyl-200">时间线</h2>
                    <p className="text-xs text-vinyl-500 mt-1">共 {timeline.length} 个事件</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    {timeline.length === 0 ? (
                      <div className="text-center text-vinyl-500 py-10">
                        暂无时间线数据
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-vinyl-600" />
                        {timeline.map((event, index) => (
                          <motion.div
                            key={event.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.02 }}
                            onClick={() => handleGoToStep(index)}
                            className={cn(
                              'relative pl-10 pb-4 cursor-pointer group',
                              index === timeline.length - 1 && 'pb-0'
                            )}
                          >
                            <div
                              className={cn(
                                'absolute left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center',
                                replayState?.stepIndex === index
                                  ? 'border-gold-500 bg-gold-500 text-vinyl-900 scale-125'
                                  : replayState && replayState.stepIndex > index
                                  ? 'border-green-500 bg-green-500/20 text-green-400'
                                  : 'border-vinyl-500 bg-vinyl-800 text-vinyl-400 group-hover:border-gold-500'
                              )}
                            >
                              {getEventTypeIcon(event.type)}
                            </div>

                            <div
                              className={cn(
                                'p-3 rounded-lg transition-colors',
                                replayState?.stepIndex === index
                                  ? 'bg-gold-500/10 border border-gold-500/30'
                                  : 'bg-vinyl-900/50 border border-transparent hover:border-vinyl-600'
                              )}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-vinyl-200">{event.title}</span>
                                <span className="text-xs text-vinyl-500 font-mono">
                                  {formatDateTime(event.timestamp)}
                                </span>
                              </div>
                              <p className="text-sm text-vinyl-400 mb-2">{event.description}</p>
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-vinyl-500">
                                  操作人: <span className="text-vinyl-300">{event.operator}</span>
                                </span>
                                <span className="text-vinyl-500">
                                  来源: <span className="text-vinyl-300">{event.source}</span>
                                </span>
                              </div>
                              {event.metadata && Object.keys(event.metadata).length > 0 && (
                                <div className="mt-2 text-xs text-vinyl-500 bg-vinyl-800/50 p-2 rounded">
                                  {JSON.stringify(event.metadata)}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
