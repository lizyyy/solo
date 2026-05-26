import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';
import { getChemicalById } from '../../data/chemicals';
import { Thermometer, Droplets, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Dashboard: React.FC = () => {
  const temperature = useGameStore(state => state.temperature);
  const humidity = useGameStore(state => state.humidity);
  const placedChemicals = useGameStore(state => state.placedChemicals);
  const violations = useGameStore(state => state.violations);

  const tempViolations = violations.filter(v => v.type === 'temperature');
  const hasTempAlert = tempViolations.length > 0;

  const checkTemperatureStatus = (temp: number): { status: 'safe' | 'warning' | 'danger'; min: number; max: number } => {
    let min = Infinity;
    let max = -Infinity;
    
    for (const id of placedChemicals) {
      const chemical = getChemicalById(id);
      if (chemical) {
        min = Math.min(min, chemical.storageRequirements.minTemp);
        max = Math.max(max, chemical.storageRequirements.maxTemp);
      }
    }

    if (min === Infinity || max === -Infinity) {
      min = 0;
      max = 40;
    }

    if (temp < min || temp > max) {
      return { status: 'danger', min, max };
    }
    if (temp < min + 5 || temp > max - 5) {
      return { status: 'warning', min, max };
    }
    return { status: 'safe', min, max };
  };

  const tempStatus = checkTemperatureStatus(temperature);

  const tempColor = {
    safe: 'text-green-400',
    warning: 'text-yellow-400',
    danger: 'text-red-400'
  }[tempStatus.status];

  const tempBgColor = {
    safe: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500'
  }[tempStatus.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-slate-900/50 rounded-xl border border-slate-700"
    >
      <h3 className="text-sm font-bold text-slate-300 mb-3">环境监控</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Thermometer className={cn('w-4 h-4', tempColor)} />
            <span className="text-xs text-slate-400">温度</span>
            <span className={cn('text-lg font-bold font-mono', tempColor)}>
              {temperature.toFixed(1)}°C
            </span>
            {hasTempAlert && (
              <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
            )}
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', tempBgColor)}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, ((temperature - 0) / 50) * 100))}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            要求: {tempStatus.min}~{tempStatus.max}°C
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-slate-400">湿度</span>
            <span className="text-lg font-bold font-mono text-cyan-400">
              {humidity.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-cyan-500"
              initial={{ width: 0 }}
              animate={{ width: `${humidity}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            要求: ≤80%
          </div>
        </div>
      </div>

      {(hasTempAlert || violations.length > 0) && (
        <div className="mt-3 p-2 bg-red-900/30 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-red-400 text-xs">
            <AlertTriangle className="w-3 h-3" />
            <span>{violations.length} 项违规</span>
          </div>
          <div className="mt-1 text-[10px] text-red-300/70">
            {violations.slice(-3).map((v, i) => (
              <div key={i}>{v.description}</div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};
