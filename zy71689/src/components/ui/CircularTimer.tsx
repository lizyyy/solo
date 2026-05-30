import React from 'react';
import { motion } from 'framer-motion';
import { formatTime } from '@/utils/format';

interface CircularTimerProps {
  timeRemaining?: number;
  timeLeft?: number;
  totalTime: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export const CircularTimer: React.FC<CircularTimerProps> = ({
  timeRemaining,
  timeLeft,
  totalTime,
  size = 120,
  strokeWidth = 8,
  color,
}) => {
  const remainingTime = timeLeft ?? timeRemaining ?? 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, remainingTime / totalTime));
  const offset = circumference * (1 - progress);

  const isUrgent = remainingTime <= 10;
  const isWarning = remainingTime <= 20 && remainingTime > 10;

  const getColor = () => {
    if (color) return color;
    if (isUrgent) return '#D62828';
    if (isWarning) return '#F77F00';
    return '#2A9D8F';
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.1, ease: 'linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={`text-2xl font-bold ${isUrgent ? 'text-red-500' : isWarning ? 'text-orange-400' : 'text-emerald-400'}`}
          animate={isUrgent ? { scale: [1, 1.1, 1] } : {}}
          transition={isUrgent ? { repeat: Infinity, duration: 0.5 } : {}}
        >
          {formatTime(remainingTime)}
        </motion.span>
        <span className="text-xs text-gray-500">剩余时间</span>
      </div>
    </div>
  );
};

export default CircularTimer;
