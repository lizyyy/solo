import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Music, Star, Lock, Play, BookOpen, Award } from 'lucide-react';
import { levels } from '../data/levels';
import { getCompletedLevels } from '../utils/storage';
import { CompletedLevel, Difficulty } from '../types';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [completedLevels, setCompletedLevels] = useState<CompletedLevel[]>([]);

  useEffect(() => {
    setCompletedLevels(getCompletedLevels());
  }, []);

  const getDifficultyColor = (difficulty: Difficulty) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'hard': return 'bg-red-100 text-red-700';
    }
  };

  const getDifficultyLabel = (difficulty: Difficulty) => {
    switch (difficulty) {
      case 'easy': return '简单';
      case 'medium': return '中等';
      case 'hard': return '困难';
    }
  };

  const isUnlocked = (index: number) => {
    if (index === 0) return true;
    const prevLevel = levels[index - 1];
    return completedLevels.some(c => c.levelId === prevLevel.id);
  };

  const getLevelProgress = (levelId: string) => {
    return completedLevels.find(c => c.levelId === levelId);
  };

  return (
    <div className="min-h-screen p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-factory-400 to-factory-600 rounded-full mb-4 shadow-lg"
          >
            <Music className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="font-display text-4xl md:text-5xl text-factory-700 mb-2">
            音符工厂排班赛
          </h1>
          <p className="text-gear-600 text-lg">
            把音符放到正确的工位上，完成节拍挑战！
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {levels.map((level, index) => {
            const unlocked = isUnlocked(index);
            const progress = getLevelProgress(level.id);

            return (
              <motion.div
                key={level.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={unlocked ? { scale: 1.02, y: -4 } : {}}
                onClick={() => unlocked && navigate(`/game/${level.id}`)}
                className={`factory-card p-6 cursor-pointer transition-all ${
                  !unlocked ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-xl'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(level.difficulty)}`}>
                        {getDifficultyLabel(level.difficulty)}
                      </span>
                      {!unlocked && (
                        <Lock className="w-4 h-4 text-gear-400" />
                      )}
                    </div>
                    <h3 className="font-display text-xl text-factory-700">
                      {level.name}
                    </h3>
                  </div>
                  {unlocked && (
                    <Play className="w-8 h-8 text-factory-500" />
                  )}
                </div>

                <p className="text-gear-500 text-sm mb-4">
                  {level.description}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm text-gear-500">
                    <BookOpen className="w-4 h-4" />
                    <span>{level.measures.length} 小节</span>
                  </div>

                  {progress ? (
                    <div className="flex items-center gap-1">
                      {[1, 2, 3].map(i => (
                        <Star
                          key={i}
                          className={`w-5 h-5 ${
                            i <= progress.stars
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                      <span className="text-sm text-gear-600 ml-2">
                        {progress.score}分
                      </span>
                    </div>
                  ) : (
                    unlocked && (
                      <span className="text-sm text-factory-500 font-medium">
                        开始挑战 →
                      </span>
                    )
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="text-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/teacher/history')}
            className="factory-button-secondary inline-flex items-center gap-2"
          >
            <Award className="w-5 h-5" />
            教师修正历史
          </motion.button>
        </div>

        <div className="mt-12 factory-card p-6">
          <h3 className="font-display text-xl text-factory-700 mb-4">游戏说明</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gear-600">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-factory-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-factory-600">1</span>
              </div>
              <p>从音符卡池拖拽音符卡片到小节的工位槽中</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-factory-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-factory-600">2</span>
              </div>
              <p>确保每个小节的拍数正好达到目标，不要超拍或缺拍</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-factory-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-factory-600">3</span>
              </div>
              <p>注意附点音符和休止符，它们也是节拍的一部分！</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
