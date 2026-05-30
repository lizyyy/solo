import React from 'react';
import { cn } from '@/lib/utils';
import type { EnergyState } from '@/types';

interface EnergyBarProps {
  energy: EnergyState;
  maxKinetic: number;
  minPotential: number;
  className?: string;
}

export const EnergyBar: React.FC<EnergyBarProps> = ({
  energy,
  maxKinetic,
  minPotential,
  className,
}) => {
  const kineticPercent = maxKinetic > 0 ? Math.min(100, (energy.kinetic / maxKinetic) * 100) : 0;
  const potentialRange = Math.abs(minPotential);
  const potentialPercent = potentialRange > 0
    ? Math.min(100, ((energy.potential - minPotential) / potentialRange) * 100)
    : 50;

  const totalEnergy = energy.total;
  const escaped = totalEnergy > 0;

  return (
    <div className={cn('space-y-3', className)}>
      <h4 className="text-xs text-gray-400 font-mono tracking-wider">能量监测</h4>

      <div className="space-y-2">
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-orange-400">动能 (Ek)</span>
          <span className="text-orange-300">{energy.kinetic.toFixed(2)}</span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
          <div
            className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-100"
            style={{ width: `${kineticPercent}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-blue-400">势能 (Ep)</span>
          <span className="text-blue-300">{energy.potential.toFixed(2)}</span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700 relative">
          <div
            className="absolute top-0 h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-100"
            style={{
              left: '50%',
              width: `${potentialPercent / 2}%`,
              transform: potentialPercent < 50 ? 'translateX(-100%)' : 'translateX(0)',
            }}
          />
          <div className="absolute top-0 left-1/2 w-px h-full bg-gray-600" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-[10px] font-mono">
          <span className={cn(escaped ? 'text-green-400' : 'text-purple-400')}>总能量 (E)</span>
          <span className={cn(escaped ? 'text-green-300' : 'text-purple-300')}>
            {energy.total.toFixed(2)}
          </span>
        </div>
        <div className="h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700 relative">
          <div className="absolute top-0 left-1/2 w-px h-full bg-gray-500" />
          <div
            className="absolute top-0 left-0 h-full text-[9px] font-mono text-gray-500 pl-1 pt-0.5"
          >
            束缚态
          </div>
          <div
            className="absolute top-0 right-0 h-full text-[9px] font-mono text-gray-500 pr-1 pt-0.5 text-right"
          >
            逃逸态
          </div>
          <div
            className={cn(
              'absolute top-0 h-full transition-all duration-100',
              escaped ? 'bg-green-500/30' : 'bg-purple-500/30'
            )}
            style={{
              left: totalEnergy > 0 ? '50%' : `${50 + totalEnergy * 5}%`,
              right: totalEnergy > 0 ? `${50 - totalEnergy * 5}%` : '50%',
            }}
          />
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2',
              escaped ? 'bg-green-400 border-green-300' : 'bg-purple-400 border-purple-300'
            )}
            style={{
              left: `${50 + Math.max(-45, Math.min(45, totalEnergy * 5))}%`,
              transform: 'translateX(-50%) translateY(-50%)',
              boxShadow: escaped
                ? '0 0 8px rgba(74, 222, 128, 0.8)'
                : '0 0 8px rgba(192, 132, 252, 0.8)',
            }}
          />
        </div>
      </div>

      <div className="flex justify-between items-center pt-1 border-t border-gray-700">
        <span className="text-[10px] text-gray-500 font-mono">逃逸阈值</span>
        <span
          className={cn(
            'text-xs font-mono font-bold',
            escaped ? 'text-green-400' : 'text-gray-400'
          )}
        >
          E {escaped ? '>' : '<'} 0
        </span>
      </div>
    </div>
  );
};
