import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

interface EnergyBarProps {
  energy: number;
  maxEnergy?: number;
}

export const EnergyBar = ({ energy, maxEnergy = 100 }: EnergyBarProps) => {
  const percentage = (energy / maxEnergy) * 100;
  const isLow = percentage <= 20;
  const isMedium = percentage > 20 && percentage <= 50;

  const getGradientColor = () => {
    if (isLow) return 'from-red-500 to-red-600';
    if (isMedium) return 'from-yellow-500 to-orange-500';
    return 'from-cyan-400 to-blue-500';
  };

  return (
    <div className="flex items-center gap-3">
      <Zap className={`w-5 h-5 ${isLow ? 'text-red-400' : isMedium ? 'text-yellow-400' : 'text-cyan-400'}`} />
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">能量</span>
          <span className={`font-mono font-bold ${isLow ? 'text-red-400' : isMedium ? 'text-yellow-400' : 'text-cyan-400'}`}>
            {Math.round(energy)}%
          </span>
        </div>
        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className={`h-full bg-gradient-to-r ${getGradientColor()} rounded-full`}
            initial={{ width: '100%' }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    </div>
  );
};
