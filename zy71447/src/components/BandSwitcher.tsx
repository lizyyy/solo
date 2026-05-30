import { useState } from 'react';
import { Info, Waves } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BandType } from '@/types';
import { BAND_CONFIGS } from '@/types';
import { BusinessRules } from '@/utils/businessRules';

interface BandSwitcherProps {
  current: BandType;
  onChange: (band: BandType) => void;
}

export function BandSwitcher({ current, onChange }: BandSwitcherProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <div className="card-panel">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Waves size={18} className="text-bronze-500" />
          <h3 className="font-serif text-lg text-bronze-400">频段选择</h3>
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="p-1 hover:bg-charcoal-700 rounded transition-colors"
          >
            <Info size={14} className="text-gray-500 hover:text-bronze-400" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showExplanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="p-3 bg-walnut-900/30 rounded-lg border border-bronze-700/30">
              <p className="text-xs text-bronze-300 font-mono leading-relaxed">
                {BusinessRules.getExplanation('band_switch').explanation}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {BusinessRules.getExplanation('band_switch').ruleBasis}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-3 gap-3">
        {BAND_CONFIGS.map((band) => {
          const isActive = current === band.key;
          const btnClass = `btn-band-${band.key}`;

          return (
            <button
              key={band.key}
              onClick={() => onChange(band.key)}
              className={`${btnClass} ${isActive ? 'active' : ''}`}
            >
              <span className="block font-serif text-lg">{band.label}</span>
              <span className="block text-xs opacity-80 font-mono mt-1">
                {band.minFreq}-{band.maxFreq}Hz
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-charcoal-700">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: BAND_CONFIGS.find((b) => b.key === current)?.color }}
          />
          <span className="font-mono">
            当前频段：{BAND_CONFIGS.find((b) => b.key === current)?.label}
          </span>
        </div>
        <div className="mt-2 h-2 bg-charcoal-800 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${
                ((BAND_CONFIGS.find((b) => b.key === current)!.maxFreq -
                  BAND_CONFIGS.find((b) => b.key === current)!.minFreq) /
                  7920) *
                100
              }%`,
              marginLeft: `${
                ((BAND_CONFIGS.find((b) => b.key === current)!.minFreq - 80) / 7920) * 100
              }%`,
              backgroundColor: BAND_CONFIGS.find((b) => b.key === current)?.color,
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-600 font-mono mt-1">
          <span>80Hz</span>
          <span>8000Hz</span>
        </div>
      </div>
    </div>
  );
}
