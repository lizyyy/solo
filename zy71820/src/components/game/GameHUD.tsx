import { Clock, Trophy, Users, DollarSign, TrendingUp } from 'lucide-react';
import { formatTime, formatNumber } from '@/utils/helpers';
import type { GameState } from '@/types/game';

interface GameHUDProps {
  state: GameState;
  levelName: string;
  playerName: string;
}

export function GameHUD({ state, levelName, playerName }: GameHUDProps) {
  const profit = state.revenue - state.costs;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <div className="bg-night-surface/80 backdrop-blur-md rounded-xl p-3 border border-night-card">
        <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
          <Clock size={14} />
          <span className="font-body">剩余时间</span>
        </div>
        <div
          className={`font-title text-2xl ${
            state.timeRemaining < 30 ? 'text-neon-pink animate-pulse' : 'text-neon-yellow'
          }`}
        >
          {formatTime(Math.ceil(state.timeRemaining))}
        </div>
      </div>

      <div className="bg-night-surface/80 backdrop-blur-md rounded-xl p-3 border border-night-card">
        <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
          <Trophy size={14} />
          <span className="font-body">当前分数</span>
        </div>
        <div className="font-title text-2xl text-neon-orange">
          {formatNumber(state.score)}
        </div>
      </div>

      <div className="bg-night-surface/80 backdrop-blur-md rounded-xl p-3 border border-night-card">
        <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
          <TrendingUp size={14} />
          <span className="font-body">满意度</span>
        </div>
        <div className="font-title text-2xl text-neon-green">
          {Math.floor(state.satisfaction)}%
        </div>
        <div className="mt-1 h-1.5 bg-night-card rounded-full overflow-hidden">
          <div
            className="h-full bg-neon-green transition-all duration-300"
            style={{ width: `${state.satisfaction}%` }}
          />
        </div>
      </div>

      <div className="bg-night-surface/80 backdrop-blur-md rounded-xl p-3 border border-night-card">
        <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
          <Users size={14} />
          <span className="font-body">已服务</span>
        </div>
        <div className="font-title text-2xl text-neon-blue">
          {state.totalCustomersServed}
          <span className="text-sm text-gray-500 ml-1">
            / 流失 {state.totalCustomersLost}
          </span>
        </div>
      </div>

      <div className="bg-night-surface/80 backdrop-blur-md rounded-xl p-3 border border-night-card">
        <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
          <DollarSign size={14} />
          <span className="font-body">收入</span>
        </div>
        <div className="font-title text-2xl text-neon-yellow">
          ¥{formatNumber(state.revenue)}
        </div>
      </div>

      <div className="bg-night-surface/80 backdrop-blur-md rounded-xl p-3 border border-night-card">
        <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
          <DollarSign size={14} />
          <span className="font-body">利润</span>
        </div>
        <div
          className={`font-title text-2xl ${
            profit >= 0 ? 'text-neon-green' : 'text-neon-pink'
          }`}
        >
          {profit >= 0 ? '+' : ''}¥{formatNumber(profit)}
        </div>
      </div>
    </div>
  );
}
