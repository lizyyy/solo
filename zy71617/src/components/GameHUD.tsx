import { motion } from 'framer-motion';
import { Trophy, Timer, Zap, Target } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { EnergyBar } from './EnergyBar';

export const GameHUD = () => {
  const { score, combo, maxCombo, currentTime, totalTime, energy } = useGameStore();
  const remainingTime = Math.max(0, totalTime * 1000 - currentTime);
  const minutes = Math.floor(remainingTime / 60000);
  const seconds = Math.floor((remainingTime % 60000) / 1000);

  return (
    <div className="w-full p-4 bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-700">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <motion.div 
          className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Trophy className="w-6 h-6 text-yellow-400" />
          <div>
            <p className="text-xs text-gray-400">分数</p>
            <motion.p 
              className="text-xl font-bold text-yellow-400 font-mono"
              key={score}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
            >
              {score.toLocaleString()}
            </motion.p>
          </div>
        </motion.div>

        <motion.div 
          className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Target className="w-6 h-6 text-purple-400" />
          <div>
            <p className="text-xs text-gray-400">连击</p>
            <motion.p 
              className={`text-xl font-bold font-mono ${combo > 10 ? 'text-purple-400' : combo > 5 ? 'text-blue-400' : 'text-gray-300'}`}
              key={combo}
              initial={{ scale: 1.2, color: '#a855f7' }}
              animate={{ scale: 1 }}
            >
              {combo}x
            </motion.p>
          </div>
        </motion.div>

        <motion.div 
          className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Timer className={`w-6 h-6 ${remainingTime < 10000 ? 'text-red-400 animate-pulse' : 'text-cyan-400'}`} />
          <div>
            <p className="text-xs text-gray-400">剩余时间</p>
            <p className={`text-xl font-bold font-mono ${remainingTime < 10000 ? 'text-red-400' : 'text-cyan-400'}`}>
              {minutes}:{seconds.toString().padStart(2, '0')}
            </p>
          </div>
        </motion.div>

        <motion.div 
          className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Zap className="w-6 h-6 text-green-400" />
          <div>
            <p className="text-xs text-gray-400">最高连击</p>
            <p className="text-xl font-bold text-green-400 font-mono">
              {maxCombo}x
            </p>
          </div>
        </motion.div>
      </div>

      <EnergyBar energy={energy} />
    </div>
  );
};
