import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Info, Award, TrendingUp } from 'lucide-react';
import { LEVELS, getLevelDifficultyLabel, getLevelDifficultyColor } from '../data/levels';
import { useGameStore } from '../store/gameStore';
import { LevelConfig } from '../types';

const StartScreen: React.FC = () => {
  const navigate = useNavigate();
  const { startGame, getHighScore } = useGameStore();
  const [selectedLevel, setSelectedLevel] = useState<LevelConfig>(LEVELS[0]);

  const handleStartGame = () => {
    startGame(selectedLevel);
    navigate('/game');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-green-800 to-teal-900 flex flex-col items-center justify-center p-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 text-8xl opacity-10 animate-bounce">♻️</div>
        <div className="absolute top-40 right-32 text-6xl opacity-10 animate-pulse">🌱</div>
        <div className="absolute bottom-32 left-40 text-7xl opacity-10 animate-bounce" style={{ animationDelay: '0.5s' }}>🗑️</div>
        <div className="absolute bottom-20 right-20 text-8xl opacity-10 animate-pulse" style={{ animationDelay: '0.3s' }}>🌍</div>
      </div>

      <div className="relative z-10 text-center mb-12">
        <div className="text-8xl mb-6 animate-bounce">♻️</div>
        <h1 className="text-6xl font-bold text-white mb-4 drop-shadow-2xl">
          回收分拣产线
        </h1>
        <p className="text-xl text-emerald-200 max-w-xl mx-auto">
          体验真实的垃圾分类工作，学习环保知识，成为分拣大师！
        </p>
      </div>

      <div className="relative z-10 w-full max-w-4xl">
        <h2 className="text-2xl font-bold text-white mb-6 text-center flex items-center justify-center gap-3">
          <TrendingUp className="w-7 h-7" />
          选择关卡
        </h2>
        
        <div className="grid grid-cols-3 gap-6 mb-8">
          {LEVELS.map((level) => (
            <div
              key={level.id}
              onClick={() => setSelectedLevel(level)}
              className={`relative p-6 rounded-2xl cursor-pointer transition-all duration-300 transform ${
                selectedLevel.id === level.id
                  ? 'bg-white/20 scale-105 shadow-2xl ring-4 ring-white/40'
                  : 'bg-white/10 hover:bg-white/15 hover:scale-102 shadow-lg'
              }`}
            >
              {selectedLevel.id === level.id && (
                <div className="absolute -top-3 -right-3 bg-yellow-400 text-yellow-900 rounded-full p-2 shadow-lg">
                  <Award className="w-5 h-5" />
                </div>
              )}
              
              <div className="text-center">
                <div className="text-5xl mb-3">
                  {level.id === 1 ? '🎓' : level.id === 2 ? '👷' : '🏆'}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{level.name}</h3>
                <span className={`text-sm font-semibold ${getLevelDifficultyColor(level)}`}>
                  {getLevelDifficultyLabel(level)}
                </span>
                <p className="text-sm text-emerald-100 mt-3 mb-4">
                  {level.description}
                </p>
                <div className="space-y-2 text-xs text-emerald-200">
                  <div className="flex justify-between">
                    <span>物品数量</span>
                    <span className="font-semibold">{level.itemCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>传送带速度</span>
                    <span className="font-semibold">x{level.speed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>最高分</span>
                    <span className="font-semibold text-yellow-300">{getHighScore(level.id)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={handleStartGame}
            className="group flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-gray-900 font-bold text-xl rounded-2xl shadow-2xl transform hover:scale-105 transition-all duration-300"
          >
            <Play className="w-7 h-7 group-hover:scale-110 transition-transform" />
            开始游戏
          </button>
        </div>
      </div>

      <div className="relative z-10 mt-12 bg-white/10 backdrop-blur-sm rounded-2xl p-6 max-w-2xl">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Info className="w-5 h-5" />
          游戏说明
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm text-emerald-100">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🖱️</span>
            <div>
              <span className="font-semibold text-white">拖拽分拣</span>
              <p>用鼠标拖拽物品到对应分类桶</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔥</span>
            <div>
              <span className="font-semibold text-white">连击加分</span>
              <p>连续正确分类获得额外加分</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <span className="font-semibold text-white">危险品</span>
              <p>红色感叹号标记，漏拦重罚</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">💧</span>
            <div>
              <span className="font-semibold text-white">污染物</span>
              <p>黄色水滴标记，注意辨别</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StartScreen;
