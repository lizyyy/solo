import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { VolumeX } from 'lucide-react';
import { LevelMeter } from './LevelMeter';
import { useGameStore } from '@/store/useGameStore';

export const MasterFader: React.FC = () => {
  const masterLevel = useGameStore(state => state.masterLevel);
  const setMasterLevel = useGameStore(state => state.setMasterLevel);
  const [isDragging, setIsDragging] = useState(false);

  const isClipping = masterLevel > 85;

  return (
    <motion.div
      className={`relative flex flex-col items-center p-4 rounded-xl transition-all ${
        isClipping 
          ? 'bg-red-900/40 border-2 border-red-500 shadow-xl shadow-red-500/40' 
          : 'bg-gray-800 border-2 border-gray-600'
      }`}
      animate={isClipping ? { boxShadow: ['0 0 20px rgba(239, 68, 68, 0.5)', '0 0 40px rgba(239, 68, 68, 0.8)', '0 0 20px rgba(239, 68, 68, 0.5)'] } : {}}
      transition={{ duration: 0.5, repeat: isClipping ? Infinity : 0 }}
    >
      <div className="text-sm text-gray-300 font-bold mb-2 flex items-center gap-1">
        <VolumeX size={16} />
        主输出
      </div>

      <div className="flex items-center gap-3 mb-3">
        <LevelMeter level={masterLevel} size="lg" showPeak={isClipping} />
      </div>

      <div className="relative h-48 flex items-center justify-center">
        <div className="absolute w-4 h-full bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`absolute bottom-0 w-full transition-all ${
              isClipping 
                ? 'bg-gradient-to-t from-red-600 to-red-400' 
                : 'bg-gradient-to-t from-green-500 to-green-400'
            }`}
            style={{ height: `${masterLevel}%` }}
          />
          <div className="absolute inset-0 flex flex-col justify-between py-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="w-full h-px bg-gray-600/50" />
            ))}
          </div>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={masterLevel}
          onChange={(e) => setMasterLevel(Number(e.target.value))}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          className="absolute w-48 h-6 opacity-0 cursor-pointer"
          style={{ transform: 'rotate(-90deg)' }}
        />
        <motion.div
          className={`absolute w-12 h-8 rounded-lg bg-gradient-to-b from-gray-300 to-gray-500 shadow-xl border-2 border-gray-400 cursor-grab ${
            isDragging ? 'cursor-grabbing scale-110' : ''
          }`}
          style={{ bottom: `calc(${masterLevel}% - 16px)` }}
          animate={{ scale: isDragging ? 1.1 : 1 }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-1 bg-gray-600 rounded" />
        </motion.div>
      </div>

      <div className={`text-lg font-mono font-bold mt-2 ${isClipping ? 'text-red-400' : 'text-green-400'}`}>
        {masterLevel.toFixed(0)}
        <span className="text-xs text-gray-500 ml-1">dB</span>
      </div>

      {isClipping && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded animate-pulse">
          CLIP!
        </div>
      )}
    </motion.div>
  );
};
