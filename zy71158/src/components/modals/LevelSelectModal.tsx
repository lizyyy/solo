import React from 'react';
import { levels } from '@/utils/levels';
import { useGameStore } from '@/store/gameStore';
import { Play, Star } from 'lucide-react';

export default function LevelSelectModal() {
  const { startGame } = useGameStore();

  const getDifficultyStars = (id: number) => {
    return id;
  };

  return (
    <div className="min-h-screen bg-night-bg flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-neon-orange mb-2">🌙 夜市摊位经营游戏</h1>
          <p className="text-gray-400">通过游戏学习合规经营，理解用电、排烟和投诉规则</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {levels.map((level) => (
            <div
              key={level.id}
              className="bg-night-panel rounded-xl border border-night-border p-6 hover:border-neon-orange/50 transition-all cursor-pointer group"
              onClick={() => startGame(level.id)}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-bold text-neon-yellow">
                  关卡 {level.id}
                </span>
                <div className="flex">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className={
                        i < getDifficultyStars(level.id)
                          ? 'text-neon-orange fill-neon-orange'
                          : 'text-gray-600'
                      }
                    />
                  ))}
                </div>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-neon-orange transition-colors">
                {level.name}
              </h3>

              <p className="text-sm text-gray-400 mb-4">{level.description}</p>

              <div className="space-y-2 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>摊位数量</span>
                  <span className="text-gray-300">{level.stallConfigs.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>回合数</span>
                  <span className="text-gray-300">{level.maxRounds}</span>
                </div>
                <div className="flex justify-between">
                  <span>用电容量</span>
                  <span className="text-gray-300">{level.maxElectricity}</span>
                </div>
                <div className="flex justify-between">
                  <span>最大投诉</span>
                  <span className="text-gray-300">{level.maxComplaints}</span>
                </div>
              </div>

              <button
                className="w-full mt-4 py-2 bg-neon-orange/20 text-neon-orange rounded-lg flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Play size={16} />
                开始游戏
              </button>
            </div>
          ))}
        </div>

        <div className="bg-night-panel/50 rounded-xl p-6 border border-night-border">
          <h3 className="text-lg font-bold text-neon-cyan mb-4">📖 游戏规则</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-400">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <h4 className="font-semibold text-white mb-1">用电容量</h4>
                <p>合理分配各摊位功率，总用电不能超过容量限制。连续超限会触发跳闸！</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">💨</span>
              <div>
                <h4 className="font-semibold text-white mb-1">油烟排放</h4>
                <p>高功率烹饪产生油烟，开启排烟设备可降低排放。油烟超标会引发邻摊投诉。</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">😤</span>
              <div>
                <h4 className="font-semibold text-white mb-1">投诉处理</h4>
                <p>累积投诉达到上限即经营失败。注意控制油烟和与邻摊保持良好关系。</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">⏱️</span>
              <div>
                <h4 className="font-semibold text-white mb-1">限时操作</h4>
                <p>每回合限时操作，超时会扣分。在规定时间内做出最优决策！</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}