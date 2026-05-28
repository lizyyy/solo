import { motion } from 'framer-motion';
import { Card as CardType } from '../../types';
import { getCardTypeIcon, getCardTypeName, getRarityColor, getRarityName, getRarityGlow } from '../../utils/settlementEngine';
import { useGameStore } from '../../stores/useGameStore';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  isPlayable?: boolean;
  isSelected?: boolean;
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
}

export function Card({ card, onClick, isPlayable = true, isSelected = false, size = 'medium', showDetails = true }: CardProps) {
  const setSelectedCard = useGameStore(state => state.setSelectedCard);
  const setShowCardDetail = useGameStore(state => state.setShowCardDetail);

  const sizeClasses = {
    small: 'w-24 h-36',
    medium: 'w-36 h-52',
    large: 'w-48 h-64',
  };

  const handleClick = () => {
    if (onClick && isPlayable) {
      onClick();
    } else {
      setSelectedCard(card);
      setShowCardDetail(true);
    }
  };

  return (
    <motion.div
      className={`${sizeClasses[size]} relative rounded-xl cursor-pointer overflow-hidden
        border-2 ${getRarityColor(card.rarity)}
        bg-gradient-to-b from-music-card to-music-darker
        ${isSelected ? 'ring-2 ring-music-gold shadow-lg shadow-music-gold/30' : ''}
        ${isPlayable ? 'hover:scale-105 hover:-translate-y-2' : 'opacity-60 cursor-not-allowed'}
        transition-all duration-300
        ${getRarityGlow(card.rarity)}`}
      onClick={handleClick}
      whileHover={isPlayable ? { y: -8, scale: 1.05 } : {}}
      whileTap={isPlayable ? { scale: 0.98 } : {}}
      layout
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
      
      <div className="relative h-full flex flex-col p-3">
        <div className="flex justify-between items-start mb-2">
          <span className="text-2xl">{getCardTypeIcon(card.type)}</span>
          <span className={`text-xs px-2 py-1 rounded-full ${
            card.rarity === 'epic' ? 'bg-amber-500/30 text-amber-300' :
            card.rarity === 'rare' ? 'bg-blue-500/30 text-blue-300' :
            'bg-gray-500/30 text-gray-300'
          }`}>
            {getRarityName(card.rarity)}
          </span>
        </div>

        <div className="text-center mb-2">
          <h3 className={`font-serif font-bold text-music-gold ${
            size === 'small' ? 'text-xs' : size === 'medium' ? 'text-sm' : 'text-base'
          }`}>
            {card.name}
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            {getCardTypeName(card.type)}
          </p>
        </div>

        {showDetails && size !== 'small' && (
          <div className="flex-1 overflow-hidden">
            <p className={`text-gray-300 leading-relaxed ${
              size === 'large' ? 'text-sm' : 'text-xs'
            }`}>
              {card.description}
            </p>
          </div>
        )}

        {showDetails && (
          <div className="mt-auto pt-2 border-t border-white/10">
            <div className={`text-center font-bold ${
              card.effect.value > 0 ? 'text-green-400' : 
              card.effect.value < 0 ? 'text-red-400' : 'text-gray-400'
            } ${size === 'small' ? 'text-xs' : 'text-sm'}`}>
              {card.effect.type === 'split_modifier' && (
                <span>{card.effect.value > 0 ? '+' : ''}{card.effect.value}% 分成</span>
              )}
              {card.effect.type === 'right_add' && (
                <span>+ 权利</span>
              )}
              {card.effect.type === 'reputation_mod' && (
                <span>{card.effect.value > 0 ? '+' : ''}{card.effect.value} 信誉</span>
              )}
              {card.effect.type === 'deduction_add' && (
                <span className="text-orange-400">-{card.effect.value}% 扣费</span>
              )}
              {card.effect.type === 'risk_add' && (
                <span className="text-red-400">⚠ 风险</span>
              )}
            </div>
          </div>
        )}
      </div>

      {card.rarity === 'epic' && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent animate-pulse" />
        </div>
      )}
    </motion.div>
  );
}
