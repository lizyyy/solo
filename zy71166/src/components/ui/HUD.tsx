import { Clock, Thermometer, Zap, DollarSign, Trophy, Gauge } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { formatHour, getPricePeriodLabel, getPricePeriodColor } from '../../utils/temperature';
import { PHYSICS_CONFIG } from '../../engine/config';

interface HudItemProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  highlight?: 'normal' | 'warning' | 'danger';
}

function HudItem({ icon, label, value, subValue, highlight = 'normal' }: HudItemProps) {
  const colorClass = highlight === 'danger'
    ? 'text-red-400'
    : highlight === 'warning'
    ? 'text-yellow-400'
    : 'text-slate-300';

  return (
    <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-slate-700/50 min-w-[140px]">
      <div className="flex items-center gap-2 mb-1">
        <div className={colorClass}>{icon}</div>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className={`text-xl font-bold font-mono ${colorClass}`}>
        {value}
      </div>
      {subValue && (
        <div className="text-xs text-slate-500 font-mono">
          {subValue}
        </div>
      )}
    </div>
  );
}

export function HUD() {
  const { turnState, totalTurns, gamePhase, racks, acUnits } = useGameStore();

  const avgTemp = racks.reduce((s, r) => s + r.temperature, 0) / racks.length;
  const maxTemp = Math.max(...racks.map((r) => r.temperature));
  const totalLoad = racks.reduce((s, r) => s + r.load, 0);
  const totalCooling = acUnits
    .filter((a) => a.isOn && a.status !== 'fault')
    .reduce((s, a) => s + a.capacity, 0);

  const tempHighlight = maxTemp >= PHYSICS_CONFIG.DANGER_TEMP
    ? 'danger'
    : maxTemp >= PHYSICS_CONFIG.WARNING_TEMP
    ? 'warning'
    : 'normal';

  const costRatio = turnState.totalCost / turnState.budget;
  const costHighlight = costRatio >= 2
    ? 'danger'
    : costRatio >= 1
    ? 'warning'
    : 'normal';

  return (
    <div className="absolute top-4 left-4 right-4 z-20">
      <div className="flex flex-wrap gap-3 items-center">
        <HudItem
          icon={<Clock size={16} />}
          label="回合"
          value={`${turnState.turn} / ${totalTurns}`}
          subValue={formatHour(turnState.hour)}
        />

        <HudItem
          icon={<Thermometer size={16} />}
          label="机房温度"
          value={`${avgTemp.toFixed(1)}°C`}
          subValue={`最高 ${maxTemp.toFixed(1)}°C / 室外 ${turnState.outdoorTemp}°C`}
          highlight={tempHighlight}
        />

        <HudItem
          icon={<Zap size={16} />}
          label="电力负载"
          value={`${totalLoad.toFixed(1)} kW`}
          subValue={`制冷量 ${totalCooling.toFixed(0)} kW`}
        />

        <HudItem
          icon={<DollarSign size={16} />}
          label="电费"
          value={`¥${turnState.totalCost.toFixed(0)}`}
          subValue={
            <span className={getPricePeriodColor(turnState.pricePeriod)}>
              {getPricePeriodLabel(turnState.pricePeriod)} ¥{turnState.electricityPrice.toFixed(2)}/kWh
              {` · 预算 ${turnState.budget.toFixed(0)}元 (${(costRatio * 100).toFixed(0)}%)`}
            </span>
          }
          highlight={costHighlight}
        />

        <HudItem
          icon={<Trophy size={16} />}
          label="得分"
          value={turnState.score}
        />

        <div className="ml-auto flex items-center gap-2">
          {gamePhase === 'paused' && (
            <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-md text-sm font-medium border border-yellow-500/30 animate-pulse">
              已暂停
            </span>
          )}
          {gamePhase === 'won' && (
            <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-md text-sm font-medium border border-green-500/30">
              挑战成功
            </span>
          )}
          {gamePhase === 'lost' && (
            <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-md text-sm font-medium border border-red-500/30">
              挑战失败
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
