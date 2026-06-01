import React from 'react';
import { motion } from 'framer-motion';
import { Gauge, Target, AlertTriangle } from 'lucide-react';

interface LoadDisplayProps {
  currentLoad: number;
  maxLoad: number;
  targetLoad: number;
  currentRound: number;
  totalRounds: number;
  isFailure?: boolean;
}

export const LoadDisplay: React.FC<LoadDisplayProps> = ({
  currentLoad,
  maxLoad,
  targetLoad,
  currentRound,
  totalRounds,
  isFailure = false,
}) => {
  const loadPercent = maxLoad > 0 ? (currentLoad / maxLoad) * 100 : 0;
  const targetPercent = maxLoad > 0 ? (targetLoad / maxLoad) * 100 : 0;
  const isOverloaded = currentLoad > maxLoad;
  const isNearTarget = Math.abs(currentLoad - targetLoad) <= targetLoad * 0.05;

  const getBridgeDeflection = () => {
    const baseDeflection = 0;
    const maxDeflection = 20;
    if (currentLoad <= 0) return baseDeflection;
    return Math.min((loadPercent / 100) * maxDeflection, maxDeflection);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-400">
            <Gauge className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-medium">当前回合</span>
          </div>
          <div className="text-4xl font-bold text-white font-mono">
            <span className="text-amber-500">{currentRound}</span>
            <span className="text-gray-500 text-2xl"> / {totalRounds}</span>
          </div>
        </div>

        <div className="space-y-2 text-right">
          <div className="flex items-center gap-2 text-gray-400 justify-end">
            <Target className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium">目标载荷</span>
          </div>
          <div className="text-4xl font-bold text-white font-mono">
            <span className="text-blue-500">{targetLoad}</span>
            <span className="text-gray-500 text-xl"> kg</span>
          </div>
        </div>
      </div>

      <div className="relative h-40 bg-gradient-to-b from-slate-800 to-slate-900 rounded-lg border-2 border-slate-700 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-amber-500"
              style={{ top: `${(i + 1) * 10}%` }}
            />
          ))}
        </div>

        <div
          className="absolute left-0 right-0 h-1 bg-blue-500 z-10"
          style={{ top: `${100 - targetPercent}%` }}
        >
          <div className="absolute -top-6 left-2 text-xs text-blue-400 font-mono bg-slate-900 px-2 py-1 rounded">
            目标: {targetLoad}kg
          </div>
        </div>

        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 160" preserveAspectRatio="none">
          <motion.g
            animate={{ y: getBridgeDeflection() }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          >
            <path
              d="M 20 100 L 380 100"
              stroke={isOverloaded ? '#E74C3C' : isNearTarget ? '#3498DB' : '#F5A623'}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              className={isFailure ? 'animate-pulse' : ''}
            />
            
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i}>
                <motion.line
                  x1={80 + i * 60}
                  y1="100"
                  x2={80 + i * 60}
                  y2={100 + (loadPercent > 80 ? 30 : 15)}
                  stroke={isOverloaded ? '#E74C3C' : '#64748B'}
                  strokeWidth="3"
                  animate={{ 
                    y2: isFailure 
                      ? [100 + 15, 100 + 40, 100 + 15] 
                      : 100 + (loadPercent > 80 ? 30 : 15)
                  }}
                  transition={{ duration: isFailure ? 0.3 : 0.5 }}
                />
                <motion.rect
                  x={70 + i * 60}
                  y={95}
                  width="20"
                  height="10"
                  rx="2"
                  fill={isOverloaded ? '#E74C3C' : '#F5A623'}
                  className={isFailure ? 'animate-pulse' : ''}
                />
              </g>
            ))}
          </motion.g>

          <line x1="20" y1="150" x2="20" y2="100" stroke="#475569" strokeWidth="6" />
          <line x1="380" y1="150" x2="380" y2="100" stroke="#475569" strokeWidth="6" />
          <rect x="10" y="145" width="20" height="10" fill="#334155" />
          <rect x="370" y="145" width="20" height="10" fill="#334155" />
        </svg>

        {isOverloaded && (
          <div className="absolute top-3 right-3 flex items-center gap-2 bg-red-900/80 text-red-400 px-3 py-1 rounded-full animate-pulse">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-bold">超载!</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400 font-mono">0</span>
          <span className="text-amber-500 font-bold font-mono">
            当前: {currentLoad} kg ({loadPercent.toFixed(1)}%)
          </span>
          <span className="text-gray-400 font-mono">{maxLoad}</span>
        </div>
        <div className="relative h-6 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
          <motion.div
            className="absolute left-0 top-0 bottom-0 rounded-full"
            initial={{ width: 0 }}
            animate={{ 
              width: `${Math.min(loadPercent, 100)}%`,
              backgroundColor: isOverloaded 
                ? '#E74C3C' 
                : loadPercent > targetPercent 
                  ? '#F5A623' 
                  : '#10B981'
            }}
            transition={{ duration: 0.5 }}
          />
          <div
            className="absolute top-0 bottom-0 w-1 bg-blue-500 z-10"
            style={{ left: `${targetPercent}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-white font-mono drop-shadow-lg">
              {currentLoad} / {maxLoad} kg
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
