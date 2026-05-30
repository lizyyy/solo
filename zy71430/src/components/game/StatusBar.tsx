
import React from 'react';
import { Zap, Package, Trophy, Clock, Info } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { GAME_CONFIG } from '../../data/config';

export const StatusBar: React.FC = () => {
  const { power, maxPower, score, currentInventory, inventoryCapacity, gameVersion, rulesVersion } =
    useGameStore();

  const powerPercentage = (power / maxPower) * 100;
  const inventoryPercentage = (currentInventory / inventoryCapacity) * 100;

  const getPowerColor = () => {
    if (powerPercentage > 50) return 'bg-cyan-500';
    if (powerPercentage > 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getInventoryColor = () => {
    if (inventoryPercentage > 80) return 'bg-red-500';
    if (inventoryPercentage > 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-4 shadow-xl">
      <div className="flex items-center justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-cyan-400" />
          <span className="text-slate-300 text-sm font-medium">电量</span>
          <div className="w-32 h-3 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getPowerColor()} transition-all duration-500`}
              style={{ width: `${powerPercentage}%` }}
            />
          </div>
          <span className="text-cyan-400 font-mono text-sm">
            {power}/{maxPower}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-green-400" />
          <span className="text-slate-300 text-sm font-medium">库存</span>
          <div className="w-32 h-3 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getInventoryColor()} transition-all duration-500`}
              style={{ width: `${inventoryPercentage}%` }}
            />
          </div>
          <span className="text-green-400 font-mono text-sm">
            {currentInventory}/{inventoryCapacity}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <span className="text-slate-300 text-sm font-medium">得分</span>
          <span className="text-amber-400 font-mono text-lg font-bold">{score}</span>
        </div>

        <div className="flex items-center gap-2 text-slate-500 text-xs">
          <Info className="w-4 h-4" />
          <span>v{gameVersion} | 规则 v{rulesVersion}</span>
        </div>
      </div>
    </div>
  );
};
