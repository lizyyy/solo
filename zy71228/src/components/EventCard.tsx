import { AlertTriangle, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EventCard as EventCardType } from '@/types/game';
import { useGameStore } from '@/store/gameStore';

interface EventCardProps {
  gameId: string;
  event: EventCardType;
  disabled?: boolean;
}

export function EventCardComponent({ gameId, event, disabled }: EventCardProps) {
  const selectEventOption = useGameStore((state) => state.selectEventOption);
  const selectedOption = event.options.find((o) => o.id === event.selectedOptionId);

  const getImpactIcon = () => {
    switch (event.impactType) {
      case 'liquidity':
        return '💧';
      case 'rate':
        return '📈';
      case 'expectation':
        return '🎭';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        className="bg-navy-800/80 backdrop-blur-sm rounded-xl border border-gold-500/50 overflow-hidden"
      >
        <div className="bg-gradient-to-r from-gold-500/20 to-transparent px-4 py-3 border-b border-gold-500/30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-gold-400" size={18} />
            <span className="font-semibold text-gold-400">事件卡</span>
            <span className="text-lg ml-auto">{getImpactIcon()}</span>
          </div>
        </div>

        <div className="p-4">
          <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
            <Zap className="text-yellow-400" size={18} />
            {event.title}
          </h4>
          <p className="text-sm text-navy-300 mb-4">{event.description}</p>

          <div className="space-y-2">
            <p className="text-xs text-navy-400 mb-2">选择应对策略：</p>
            {event.options.map((option) => {
              const isSelected = option.id === event.selectedOptionId;
              return (
                <button
                  key={option.id}
                  onClick={() => !disabled && selectEventOption(gameId, option.id)}
                  disabled={disabled || !!event.selectedOptionId}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-gold-500 bg-gold-500/10'
                      : event.selectedOptionId
                        ? 'border-navy-600 bg-navy-900/30 opacity-50'
                        : 'border-navy-600 hover:border-gold-500/50 hover:bg-navy-700/30'
                  }`}
                >
                  <div className="font-medium text-sm mb-1">{option.label}</div>
                  <div className="text-xs text-navy-400">{option.effectDescription}</div>
                </button>
              );
            })}
          </div>

          {selectedOption && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 p-3 bg-liquidity-good/10 border border-liquidity-good/30 rounded-lg"
            >
              <p className="text-xs text-liquidity-good">
                ✓ 已选择: {selectedOption.label}
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
