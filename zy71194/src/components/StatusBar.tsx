import React from 'react';
import { Heart, Zap, Clock, Backpack, Trophy } from 'lucide-react';
import { useGameStore } from '../game/state';

export const StatusBar: React.FC = () => {
  const { team, turn, maxTurns, inventory, currentLevel, score, pauseGame } = useGameStore();

  const totalWeight = inventory.reduce((sum, item) => sum + item.weight * item.quantity, 0);
  const maxWeight = currentLevel?.maxWeight || 10;
  const weightPercent = Math.min(100, (totalWeight / maxWeight) * 100);
  const isOverweight = totalWeight > maxWeight;

  const healthPercent = (team.health / team.maxHealth) * 100;
  const healthColor = healthPercent > 60 ? 'bg-green-500' : healthPercent > 30 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="game-card p-4 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Heart className={`w-5 h-5 ${healthPercent <= 30 ? 'text-red-500 animate-pulse' : 'text-red-500'}`} />
            <div className="w-24">
              <div className="progress-bar">
                <div className={`progress-fill ${healthColor}`} style={{ width: `${healthPercent}%` }}></div>
              </div>
              <span className="text-xs text-gray-600">{team.health}/{team.maxHealth}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <div className="flex gap-1">
              {Array.from({ length: team.maxActionPoints }).map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full ${i < team.actionPoints ? 'bg-yellow-400' : 'bg-gray-300'}`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <span className={`font-bold ${turn > maxTurns * 0.7 ? 'text-red-500' : 'text-gray-700'}`}>
              回合 {turn}/{maxTurns}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Backpack className={`w-5 h-5 ${isOverweight ? 'text-red-500' : 'text-gray-600'}`} />
            <div className="w-28">
              <div className="progress-bar">
                <div
                  className={`progress-fill ${isOverweight ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${weightPercent}%` }}
                ></div>
              </div>
              <span className={`text-xs ${isOverweight ? 'text-red-500 font-bold' : 'text-gray-600'}`}>
                {totalWeight.toFixed(1)}/{maxWeight} kg
                {isOverweight && ' (超重!)'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span className="font-bold text-amber-600">{score.total}</span>
          </div>

          <button onClick={pauseGame} className="game-btn-secondary text-sm">
            暂停
          </button>
        </div>
      </div>
    </div>
  );
};
