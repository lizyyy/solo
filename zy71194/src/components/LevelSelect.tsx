import React from 'react';
import { ArrowLeft, Star, Mountain, MapPin, Timer, Backpack } from 'lucide-react';
import { useGameStore } from '../game/state';
import { LEVELS } from '../data/levels';

export const LevelSelect: React.FC = () => {
  const { goToMenu, startGame } = useGameStore();

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'hard': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return '简单';
      case 'medium': return '中等';
      case 'hard': return '困难';
      default: return difficulty;
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={goToMenu}
          className="flex items-center gap-2 text-gray-600 hover:text-primary-600 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          返回主菜单
        </button>

        <h1 className="text-3xl font-bold text-gray-800 mb-2">选择关卡</h1>
        <p className="text-gray-600 mb-8">选择一个关卡开始你的补给训练</p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {LEVELS.map((level) => (
            <div
              key={level.id}
              className="game-card p-6 hover:shadow-xl transition-all duration-300 cursor-pointer group"
              onClick={() => startGame(level)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-4xl">
                  {level.difficulty === 'easy' ? '🌿' : level.difficulty === 'medium' ? '⛰️' : '🏔️'}
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(level.difficulty)}`}>
                  {getDifficultyText(level.difficulty)}
                </span>
              </div>

              <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-primary-600 transition-colors">
                {level.name}
              </h3>
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">{level.description}</p>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Timer className="w-4 h-4" />
                  <span>限制回合: {level.maxTurns}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Backpack className="w-4 h-4" />
                  <span>最大负重: {level.maxWeight}kg</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>节点数量: {level.nodes.length}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Star className="w-4 h-4" />
                  <span>关键补给点: {level.criticalSupplyNodes?.length || 0}</span>
                </div>
              </div>

              <button className="w-full game-btn-primary mt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                开始挑战
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
