import React from 'react';
import { Play, History, BookOpen } from 'lucide-react';
import { useGameStore } from '../game/state';

export const MainMenu: React.FC = () => {
  const { goToLevelSelect } = useGameStore();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="game-card max-w-lg w-full p-8 text-center">
        <div className="mb-8">
          <div className="text-6xl mb-4">🏕️</div>
          <h1 className="text-3xl font-bold text-primary-700 mb-2">急救包补给游戏</h1>
          <p className="text-gray-600">
            训练你的补给管理能力，在户外探险中确保队伍安全
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={goToLevelSelect}
            className="w-full game-btn-primary text-lg py-4 flex items-center justify-center gap-3"
          >
            <Play className="w-6 h-6" />
            开始游戏
          </button>

          <button
            className="w-full game-btn-secondary text-lg py-4 flex items-center justify-center gap-3"
            onClick={() => document.getElementById('history-section')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <History className="w-6 h-6" />
            历史记录
          </button>

          <button
            className="w-full game-btn-secondary text-lg py-4 flex items-center justify-center gap-3"
            onClick={() => document.getElementById('rules-section')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <BookOpen className="w-6 h-6" />
            游戏规则
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="font-bold text-gray-700 mb-3">🎯 游戏目标</h3>
          <ul className="text-sm text-gray-600 text-left space-y-2">
            <li>• 带领队伍安全到达终点</li>
            <li>• 管理急救包，避免超重和过期药品</li>
            <li>• 经过所有关键补给点</li>
            <li>• 应对各种突发事件</li>
            <li>• 在限定回合内完成任务</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
