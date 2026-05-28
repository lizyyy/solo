import { motion } from 'framer-motion';
import { ArrowLeft, Star, Lock, Play } from 'lucide-react';
import levelsData from '../data/levels.json';
import { useGameStore } from '../stores/useGameStore';

export function LevelsPage() {
  const setCurrentPage = useGameStore(state => state.setCurrentPage);
  const startGame = useGameStore(state => state.startGame);
  const completedLevels = useGameStore(state => state.completedLevels);

  const getDifficultyStars = (difficulty: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < difficulty ? 'text-music-gold fill-music-gold' : 'text-gray-600'
        }`}
      />
    ));
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <button
            onClick={() => setCurrentPage('home')}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-serif font-bold text-music-gold">
            选择关卡
          </h1>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {levelsData.map((level, index) => {
            const isUnlocked = level.unlocked;
            const isCompleted = completedLevels[level.id] > 0;

            return (
              <motion.div
                key={level.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative rounded-2xl p-6 border-2 transition-all duration-300 ${
                  isUnlocked
                    ? 'bg-music-card border-music-gold/30 hover:border-music-gold hover:shadow-lg hover:shadow-music-gold/20 cursor-pointer'
                    : 'bg-music-darker/50 border-gray-700 opacity-60 cursor-not-allowed'
                }`}
                onClick={() => isUnlocked && startGame(level.id)}
              >
                {!isUnlocked && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl z-10">
                    <Lock className="w-10 h-10 text-gray-500" />
                  </div>
                )}

                <div className="flex justify-between items-start mb-4">
                  <span className="text-4xl">
                    {index === 0 && '🎵'}
                    {index === 1 && '💰'}
                    {index === 2 && '⚖️'}
                    {index === 3 && '⭐'}
                    {index === 4 && '🏆'}
                  </span>
                  <div className="flex gap-1">
                    {getDifficultyStars(level.difficulty)}
                  </div>
                </div>

                <h3 className="text-xl font-serif font-bold text-white mb-2">
                  关卡 {level.difficulty}: {level.name}
                </h3>

                <p className="text-gray-400 text-sm mb-4">
                  {level.description}
                </p>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    目标营收: ¥{level.totalRevenue.toLocaleString()}
                  </div>
                  {isCompleted && (
                    <div className="flex gap-1">
                      {Array.from({ length: completedLevels[level.id] }, (_, i) => (
                        <Star key={i} className="w-4 h-4 text-music-gold fill-music-gold" />
                      ))}
                    </div>
                  )}
                </div>

                {isUnlocked && (
                  <motion.div
                    className="mt-4 flex items-center justify-center gap-2 py-2 bg-music-gold/20 rounded-lg text-music-gold font-bold"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Play className="w-4 h-4" />
                    开始挑战
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 bg-music-card rounded-xl p-6 border border-white/10"
        >
          <h3 className="text-music-gold font-serif text-lg mb-4">
            📚 新手提示
          </h3>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li>• 每个关卡有不同的初始卡牌和难度设置</li>
            <li>• 完成前一个关卡才能解锁下一个</li>
            <li>• 尽量避免严重问题（红色）和重要问题（黄色）</li>
            <li>• 点击卡牌查看详细效果说明</li>
            <li>• 结算时可查看详细的分成溯源和问题分析</li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
