import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Card } from '../Card/Card';
import type { Card as CardType } from '../../types';
import { getCardTypeName, getRarityName } from '../../utils/settlementEngine';
import { useGameStore } from '../../stores/useGameStore';

export function CardDetailModal() {
  const selectedCard = useGameStore(state => state.selectedCard);
  const showCardDetail = useGameStore(state => state.showCardDetail);
  const setShowCardDetail = useGameStore(state => state.setShowCardDetail);
  const setSelectedCard = useGameStore(state => state.setSelectedCard);

  const handleClose = () => {
    setShowCardDetail(false);
    setSelectedCard(null);
  };

  return (
    <AnimatePresence>
      {showCardDetail && selectedCard && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.8, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 50, opacity: 0 }}
            className="bg-music-card rounded-2xl p-8 max-w-md w-full border border-music-gold/30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end mb-4">
              <button
                onClick={handleClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-center mb-6">
              <Card card={selectedCard} size="large" isPlayable={false} />
            </div>

            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-2xl font-serif text-music-gold font-bold">
                  {selectedCard.name}
                </h2>
                <div className="flex justify-center gap-3 mt-2">
                  <span className="text-sm px-3 py-1 rounded-full bg-music-gold/20 text-music-gold">
                    {getCardTypeName(selectedCard.type)}
                  </span>
                  <span className="text-sm px-3 py-1 rounded-full bg-blue-500/20 text-blue-300">
                    {getRarityName(selectedCard.rarity)}
                  </span>
                </div>
              </div>

              <div className="bg-music-darker rounded-lg p-4">
                <p className="text-gray-300 leading-relaxed">
                  {selectedCard.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-music-darker rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">效果类型</div>
                  <div className="font-bold text-white">
                    {selectedCard.effect.type === 'split_modifier' && '分成调整'}
                    {selectedCard.effect.type === 'right_add' && '权利添加'}
                    {selectedCard.effect.type === 'risk_add' && '风险添加'}
                    {selectedCard.effect.type === 'reputation_mod' && '信誉调整'}
                    {selectedCard.effect.type === 'deduction_add' && '扣费添加'}
                  </div>
                </div>
                <div className="bg-music-darker rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">目标方</div>
                  <div className="font-bold text-white capitalize">
                    {selectedCard.effect.target === 'all' ? '全部' : selectedCard.effect.target}
                  </div>
                </div>
              </div>

              {selectedCard.rawData && (
                <div className="bg-music-gold/10 rounded-lg p-4 border border-music-gold/30">
                  <div className="text-xs text-music-gold mb-2">📄 原始数据</div>
                  <pre className="text-xs text-gray-300 overflow-x-auto">
                    {JSON.stringify(selectedCard.rawData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
