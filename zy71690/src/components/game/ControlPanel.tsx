import React from 'react';
import { Play, Pause, RotateCcw, Rocket, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SliderInput } from '@/components/common/SliderInput';
import { AngleDial } from '@/components/common/AngleDial';
import type { GameStatus, PhysicsParams } from '@/types';
import { calculateEscapeVelocity } from '@/utils/physics/integrator';
import { DEFAULT_MARBLE, DEFAULT_BODIES } from '@/types';

interface ControlPanelProps {
  status: GameStatus;
  launchSpeed: number;
  launchAngle: number;
  physicsParams: PhysicsParams;
  onLaunchSpeedChange: (speed: number) => void;
  onLaunchAngleChange: (angle: number) => void;
  onPhysicsParamsChange: (params: PhysicsParams) => void;
  onLaunch: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  status,
  launchSpeed,
  launchAngle,
  physicsParams,
  onLaunchSpeedChange,
  onLaunchAngleChange,
  onPhysicsParamsChange,
  onLaunch,
  onPause,
  onResume,
  onReset,
}) => {
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isSettled = status === 'settled';
  const canEdit = status === 'idle' || status === 'ready' || isSettled;

  const escapeVelocity = calculateEscapeVelocity(
    { x: DEFAULT_MARBLE.x, y: DEFAULT_MARBLE.y },
    DEFAULT_BODIES,
    physicsParams.gravitationalConstant
  );

  const speedRatio = launchSpeed / escapeVelocity;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-200 font-mono tracking-wider flex items-center gap-2">
          <Settings size={14} className="text-green-500" />
          发射控制
        </h3>
        <div className="text-[10px] font-mono text-gray-500">
          逃逸速度: <span className="text-orange-400">{escapeVelocity.toFixed(1)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-4">
          <AngleDial
            angle={launchAngle}
            onChange={onLaunchAngleChange}
            disabled={!canEdit}
            size={120}
          />
        </div>

        <div className="space-y-4">
          <SliderInput
            label="初速度"
            value={launchSpeed}
            min={10}
            max={200}
            step={1}
            unit="px/s"
            onChange={onLaunchSpeedChange}
            disabled={!canEdit}
          />

          <div className="p-2 bg-gray-800/50 rounded border border-gray-700">
            <div className="text-[10px] text-gray-400 font-mono mb-1">能量分析</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-300',
                    speedRatio >= 1
                      ? 'bg-gradient-to-r from-green-500 to-green-400'
                      : 'bg-gradient-to-r from-orange-500 to-orange-400'
                  )}
                  style={{ width: `${Math.min(100, speedRatio * 100)}%` }}
                />
              </div>
              <span
                className={cn(
                  'text-xs font-mono font-bold',
                  speedRatio >= 1 ? 'text-green-400' : 'text-orange-400'
                )}
              >
                {(speedRatio * 100).toFixed(0)}%
              </span>
            </div>
            <div className="text-[9px] text-gray-500 font-mono mt-1">
              {speedRatio >= 1 ? '✓ 能量足够逃逸' : '⚠ 能量不足'}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-700 pt-4">
        <h4 className="text-xs text-gray-400 font-mono mb-3">引力参数</h4>
        <div className="grid grid-cols-2 gap-3">
          <SliderInput
            label="引力常数 G"
            value={physicsParams.gravitationalConstant}
            min={100}
            max={2000}
            step={10}
            onChange={(v) =>
              onPhysicsParamsChange({ ...physicsParams, gravitationalConstant: v })
            }
            disabled={!canEdit}
          />
          <SliderInput
            label="时间步长"
            value={physicsParams.timeStep}
            min={0.008}
            max={0.032}
            step={0.001}
            onChange={(v) => onPhysicsParamsChange({ ...physicsParams, timeStep: v })}
            disabled={!canEdit}
          />
          <SliderInput
            label="阻尼系数"
            value={physicsParams.damping}
            min={0}
            max={0.1}
            step={0.001}
            onChange={(v) => onPhysicsParamsChange({ ...physicsParams, damping: v })}
            disabled={!canEdit}
          />
        </div>
      </div>

      <div className="border-t border-gray-700 pt-4 flex gap-2">
        {!isRunning && !isPaused && (
          <button
            onClick={onLaunch}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg',
              'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400',
              'text-white font-mono font-bold tracking-wider transition-all duration-200',
              'shadow-lg shadow-green-500/30 hover:shadow-green-500/50',
              'active:scale-95',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'
            )}
            disabled={!canEdit}
          >
            <Rocket size={18} />
            发射
          </button>
        )}

        {isRunning && (
          <button
            onClick={onPause}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white font-mono font-bold transition-all active:scale-95"
          >
            <Pause size={18} />
            暂停
          </button>
        )}

        {isPaused && (
          <button
            onClick={onResume}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-green-600 hover:bg-green-500 text-white font-mono font-bold transition-all active:scale-95"
          >
            <Play size={18} />
            继续
          </button>
        )}

        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 font-mono font-bold transition-all active:scale-95"
        >
          <RotateCcw size={18} />
          重置
        </button>
      </div>
    </div>
  );
};
