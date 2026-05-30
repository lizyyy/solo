import { motion } from 'framer-motion';
import { Train as TrainIcon, AlertTriangle } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';

export const TrainDisplay = () => {
  const { trains, anomalies } = useGameStore();
  const hasCollisionWarning = anomalies.some(a => a.type === 'train_collision' && Date.now() - a.time < 2000);

  return (
    <div className="relative w-full h-20 bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full h-1 bg-gray-600" />
        <div className="absolute inset-0 flex items-center justify-around">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-2 h-8 bg-gray-600 rounded-sm" />
          ))}
        </div>
      </div>

      {trains.slice(-5).map((train, index) => (
        <motion.div
          key={train.id}
          className="absolute top-1/2 transform -translate-y-1/2"
          initial={{ left: '-10%', opacity: 0 }}
          animate={{ 
            left: `${10 + train.position * 0.8}%`, 
            opacity: train.status === 'arrived' ? 0 : 1 
          }}
          transition={{ duration: 0.1 }}
          style={{ zIndex: trains.length - index }}
        >
          <div className={`relative p-2 rounded-lg ${hasCollisionWarning ? 'bg-red-500/20 animate-pulse' : 'bg-cyan-500/20'}`}>
            <TrainIcon className={`w-6 h-6 ${train.status === 'running' ? 'text-cyan-400' : 'text-gray-500'}`} />
            {hasCollisionWarning && (
              <AlertTriangle className="absolute -top-1 -right-1 w-3 h-3 text-red-500" />
            )}
          </div>
        </motion.div>
      ))}

      {hasCollisionWarning && (
        <motion.div
          className="absolute top-2 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-red-500/90 rounded text-xs text-white font-bold"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          ⚠️ 追尾警告！
        </motion.div>
      )}
    </div>
  );
};
