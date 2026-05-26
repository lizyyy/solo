import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LEVELS } from '../data/levels';
import { Flame, Shield, AlertTriangle, Play } from 'lucide-react';
import { cn } from '../lib/utils';

const difficultyStars = (difficulty: number) => {
  return Array.from({ length: 3 }).map((_, i) => (
    <span
      key={i}
      className={cn(
        'text-lg',
        i < difficulty ? 'text-yellow-400' : 'text-slate-600'
      )}
    >
      ★
    </span>
  ));
};

export const StartPage: React.FC = () => {
  const navigate = useNavigate();

  const handleStartLevel = (levelId: number) => {
    navigate(`/game/${levelId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-yellow-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Flame className="w-12 h-12 text-orange-500" />
            <Shield className="w-12 h-12 text-blue-500" />
            <AlertTriangle className="w-12 h-12 text-yellow-500" />
          </div>
          <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-yellow-400 to-red-400 mb-4">
            化学品仓库配伍游戏
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            学习危化品仓储安全规范，掌握禁忌相邻、温度控制、隔离距离等核心规则。
            通过模拟真实仓储场景，提升安全意识和实操能力。
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-200 mb-6 text-center">
            选择关卡
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {LEVELS.map((level, index) => (
              <motion.div
                key={level.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="relative group cursor-pointer"
                onClick={() => handleStartLevel(level.id)}
              >
                <div className={cn(
                  'absolute inset-0 rounded-2xl blur-xl opacity-50 group-hover:opacity-70 transition-opacity',
                  level.difficulty === 1 ? 'bg-green-500/30' :
                  level.difficulty === 2 ? 'bg-yellow-500/30' : 'bg-red-500/30'
                )} />
                <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 h-full">
                  <div className="flex items-center justify-between mb-4">
                    <span className={cn(
                      'text-4xl font-bold font-mono',
                      level.difficulty === 1 ? 'text-green-400' :
                      level.difficulty === 2 ? 'text-yellow-400' : 'text-red-400'
                    )}>
                      {level.id}
                    </span>
                    <div className="flex gap-0.5">
                      {difficultyStars(level.difficulty)}
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-slate-100 mb-2">
                    {level.name}
                  </h3>

                  <p className="text-slate-400 text-sm mb-4 h-12">
                    {level.description}
                  </p>

                  <div className="space-y-2 text-sm text-slate-400 mb-6">
                    <div className="flex justify-between">
                      <span>化学品数量</span>
                      <span className="text-slate-200 font-mono">{level.chemicalIds.length} 个</span>
                    </div>
                    <div className="flex justify-between">
                      <span>时间限制</span>
                      <span className="text-slate-200 font-mono">{level.timeLimit} 秒</span>
                    </div>
                    <div className="flex justify-between">
                      <span>目标分数</span>
                      <span className="text-slate-200 font-mono">{level.targetScore}</span>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'w-full py-3 px-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all',
                      level.difficulty === 1 ? 'bg-green-600 hover:bg-green-500' :
                      level.difficulty === 2 ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-red-600 hover:bg-red-500'
                    )}
                  >
                    <Play className="w-5 h-5" />
                    开始挑战
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-200 mb-6 text-center">
            游戏说明
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
              <h3 className="font-bold text-slate-200 mb-3">🎯 游戏目标</h3>
              <ul className="text-slate-400 text-sm space-y-2">
                <li>• 将所有化学品正确摆放到货架上</li>
                <li>• 遵守禁忌相邻规则</li>
                <li>• 控制温湿度在安全范围内</li>
                <li>• 保持足够的隔离距离</li>
                <li>• 使用正确的存储区域</li>
              </ul>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
              <h3 className="font-bold text-slate-200 mb-3">⚠️ 风险类别</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💥</span>
                  <span className="text-slate-400">爆炸品</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔥</span>
                  <span className="text-slate-400">易燃液体</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚡</span>
                  <span className="text-slate-400">氧化剂</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">☠️</span>
                  <span className="text-slate-400">毒害品</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🧪</span>
                  <span className="text-slate-400">腐蚀品</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">💨</span>
                  <span className="text-slate-400">压缩气体</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-slate-500 text-sm">
          <p>本游戏用于安全培训目的，数据基于真实危化品存储规范</p>
        </div>
      </div>
    </div>
  );
};
