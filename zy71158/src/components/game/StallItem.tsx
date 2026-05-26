import React from 'react';
import { useGameStore } from '@/store/gameStore';
import { Power, Wind } from 'lucide-react';

export default function StallItem({ stall }: { stall: {
  id: string;
  name: string;
  type: string;
  power: number;
  maxPower: number;
  exhaustLevel: number;
  isOn: boolean;
  color: string;
  emoji: string;
} }) {
  const { toggleStall, setStallPower, setStallExhaust, phase } = useGameStore();
  const isDisabled = phase !== 'playing' && phase !== 'paused';

  return (
    <div
      className={`bg-night-card rounded-lg p-3 border transition-all ${
        stall.isOn
          ? 'border-neon-yellow/50 shadow-lg'
          : 'border-night-border opacity-60'
      }`}
      style={{
        boxShadow: stall.isOn ? `0 0 10px ${stall.color}40` : 'none',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{stall.emoji}</span>
          <span className="font-semibold text-white">{stall.name}</span>
        </div>
        <button
          onClick={() => toggleStall(stall.id)}
          disabled={isDisabled}
          className={`p-1.5 rounded-md transition-colors ${
            stall.isOn
              ? 'bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30'
              : 'bg-night-border text-gray-400 hover:bg-night-card'
          } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={stall.isOn ? '关闭摊位' : '开启摊位'}
        >
          <Power size={14} />
        </button>
      </div>

      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">功率</span>
          <span className="text-xs text-neon-orange">{stall.power}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={stall.power}
          onChange={(e) => setStallPower(stall.id, parseInt(e.target.value))}
          disabled={isDisabled || !stall.isOn}
          className="w-full h-1 bg-night-border rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #FF6B35 ${stall.power}%, #3A3A5C ${stall.power}%)`,
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Wind size={12} />
          排烟
        </span>
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((level) => (
            <button
              key={level}
              onClick={() => setStallExhaust(stall.id, level)}
              disabled={isDisabled || !stall.isOn}
              className={`w-6 h-6 text-xs rounded transition-colors ${
                stall.exhaustLevel === level
                  ? 'bg-neon-purple/30 text-neon-purple border border-neon-purple'
                  : 'bg-night-border text-gray-500 hover:bg-night-card'
              } ${isDisabled || !stall.isOn ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}