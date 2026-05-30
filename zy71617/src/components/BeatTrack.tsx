import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { DIFFICULTY_CONFIG } from '@/types/game';

interface JudgeEffect {
  id: string;
  type: 'perfect' | 'good' | 'early' | 'late' | 'miss';
  timestamp: number;
}

export const BeatTrack = () => {
  const { currentTime, beatPoints, difficulty, dispatchTrain } = useGameStore();
  const config = DIFFICULTY_CONFIG[difficulty];
  const visibleRange = 3000;
  const trackHeight = 400;

  const visibleBeats = beatPoints.filter((beat) => {
    const timeToBeat = beat.time - currentTime;
    return timeToBeat > -500 && timeToBeat < visibleRange;
  });

  const handleClick = () => {
    dispatchTrain(currentTime);
  };

  const getBeatY = (beatTime: number) => {
    const timeDiff = beatTime - currentTime;
    const normalized = 1 - timeDiff / visibleRange;
    return normalized * trackHeight;
  };

  const getJudgeColor = (type: string) => {
    switch (type) {
      case 'perfect': return 'text-cyan-400';
      case 'good': return 'text-green-400';
      case 'early': return 'text-yellow-400';
      case 'late': return 'text-orange-400';
      case 'miss': return 'text-red-400';
      default: return 'text-white';
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div 
        className="relative w-24 h-96 bg-gradient-to-b from-gray-900/80 to-gray-800/80 rounded-lg border-2 border-cyan-500/30 overflow-hidden cursor-pointer"
        onClick={handleClick}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent" />
        
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent transform -translate-y-1/2">
          <div className="absolute inset-0 animate-pulse bg-cyan-400/50" />
        </div>

        {visibleBeats.map((beat) => {
          const y = getBeatY(beat.time);
          const isNear = Math.abs(beat.time - currentTime) < config.goodWindow + 100;
          
          return (
            <motion.div
              key={beat.id}
              className={`absolute left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-8 rounded-md flex items-center justify-center font-bold text-xs transition-all
                ${beat.isHit 
                  ? beat.judgeType === 'perfect' ? 'bg-cyan-500/80' 
                    : beat.judgeType === 'good' || beat.judgeType === 'early' || beat.judgeType === 'late' ? 'bg-green-500/80'
                    : 'bg-red-500/80'
                  : isNear 
                    ? 'bg-cyan-400 scale-110 shadow-lg shadow-cyan-500/50' 
                    : 'bg-gray-600'
                }`}
              style={{ top: `${y}px` }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ 
                opacity: beat.isHit ? 0.3 : 1, 
                scale: isNear && !beat.isHit ? 1.1 : 1 
              }}
              transition={{ duration: 0.1 }}
            >
              {!beat.isHit && (
                <span className="text-white font-bold">●</span>
              )}
            </motion.div>
          );
        })}

        <AnimatePresence>
          {beatPoints.slice(-5).map((beat) => {
            if (!beat.isHit || !beat.judgeType) return null;
            return (
              <motion.div
                key={`judge-${beat.id}`}
                className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 font-bold text-lg ${getJudgeColor(beat.judgeType)}`}
                initial={{ opacity: 1, y: 0, scale: 1.2 }}
                animate={{ opacity: 0, y: -30, scale: 0.8 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                {beat.judgeType.toUpperCase()}
                {beat.offset !== undefined && beat.judgeType !== 'perfect' && beat.judgeType !== 'miss' && (
                  <span className="block text-xs">
                    {beat.offset < 0 ? '↑' : '↓'} {Math.abs(beat.offset).toFixed(0)}ms
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <p className="mt-2 text-gray-400 text-sm">点击节拍发车</p>
      <p className="text-gray-500 text-xs">按空格键或点击轨道</p>
    </div>
  );
};
