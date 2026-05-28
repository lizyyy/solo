
import React from 'react';
import { Level } from '../types';
import { getDifficultyLabel, getDifficultyColor } from '../data/levels';
import { Play, Lock, Star } from 'lucide-react';

interface LevelSelectProps {
  levels: Level[];
  currentLevelId: string | null;
  onSelectLevel: (level: Level) => void;
  completedLevels?: Record<string, { bestScore: number; completed: boolean }>;
}

export const LevelSelect: React.FC<LevelSelectProps> = ({
  levels,
  currentLevelId,
  onSelectLevel,
  completedLevels = {},
}) => {
  return (
    <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4">
      <div className="text-sm font-medium text-gray-200 mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
        选择关卡
      </div>
      <div className="space-y-2">
        {levels.map((level, index) => {
          const progress = completedLevels[level.id];
          const isUnlocked = index === 0 || completedLevels[levels[index - 1]?.id]?.completed;
          const isActive = currentLevelId === level.id;

          return (
            <button
              key={level.id}
              onClick={() => isUnlocked && onSelectLevel(level)}
              disabled={!isUnlocked}
              className={`w-full p-3 rounded-lg text-left transition-all ${
                isActive
                  ? 'bg-cyan-900/30 border-2 border-cyan-500'
                  : isUnlocked
                  ? 'bg-gray-800 border border-gray-700 hover:bg-gray-700'
                  : 'bg-gray-800/50 border border-gray-800 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isUnlocked ? 'bg-gray-700' : 'bg-gray-800'
                  }`}
                >
                  {isUnlocked ? (
                    progress?.completed ? (
                      <Star
                        className="w-5 h-5 text-yellow-400"
                        fill="currentColor"
                      />
                    ) : (
                      <Play className="w-5 h-5 text-cyan-400" />
                    )
                  ) : (
                    <Lock className="w-5 h-5 text-gray-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-200 truncate">
                      {level.name}
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${getDifficultyColor(level.difficulty)}22`,
                        color: getDifficultyColor(level.difficulty),
                      }}
                    >
                      {getDifficultyLabel(level.difficulty)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 truncate mt-0.5">
                    {level.description}
                  </div>
                  {progress?.bestScore !== undefined && (
                    <div className="text-xs text-cyan-400 mt-1 font-mono">
                      最高分: {progress.bestScore.toFixed(1)}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
