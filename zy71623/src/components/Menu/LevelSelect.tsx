import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { levels } from '../../data/levels';

const LevelSelect: React.FC = () => {
  const { setCurrentLevel } = useGameStore();

  const difficultyColors = {
    easy: 'from-green-500/20 to-green-600/20 border-green-500/30',
    medium: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
    hard: 'from-red-500/20 to-red-600/20 border-red-500/30'
  };

  const difficultyLabels = {
    easy: '简单',
    medium: '中等',
    hard: '困难'
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-white mb-4 font-mono">
          🌉 多边形修桥挑战
        </h1>
        <p className="text-slate-400 text-lg max-w-xl">
          用多边形搭建稳固的桥梁，让载重车安全通过！
          学习几何知识，理解结构力学。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        {levels.map((level, index) => (
          <button
            key={level.id}
            onClick={() => setCurrentLevel(level)}
            className={`group relative bg-gradient-to-br ${difficultyColors[level.difficulty]} border rounded-2xl p-6 text-left hover:scale-105 transition-all duration-300 hover:shadow-2xl`}
            style={{
              animationDelay: `${index * 0.1}s`,
              animation: 'fadeInUp 0.6s ease-out both'
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">
                {index === 0 ? '🎓' : index === 1 ? '🏗️' : '🏆'}
              </span>
              <div>
                <h3 className="text-xl font-bold text-white">
                  {level.name}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  level.difficulty === 'easy' ? 'bg-green-500/30 text-green-400' :
                  level.difficulty === 'medium' ? 'bg-yellow-500/30 text-yellow-400' :
                  'bg-red-500/30 text-red-400'
                }`}>
                  {difficultyLabels[level.difficulty]}
                </span>
              </div>
            </div>

            <p className="text-slate-400 text-sm mb-4">
              {level.description}
            </p>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>📐 面积预算: {level.areaBudget}</span>
              <span>🚗 载重: {level.truck.weight}</span>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-accent-400 text-sm font-medium group-hover:translate-x-2 transition-transform">
                开始挑战 →
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-12 text-center text-slate-500 text-sm max-w-lg">
        <p className="mb-2">🎮 操作提示</p>
        <div className="flex flex-wrap justify-center gap-4 text-xs">
          <span className="bg-slate-800 px-3 py-1 rounded-full">
            拖拽放置多边形
          </span>
          <span className="bg-slate-800 px-3 py-1 rounded-full">
            R键旋转
          </span>
          <span className="bg-slate-800 px-3 py-1 rounded-full">
            Delete删除
          </span>
          <span className="bg-slate-800 px-3 py-1 rounded-full">
            方向键微调
          </span>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default LevelSelect;
