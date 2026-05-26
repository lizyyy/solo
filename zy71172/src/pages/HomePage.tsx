
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Play, History, BookOpen, Star, Trash2 } from 'lucide-react';
import { levels } from '@/data/levels';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useEffect } from 'react';

export function HomePage() {
  const navigate = useNavigate();
  const { loadRecords, records } = useHistoryStore();

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const getHighScore = (levelId: number) => {
    const levelRecords = records.filter(r => r.levelId === levelId);
    if (levelRecords.length === 0) return null;
    return Math.max(...levelRecords.map(r => r.score));
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 100,
      },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 flex flex-col items-center justify-center p-8">
      {/* Background Decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {['🍃', '🌿', '🌱', '🍀', '🌻', '🌸'].map((emoji, i) => (
          <motion.div
            key={i}
            className="absolute text-4xl opacity-20"
            style={{
              left: `${10 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
            }}
            animate={{
              y: [0, -20, 0],
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {emoji}
          </motion.div>
        ))}
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-4xl w-full"
      >
        {/* Title */}
        <motion.div variants={itemVariants} className="text-center mb-12">
          <motion.div
            className="flex items-center justify-center gap-4 mb-4"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Trash2 size={60} className="text-white" />
          </motion.div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
            小区垃圾投放游戏
          </h1>
          <p className="text-xl text-white/90 max-w-xl mx-auto">
            学习垃圾分类规则，成为环保达人！
            <br />
            处理湿垃圾破袋、可回收污染和大件预约
          </p>
        </motion.div>

        {/* Level Selection */}
        <motion.div variants={itemVariants} className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            选择关卡
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {levels.map((level, index) => {
              const highScore = getHighScore(level.id);
              const isUnlocked = index === 0 || getHighScore(level.id - 1) !== null;

              return (
                <motion.div
                  key={level.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative rounded-2xl p-6 shadow-xl transition-all ${
                    isUnlocked
                      ? 'bg-white cursor-pointer hover:shadow-2xl'
                      : 'bg-gray-400/50 cursor-not-allowed'
                  }`}
                  onClick={() => {
                    if (isUnlocked) {
                      navigate(`/game/${level.id}`);
                    }
                  }}
                >
                  {/* Difficulty Badge */}
                  <div className="absolute top-4 right-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
                        level.difficulty === 'easy'
                          ? 'bg-green-500'
                          : level.difficulty === 'medium'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                    >
                      {level.difficulty === 'easy'
                        ? '简单'
                        : level.difficulty === 'medium'
                        ? '中等'
                        : '困难'}
                    </span>
                  </div>

                  {/* Level Number */}
                  <div className="text-4xl font-bold text-gray-300 mb-2">
                    0{level.id}
                  </div>

                  {/* Level Name */}
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    {level.name}
                  </h3>

                  {/* Level Description */}
                  <p className="text-sm text-gray-600 mb-4">
                    {level.description}
                  </p>

                  {/* Level Stats */}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>⏱️ {level.timeLimit}秒</span>
                    <span>📦 {level.trashCount}个</span>
                  </div>

                  {/* High Score */}
                  {highScore !== null && (
                    <div className="mt-4 flex items-center gap-2 text-yellow-500">
                      <Star size={16} fill="currentColor" />
                      <span className="font-bold">最高分: {highScore}</span>
                    </div>
                  )}

                  {/* Locked Overlay */}
                  {!isUnlocked && (
                    <div className="absolute inset-0 bg-gray-900/50 rounded-2xl flex items-center justify-center">
                      <span className="text-white font-bold">🔒 完成前一关解锁</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-4">
          <button
            onClick={() => navigate('/history')}
            className="flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur hover:bg-white/30 text-white font-bold rounded-xl transition-colors"
          >
            <History size={20} />
            历史记录
          </button>
          <button
            onClick={() => navigate('/rules')}
            className="flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur hover:bg-white/30 text-white font-bold rounded-xl transition-colors"
          >
            <BookOpen size={20} />
            游戏规则
          </button>
        </motion.div>

        {/* Start Quick Game */}
        <motion.div variants={itemVariants} className="mt-8 text-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/game/1')}
            className="inline-flex items-center gap-3 px-12 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold text-xl rounded-2xl shadow-2xl hover:shadow-3xl transition-shadow"
          >
            <Play size={28} fill="currentColor" />
            快速开始
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default HomePage;
