import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Flag,
  History,
  Shield,
  Lock,
  Database,
  Eye,
  Coins,
  Heart,
  Waves,
  Clock,
} from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { TowerType } from '@/types/game';
import { TOWER_CONFIG, formatTime } from '@/utils/gameUtils';

const towerTypes: TowerType[] = ['firewall', 'encryption', 'backup', 'monitor'];
const towerIcons: Record<TowerType, React.ReactNode> = {
  firewall: <Shield className="w-5 h-5" />,
  encryption: <Lock className="w-5 h-5" />,
  backup: <Database className="w-5 h-5" />,
  monitor: <Eye className="w-5 h-5" />,
};

export const ControlPanel: React.FC = () => {
  const {
    status,
    health,
    maxHealth,
    coins,
    currentWave,
    selectedTowerType,
    totalPlayTime,
    config,
    setSelectedTowerType,
    startGame,
    pauseGame,
    resumeGame,
    resetGame,
    endGame,
    startReplay,
  } = useGameStore();

  const currentLevel = config?.levels[0];

  const handleTowerSelect = (type: TowerType) => {
    if (status !== 'playing') return;
    setSelectedTowerType(selectedTowerType === type ? null : type);
  };

  return (
    <div className="bg-slate-800/90 backdrop-blur rounded-xl p-6 space-y-6 border border-slate-700">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">
          {config?.name || '链上钱包防守塔'}
        </h2>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            status === 'playing'
              ? 'bg-green-500/20 text-green-400'
              : status === 'paused'
              ? 'bg-yellow-500/20 text-yellow-400'
              : status === 'ended'
              ? 'bg-red-500/20 text-red-400'
              : 'bg-slate-600/50 text-slate-400'
          }`}
        >
          {status === 'playing'
            ? '进行中'
            : status === 'paused'
            ? '已暂停'
            : status === 'ended'
            ? '已结束'
            : '准备中'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <Heart className="w-4 h-4 text-red-400" />
            <span>钱包生命值</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-slate-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-300"
                style={{ width: `${(health / maxHealth) * 100}%` }}
              />
            </div>
            <span className="text-white font-bold min-w-[60px] text-right">
              {health}/{maxHealth}
            </span>
          </div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span>金币</span>
          </div>
          <div className="text-2xl font-bold text-yellow-400">{coins}</div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <Waves className="w-4 h-4 text-blue-400" />
            <span>当前波次</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {currentWave} / {currentLevel?.waveCount || 0}
          </div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>游戏时长</span>
          </div>
          <div className="text-2xl font-bold text-cyan-400">
            {formatTime(totalPlayTime)}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-400">选择防守塔</h3>
        <div className="grid grid-cols-2 gap-3">
          {towerTypes.map((type) => {
            const config = TOWER_CONFIG[type];
            const isSelected = selectedTowerType === type;
            const canAfford = coins >= config.cost;

            return (
              <button
                key={type}
                onClick={() => handleTowerSelect(type)}
                disabled={status !== 'playing' || !canAfford}
                className={`
                  p-4 rounded-lg border-2 transition-all duration-200 text-left
                  ${isSelected ? 'border-blue-500 bg-blue-500/20' : 'border-slate-600 bg-slate-700/50'}
                  ${status !== 'playing' || !canAfford ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400 cursor-pointer'}
                `}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${isSelected ? 'bg-blue-500' : 'bg-slate-600'}`}
                  >
                    {towerIcons[type]}
                  </div>
                  <div>
                    <div className="font-medium text-white">{config.name}</div>
                    <div className="text-xs text-yellow-400 flex items-center gap-1">
                      <Coins className="w-3 h-3" />
                      {config.cost}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {config.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {status === 'idle' && (
          <button
            onClick={startGame}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-green-700 transition-all shadow-lg shadow-green-500/25"
          >
            <Play className="w-5 h-5" />
            开始游戏
          </button>
        )}

        {status === 'playing' && (
          <button
            onClick={pauseGame}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-lg font-medium hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-lg shadow-yellow-500/25"
          >
            <Pause className="w-5 h-5" />
            暂停
          </button>
        )}

        {status === 'paused' && (
          <button
            onClick={resumeGame}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-green-700 transition-all shadow-lg shadow-green-500/25"
          >
            <Play className="w-5 h-5" />
            继续
          </button>
        )}

        {(status === 'playing' || status === 'paused') && (
          <button
            onClick={endGame}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg font-medium hover:from-red-600 hover:to-red-700 transition-all shadow-lg shadow-red-500/25"
          >
            <Flag className="w-5 h-5" />
            结算
          </button>
        )}

        <button
          onClick={resetGame}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-all"
        >
          <RotateCcw className="w-5 h-5" />
          重开
        </button>

        {status === 'ended' && (
          <button
            onClick={startReplay}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25"
          >
            <History className="w-5 h-5" />
            回放
          </button>
        )}
      </div>
    </div>
  );
};
