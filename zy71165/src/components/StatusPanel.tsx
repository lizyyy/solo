import React from 'react';
import { Gauge, Users, Droplets, Clock, Footprints, AlertTriangle } from 'lucide-react';
import type { GameState, Level } from '../engine/types';

interface StatusPanelProps {
  gameState: GameState;
  level: Level;
}

export const StatusPanel: React.FC<StatusPanelProps> = ({ gameState, level }) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPressureColor = (pressure: number, minRequired: number) => {
    if (pressure === 0) return 'text-gray-500';
    if (pressure < minRequired) return 'text-red-400';
    if (pressure < minRequired + 10) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getUsersColor = (affected: number, max: number) => {
    if (affected === 0) return 'text-green-400';
    if (affected <= max * 0.5) return 'text-yellow-400';
    if (affected <= max) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl p-4 space-y-4 w-64 border border-slate-700">
      <h3 className="text-lg font-bold text-blue-400 border-b border-slate-600 pb-2">
        实时状态
      </h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-400" />
            <span className="text-slate-300 text-sm">已隔离漏点</span>
          </div>
          <span className="font-mono font-bold text-lg text-green-400">
            {gameState.isolatedLeaks}/{level.targetIsolatedLeaks}
          </span>
        </div>

        <div className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-400" />
            <span className="text-slate-300 text-sm">受影响用户</span>
          </div>
          <span
            className={`font-mono font-bold text-lg ${getUsersColor(
              gameState.affectedUsers,
              level.maxAffectedUsers
            )}`}
          >
            {gameState.affectedUsers}/{level.maxAffectedUsers}
          </span>
        </div>

        <div className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-green-400" />
            <span className="text-slate-300 text-sm">最低压力</span>
          </div>
          <span
            className={`font-mono font-bold text-lg ${getPressureColor(
              gameState.minPressure,
              level.minPressure
            )}`}
          >
            {gameState.minPressure.toFixed(1)}
            <span className="text-xs text-slate-400"> / {level.minPressure}</span>
          </span>
        </div>

        <div className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-cyan-400" />
            <span className="text-slate-300 text-sm">平均压力</span>
          </div>
          <span className="font-mono font-bold text-lg text-cyan-400">
            {gameState.averagePressure.toFixed(1)}
          </span>
        </div>

        <div className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Footprints className="w-5 h-5 text-purple-400" />
            <span className="text-slate-300 text-sm">操作步数</span>
          </div>
          <span className="font-mono font-bold text-lg text-purple-400">
            {gameState.stepCount}
            {level.maxSteps && (
              <span className="text-xs text-slate-400"> / {level.maxSteps}</span>
            )}
          </span>
        </div>

        <div className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="text-slate-300 text-sm">用时</span>
          </div>
          <span
            className={`font-mono font-bold text-lg ${
              level.timeLimit && gameState.elapsedTime > level.timeLimit
                ? 'text-red-400'
                : 'text-yellow-400'
            }`}
          >
            {formatTime(gameState.elapsedTime)}
            {level.timeLimit && (
              <span className="text-xs text-slate-400"> / {formatTime(level.timeLimit)}</span>
            )}
          </span>
        </div>
      </div>

      <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-600">
        <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          目标说明
        </h4>
        <p className="text-xs text-slate-400 leading-relaxed">{level.description}</p>
      </div>

      <div className="mt-2 p-3 bg-slate-900/50 rounded-lg border border-slate-600">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">图例</h4>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-slate-400">水厂（水源）</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-slate-400">漏点（未隔离）</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span className="text-slate-400">漏点（已隔离）</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-slate-400">用户区（正常）</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-slate-400">用户区（受影响）</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <span className="text-slate-400">阀门（开启）</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <span className="text-slate-400">阀门（关闭）</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-slate-400">主阀门（不可关闭）</span>
          </div>
        </div>
      </div>
    </div>
  );
};
