import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { Flame, Trophy, Zap, Target } from 'lucide-react';

const StatusBar: React.FC = () => {
  const { score, combo, correctCount, wrongCount, missedCount, currentLevel, spawnedCount } = useGameStore();

  const totalProcessed = correctCount + wrongCount + missedCount;
  const totalItems = currentLevel?.itemCount || 0;
  const progress = totalItems > 0 ? (spawnedCount / totalItems) * 100 : 0;

  return (
    <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-4 shadow-2xl border border-gray-700">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/20 rounded-xl">
            <Trophy className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <div className="text-xs text-gray-400">分数</div>
            <div className="text-2xl font-bold text-white">{score}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${combo > 0 ? 'bg-orange-500/20' : 'bg-gray-600/20'}`}>
            <Flame className={`w-6 h-6 ${combo > 0 ? 'text-orange-400' : 'text-gray-500'}`} />
          </div>
          <div>
            <div className="text-xs text-gray-400">连击</div>
            <div className={`text-2xl font-bold ${combo > 0 ? 'text-orange-400' : 'text-gray-500'}`}>
              {combo > 0 ? `x${combo}` : '-'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-xl">
            <Target className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <div className="text-xs text-gray-400">正确率</div>
            <div className="text-2xl font-bold text-green-400">
              {totalProcessed > 0 ? Math.round((correctCount / totalProcessed) * 100) : 100}%
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-xl">
            <Zap className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <div className="text-xs text-gray-400">速度</div>
            <div className="text-2xl font-bold text-blue-400">
              x{currentLevel?.speed || 1}
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>进度</span>
            <span>{spawnedCount} / {totalItems}</span>
          </div>
          <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
