import React from 'react';
import { Play, Lock, Trophy } from 'lucide-react';
import { Level } from '../../types';
import { getDifficultyColor, getDifficultyLabel } from '../../data/levels';
import { getHighScore } from '../../utils/scoring';

interface LevelCardProps {
  level: Level;
  index: number;
  isUnlocked: boolean;
  onSelect: (level: Level) => void;
}

export const LevelCard: React.FC<LevelCardProps> = ({ level, index, isUnlocked, onSelect }) => {
  const highScore = getHighScore(level.id);
  
  const difficultyColors: Record<string, string> = {
    easy: 'from-green-500 to-emerald-600',
    medium: 'from-yellow-500 to-orange-500',
    hard: 'from-red-500 to-rose-600'
  };

  return (
    <div
      className={`relative rounded-2xl overflow-hidden transition-all duration-500 transform hover:scale-105 ${
        isUnlocked ? 'cursor-pointer hover:shadow-2xl' : 'opacity-60 cursor-not-allowed'
      }`}
      onClick={() => isUnlocked && onSelect(level)}
    >
      <div className={`bg-gradient-to-br ${difficultyColors[level.difficulty]} p-1`}>
        <div className="bg-slate-900 rounded-xl p-6 h-full">
          <div className="flex items-center justify-between mb-4">
            <span className="text-4xl font-bold text-white/20">0{index + 1}</span>
            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${getDifficultyColor(level.difficulty)} bg-white/10`}>
              {getDifficultyLabel(level.difficulty)}
            </div>
          </div>
          
          <h3 className="text-xl font-bold text-white mb-2">{level.name}</h3>
          <p className="text-sm text-slate-400 mb-4 line-clamp-2">{level.description}</p>
          
          <div className="flex items-center justify-between text-sm mb-4">
            <span className="text-slate-500">回合数: {level.maxRounds}</span>
            <span className="text-slate-500">药剂单价: ¥{level.chemicalCost}</span>
          </div>

          {highScore > 0 && (
            <div className="flex items-center gap-2 mb-4 text-yellow-500">
              <Trophy size={16} />
              <span className="text-sm">最高分: {highScore}</span>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 py-3 bg-slate-800/50 rounded-lg transition-colors hover:bg-slate-700/50">
            {isUnlocked ? (
              <>
                <Play size={20} className="text-green-400" />
                <span className="text-green-400 font-semibold">开始游戏</span>
              </>
            ) : (
              <>
                <Lock size={20} className="text-slate-500" />
                <span className="text-slate-500">完成前一关解锁</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
