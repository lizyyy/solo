import React from 'react';
import type { TimeFormat } from '../../types';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { Globe, Clock, Timer } from 'lucide-react';

const formats: { value: TimeFormat; label: string; icon: React.ReactNode }[] = [
  { value: 'UTC', label: 'UTC', icon: <Globe className="w-3 h-3" /> },
  { value: 'BEIJING', label: '北京时', icon: <Clock className="w-3 h-3" /> },
  { value: 'RELATIVE', label: '相对时', icon: <Timer className="w-3 h-3" /> },
];

export const TimeFormatSwitch: React.FC = () => {
  const { primaryTimeFormat, setPrimaryTimeFormat } = usePlaybackStore();

  return (
    <div className="flex items-center gap-1 p-1 bg-space-800 rounded border border-space-600">
      {formats.map(format => (
        <button
          key={format.value}
          onClick={() => setPrimaryTimeFormat(format.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-all ${
            primaryTimeFormat === format.value
              ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/50 shadow-glow-cyan'
              : 'text-gray-400 hover:text-gray-200 hover:bg-space-700'
          }`}
        >
          {format.icon}
          <span>{format.label}</span>
        </button>
      ))}
    </div>
  );
};
