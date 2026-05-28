
import React from 'react';
import { LUTPreset } from '../types';
import { LUT_PRESETS } from '../data/luts';
import { Palette } from 'lucide-react';

interface LUTSelectorProps {
  selectedLUT: string | null;
  intensity: number;
  onLUTChange: (lutId: string | null) => void;
  onIntensityChange: (intensity: number) => void;
}

export const LUTSelector: React.FC<LUTSelectorProps> = ({
  selectedLUT,
  intensity,
  onLUTChange,
  onIntensityChange,
}) => {
  return (
    <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Palette className="w-4 h-4 text-purple-400" />
        <span
          className="text-sm font-medium text-gray-200"
          style={{ fontFamily: 'Orbitron, sans-serif' }}
        >
          LUT 风格
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {LUT_PRESETS.map((lut) => {
          const isSelected = selectedLUT === lut.id;
          return (
            <button
            key={lut.id}
            onClick={() => onLUTChange(lut.id === 'none' ? null : lut.id)}
            className={`p-2 rounded text-xs text-left transition-all ${
              isSelected
                ? 'bg-purple-900/50 border border-purple-500/50'
                : 'bg-gray-800 border border-gray-700 hover:bg-gray-700'
            }`}
          >
            <div
              className="font-medium"
              style={{ color: isSelected ? '#a855f7' : '#e5e7eb' }}
            >
              {lut.name}
            </div>
            <div className="text-gray-500 mt-1 truncate">
              {lut.description.slice(0, 20)}...
            </div>
          </button>
        );
      })}
    </div>

      {selectedLUT && selectedLUT !== 'none' && (
        <div className="border-t border-gray-700 pt-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400">强度</span>
            <span className="text-xs text-purple-400 font-mono">{intensity}%</span>
          </div>
          <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="absolute h-full rounded-full transition-all duration-100"
              style={{
                width: `${intensity}%`,
                background: 'linear-gradient(90deg, #a855f7, #6366f1)',
                boxShadow: '0 0 10px rgba(168, 85, 247, 0.5)',
              }}
            />
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={intensity}
              onChange={(e) => onIntensityChange(parseInt(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
};
