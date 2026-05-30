import { useState } from 'react';
import { MapPin, Info, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Hotspot } from '@/types';
import { BusinessRules } from '@/utils/businessRules';

interface HotspotListProps {
  hotspots: Hotspot[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const categoryLabels: Record<string, string> = {
  structure: '结构',
  acoustics: '声学',
  craftsmanship: '工艺',
};

const categoryColors: Record<string, string> = {
  structure: 'bg-acoustic-low/20 text-acoustic-low',
  acoustics: 'bg-acoustic-mid/20 text-acoustic-mid',
  craftsmanship: 'bg-acoustic-high/20 text-acoustic-high',
};

export function HotspotList({ hotspots, selectedId, onSelect }: HotspotListProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <div className="card-panel">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-bronze-500" />
          <h3 className="font-serif text-lg text-bronze-400">讲解点</h3>
          <span className="px-2 py-0.5 bg-charcoal-800 rounded text-xs text-gray-400 font-mono">
            {hotspots.length} 个
          </span>
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
                {BusinessRules.getExplanation('hotspot_annotation').explanation}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {BusinessRules.getExplanation('hotspot_annotation').ruleBasis}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
        {hotspots.map((hotspot) => {
          const isSelected = selectedId === hotspot.id;

          return (
            <motion.div
              key={hotspot.id}
              layout
              onClick={() => onSelect(isSelected ? null : hotspot.id)}
              className={`
                p-3 rounded-lg cursor-pointer transition-all duration-200
                ${isSelected
                  ? 'bg-walnut-800/50 border border-bronze-600/50 shadow-bronze-glow'
                  : 'bg-charcoal-800/50 border border-transparent hover:bg-charcoal-800 hover:border-charcoal-700'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                    ${isSelected ? 'bg-bronze-500 text-white' : 'bg-charcoal-700 text-gray-400'}
                  `}
                >
                  <MapPin size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4
                      className={`font-serif ${isSelected ? 'text-bronze-300' : 'text-gray-200'}`}
                    >
                      {hotspot.name}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-mono ${categoryColors[hotspot.category]}`}
                      >
                        {categoryLabels[hotspot.category]}
                      </span>
                      <ChevronRight
                        size={16}
                        className={`text-gray-500 transition-transform ${isSelected ? 'rotate-90' : ''}`}
                      />
                    </div>
                  </div>
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                          {hotspot.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 font-mono">
                          <span>
                            位置：({hotspot.position.x.toFixed(3)}, {hotspot.position.y.toFixed(3)}, {hotspot.position.z.toFixed(3)})
                          </span>
                          <span>重要度：{'★'.repeat(hotspot.importance)}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
