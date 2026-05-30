import React from 'react';
import { motion } from 'framer-motion';

interface LevelMeterProps {
  level: number;
  maxLevel?: number;
  orientation?: 'vertical' | 'horizontal';
  size?: 'sm' | 'md' | 'lg';
  showPeak?: boolean;
}

export const LevelMeter: React.FC<LevelMeterProps> = ({
  level,
  maxLevel = 100,
  orientation = 'vertical',
  size = 'md',
  showPeak = true,
}) => {
  const percentage = Math.min(100, Math.max(0, (level / maxLevel) * 100));
  
  const getColor = (pct: number) => {
    if (pct > 85) return 'bg-red-500';
    if (pct > 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getGlowColor = (pct: number) => {
    if (pct > 85) return 'shadow-red-500/50';
    if (pct > 70) return 'shadow-yellow-500/50';
    return 'shadow-green-500/50';
  };

  const sizeClasses = {
    sm: { vertical: 'w-2 h-24', horizontal: 'w-24 h-2' },
    md: { vertical: 'w-3 h-32', horizontal: 'w-32 h-3' },
    lg: { vertical: 'w-4 h-40', horizontal: 'w-40 h-4' },
  };

  if (orientation === 'vertical') {
    return (
      <div className={`${sizeClasses[size].vertical} bg-gray-800 rounded-sm relative overflow-hidden border border-gray-700`}>
        <motion.div
          className={`absolute bottom-0 w-full ${getColor(percentage)} ${percentage > 70 ? `shadow-lg ${getGlowColor(percentage)}` : ''}`}
          style={{ height: `${percentage}%` }}
          initial={{ height: 0 }}
          animate={{ height: `${percentage}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
        <div className="absolute inset-0 flex flex-col justify-between py-1">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-full h-px bg-gray-600/50" />
          ))}
        </div>
        {showPeak && percentage > 85 && (
          <div className="absolute top-0 w-full h-1 bg-red-600 animate-pulse" />
        )}
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size].horizontal} bg-gray-800 rounded-sm relative overflow-hidden border border-gray-700`}>
      <motion.div
        className={`absolute left-0 h-full ${getColor(percentage)} ${percentage > 70 ? `shadow-lg ${getGlowColor(percentage)}` : ''}`}
        style={{ width: `${percentage}%` }}
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      />
      <div className="absolute inset-0 flex justify-between px-1">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-full w-px bg-gray-600/50" />
        ))}
      </div>
    </div>
  );
};
