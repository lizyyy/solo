import { useGameStore } from '@/store/gameStore';
import { Trophy, Clock, Pause, Play, RotateCcw, Home, AlertTriangle } from 'lucide-react';
import type { LevelConfig } from '@/types/game';

interface TopBarProps {
  score: number;
  gameTime: number;
  level: LevelConfig | null;
}

export default function TopBar({ score, gameTime, level }: TopBarProps) {
  const { status, pauseGame, resumeGame, restartGame, goToMenu } = useGameStore();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeRemaining = () => {
    if (!level) return 0;
    return Math.max(0, level.gameDuration - gameTime);
  };

  const getWinProgress = () => {
    if (!level) return 0;
    if (level.winCondition === 'score_threshold' && level.winScore) {
      return Math.min((score / level.winScore) * 100, 100);
    }
    return 0;
  };

  const timeRemaining = getTimeRemaining();
  const isTimeWarning = timeRemaining < 30;
  const winProgress = getWinProgress();

  return (
    <div className="bg-[#0a1628] rounded-xl p-4 border border-[#ff8a00]/20">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#ff8a00]/20 rounded-lg">
              <Trophy className="text-[#ff8a00]" size={24} />
            </div>
            <div>
              <div className="text-xs text-gray-400">得分</div>
              <div className="text-2xl font-bold text-[#ff8a00] font-mono">{score}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isTimeWarning ? 'bg-[#ff4d4d]/20' : 'bg-[#4caf50]/20'}`}>
              <Clock className={isTimeWarning ? 'text-[#ff4d4d] animate-pulse' : 'text-[#4caf50]'} size={24} />
            </div>
            <div>
              <div className="text-xs text-gray-400">剩余时间</div>
              <div className={`text-2xl font-bold font-mono ${isTimeWarning ? 'text-[#ff4d4d]' : 'text-[#4caf50]'}`}>
                {formatTime(timeRemaining)}
              </div>
            </div>
          </div>

          {level && level.winCondition === 'score_threshold' && level.winScore && (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#2196f3]/20 rounded-lg">
                <AlertTriangle className="text-[#2196f3]" size={24} />
              </div>
              <div>
                <div className="text-xs text-gray-400">目标分数</div>
                <div className="text-2xl font-bold text-[#2196f3] font-mono">
                  {score} / {level.winScore}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {level && (
            <div className="px-4 py-2 bg-[#1a2a4a] rounded-lg">
              <span className="text-xs text-gray-400">关卡：</span>
              <span className="text-white font-bold ml-1">{level.name}</span>
            </div>
          )}

          {status === 'playing' && (
            <button
              onClick={pauseGame}
              className="flex items-center gap-2 px-4 py-2 bg-[#ffc107] hover:bg-[#ffd137] text-black rounded-lg font-bold transition-colors"
            >
              <Pause size={18} />
              暂停
            </button>
          )}

          {status === 'paused' && (
            <button
              onClick={resumeGame}
              className="flex items-center gap-2 px-4 py-2 bg-[#4caf50] hover:bg-[#5ccf60] text-white rounded-lg font-bold transition-colors"
            >
              <Play size={18} />
              继续
            </button>
          )}

          <button
            onClick={restartGame}
            className="flex items-center gap-2 px-4 py-2 bg-[#2196f3] hover:bg-[#31a6ff] text-white rounded-lg font-bold transition-colors"
          >
            <RotateCcw size={18} />
            重开
          </button>

          <button
            onClick={goToMenu}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-colors"
          >
            <Home size={18} />
            主菜单
          </button>
        </div>
      </div>

      {level && level.winCondition === 'score_threshold' && (
        <div className="mt-3">
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#2196f3] to-[#4caf50] transition-all"
              style={{ width: `${winProgress}%` }}
            />
          </div>
        </div>
      )}

      {status === 'paused' && (
        <div className="mt-4 p-4 bg-[#ffc107]/20 border border-[#ffc107]/50 rounded-lg text-center">
          <p className="text-[#ffc107] font-bold text-lg">游戏已暂停</p>
          <p className="text-gray-400 text-sm">点击"继续"按钮恢复游戏</p>
        </div>
      )}
    </div>
  );
}
