import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './Card';
import type { Card as CardType } from '../../types';
import { useGameStore } from '../../stores/useGameStore';

interface CardHandProps {
  cards: CardType[];
  onCardPlay?: (cardId: string) => void;
}

export function CardHand({ cards, onCardPlay }: CardHandProps) {
  const playCard = useGameStore(state => state.playCard);
  const gameStatus = useGameStore(state => state.game?.status);

  const isPlayable = gameStatus === 'playing';

  const handleCardClick = (cardId: string) => {
    if (onCardPlay) {
    onCardPlay(cardId);
  } else {
    playCard(cardId);
  }
};

  return (
    <div className="relative w-full">
      <div className="flex justify-center items-end gap-2 py-4 overflow-x-auto px-8">
        <AnimatePresence mode="popLayout">
          {cards.map((card, index) => {
            const centerOffset = (index - (cards.length - 1) / 2) * 2;
            const rotateAngle = centerOffset * 2;
            const yOffset = Math.abs(centerOffset) * 5;
            
            return (
              <motion.div
                key={card.id}
                initial={{ y: 100, opacity: 0, rotate: 0 }}
                animate={{
                  y: yOffset,
                  opacity: 1,
                  rotate: rotateAngle,
                  zIndex: index
                }}
                exit={{ y: 200, opacity: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 25
                }}
                className="flex-shrink-0"
                style={{
                  marginLeft: index > 0 ? '-20px' : '0',
                }}
                whileHover={{
                  y: -30 - yOffset,
                  rotate: 0,
                  zIndex: 100,
                  scale: 1.1
                }}
              >
                <Card
                  card={card}
                  onClick={() => handleCardClick(card.id)}
                  isPlayable={isPlayable}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      
      <div className="text-center mt-4 text-gray-400 text-sm">
        手牌数量: {cards.length} 张
      </div>
    </div>
  );
}
