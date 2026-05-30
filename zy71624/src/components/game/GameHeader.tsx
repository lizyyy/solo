import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { NeonButton } from '@/components/ui/NeonButton';
import { formatTime } from '@/utils/gameConfig';
import { ClockIcon, ScoreIcon, PlayIcon, PauseIcon, HomeIcon, BarChartIcon } from '../circuit/CircuitIcons';

interface GameHeaderProps {
  onNavigateHome: () => void;
  onNavigateReport: () => void;
}

export function GameHeader({ onNavigateHome, onNavigateReport }: GameHeaderProps) {
  const {
    status,
    score,
    remainingTime,
    difficulty,
    tick,
    startGame,
    pauseGame,
    resumeGame,
    endGame,
  } = useGameStore();

  useEffect(() => {
    if (status !== 'playing') return;

    const interval = setInterval(() => {
      tick();
    }, 1000);

    return () => clearInterval(interval);
  }, [status, tick]);

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isIdle = status === 'idle';

  const totalTime = useGameStore(state => {
    const config = state.difficulty ? useGameStore.getState().difficulty : 'medium';
    return 120;
  });

  const timeProgress = (remainingTime / 120) * 100;
  const isTimeLow = remainingTime < 30;

  const difficultyText = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
  };

  const difficultyColor = {
    easy: 'text-neon-green',
    medium: 'text-neon-cyan',
    hard: 'text-neon-red',
  };

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="glass-card px-6 py-4 flex items-center justify-between"
    >
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <HomeIcon className="w-5 h-5 text-neon-purple" />
          <h1 className="font-display font-bold text-xl text-neon-purple text-neon-glow-purple">
            电路酒吧点单夜
          </h1>
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${difficultyColor[difficulty]} bg-neon-purple/10`}>
            {difficultyText[difficulty]}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ClockIcon className={`w-5 h-5 ${isTimeLow ? 'text-neon-red animate-pulse' : 'text-neon-cyan'}`} />
            <div className="w-32">
              <div className={`font-display font-bold text-lg ${isTimeLow ? 'text-neon-red' : 'text-neon-cyan'}`}>
                {formatTime(remainingTime)}
              </div>
              <div className="h-1.5 bg-neon-bgSecondary rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${isTimeLow ? 'bg-neon-red' : 'bg-neon-cyan'}`}
                  initial={{ width: '100%' }}
                  animate={{ width: `${timeProgress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ScoreIcon className="w-5 h-5 text-neon-orange" />
            <div className="font-display font-bold text-xl text-neon-orange">
              {score}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isIdle && (
          <NeonButton color="green" onClick={startGame}>
            <PlayIcon className="w-4 h-4 mr-2" />
            开始游戏
          </NeonButton>
        )}

        {isPlaying && (
          <NeonButton color="yellow" onClick={pauseGame}>
            <PauseIcon className="w-4 h-4 mr-2" />
            暂停
          </NeonButton>
        )}

        {isPaused && (
          <NeonButton color="green" onClick={resumeGame}>
            <PlayIcon className="w-4 h-4 mr-2" />
            继续
          </NeonButton>
        )}

        {!isIdle && (
          <NeonButton color="red" onClick={endGame}>
            结束游戏
          </NeonButton>
        )}

        <NeonButton color="purple" variant="outline" onClick={onNavigateHome}>
          <HomeIcon className="w-4 h-4" />
        </NeonButton>

        <NeonButton color="cyan" variant="outline" onClick={onNavigateReport}>
          <BarChartIcon className="w-4 h-4" />
        </NeonButton>
      </div>
    </motion.div>
  );
}
