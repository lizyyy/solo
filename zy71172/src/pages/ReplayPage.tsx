
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Download,
  Home,
  RotateCcw,
  Clock,
  Trophy,
  Target,
} from 'lucide-react';
import { useHistoryStore } from '@/store/useHistoryStore';
import { GameRecord, ReplayAction, TrashItem, CATEGORY_NAMES, CATEGORY_EMOJIS, CATEGORY_COLORS } from '@/types';
import { levels } from '@/data/levels';
import { cn } from '@/lib/utils';

interface ReplayDisplayItem {
  action: ReplayAction;
  trash: TrashItem | undefined;
  targetName: string;
  targetEmoji: string;
  targetColor: string;
}

export function ReplayPage() {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
  const { getRecordById, loadRecords, exportReport } = useHistoryStore();
  const [record, setRecord] = useState<GameRecord | null>(null);
  const [currentActionIndex, setCurrentActionIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (recordId) {
      const found = getRecordById(recordId);
      if (found) {
        setRecord(found);
        setCurrentActionIndex(-1);
      }
    }
  }, [recordId, getRecordById]);

  const getTrashFromAction = useCallback((action: ReplayAction): TrashItem | undefined => {
    if (!record) return undefined;
    const error = record.errors.find(e => e.trashItem.id === action.trashId);
    if (error) {
      return error.trashItem;
    }
    const firstAction = record.replayActions
      .filter(a => a.trashId === action.trashId)
      .sort((a, b) => a.timestamp - b.timestamp)[0];
    if (firstAction && firstAction.timestamp !== action.timestamp) return undefined;
    return undefined;
  }, [record]);

  const displayItems = useMemo((): ReplayDisplayItem[] => {
    if (!record) return [];
    return record.replayActions.map(action => {
      const target = action.target;
      let targetName = '';
      let targetEmoji = '';
      let targetColor = '#333';

      if (target === 'appointment') {
        targetName = '预约点';
        targetEmoji = '📅';
        targetColor = '#FF9800';
      } else if (target === 'bagBreak') {
        targetName = '破袋操作';
        targetEmoji = '✂️';
        targetColor = '#795548';
      } else if (target === 'clean') {
        targetName = '清洁操作';
        targetEmoji = '💧';
        targetColor = '#00BCD4';
      } else if (target in CATEGORY_NAMES) {
        targetName = CATEGORY_NAMES[target as keyof typeof CATEGORY_NAMES];
        targetEmoji = CATEGORY_EMOJIS[target as keyof typeof CATEGORY_EMOJIS];
        targetColor = CATEGORY_COLORS[target as keyof typeof CATEGORY_COLORS];
      }

      return {
        action,
        trash: getTrashFromAction(action),
        targetName,
        targetEmoji,
        targetColor,
      };
    });
  }, [record, getTrashFromAction]);

  const currentDisplayItem = currentActionIndex >= 0 && currentActionIndex < displayItems.length
    ? displayItems[currentActionIndex]
    : null;

  const displayedItems = currentActionIndex >= 0
    ? displayItems.slice(0, currentActionIndex + 1)
    : [];

  const totalDuration = record?.duration || 0;
  const currentTime = currentDisplayItem?.action.timestamp || 0;
  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const playNext = useCallback(() => {
    setCurrentActionIndex(prev => {
      if (prev >= displayItems.length - 1) {
        setIsPlaying(false);
        return prev;
      }
      return prev + 1;
    });
  }, [displayItems.length]);

  const playPrev = useCallback(() => {
    setCurrentActionIndex(prev => Math.max(-1, prev - 1));
  }, []);

  const goToStart = useCallback(() => {
    setCurrentActionIndex(-1);
    setIsPlaying(false);
  }, []);

  const goToEnd = useCallback(() => {
    setCurrentActionIndex(displayItems.length - 1);
    setIsPlaying(false);
  }, [displayItems.length]);

  useEffect(() => {
    if (isPlaying) {
      playbackIntervalRef.current = window.setInterval(() => {
        playNext();
      }, 2000 / playbackSpeed);
    } else if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, playNext]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!record) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const clickedTime = percentage * totalDuration;

    const nearestIndex = displayItems.findIndex(item => item.action.timestamp >= clickedTime);
    if (nearestIndex >= 0) {
      setCurrentActionIndex(nearestIndex);
    } else if (displayItems.length > 0) {
      setCurrentActionIndex(displayItems.length - 1);
    }
  };

  const handleExport = () => {
    if (record) {
      const report = exportReport(record);
      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `回放报告_${new Date(record.completedAt).toLocaleDateString()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!record) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin text-6xl mb-4">⏳</div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  const level = levels.find(l => l.id === record.levelId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-600 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/history')}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur hover:bg-white/30 text-white font-bold rounded-xl transition-colors"
            >
              <ArrowLeft size={20} />
              返回历史
            </button>
          </div>
          <h1 className="text-2xl font-bold text-white">🎬 历史回放</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur hover:bg-white/30 text-white font-bold rounded-xl transition-colors"
            >
              <Download size={20} />
              导出报告
            </button>
          </div>
        </div>

        {/* Game Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 shadow-2xl mb-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                {level?.name || `关卡${record.levelId}`}
              </h2>
              <p className="text-sm text-gray-500">
                {new Date(record.completedAt).toLocaleString('zh-CN')}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="flex items-center gap-1 text-yellow-500">
                  <Trophy size={20} />
                  <span className="text-2xl font-bold">{record.score}</span>
                </div>
                <div className="text-xs text-gray-500">得分</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">{record.accuracy}%</div>
                <div className="text-xs text-gray-500">准确率</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{record.correctCount}</div>
                <div className="text-xs text-gray-500">正确</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{record.wrongCount}</div>
                <div className="text-xs text-gray-500">错误</div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {formatTime(0)}
              </span>
              <span className="font-medium">
                操作 {currentActionIndex + 1} / {displayItems.length}
              </span>
              <span>{formatTime(totalDuration)}</span>
            </div>
            <div
              className="relative h-4 bg-gray-200 rounded-full cursor-pointer overflow-hidden"
              onClick={handleTimelineClick}
            >
              {/* Progress Fill */}
              <motion.div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 to-blue-500"
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />

              {/* Action Markers */}
              {displayItems.map((item, idx) => {
                const markerProgress = totalDuration > 0 ? (item.action.timestamp / totalDuration) * 100 : 0;
                return (
                  <div
                    key={idx}
                    className={cn(
                      'absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-md cursor-pointer',
                      idx <= currentActionIndex ? 'bg-white' : 'bg-gray-400',
                      item.action.type === 'drop' && !item.action.isCorrect && 'bg-red-400'
                    )}
                    style={{ left: `calc(${markerProgress}% - 6px)` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentActionIndex(idx);
                    }}
                    title={`${item.targetName} - ${item.action.isCorrect ? '正确' : '错误'}`}
                  />
                );
              })}

              {/* Playhead */}
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-4 border-purple-500 rounded-full shadow-lg cursor-grab active:cursor-grabbing z-10"
                style={{ left: `calc(${progress}% - 10px)` }}
                transition={{ duration: 0.2 }}
              />
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={goToStart}
              className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="回到开始"
            >
              <SkipBack size={24} />
            </button>
            <button
              onClick={playPrev}
              className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="上一帧"
              disabled={currentActionIndex < 0}
            >
              <ChevronLeft size={28} />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-4 bg-purple-500 hover:bg-purple-600 text-white rounded-full shadow-lg transition-colors"
              title={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
            </button>
            <button
              onClick={playNext}
              className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="下一帧"
              disabled={currentActionIndex >= displayItems.length - 1}
            >
              <ChevronRight size={28} />
            </button>
            <button
              onClick={goToEnd}
              className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="跳到结尾"
            >
              <SkipForward size={24} />
            </button>

            <div className="ml-6 flex items-center gap-2">
              <span className="text-sm text-gray-500">速度:</span>
              {[0.5, 1, 2].map(speed => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                    playbackSpeed === speed
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Current Action Display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Action Detail */}
          <motion.div
            key={currentActionIndex}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Target className="text-purple-500" />
              当前操作
            </h3>

            {currentDisplayItem ? (
              <div className="space-y-4">
                {/* Trash Item */}
                {currentDisplayItem.trash && (
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                    <span className="text-5xl">{currentDisplayItem.trash.emoji}</span>
                    <div>
                      <div className="font-bold text-gray-800 text-lg">
                        {currentDisplayItem.trash.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {CATEGORY_EMOJIS[currentDisplayItem.trash.category]} {CATEGORY_NAMES[currentDisplayItem.trash.category]}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Type */}
                <div
                  className="p-4 rounded-2xl border-2"
                  style={{ borderColor: currentDisplayItem.targetColor }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-3xl w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${currentDisplayItem.targetColor}20` }}
                    >
                      {currentDisplayItem.targetEmoji}
                    </span>
                    <div className="flex-1">
                      <div
                        className="font-bold text-lg"
                        style={{ color: currentDisplayItem.targetColor }}
                      >
                        {currentDisplayItem.targetName}
                      </div>
                      <div className="text-sm text-gray-500">
                        操作时间: {formatTime(currentDisplayItem.action.timestamp)}
                      </div>
                    </div>
                    <div
                      className={cn(
                        'px-4 py-2 rounded-full font-bold text-white',
                        currentDisplayItem.action.isCorrect ? 'bg-green-500' : 'bg-red-500'
                      )}
                    >
                      {currentDisplayItem.action.isCorrect ? '✓ 正确' : '✗ 错误'}
                    </div>
                  </div>
                </div>

                {/* Score Change */}
                {currentDisplayItem.action.scoreChange !== 0 && (
                  <div
                    className={cn(
                      'p-3 rounded-xl text-center font-bold text-lg',
                      currentDisplayItem.action.scoreChange > 0
                        ? 'bg-green-100 text-green-600'
                        : 'bg-red-100 text-red-600'
                    )}
                  >
                    {currentDisplayItem.action.scoreChange > 0 ? '+' : ''}
                    {currentDisplayItem.action.scoreChange} 分
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <RotateCcw className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>点击播放或时间轴开始回放</p>
              </div>
            )}
          </motion.div>

          {/* Action List */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-3xl p-6 shadow-2xl max-h-[500px] overflow-hidden flex flex-col"
          >
            <h3 className="text-lg font-bold text-gray-800 mb-4">操作列表</h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {displayItems.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  暂无操作记录
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {displayedItems.map((item, idx) => (
                    <motion.div
                      key={`${item.action.trashId}-${item.action.timestamp}-${idx}`}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      onClick={() => setCurrentActionIndex(idx)}
                      className={cn(
                        'p-3 rounded-xl cursor-pointer transition-all border-2',
                        idx === currentActionIndex
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-transparent bg-gray-50 hover:bg-gray-100'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-12">
                          {formatTime(item.action.timestamp)}
                        </span>
                        {item.trash && (
                          <span className="text-xl">{item.trash.emoji}</span>
                        )}
                        <div className="flex-1">
                          <div className="font-medium text-gray-800 text-sm">
                            {item.trash?.name || item.action.type}
                          </div>
                          <div className="text-xs text-gray-500">
                            → {item.targetName}
                          </div>
                        </div>
                        <div
                          className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold',
                            item.action.isCorrect ? 'bg-green-500' : 'bg-red-500'
                          )}
                        >
                          {item.action.isCorrect ? '✓' : '✗'}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-6 flex justify-center gap-4">
          <button
            onClick={() => navigate(`/game/${record.levelId}`)}
            className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors shadow-lg"
          >
            <Play size={20} />
            再来一局
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur hover:bg-white/30 text-white font-bold rounded-xl transition-colors"
          >
            <Home size={20} />
            返回主菜单
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReplayPage;
