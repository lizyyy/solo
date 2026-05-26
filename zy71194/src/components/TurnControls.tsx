import React from 'react';
import { SkipForward, Info } from 'lucide-react';
import { useGameStore } from '../game/state';

export const TurnControls: React.FC = () => {
  const { endTurn, team, activeEvent, status } = useGameStore();

  const canEndTurn = status === 'playing' && !activeEvent && team.actionPoints >= 0;

  return (
    <div className="game-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-500" />
          <span className="text-sm text-gray-600">
            {activeEvent ? '📢 请处理突发事件' : team.actionPoints > 0 ? '💡 点击地图上的节点移动队伍' : '⚡ 行动点数已用完，请结束回合'}
          </span>
        </div>
        <button
          onClick={endTurn}
          disabled={!canEndTurn}
          className="game-btn-primary flex items-center gap-2"
        >
          <SkipForward className="w-4 h-4" />
          结束回合
        </button>
      </div>
    </div>
  );
};
