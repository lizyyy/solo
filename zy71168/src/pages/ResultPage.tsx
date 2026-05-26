import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { getLevelById } from '../data/levels';
import { getChemicalById } from '../data/chemicals';
import { calculateScoreDetail, getScoreRating, getRatingColor, getViolationTypeLabel } from '../engine/scoring';
import { Shelf } from '../components/game/Shelf';
import { Download, Home, RotateCcw, Play, Pause, SkipBack, SkipForward, Clock, Trophy, AlertCircle, CheckCircle, XCircle, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import { generateReport } from '../utils/export';
import { ScoreDetail, Operation } from '../types';

export const ResultPage: React.FC = () => {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);

  const status = useGameStore(state => state.status);
  const score = useGameStore(state => state.score);
  const timeRemaining = useGameStore(state => state.timeRemaining);
  const grid = useGameStore(state => state.grid);
  const temperature = useGameStore(state => state.temperature);
  const placedChemicals = useGameStore(state => state.placedChemicals);
  const violations = useGameStore(state => state.violations);
  const operationHistory = useGameStore(state => state.operationHistory);
  const failureReason = useGameStore(state => state.failureReason);
  const isReplaying = useGameStore(state => state.isReplaying);
  const replayIndex = useGameStore(state => state.replayIndex);
  const levelIdFromStore = useGameStore(state => state.levelId);

  const startLevel = useGameStore(state => state.startLevel);
  const startReplay = useGameStore(state => state.startReplay);
  const stopReplay = useGameStore(state => state.stopReplay);
  const replayStep = useGameStore(state => state.replayStep);
  const replayNext = useGameStore(state => state.replayNext);
  const replayPrev = useGameStore(state => state.replayPrev);
  const reset = useGameStore(state => state.reset);

  const [isPlaying, setIsPlaying] = useState(false);
  const [scoreDetail, setScoreDetail] = useState<ScoreDetail | null>(null);

  const currentLevel = levelId ? getLevelById(parseInt(levelId, 10)) : null;

  useEffect(() => {
    if (!levelId) return;
    const id = parseInt(levelId, 10);
    if (levelIdFromStore !== id) {
      navigate('/');
      return;
    }

    if (status !== 'completed' && status !== 'failed') {
      navigate(`/game/${levelId}`);
      return;
    }

    if (currentLevel) {
      const detail = calculateScoreDetail(
        currentLevel.baseScore,
        operationHistory,
        timeRemaining,
        currentLevel.timeLimit,
        grid,
        placedChemicals,
        temperature
      );
      setScoreDetail(detail);
    }
  }, [levelId, levelIdFromStore, status, currentLevel, operationHistory, timeRemaining, grid, placedChemicals, temperature, navigate]);

  useEffect(() => {
    if (!isPlaying || !isReplaying) return;

    const interval = setInterval(() => {
      if (replayIndex < operationHistory.length - 1) {
        replayNext();
      } else {
        setIsPlaying(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, isReplaying, replayIndex, operationHistory.length, replayNext]);

  const handleStartReplay = () => {
    startReplay();
    setIsPlaying(false);
  };

  const handleStopReplay = () => {
    stopReplay();
    setIsPlaying(false);
  };

  const handlePlayPause = () => {
    if (!isReplaying) {
      handleStartReplay();
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleExportReport = () => {
    if (!currentLevel || !scoreDetail) return;
    generateReport({
      level: currentLevel,
      scoreDetail,
      violations,
      operationHistory,
      isSuccess: status === 'completed',
      failureReason
    });
  };

  const handleRestart = () => {
    if (levelId) {
      const id = parseInt(levelId, 10);
      startLevel(id);
      navigate(`/game/${levelId}`);
    }
  };

  const handleHome = () => {
    reset();
    navigate('/');
  };

  if (!currentLevel || !scoreDetail) {
    return null;
  }

  const rating = getScoreRating(scoreDetail.totalScore, currentLevel.targetScore);
  const timeUsed = currentLevel.timeLimit - Math.max(0, timeRemaining);
  const isSuccess = status === 'completed';

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    return `${seconds < 0 ? '-' : ''}${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const scoreItems = [
    { label: '基础分', value: scoreDetail.baseScore, type: 'positive' },
    { label: '摆放得分', value: scoreDetail.placementScore, type: 'positive' },
    { label: '完美隔离奖励', value: scoreDetail.isolationBonus, type: 'positive' },
    { label: '温度合规奖励', value: scoreDetail.temperatureBonus, type: 'positive' },
    { label: '提前完成奖励', value: scoreDetail.timeBonus, type: 'positive' },
    { label: '禁忌相邻扣分', value: -scoreDetail.adjacencyPenalty, type: 'negative' },
    { label: '温度超限扣分', value: -scoreDetail.temperaturePenalty, type: 'negative' },
    { label: '隔离不足扣分', value: -scoreDetail.isolationPenalty, type: 'negative' },
    { label: '区域错误扣分', value: -scoreDetail.zonePenalty, type: 'negative' },
    { label: '超时扣分', value: -scoreDetail.timePenalty, type: 'negative' }
  ];

  const getOperationSummary = (op: Operation): string => {
    const chemical = op.data.chemicalId ? getChemicalById(op.data.chemicalId) : null;
    switch (op.type) {
      case 'place':
        return `摆放 ${chemical?.name || '化学品'} 到 (${op.data.to?.row},${op.data.to?.col})`;
      case 'remove':
        return `移除 ${chemical?.name || '化学品'} 从 (${op.data.from?.row},${op.data.from?.col})`;
      case 'pause':
        return '暂停游戏';
      case 'resume':
        return '继续游戏';
      case 'end':
        return '游戏结束';
      default:
        return '未知操作';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">
              结算报告 - {currentLevel.name}
            </h1>
            <p className="text-slate-400">
              {isSuccess ? '🎉 恭喜完成关卡！' : '❌ 任务失败'}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExportReport}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              导出报告
            </button>
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              重新挑战
            </button>
            <button
              onClick={handleHome}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-xl font-medium transition-colors"
            >
              <Home className="w-4 h-4" />
              返回主页
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6 text-center"
            >
              <div className="mb-4">
                <span className={cn(
                  'text-8xl font-bold',
                  getRatingColor(rating)
                )}>
                  {rating}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <span className="text-4xl font-bold text-slate-100 font-mono">
                  {scoreDetail.totalScore}
                </span>
              </div>
              <p className="text-slate-400 text-sm">
                目标分数: {currentLevel.targetScore}
              </p>
              <div className="mt-4 h-2 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (scoreDetail.totalScore / currentLevel.targetScore) * 100)}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className={cn(
                    'h-full rounded-full',
                    rating === 'S' || rating === 'A' ? 'bg-green-500' :
                    rating === 'B' ? 'bg-blue-500' :
                    rating === 'C' ? 'bg-yellow-500' : 'bg-red-500'
                  )}
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6"
            >
              <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                得分明细
              </h3>
              <div className="space-y-2">
                {scoreItems.map((item, i) => (
                  item.value !== 0 && (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-slate-400 text-sm">{item.label}</span>
                      <span className={cn(
                        'font-mono font-bold',
                        item.type === 'positive' ? 'text-green-400' : 'text-red-400'
                      )}>
                        {item.value > 0 ? '+' : ''}{item.value}
                      </span>
                    </motion.div>
                  )
                ))}
                <div className="border-t border-slate-700 pt-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200 font-bold">最终得分</span>
                    <span className="text-2xl font-bold text-slate-100 font-mono">
                      {scoreDetail.totalScore}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6"
            >
              <h3 className="text-lg font-bold text-slate-200 mb-4">统计数据</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-slate-700/30 rounded-xl">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-slate-400">用时</span>
                  </div>
                  <span className="text-xl font-mono text-slate-200">{formatTime(timeUsed)}</span>
                </div>
                <div className="text-center p-3 bg-slate-700/30 rounded-xl">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-slate-400">已摆放</span>
                  </div>
                  <span className="text-xl font-mono text-slate-200">{placedChemicals.length}</span>
                </div>
                <div className="text-center p-3 bg-slate-700/30 rounded-xl">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-slate-400">违规次数</span>
                  </div>
                  <span className="text-xl font-mono text-slate-200">{violations.length}</span>
                </div>
                <div className="text-center p-3 bg-slate-700/30 rounded-xl">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-slate-400">操作次数</span>
                  </div>
                  <span className="text-xl font-mono text-slate-200">{operationHistory.length}</span>
                </div>
              </div>
            </motion.div>

            {!isSuccess && failureReason && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-red-900/30 rounded-2xl border border-red-500/30 p-6"
              >
                <h3 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  失败原因
                </h3>
                <p className="text-slate-300">{failureReason}</p>
                <div className="mt-4 p-4 bg-slate-800/50 rounded-xl">
                  <h4 className="font-medium text-slate-200 mb-2">改进建议</h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• 仔细查看化学品的存储要求和禁忌规则</li>
                    <li>• 注意特殊存储区域的使用（防爆柜、冷藏区、毒害区）</li>
                    <li>• 保持足够的隔离距离</li>
                    <li>• 关注温度变化，及时调整</li>
                  </ul>
                </div>
              </motion.div>
            )}
          </div>

          <div className="col-span-12 lg:col-span-8 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-200">
                  {isReplaying ? '历史回放' : '最终布局'}
                </h3>
                <div className="flex items-center gap-2">
                  {isReplaying ? (
                    <>
                      <button
                        onClick={() => replayStep(0)}
                        className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>
                      <button
                        onClick={replayPrev}
                        disabled={replayIndex === 0}
                        className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-50"
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handlePlayPause}
                        className="p-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                      >
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={replayNext}
                        disabled={replayIndex >= operationHistory.length - 1}
                        className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-50"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleStopReplay}
                        className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
                      >
                        停止回放
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleStartReplay}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      开始回放
                    </button>
                  )}
                </div>
              </div>

              {isReplaying && (
                <div className="mb-4">
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-sm text-slate-400">
                      操作 {replayIndex + 1} / {operationHistory.length}
                    </span>
                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${((replayIndex + 1) / operationHistory.length) * 100}%` }}
                      />
                    </div>
                  </div>
                  {operationHistory[replayIndex] && (
                    <div className="text-sm text-slate-300">
                      {getOperationSummary(operationHistory[replayIndex])}
                      {operationHistory[replayIndex].scoreDelta !== 0 && (
                        <span className={cn(
                          'ml-2 font-bold',
                          operationHistory[replayIndex].scoreDelta > 0 ? 'text-green-400' : 'text-red-400'
                        )}>
                          ({operationHistory[replayIndex].scoreDelta > 0 ? '+' : ''}{operationHistory[replayIndex].scoreDelta})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <Shelf isReplaying={isReplaying} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6"
            >
              <h3 className="text-lg font-bold text-slate-200 mb-4">违规记录</h3>
              {violations.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <p>完美！没有任何违规记录</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {violations.map((v, i) => (
                    <motion.div
                      key={v.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      className="flex items-start gap-3 p-3 bg-red-900/20 rounded-xl border border-red-500/20"
                    >
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-slate-200">{v.description}</div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                          <span>{getViolationTypeLabel(v.type)}</span>
                          {v.penalty > 0 && (
                            <span className="text-red-400">-{v.penalty}分</span>
                          )}
                          {v.involvedCells.length > 0 && (
                            <span>
                              位置: {v.involvedCells.map(c => `(${c.row},${c.col})`).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6"
              ref={reportRef}
            >
              <h3 className="text-lg font-bold text-slate-200 mb-4">操作记录</h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {operationHistory.map((op, i) => (
                  <div
                    key={op.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm',
                      isReplaying && replayIndex === i ? 'bg-blue-600/30 border border-blue-500/30' : 'hover:bg-slate-700/30'
                    )}
                  >
                    <span className="text-slate-500 font-mono w-8">#{i + 1}</span>
                    <span className="flex-1 text-slate-300">
                      {getOperationSummary(op)}
                    </span>
                    {op.scoreDelta !== 0 && (
                      <span className={cn(
                        'font-mono font-bold',
                        op.scoreDelta > 0 ? 'text-green-400' : 'text-red-400'
                      )}>
                        {op.scoreDelta > 0 ? '+' : ''}{op.scoreDelta}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};
