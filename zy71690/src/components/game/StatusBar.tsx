import React from 'react';
import { LedIndicator } from '@/components/common/LedIndicator';
import type { GameStatus } from '@/types';

interface StatusBarProps {
  status: GameStatus;
  simulationTime: number;
  currentFrame: number;
  errorCount: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  status,
  simulationTime,
  currentFrame,
  errorCount,
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-900/80 border border-gray-800 rounded-lg">
      <div className="flex items-center gap-6">
        <LedIndicator status={status} label="状态" />
        <div className="flex items-center gap-4">
          <div className="text-xs font-mono">
            <span className="text-gray-500">时间: </span>
            <span className="text-green-400">{simulationTime.toFixed(2)}s</span>
          </div>
          <div className="text-xs font-mono">
            <span className="text-gray-500">帧: </span>
            <span className="text-blue-400">{currentFrame}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {errorCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 border border-red-500/40 rounded">
            <span className="text-[10px] text-red-400 font-mono">⚠ {errorCount} 异常</span>
          </div>
        )}
        <div className="text-[10px] text-gray-600 font-mono">
          FPS: 60
        </div>
      </div>
    </div>
  );
};
