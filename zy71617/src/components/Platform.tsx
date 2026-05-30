import { motion } from 'framer-motion';
import { Platform as PlatformType } from '@/types/game';
import { Users, AlertTriangle } from 'lucide-react';

interface PlatformProps {
  platform: PlatformType;
  position: 'left' | 'right';
}

export const Platform = ({ platform, position }: PlatformProps) => {
  const congestionPercent = platform.congestionLevel;
  const isOverflowing = platform.passengerCount > platform.maxCapacity;
  const isWarning = congestionPercent >= 70;
  const isDanger = congestionPercent >= 90 || isOverflowing;

  const getCongestionColor = () => {
    if (isDanger) return 'from-red-500 to-red-600';
    if (isWarning) return 'from-yellow-500 to-orange-500';
    return 'from-green-500 to-emerald-500';
  };

  const getBarColor = () => {
    if (isDanger) return 'bg-red-500';
    if (isWarning) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <motion.div
      className={`relative p-3 rounded-lg bg-gray-800/60 border-2 backdrop-blur-sm
        ${isDanger ? 'border-red-500 shadow-lg shadow-red-500/30' : 
          isWarning ? 'border-yellow-500/50 shadow-lg shadow-yellow-500/20' : 
          'border-gray-600/50'}
        ${position === 'left' ? 'text-right' : 'text-left'}`}
      animate={isDanger ? {
        boxShadow: ['0 0 20px rgba(239, 68, 68, 0.5)', '0 0 40px rgba(239, 68, 68, 0.3)', '0 0 20px rgba(239, 68, 68, 0.5)'],
      } : {}}
      transition={{ duration: 0.5, repeat: isDanger ? Infinity : 0 }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center gap-2 ${position === 'left' ? 'flex-row-reverse' : ''}`}>
          <Users className={`w-4 h-4 ${isDanger ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-cyan-400'}`} />
          <span className="text-sm font-semibold text-gray-200 truncate max-w-24">
            {platform.name}
          </span>
        </div>
        {isOverflowing && (
          <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
        )}
      </div>

      <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden mb-2">
        <motion.div
          className={`h-full bg-gradient-to-r ${getCongestionColor()}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, congestionPercent)}%` }}
          transition={{ duration: 0.3 }}
        />
        <div 
          className="absolute top-0 h-full w-px bg-white/30"
          style={{ left: '100%' }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">客流</span>
        <span className={`font-mono font-bold ${isDanger ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-gray-300'}`}>
          {platform.passengerCount}/{platform.maxCapacity}
        </span>
      </div>

      {isOverflowing && (
        <motion.div
          className="mt-2 text-xs text-red-400 font-medium"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          ⚠️ 客流溢出！
        </motion.div>
      )}

      <div className="mt-2 flex gap-0.5 justify-start">
        {Array.from({ length: Math.min(10, Math.ceil(platform.passengerCount / 10)) }).map((_, i) => (
          <motion.div
            key={i}
            className={`w-1.5 h-3 rounded-sm ${getBarColor()}`}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: i * 0.05 }}
          />
        ))}
      </div>
    </motion.div>
  );
};
