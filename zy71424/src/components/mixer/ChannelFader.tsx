import React, { useState } from 'react';
import { Volume2, VolumeX, Headphones, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { Channel } from '@/types';
import { LevelMeter } from './LevelMeter';
import { useGameStore } from '@/store/useGameStore';

interface ChannelFaderProps {
  channel: Channel;
  hasWarning?: boolean;
  hasCritical?: boolean;
}

export const ChannelFader: React.FC<ChannelFaderProps> = ({
  channel,
  hasWarning = false,
  hasCritical = false,
}) => {
  const setChannelLevel = useGameStore(state => state.setChannelLevel);
  const toggleMute = useGameStore(state => state.toggleMute);
  const toggleSolo = useGameStore(state => state.toggleSolo);
  const setMonitorLevel = useGameStore(state => state.setMonitorLevel);

  const [isDragging, setIsDragging] = useState(false);
  const [showMonitorMenu, setShowMonitorMenu] = useState(false);

  const handleFaderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChannelLevel(channel.id, Number(e.target.value));
  };

  const getChannelColor = () => {
    switch (channel.type) {
      case 'vocal': return 'from-pink-500 to-purple-500';
      case 'guitar': return 'from-orange-500 to-red-500';
      case 'bass': return 'from-blue-500 to-cyan-500';
      case 'drum': return 'from-yellow-500 to-amber-500';
      case 'keys': return 'from-green-500 to-emerald-500';
      default: return 'from-gray-500 to-slate-500';
    }
  };

  const getMonitorIconColor = () => {
    switch (channel.monitorLevel) {
      case 'too_low': return 'text-blue-400';
      case 'too_high': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <motion.div
      className={`relative flex flex-col items-center p-3 rounded-lg transition-all duration-200 ${
        hasCritical 
          ? 'bg-red-900/30 border-2 border-red-500 shadow-lg shadow-red-500/30' 
          : hasWarning 
            ? 'bg-yellow-900/30 border-2 border-yellow-500' 
            : 'bg-gray-800/80 border border-gray-700 hover:border-gray-600'
      }`}
      animate={hasCritical ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 0.3, repeat: hasCritical ? Infinity : 0 }}
    >
      <div className={`w-full h-1 rounded-full bg-gradient-to-r ${getChannelColor()} mb-2`} />
      
      <div className="text-xs text-gray-400 font-medium mb-1 text-center truncate w-full">
        {channel.name}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <LevelMeter level={channel.level} size="sm" />
      </div>

      <div className="relative h-32 flex items-center justify-center">
        <div className="absolute w-2 h-full bg-gray-700 rounded-full">
          <div 
            className="absolute bottom-0 w-full bg-gradient-to-t from-green-500 to-green-400 rounded-full transition-all"
            style={{ height: `${channel.level}%` }}
          />
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={channel.level}
          onChange={handleFaderChange}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          className="absolute w-32 h-4 opacity-0 cursor-pointer"
          style={{ transform: 'rotate(-90deg)' }}
        />
        <motion.div
          className={`absolute w-8 h-6 rounded-md bg-gradient-to-b from-gray-200 to-gray-400 shadow-lg border border-gray-300 cursor-grab ${isDragging ? 'cursor-grabbing scale-110' : ''}`}
          style={{ bottom: `calc(${channel.level}% - 12px)` }}
          animate={{ scale: isDragging ? 1.1 : 1 }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-0.5 bg-gray-600 rounded" />
        </motion.div>
      </div>

      <div className="text-xs text-gray-500 font-mono mt-1">
        {channel.level.toFixed(0)}
      </div>

      <div className="flex gap-1 mt-2">
        <button
          onClick={() => toggleMute(channel.id)}
          className={`p-1.5 rounded transition-all ${
            channel.mute 
              ? 'bg-red-500 text-white' 
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
          title="静音"
        >
          {channel.mute ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>
        <button
          onClick={() => toggleSolo(channel.id)}
          className={`p-1.5 rounded transition-all ${
            channel.solo 
              ? 'bg-yellow-500 text-black' 
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
          title="独奏"
        >
          <Zap size={12} />
        </button>
        <div className="relative">
          <button
            onClick={() => setShowMonitorMenu(!showMonitorMenu)}
            className={`p-1.5 rounded transition-all bg-gray-700 hover:bg-gray-600 ${getMonitorIconColor()}`}
            title="返听"
          >
            <Headphones size={12} />
          </button>
          {showMonitorMenu && (
            <div className="absolute bottom-full left-0 mb-1 bg-gray-900 border border-gray-700 rounded shadow-lg z-10">
              <button
                onClick={() => { setMonitorLevel(channel.id, 'too_low'); setShowMonitorMenu(false); }}
                className="block w-full px-3 py-1 text-xs text-left hover:bg-gray-800 text-blue-400"
              >
                太低
              </button>
              <button
                onClick={() => { setMonitorLevel(channel.id, 'good'); setShowMonitorMenu(false); }}
                className="block w-full px-3 py-1 text-xs text-left hover:bg-gray-800 text-green-400"
              >
                合适
              </button>
              <button
                onClick={() => { setMonitorLevel(channel.id, 'too_high'); setShowMonitorMenu(false); }}
                className="block w-full px-3 py-1 text-xs text-left hover:bg-gray-800 text-red-400"
              >
                太高
              </button>
            </div>
          )}
        </div>
      </div>

      {hasCritical && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
      )}
    </motion.div>
  );
};
