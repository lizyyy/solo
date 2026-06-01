import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, User, Disc, Timer, Coins, Trophy, AlertTriangle } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { AnimatedNumber, useDeltaDisplay } from '@/hooks/useNumberAnimation';

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const StatusPanel = () => {
  const {
    currentRound,
    currentLevel,
    resources,
    score,
    risk,
    isPaused,
    startRound,
    pauseRound,
    resumeRound,
    endRound,
    error,
    clearError,
    operations,
  } = useGameStore();

  const [duration, setDuration] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [prevResources, setPrevResources] = useState<number | null>(null);
  const [prevScore, setPrevScore] = useState<number | null>(null);
  const [prevRisk, setPrevRisk] = useState<number | null>(null);

  const resourcesDelta = useDeltaDisplay(resources, prevResources);
  const scoreDelta = useDeltaDisplay(score, prevScore);
  const riskDelta = useDeltaDisplay(risk, prevRisk);

  useEffect(() => {
    setPrevResources(resources);
  }, [resources]);

  useEffect(() => {
    setPrevScore(score);
  }, [score]);

  useEffect(() => {
    setPrevRisk(risk);
  }, [risk]);

  useEffect(() => {
    if (!currentRound || currentRound.status !== 'active' || isPaused) {
      return;
    }

    const startTime = new Date(currentRound.startTime).getTime();
    const interval = setInterval(() => {
      setDuration(Date.now() - startTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentRound, isPaused]);

  useEffect(() => {
    if (currentRound) {
      setPlayerName(currentRound.playerName);
      const startTime = new Date(currentRound.startTime).getTime();
      setDuration(Date.now() - startTime);
    } else {
      setDuration(0);
    }
  }, [currentRound]);

  const handleStart = () => {
    if (!currentLevel) return;
    const name = playerName.trim() || '匿名玩家';
    startRound(name);
  };

  const handleTogglePause = () => {
    if (isPaused) {
      resumeRound();
    } else {
      pauseRound();
    }
  };

  const handleEnd = () => {
    endRound();
  };

  const isNegativeResource = resources < 0;
  const isHighRisk = currentLevel && risk >= currentLevel.riskThreshold;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-vinyl-900/90 backdrop-blur-sm rounded-2xl p-6 shadow-vinyl border border-vinyl-700"
    >
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg flex items-center gap-2 text-red-300"
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
            <button
              onClick={clearError}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-vinyl-400 text-sm mb-1">玩家名称</label>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-gold-500" />
                {currentRound ? (
                  <span className="text-xl font-bold text-vinyl-100">{currentRound.playerName}</span>
                ) : (
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="请输入玩家名称"
                    className="flex-1 bg-vinyl-800 border border-vinyl-600 rounded-lg px-3 py-2 text-vinyl-100 focus:outline-none focus:border-gold-500"
                  />
                )}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-vinyl-400 text-sm mb-1">当前关卡</label>
              <div className="flex items-center gap-2">
                <Disc className="w-5 h-5 text-gold-500" />
                <span className="text-xl font-bold text-vinyl-100">
                  {currentLevel?.name || '未选择'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-vinyl-400 text-sm mb-1">比赛时长</label>
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-gold-500" />
              <span className="text-3xl font-mono font-bold text-vinyl-100">
                {formatDuration(duration)}
              </span>
              {isPaused && (
                <span className="text-yellow-500 text-sm px-2 py-1 bg-yellow-500/20 rounded">
                  已暂停
                </span>
              )}
              {currentRound?.status === 'completed' && (
                <span className="text-green-500 text-sm px-2 py-1 bg-green-500/20 rounded">
                  已完成
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            {!currentRound || currentRound.status === 'completed' ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStart}
                disabled={!currentLevel}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-gold-500 to-gold-600 text-vinyl-900 font-bold rounded-xl hover:from-gold-400 hover:to-gold-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-gold"
              >
                <Play className="w-5 h-5" />
                开始比赛
              </motion.button>
            ) : (
              <>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleTogglePause}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-vinyl-600 to-vinyl-700 text-vinyl-100 font-bold rounded-xl hover:from-vinyl-500 hover:to-vinyl-600 transition-all"
                >
                  {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                  {isPaused ? '继续' : '暂停'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleEnd}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold rounded-xl hover:from-red-500 hover:to-red-600 transition-all"
                >
                  <Square className="w-5 h-5" />
                  结束比赛
                </motion.button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <motion.div
            animate={isNegativeResource ? { scale: [1, 1.02, 1] } : {}}
            transition={{ repeat: isNegativeResource ? Infinity : 0, duration: 0.5 }}
            className={`relative p-4 rounded-xl border ${
              isNegativeResource
                ? 'bg-red-900/30 border-red-500'
                : 'bg-vinyl-800/50 border-vinyl-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Coins className={`w-5 h-5 ${isNegativeResource ? 'text-red-400' : 'text-gold-500'}`} />
              <span className="text-vinyl-400 text-sm">资源</span>
            </div>
            <AnimatedNumber
              value={resources}
              className={`text-2xl font-bold ${isNegativeResource ? 'text-red-400' : 'text-vinyl-100'}`}
            />
            <AnimatePresence>
              {resourcesDelta.showDelta && (
                <motion.span
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`absolute top-2 right-2 text-sm font-mono ${resourcesDelta.getDeltaColor()}`}
                >
                  {resourcesDelta.getDeltaSign()}{resourcesDelta.delta}
                </motion.span>
              )}
            </AnimatePresence>
            {isNegativeResource && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            )}
          </motion.div>

          <motion.div className="relative p-4 rounded-xl bg-vinyl-800/50 border border-vinyl-700">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-gold-500" />
              <span className="text-vinyl-400 text-sm">分数</span>
            </div>
            <AnimatedNumber
              value={score}
              className="text-2xl font-bold text-vinyl-100"
            />
            <AnimatePresence>
              {scoreDelta.showDelta && (
                <motion.span
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`absolute top-2 right-2 text-sm font-mono ${scoreDelta.getDeltaColor()}`}
                >
                  {scoreDelta.getDeltaSign()}{scoreDelta.delta}
                </motion.span>
              )}
            </AnimatePresence>
            {currentLevel && (
              <div className="mt-1 text-xs text-vinyl-500">
                目标: {currentLevel.targetScore}
              </div>
            )}
          </motion.div>

          <motion.div
            animate={isHighRisk ? { scale: [1, 1.02, 1] } : {}}
            transition={{ repeat: isHighRisk ? Infinity : 0, duration: 0.5 }}
            className={`relative p-4 rounded-xl border ${
              isHighRisk
                ? 'bg-orange-900/30 border-orange-500'
                : 'bg-vinyl-800/50 border-vinyl-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`w-5 h-5 ${isHighRisk ? 'text-orange-400' : 'text-gold-500'}`} />
              <span className="text-vinyl-400 text-sm">风险</span>
            </div>
            <AnimatedNumber
              value={risk}
              className={`text-2xl font-bold ${isHighRisk ? 'text-orange-400' : 'text-vinyl-100'}`}
            />
            <AnimatePresence>
              {riskDelta.showDelta && (
                <motion.span
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`absolute top-2 right-2 text-sm font-mono ${riskDelta.getDeltaColor()}`}
                >
                  {riskDelta.getDeltaSign()}{riskDelta.delta}
                </motion.span>
              )}
            </AnimatePresence>
            {currentLevel && (
              <div className="mt-1 text-xs text-vinyl-500">
                阈值: {currentLevel.riskThreshold}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-vinyl-700 flex items-center justify-between text-sm">
        <span className="text-vinyl-500">
          操作次数: <span className="text-vinyl-300 font-mono">{operations.length}</span>
        </span>
        {currentRound && (
          <span className="text-vinyl-500">
            回合ID: <span className="text-vinyl-300 font-mono text-xs">{currentRound.id.slice(0, 8)}...</span>
          </span>
        )}
      </div>
    </motion.div>
  );
};
