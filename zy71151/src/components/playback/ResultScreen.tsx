import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GameState } from '../../types';
import { useGameActions } from '../../store/gameStore';
import { PlaybackScene } from './PlaybackScene';
import { formatTime } from '../../utils/math';

const gradeColors: Record<string, string> = {
  S: 'from-yellow-400 to-yellow-600',
  A: 'from-green-400 to-green-600',
  B: 'from-blue-400 to-blue-600',
  C: 'from-harbor-400 to-harbor-600',
  D: 'from-yellow-600 to-yellow-800',
  F: 'from-red-500 to-red-700',
};

const failReasons: Record<string, string> = {
  collision: '发生碰撞事故',
  fuel_depleted: '燃油耗尽',
  tide_missed: '错过潮汐窗口',
  time_out: '超时',
  none: '任务完成',
};

export default function ResultScreen() {
  const navigate = useNavigate();
  const { exportReport } = useGameActions();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const savedState = (window as any).lastGameState;
    if (savedState) {
      setGameState(savedState);
    } else {
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    if (!gameState || !isPlaying) return;

    const animate = (currentTime: number) => {
      if (lastTimeRef.current) {
        const delta = (currentTime - lastTimeRef.current) / 1000;
        setPlaybackTime((prev) => {
          const newTime = prev + delta * playbackSpeed * 10;
          if (newTime >= gameState.maxTime) {
            setIsPlaying(false);
            return gameState.maxTime;
          }
          return newTime;
        });
      }
      lastTimeRef.current = currentTime;
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, isPlaying, playbackSpeed]);

  const getPlaybackState = (): GameState | null => {
    if (!gameState || gameState.history.length === 0) return gameState;
    
    let frame = gameState.history[0];
    for (let i = 0; i < gameState.history.length; i++) {
      if (gameState.history[i].time <= playbackTime) {
        frame = gameState.history[i];
      } else {
        break;
      }
    }

    return {
      ...gameState,
      time: frame.time,
      ships: frame.ships,
      tugs: frame.tugs,
      tide: frame.tide,
    };
  };

  const handleExportReport = () => {
    const report = exportReport();
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `port-sim-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    const report = exportReport();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(report);
      alert('报告已复制到剪贴板！');
    }
  };

  if (!gameState) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-navy-800">
        <div className="text-white text-2xl font-oswald">加载中...</div>
      </div>
    );
  }

  const playbackState = getPlaybackState();
  const allObjectivesCompleted = gameState.objectives.every((o) => o.completed);
  const isWin = gameState.failReason === 'none' && allObjectivesCompleted;

  return (
    <div className="w-full h-full bg-gradient-to-br from-navy-800 via-navy-700 to-navy-900 relative overflow-hidden">
      <div className="absolute inset-0">
        {playbackState && <PlaybackScene state={playbackState} />}
      </div>

      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      <div className="absolute top-0 left-0 right-0 z-10 p-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="btn-industrial bg-navy-700 border-navy-500 text-harbor-200 hover:bg-navy-600"
          >
            ← 返回主菜单
          </button>

          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-4xl font-oswald font-bold text-white mb-2">
              {isWin ? '🎉 任务完成！' : '💥 任务失败'}
            </h1>
            <p className="text-harbor-300">
              {failReasons[gameState.failReason] || '游戏结束'}
            </p>
          </motion.div>

          <div className="w-32" />
        </div>
      </div>

      <div className="absolute left-6 top-24 bottom-6 z-10 w-80 flex flex-col">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel rounded-xl p-6 mb-4"
        >
          <div className="text-center mb-6">
            <div className="relative inline-block">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#1e3a5f"
                  strokeWidth="8"
                  fill="none"
                />
                <motion.circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="url(#gradeGradient)"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: '0 352' }}
                  animate={{
                    strokeDasharray: `${Math.min(
                      (gameState.score.total / 600) * 352,
                      352
                    )} 352`,
                  }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                />
                <defs>
                  <linearGradient id="gradeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#F77F00" />
                    <stop offset="100%" stopColor="#fbbf24" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className={`text-5xl font-oswald font-bold bg-gradient-to-r ${gradeColors[gameState.score.grade]} bg-clip-text text-transparent`}
                >
                  {gameState.score.grade}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-4xl font-mono font-bold text-white">
                {gameState.score.total}
              </div>
              <div className="text-harbor-400 text-sm">总分</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-harbor-300">按时完成奖励</span>
              <span className="text-green-400 font-mono">+{gameState.score.onTimeCompletions}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-harbor-300">燃油效率奖励</span>
              <span className="text-blue-400 font-mono">+{gameState.score.fuelEfficiency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-harbor-300">安全评分</span>
              <span className={gameState.score.safetyScore > 50 ? 'text-green-400 font-mono' : 'text-yellow-400 font-mono'}>
                +{gameState.score.safetyScore}
              </span>
            </div>
            <div className="border-t border-harbor-600 pt-3 mt-3">
              <div className="flex justify-between text-sm">
                <span className="text-harbor-300">扣分</span>
                <span className="text-red-400 font-mono">-{gameState.score.penalties}</span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-panel rounded-xl p-4 flex-1 overflow-y-auto"
        >
          <h3 className="font-oswald font-bold text-white mb-3">任务目标</h3>
          <div className="space-y-3">
            {gameState.objectives.map((obj) => (
              <div
                key={obj.id}
                className={`p-3 rounded-lg ${
                  obj.completed ? 'bg-green-900/30' : 'bg-red-900/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={obj.completed ? 'text-green-400' : 'text-red-400'}>
                    {obj.completed ? '✓' : '✗'}
                  </span>
                  <span className="text-white text-sm">{obj.description}</span>
                </div>
                <div className="flex justify-between text-xs text-harbor-400">
                  <span>进度: {obj.currentValue}/{obj.targetValue}</span>
                  <span>{obj.points} 分</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="absolute right-6 top-24 bottom-6 z-10 w-80 flex flex-col gap-4">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-panel rounded-xl p-4"
        >
          <h3 className="font-oswald font-bold text-white mb-4">🎮 历史回放</h3>

          <div className="mb-4">
            <div className="flex justify-between text-sm text-harbor-300 mb-2">
              <span className="font-mono">{formatTime(playbackTime)}</span>
              <span className="font-mono">{formatTime(gameState.maxTime)}</span>
            </div>
            <input
              type="range"
              min="0"
              max={gameState.maxTime}
              value={playbackTime}
              onChange={(e) => setPlaybackTime(Number(e.target.value))}
              className="w-full h-2 bg-navy-800 rounded-full appearance-none cursor-pointer accent-warning-500"
            />
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex-1 btn-industrial ${
                isPlaying
                  ? 'bg-yellow-600 border-yellow-400'
                  : 'bg-green-600 border-green-400'
              } text-white`}
            >
              {isPlaying ? '⏸ 暂停' : '▶ 播放'}
            </button>
            <button
              onClick={() => setPlaybackTime(0)}
              className="btn-industrial bg-navy-600 border-navy-400 text-harbor-200"
            >
              ⏮
            </button>
          </div>

          <div className="flex gap-2">
            {[0.5, 1, 2, 4].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`flex-1 btn-industrial text-xs py-1 ${
                  playbackSpeed === speed
                    ? 'bg-warning-500 border-warning-400 text-white'
                    : 'bg-navy-700 border-navy-500 text-harbor-300'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-3"
        >
          <button
            onClick={handleExportReport}
            className="w-full btn-industrial bg-warning-500 border-warning-400 text-white hover:bg-warning-400"
          >
            📄 导出报告
          </button>
          <button
            onClick={handleShare}
            className="w-full btn-industrial bg-blue-600 border-blue-400 text-white hover:bg-blue-500"
          >
            📋 复制报告
          </button>
          <button
            onClick={() => navigate(`/game/${gameState.levelId.startsWith('session') ? 'level-1' : gameState.levelId}`)}
            className="w-full btn-industrial bg-green-600 border-green-400 text-white hover:bg-green-500"
          >
            🔄 再来一次
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-panel rounded-xl p-4 flex-1 overflow-y-auto"
        >
          <h3 className="font-oswald font-bold text-white mb-3">📊 统计数据</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-harbor-300">游戏时长</span>
              <span className="text-white font-mono">{formatTime(gameState.time)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-harbor-300">船舶数量</span>
              <span className="text-white font-mono">{gameState.ships.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-harbor-300">拖轮数量</span>
              <span className="text-white font-mono">{gameState.tugs.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-harbor-300">事件数量</span>
              <span className="text-white font-mono">{gameState.events.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-harbor-300">碰撞警告</span>
              <span className="text-yellow-400 font-mono">
                {gameState.collisionWarnings.length}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
