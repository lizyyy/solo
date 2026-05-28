import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './Card';
import type { Card as CardType } from '../../types';

interface CardTableProps {
  cards: CardType[];
  title?: string;
}

export function CardTable({ cards, title = '已出卡牌' }: CardTableProps) {
  return (
    <div className="w-full">
      {title && (
        <h3 className="text-center text-music-gold font-serif text-lg mb-4">
          {title}
        </h3>
      )}
      
      <div className="music-table rounded-2xl p-6 min-h-[180px]">
        <div className="flex flex-wrap justify-center gap-3">
          <AnimatePresence mode="popLayout">
            {cards.length > 0 ? (
              cards.map((card, index) => (
                <motion.div
                  key={card.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 25,
                    delay: index * 0.05
                  }}
                >
                  <Card
                    card={card}
                    size="small"
                    isPlayable={false}
                    showDetails={false}
                  />
                </motion.div>
              ))
            ) : (
              <div className="text-gray-500 text-sm py-8">
                暂无卡牌
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
