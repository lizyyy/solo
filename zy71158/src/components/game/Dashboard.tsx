import React from 'react';
import { useGameStore } from '@/store/gameStore';
import { Wind, Zap, AlertTriangle } from 'lucide-react';

interface ProgressBarProps {
  value: number;
  max: number;
  color: string;
  label: string;
  icon?: React.ReactNode;
  warningThreshold?: number;
  dangerThreshold?: number;
}

function ProgressBar({ value, max, color, label, icon, warningThreshold, dangerThreshold }: ProgressBarProps) {
  const ratio = Math.min(value / max, 1.5);
  const percentage = Math.min(ratio * 100, 150);

  let barColor = color;
  if (dangerThreshold && value / max >= dangerThreshold) barColor = '#E63946';
  else if (warningThreshold && value / max >= warningThreshold) barColor = '#FF6B35';

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm text-gray-300">{label}</span>
        </div>
        <span className="text-sm font-mono text-white">
          {Math.round(value)} / {max}
        </span>
      </div>
      <div className="h-3 bg-night-card rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: barColor }}
        />
      </div>
      {ratio > 1 && (
        <div className="text-xs text-neon-red mt-1 flex items-center gap-1">
          <AlertTriangle size={12} />
          超限 {Math.round((ratio - 1) * 100)}%
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const {
    totalElectricity,
    maxElectricity,
    totalSmoke,
    maxSmoke,
    complaints,
    maxComplaints,
    score,
    money,
    scoreBreakdown,
  } = useGameStore();

  return (
    <div className="bg-night-panel rounded-xl p-4 border border-night-border">
      <h3 className="text-lg font-bold text-neon-yellow mb-4">📊 经营状态</h3>

      <ProgressBar
        value={totalElectricity}
        max={maxElectricity}
        color="#2EC4B6"
        label="用电容量"
        icon={<Zap size={16} className="text-neon-cyan" />}
        warningThreshold={0.85}
        dangerThreshold={1}
      />

      <ProgressBar
        value={totalSmoke}
        max={maxSmoke}
        color="#FF6B35"
        label="油烟指数"
        icon={<Wind size={16} className="text-neon-orange" />}
        warningThreshold={0.7}
        dangerThreshold={1}
      />

      <ProgressBar
        value={complaints}
        max={maxComplaints}
        color="#E63946"
        label="投诉值"
        icon={<AlertTriangle size={16} className="text-neon-red" />}
        warningThreshold={0.7}
        dangerThreshold={1}
      />

      <div className="border-t border-night-border mt-4 pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-300">💰 资金</span>
          <span className="text-lg font-bold text-neon-cyan">¥{money}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">⭐ 当前评分</span>
          <span className="text-lg font-bold text-neon-yellow">{score}</span>
        </div>
      </div>

      <div className="border-t border-night-border mt-4 pt-4">
        <h4 className="text-sm font-semibold text-gray-400 mb-2">评分明细</h4>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-neon-cyan">用电效率</span>
            <span className="text-white">{scoreBreakdown.efficiency}/30</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neon-orange">合规经营</span>
            <span className="text-white">{scoreBreakdown.compliance}/50</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neon-yellow">经营收益</span>
            <span className="text-white">{scoreBreakdown.profit}/20</span>
          </div>
          {scoreBreakdown.penalty > 0 && (
            <div className="flex justify-between">
              <span className="text-neon-red">违规扣分</span>
              <span className="text-neon-red">-{scoreBreakdown.penalty}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}