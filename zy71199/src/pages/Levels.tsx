import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Lock, Star, Trophy, RotateCcw, Info } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { levels } from '@/data/levels';
import { cn } from '@/lib/utils';

export default function Levels() {
  const navigate = useNavigate();
  const { completedLevels, levelScores, loadProgress, resetProgress } = useGameStore();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const isUnlocked = (id: number) => {
    if (id === 1) return true;
    return completedLevels.includes(id - 1);
  };

  const handleStart = (levelId: number) => {
    useGameStore.getState().startLevel(levelId);
    navigate('/game');
  };

  const getStars = (score: number, fileCount: number) => {
    const maxScore = fileCount * 10;
    const ratio = score / maxScore;
    if (ratio >= 0.95) return 3;
    if (ratio >= 0.8) return 2;
    if (ratio >= 0.6) return 1;
    return 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a3a2e] via-[#2c3e50] to-[#1a3a2e] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-3">
            选择关卡
          </h1>
          <p className="text-white/60">完成关卡解锁更难的挑战</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {levels.map((level) => {
            const unlocked = isUnlocked(level.id);
            const score = levelScores[level.id] || 0;
            const stars = getStars(score, level.fileCount);
            const completed = completedLevels.includes(level.id);

            return (
              <div
                key={level.id}
                className={cn(
                  'relative rounded-2xl border-2 p-6 transition-all duration-300',
                  unlocked
                    ? 'border-[#d4a017]/40 bg-gradient-to-br from-[#2c3e50] to-[#1a3a2e] hover:border-[#d4a017] hover:shadow-xl hover:shadow-[#d4a017]/20 hover:-translate-y-1'
                    : 'border-white/10 bg-white/5'
                )}
              >
                {!unlocked && (
                  <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center z-10">
                    <Lock size={32} className="text-white/40" />
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Trophy size={20} className={cn(
                      unlocked ? 'text-[#d4a017]' : 'text-white/30'
                    )} />
                    <span className={cn(
                      'font-bold',
                      unlocked ? 'text-white' : 'text-white/40'
                    )}>
                      第 {level.id} 关
                    </span>
                  </div>
                  {completed && (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3].map(i => (
                        <Star
                          key={i}
                          size={16}
                          className={cn(
                            i <= stars ? 'text-[#d4a017] fill-[#d4a017]' : 'text-white/20'
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <h3 className={cn(
                  'text-xl font-bold mb-2',
                  unlocked ? 'text-white' : 'text-white/40'
                )}>
                  {level.name}
                </h3>
                <p className={cn(
                  'text-sm mb-4',
                  unlocked ? 'text-white/60' : 'text-white/30'
                )}>
                  {level.description}
                </p>

                <div className="flex items-center gap-4 mb-4 text-sm">
                  <div className={cn(
                    'flex items-center gap-1',
                    unlocked ? 'text-white/70' : 'text-white/30'
                  )}>
                    <span className="text-lg font-bold">{level.fileCount}</span>
                    <span>文件</span>
                  </div>
                  <div className={cn(
                    'flex items-center gap-1',
                    unlocked ? 'text-white/70' : 'text-white/30'
                  )}>
                    <span className="text-lg font-bold">{level.timeLimit}s</span>
                    <span>时限</span>
                  </div>
                  {completed && (
                    <div className="flex items-center gap-1 text-[#d4a017]">
                      <span className="text-lg font-bold">{score}</span>
                      <span>分</span>
                    </div>
                  )}
                </div>

                {unlocked && (
                  <button
                    onClick={() => handleStart(level.id)}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#d4a017] to-[#f1c40f]
                      text-[#1a3a2e] font-bold flex items-center justify-center gap-2
                      hover:shadow-lg hover:shadow-[#d4a017]/30 transition-all duration-200
                      active:scale-[0.98]"
                  >
                    <Play size={18} />
                    开始挑战
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 rounded-xl bg-white/10 text-white/80
              hover:bg-white/20 hover:text-white transition-all duration-200
              flex items-center gap-2"
          >
            返回主页
          </button>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-6 py-2.5 rounded-xl bg-red-600/20 text-red-400
              hover:bg-red-600/30 hover:text-red-300 transition-all duration-200
              flex items-center gap-2 border border-red-500/30"
          >
            <RotateCcw size={16} />
            重置进度
          </button>
        </div>

        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#1a3a2e] rounded-2xl p-8 border border-red-500/30 max-w-md w-full mx-4">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center mx-auto mb-4">
                  <RotateCcw size={32} className="text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">确认重置进度？</h3>
                <p className="text-white/60 mb-6">此操作将清除所有关卡完成记录和得分，无法恢复。</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-6 py-2.5 rounded-xl bg-white/10 text-white/80
                      hover:bg-white/20 transition-all duration-200"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      resetProgress();
                      loadProgress();
                      setShowResetConfirm(false);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-red-600 text-white
                      hover:bg-red-500 transition-all duration-200"
                  >
                    确认重置
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}