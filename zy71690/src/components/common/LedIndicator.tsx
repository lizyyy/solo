import React from 'react';
import { cn } from '@/lib/utils';

interface LedIndicatorProps {
  status: 'idle' | 'ready' | 'running' | 'paused' | 'settled' | 'error';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-gray-500',
  ready: 'bg-green-500',
  running: 'bg-green-400 animate-pulse',
  paused: 'bg-yellow-500',
  settled: 'bg-blue-500',
  error: 'bg-red-500',
};

const STATUS_LABELS: Record<string, string> = {
  idle: '待机',
  ready: '就绪',
  running: '运行中',
  paused: '已暂停',
  settled: '已结算',
  error: '错误',
};

const SIZE_CLASSES: Record<string, string> = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

export const LedIndicator: React.FC<LedIndicatorProps> = ({ status, size = 'md', label }) => {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'rounded-full shadow-lg',
          STATUS_COLORS[status],
          SIZE_CLASSES[size],
          'shadow-current/50'
        )}
        style={{
          boxShadow: status === 'running' 
            ? '0 0 10px rgba(74, 222, 128, 0.8), 0 0 20px rgba(74, 222, 128, 0.4)' 
            : undefined,
        }}
      />
      {label && (
        <span className="text-xs text-gray-400 font-mono">
          {STATUS_LABELS[status] || status}
        </span>
      )}
    </div>
  );
};
