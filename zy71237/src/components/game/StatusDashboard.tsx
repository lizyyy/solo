import { Clock } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { GaugeMeter } from '../common/GaugeMeter';
import { motion } from 'framer-motion';

export function StatusDashboard() {
  const { currentStain, currentPaintLayer, currentStructure, remainingTime, selectedArtwork } = useGameStore();

  if (!selectedArtwork) return null;

  const timePercentage = (remainingTime / selectedArtwork.timeBudget) * 100;
  const isTimeLow = timePercentage < 30;

  return (
    <div className="card">
      <h3 className="text-lg font-serif font-bold text-museum-paper mb-4 flex items-center gap-2">
        <span className="w-1 h-5 bg-museum-bronze rounded-full" />
        作品状态
      </h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <GaugeMeter
          value={currentStain}
          max={100}
          label="污渍程度"
          color="#B5651D"
          reverse
        />
        <GaugeMeter
          value={currentPaintLayer}
          max={100}
          label="颜料层"
          color="#4A7C59"
        />
        <GaugeMeter
          value={currentStructure}
          max={100}
          label="结构强度"
          color="#D4AF37"
        />
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-32 h-16">
            <svg viewBox="0 0 140 70" className="w-full h-full">
              <defs>
                <linearGradient id="timeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={isTimeLow ? '#8B0000' : '#4A7C59'} stopOpacity="0.8" />
                  <stop offset="100%" stopColor={isTimeLow ? '#B5651D' : '#D4AF37'} stopOpacity="1" />
                </linearGradient>
              </defs>
              <path
                d="M 10 60 A 60 60 0 0 1 130 60"
                className="gauge-track"
              />
              <motion.path
                d="M 10 60 A 60 60 0 0 1 130 60"
                className="gauge-progress"
                stroke="url(#timeGradient)"
                strokeDasharray={Math.PI * 60}
                initial={{ strokeDashoffset: Math.PI * 60 }}
                animate={{ strokeDashoffset: Math.PI * 60 - (timePercentage / 100) * Math.PI * 60 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
              <text
                x="70"
                y="50"
                textAnchor="middle"
                className={`font-bold text-xl ${isTimeLow ? 'fill-red-500 animate-pulse' : 'fill-museum-paper'}`}
              >
                {remainingTime}
              </text>
            </svg>
          </div>
          <span className="text-sm text-museum-paper/80 mt-1 font-medium flex items-center gap-1">
            <Clock size={14} />
            时间预算
          </span>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-museum-paper/70">
          <span>初始污渍</span>
          <span className="text-museum-paper">{selectedArtwork.initialStain}%</span>
        </div>
        <div className="flex justify-between text-museum-paper/70">
          <span>初始颜料层</span>
          <span className="text-museum-paper">{selectedArtwork.initialPaintLayer}%</span>
        </div>
        <div className="flex justify-between text-museum-paper/70">
          <span>初始结构</span>
          <span className="text-museum-paper">{selectedArtwork.initialStructure}%</span>
        </div>
      </div>

      {isTimeLow && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2"
        >
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          时间预算不足！请尽快完成修复工作。
        </motion.div>
      )}

      {currentPaintLayer < 30 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2"
        >
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          警告：颜料层严重受损，任何操作都可能造成不可逆损伤！
        </motion.div>
      )}

      {currentStructure < 30 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2"
        >
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          警告：结构强度过低，作品濒临损毁！
        </motion.div>
      )}
    </div>
  );
}
