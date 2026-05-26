import { Pause, Play, RotateCcw, Home, Clock, Star, Zap } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { getLevel } from '@/data/levels';
import { cn } from '@/lib/utils';

export default function HUD() {
  const {
    phase,
    currentLevelId,
    currentFileIndex,
    timeRemaining,
    score,
    correctCount,
    wrongCount,
    borrowCorrectCount,
    borrowWrongCount,
    pause,
    resume,
    restart,
    quit,
  } = useGameStore();

  const level = currentLevelId ? getLevel(currentLevelId) : null;
  const totalFiles = level?.fileCount ?? 0;
  const totalCorrect = correctCount + borrowCorrectCount;
  const totalWrong = wrongCount + borrowWrongCount;
  const progress = totalFiles > 0 ? (currentFileIndex / totalFiles) * 100 : 0;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="bg-gradient-to-b from-[#1a3a2e]/95 to-[#1a3a2e]/80 backdrop-blur-sm
        border-b border-[#d4a017]/30 px-4 py-3 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-4">
          <button
            onClick={quit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
              bg-[#2c3e50]/80 hover:bg-[#34495e]/80 text-white/80 hover:text-white
              transition-all duration-200 text-sm"
          >
            <Home size={16} />
            <span>主菜单</span>
          </button>

          <div className="h-6 w-px bg-white/20" />

          <div className="flex items-center gap-2 text-white/90 text-sm">
            <Clock size={16} className={cn(
              'transition-colors',
              timeRemaining <= 30 && 'text-red-400 animate-pulse'
            )} />
            <span className={cn(
              'font-mono font-bold text-lg',
              timeRemaining <= 30 && 'text-red-400'
            )}>
              {formatTime(timeRemaining)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-green-400 font-bold">{totalCorrect}</span>
              <span className="text-white/60">正确</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-red-400 font-bold">{totalWrong}</span>
              <span className="text-white/60">错误</span>
            </div>
          </div>

          <div className="h-6 w-px bg-white/20" />

          <div className="flex items-center gap-2">
            <Star size={18} className="text-[#d4a017]" />
            <span className="text-[#d4a017] font-bold text-xl">{score}</span>
            <span className="text-white/60 text-sm">分</span>
          </div>

          <div className="h-6 w-px bg-white/20" />

          <div className="flex items-center gap-2">
            {phase === 'playing' ? (
              <button
                onClick={pause}
                className="p-2 rounded-lg bg-[#2c3e50]/80 hover:bg-[#34495e]/80
                  text-white/80 hover:text-white transition-all duration-200"
              >
                <Pause size={18} />
              </button>
            ) : phase === 'paused' ? (
              <button
                onClick={resume}
                className="p-2 rounded-lg bg-green-600/80 hover:bg-green-500/80
                  text-white transition-all duration-200"
              >
                <Play size={18} />
              </button>
            ) : null}

            <button
              onClick={restart}
              className="p-2 rounded-lg bg-[#2c3e50]/80 hover:bg-[#34495e]/80
                text-white/80 hover:text-white transition-all duration-200"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-1.5 bg-[#1a3a2e]/60">
        <div className="flex items-center gap-2 max-w-md mx-auto">
          <Zap size={12} className="text-[#d4a017]" />
          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#d4a017] to-[#f1c40f] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-white/60 text-xs">
            {currentFileIndex + 1}/{totalFiles}
          </span>
        </div>
      </div>

      {phase === 'paused' && (
        <div className="absolute inset-0 top-[68px] bg-black/60 backdrop-blur-sm
          flex items-center justify-center z-50 pointer-events-auto">
          <div className="bg-[#1a3a2e] rounded-2xl p-8 border border-[#d4a017]/30
            shadow-2xl text-center">
            <Pause size={48} className="text-[#d4a017] mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">游戏暂停</h2>
            <p className="text-white/60 mb-6">点击继续按钮恢复游戏</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={resume}
                className="px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-500
                  text-white font-bold transition-all duration-200 flex items-center gap-2"
              >
                <Play size={18} />
                继续
              </button>
              <button
                onClick={restart}
                className="px-6 py-2.5 rounded-lg bg-[#2c3e50] hover:bg-[#34495e]
                  text-white font-bold transition-all duration-200 flex items-center gap-2"
              >
                <RotateCcw size={18} />
                重新开始
              </button>
              <button
                onClick={quit}
                className="px-6 py-2.5 rounded-lg bg-[#2c3e50] hover:bg-[#34495e]
                  text-white font-bold transition-all duration-200 flex items-center gap-2"
              >
                <Home size={18} />
                主菜单
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}