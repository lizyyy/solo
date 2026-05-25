import React from 'react';
import { useGameStore } from '@/store/gameStore';
import StallItem from './StallItem';

export default function ControlPanel() {
  const { stalls, phase } = useGameStore();

  return (
    <div className="bg-night-panel rounded-xl p-4 border border-night-border h-full flex flex-col">
      <h3 className="text-lg font-bold text-neon-yellow mb-3">🏪 摊位管理</h3>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
        {stalls.map((stall) => (
          <StallItem key={stall.id} stall={stall} />
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-night-border text-xs text-gray-500">
        {phase === 'paused' && <span className="text-neon-yellow">⏸ 游戏已暂停</span>}
        {phase === 'playing' && <span className="text-neon-cyan">▶ 经营中...</span>}
      </div>
    </div>
  );
}