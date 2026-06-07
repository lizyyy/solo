import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Square,
  Zap,
  Heart,
  AlertTriangle,
  Trophy,
  User,
  ChevronDown,
  Clock,
  Music,
  Disc,
  Info,
  X,
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { useLevelStore } from '@/store/useLevelStore';
import { useDragOperation } from '@/hooks/useDragOperation';
import { useClickOperation } from '@/hooks/useClickOperation';
import { cn } from '@/lib/utils';
import type { VinylElement, Operation } from '@/types/game';

export default function ConsolePage() {
  const [playerName, setPlayerName] = useState('');
  const [levelDropdownOpen, setLevelDropdownOpen] = useState(false);
  const [draggingElement, setDraggingElement] = useState<VinylElement | null>(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });

  const {
    currentRound,
    resources,
    score,
    risk,
    operations,
    isPaused,
    error,
    lastOperation,
    initEngine,
    startRound,
    pauseRound,
    resumeRound,
    endRound,
    resetGame,
    clearError,
  } = useGameStore();

  const { levels, currentLevel, setCurrentLevel, loadLevels } = useLevelStore();

  const dragOps = useDragOperation();
  const clickOps = useClickOperation();

  useEffect(() => {
    loadLevels();
  }, [loadLevels]);

  useEffect(() => {
    if (currentLevel) {
      initEngine(currentLevel);
    }
  }, [currentLevel, initEngine]);

  const handleLevelSelect = (levelId: string) => {
    setCurrentLevel(levelId);
    setLevelDropdownOpen(false);
    resetGame();
  };

  const handleStartRound = () => {
    if (!playerName.trim()) return;
    startRound(playerName.trim());
  };

  const handleEndRound = () => {
    endRound();
  };

  const handleDragStart = (e: React.MouseEvent, element: VinylElement) => {
    if (!dragOps.canDrag(element)) return;
    if (dragOps.handleDragStart(element)) {
      setDraggingElement(element);
      setDragPosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (draggingElement) {
      setDragPosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleDragEnd = () => {
    if (draggingElement) {
      const areaRect = document.getElementById('drag-area')?.getBoundingClientRect();
      if (areaRect) {
        const relX = ((dragPosition.x - areaRect.left) / areaRect.width) * 100;
        const relY = ((dragPosition.y - areaRect.top) / areaRect.height) * 100;
        dragOps.handleDragEnd(draggingElement, { x: Math.max(0, Math.min(100, relX)), y: Math.max(0, Math.min(100, relY)) });
      }
      setDraggingElement(null);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getRiskColor = (riskValue: number, threshold: number) => {
    const ratio = riskValue / threshold;
    if (ratio < 0.5) return 'text-green-400';
    if (ratio < 0.8) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="p-6" onMouseMove={handleDragMove} onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd}>
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 bg-red-600 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3"
          >
            <AlertTriangle size={20} />
            <span>{error}</span>
            <button onClick={clearError} className="ml-2 hover:bg-red-700 p-1 rounded">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Disc className="text-gold-500" size={40} />
            <div>
              <h1 className="text-3xl font-bold text-gold-500">黑胶节拍修复赛</h1>
              <p className="text-vinyl-400">比赛控制台</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {currentRound && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2 bg-vinyl-700/50 px-4 py-2 rounded-lg"
              >
                <Clock size={16} className="text-gold-500" />
                <span className="text-vinyl-200 font-mono">
                  {currentRound.endTime
                    ? `已结束 ${formatTime(currentRound.endTime)}`
                    : `${currentRound.playerName} 进行中`}
                </span>
              </motion.div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3 space-y-6">
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-vinyl-800/80 backdrop-blur rounded-xl p-5 border border-vinyl-700 shadow-xl"
            >
              <h2 className="text-lg font-semibold text-gold-400 mb-4 flex items-center gap-2">
                <Music size={18} />
                关卡选择
              </h2>

              <div className="relative">
                <button
                  onClick={() => setLevelDropdownOpen(!levelDropdownOpen)}
                  disabled={!!currentRound && currentRound.status === 'active'}
                  className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg px-4 py-3 text-left flex items-center justify-between text-vinyl-100 hover:border-gold-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{currentLevel?.name || '请选择关卡'}</span>
                  <ChevronDown size={18} className={cn('transition-transform', levelDropdownOpen && 'rotate-180')} />
                </button>

                <AnimatePresence>
                  {levelDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-vinyl-700 border border-vinyl-600 rounded-lg overflow-hidden z-40 shadow-xl"
                    >
                      {levels.map((level) => (
                        <button
                          key={level.id}
                          onClick={() => handleLevelSelect(level.id)}
                          className={cn(
                            'w-full px-4 py-3 text-left hover:bg-vinyl-600 transition-colors border-b border-vinyl-600 last:border-b-0',
                            currentLevel?.id === level.id ? 'bg-gold-500/20 text-gold-400' : 'text-vinyl-200'
                          )}
                        >
                          <div className="font-medium">{level.name}</div>
                          <div className="text-sm text-vinyl-400">目标 {level.targetScore} 分 | 初始资源 {level.initialResources}</div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {currentLevel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 p-3 bg-vinyl-900/50 rounded-lg"
                >
                  <p className="text-sm text-vinyl-400">{currentLevel.description}</p>
                  <div className="flex gap-4 mt-3 text-xs">
                    <span className="text-green-400">风险阈值: {currentLevel.riskThreshold}</span>
                    <span className="text-blue-400">元素: {currentLevel.vinylElements.length}</span>
                  </div>
                </motion.div>
              )}
            </motion.div>

            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-vinyl-800/80 backdrop-blur rounded-xl p-5 border border-vinyl-700 shadow-xl"
            >
              <h2 className="text-lg font-semibold text-gold-400 mb-4 flex items-center gap-2">
                <User size={18} />
                玩家信息
              </h2>

              {!currentRound ? (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="请输入玩家姓名"
                    className="w-full bg-vinyl-700 border border-vinyl-600 rounded-lg px-4 py-3 text-vinyl-100 placeholder-vinyl-500 focus:border-gold-500 focus:outline-none transition-colors"
                  />
                  <button
                    onClick={handleStartRound}
                    disabled={!playerName.trim() || !currentLevel}
                    className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-vinyl-900 font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:from-gold-400 hover:to-gold-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-gold-500/20"
                  >
                    <Play size={20} />
                    开始比赛
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-vinyl-900/50 rounded-lg p-4">
                    <div className="text-vinyl-400 text-sm">当前玩家</div>
                    <div className="text-xl font-bold text-vinyl-100">{currentRound.playerName}</div>
                  </div>

                  <div className="flex gap-2">
                    {isPaused ? (
                      <button
                        onClick={resumeRound}
                        className="flex-1 bg-green-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-green-500 transition-colors"
                      >
                        <Play size={18} />
                        继续
                      </button>
                    ) : (
                      <button
                        onClick={pauseRound}
                        className="flex-1 bg-yellow-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-yellow-500 transition-colors"
                      >
                        <Pause size={18} />
                        暂停
                      </button>
                    )}
                    <button
                      onClick={handleEndRound}
                      disabled={currentRound.status === 'completed'}
                      className="flex-1 bg-red-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-red-500 transition-colors disabled:opacity-50"
                    >
                      <Square size={18} />
                      结束
                    </button>
                  </div>

                  {currentRound.status === 'completed' && (
                    <button
                      onClick={resetGame}
                      className="w-full bg-vinyl-700 text-vinyl-200 py-2 rounded-lg hover:bg-vinyl-600 transition-colors"
                    >
                      重置比赛
                    </button>
                  )}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-vinyl-800/80 backdrop-blur rounded-xl p-5 border border-vinyl-700 shadow-xl"
            >
              <h2 className="text-lg font-semibold text-gold-400 mb-4 flex items-center gap-2">
                <Trophy size={18} />
                实时状态
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-vinyl-400 flex items-center gap-2">
                    <Zap size={16} className="text-yellow-400" />
                    资源
                  </span>
                  <span className="text-2xl font-bold text-yellow-400 font-mono">{resources}</span>
                </div>
                <div className="w-full bg-vinyl-700 rounded-full h-2">
                  <motion.div
                    className="bg-yellow-400 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (resources / (currentLevel?.initialResources || 100)) * 100)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between mt-4">
                  <span className="text-vinyl-400 flex items-center gap-2">
                    <Heart size={16} className="text-pink-400" />
                    分数
                  </span>
                  <span className="text-2xl font-bold text-pink-400 font-mono">
                    {score} <span className="text-sm text-vinyl-500">/ {currentLevel?.targetScore || 0}</span>
                  </span>
                </div>
                <div className="w-full bg-vinyl-700 rounded-full h-2">
                  <motion.div
                    className="bg-pink-400 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (score / (currentLevel?.targetScore || 1)) * 100)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between mt-4">
                  <span className="text-vinyl-400 flex items-center gap-2">
                    <AlertTriangle size={16} className={getRiskColor(risk, currentLevel?.riskThreshold || 100)} />
                    风险
                  </span>
                  <span className={cn('text-2xl font-bold font-mono', getRiskColor(risk, currentLevel?.riskThreshold || 100))}>
                    {risk} <span className="text-sm text-vinyl-500">/ {currentLevel?.riskThreshold || 0}</span>
                  </span>
                </div>
                <div className="w-full bg-vinyl-700 rounded-full h-2">
                  <motion.div
                    className={cn('h-2 rounded-full', risk >= (currentLevel?.riskThreshold || 100) * 0.8 ? 'bg-red-500' : risk >= (currentLevel?.riskThreshold || 100) * 0.5 ? 'bg-yellow-500' : 'bg-green-500')}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (risk / (currentLevel?.riskThreshold || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            </motion.div>
          </div>

          <div className="col-span-6 space-y-6">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="bg-vinyl-800/80 backdrop-blur rounded-xl p-5 border border-vinyl-700 shadow-xl"
            >
              <h2 className="text-lg font-semibold text-gold-400 mb-4 flex items-center gap-2">
                <Disc size={18} />
                拖拽操作区
              </h2>

              <div
                id="drag-area"
                className="relative bg-vinyl-900/80 rounded-xl h-80 border-2 border-dashed border-vinyl-600 overflow-hidden"
              >
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.1)_0%,transparent_60%)]" />
                </div>

                {currentLevel?.vinylElements.map((element) => {
                  const canDrag = dragOps.canDrag(element);
                  const effect = dragOps.getElementEffect(element.id);
                  return (
                    <motion.div
                      key={element.id}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      whileHover={canDrag ? { scale: 1.1 } : {}}
                      whileTap={canDrag ? { scale: 0.95 } : {}}
                      onMouseDown={(e) => handleDragStart(e, element)}
                      style={{
                        left: `${element.position.x}%`,
                        top: `${element.position.y}%`,
                        backgroundColor: element.color,
                        cursor: canDrag ? 'grab' : 'not-allowed',
                      }}
                      className={cn(
                        'absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-lg transition-all',
                        canDrag ? 'hover:shadow-xl hover:brightness-110' : 'opacity-50',
                        draggingElement?.id === element.id && 'opacity-30'
                      )}
                    >
                      <div className="text-center">
                        <div className="text-[10px] opacity-80">{element.label}</div>
                        {effect && (
                          <div className="text-[9px] mt-1">
                            {effect.score > 0 && `+${effect.score}`}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                <AnimatePresence>
                  {draggingElement && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0.8 }}
                      animate={{ scale: 1, opacity: 1 }}
                      style={{
                        position: 'fixed',
                        left: dragPosition.x,
                        top: dragPosition.y,
                        backgroundColor: draggingElement.color,
                        pointerEvents: 'none',
                        zIndex: 1000,
                      }}
                      className="-translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full flex items-center justify-center font-bold text-white shadow-2xl cursor-grabbing"
                    >
                      {draggingElement.label}
                    </motion.div>
                  )}
                </AnimatePresence>

                {!currentLevel && (
                  <div className="absolute inset-0 flex items-center justify-center text-vinyl-500">
                    请先选择关卡
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="bg-vinyl-800/80 backdrop-blur rounded-xl p-5 border border-vinyl-700 shadow-xl"
            >
              <h2 className="text-lg font-semibold text-gold-400 mb-4 flex items-center gap-2">
                <Zap size={18} />
                点击操作区
              </h2>

              <div className="grid grid-cols-3 gap-3">
                {clickOps.getAvailableButtons().map((btn) => {
                  const canClick = clickOps.canClick(btn.id);
                  return (
                    <motion.button
                      key={btn.id}
                      whileHover={canClick ? { y: -2 } : {}}
                      whileTap={canClick ? { scale: 0.95 } : {}}
                      onClick={() => clickOps.handleClick(btn.id, btn.label)}
                      disabled={!canClick}
                      className={cn(
                        clickOps.getVariantClasses(btn.variant, !canClick),
                        clickOps.lastClicked === btn.id && 'animate-pulse'
                      )}
                    >
                      <span className="font-semibold">{btn.label}</span>
                      <span className="text-xs opacity-75">
                        {btn.effect.resource !== 0 && `资源${btn.effect.resource > 0 ? '+' : ''}${btn.effect.resource} `}
                        {btn.effect.score !== 0 && `分数${btn.effect.score > 0 ? '+' : ''}${btn.effect.score}`}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {clickOps.getAvailableButtons().length === 0 && currentLevel && (
                <div className="text-center text-vinyl-500 py-4">
                  当前关卡无可用按钮
                </div>
              )}
            </motion.div>
          </div>

          <div className="col-span-3 space-y-6">
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-vinyl-800/80 backdrop-blur rounded-xl p-5 border border-vinyl-700 shadow-xl h-[500px] flex flex-col"
            >
              <h2 className="text-lg font-semibold text-gold-400 mb-4 flex items-center gap-2">
                <Info size={18} />
                裁决追踪
              </h2>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                <AnimatePresence>
                  {operations.length === 0 ? (
                    <div className="text-center text-vinyl-500 py-10">
                      暂无操作记录
                    </div>
                  ) : (
                    operations.slice().reverse().map((op: Operation, index: number) => (
                      <motion.div
                        key={op.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                          'p-3 rounded-lg border-l-4 text-sm',
                          op.type === 'drag' ? 'border-blue-500 bg-blue-500/10' : 'border-purple-500 bg-purple-500/10',
                          lastOperation?.id === op.id && 'ring-2 ring-gold-500/50'
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-vinyl-200">{op.elementLabel}</span>
                          <span className="text-xs text-vinyl-500 font-mono">
                            {formatTime(op.timestamp)}
                          </span>
                        </div>
                        <div className="flex gap-3 text-xs">
                          <span className="text-yellow-400">资源{op.resourceDelta > 0 ? '+' : ''}{op.resourceDelta}</span>
                          <span className="text-pink-400">分数{op.scoreDelta > 0 ? '+' : ''}{op.scoreDelta}</span>
                          <span className={op.riskDelta > 0 ? 'text-red-400' : 'text-green-400'}>
                            风险{op.riskDelta > 0 ? '+' : ''}{op.riskDelta}
                          </span>
                        </div>
                        {op.isJudgementCall && (
                          <div className="mt-2 text-xs text-orange-400 bg-orange-500/10 p-2 rounded">
                            ⚖️ 裁决: {op.judgementReason}
                          </div>
                        )}
                        {op.note && (
                          <div className="mt-1 text-xs text-vinyl-400 italic">
                            备注: {op.note}
                          </div>
                        )}
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
