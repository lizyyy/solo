import React from 'react';
import { motion } from 'framer-motion';
import { getRatingColorClass, getRatingBgColorClass } from '@/utils/format';
import type { RatingLevel } from '@/types';

interface RatingBadgeProps {
  rating: RatingLevel | '-';
  size?: 'sm' | 'md' | 'lg';
  showChange?: boolean;
  oldRating?: RatingLevel;
  animate?: boolean;
}

export const RatingBadge: React.FC<RatingBadgeProps> = ({
  rating,
  size = 'md',
  showChange = false,
  oldRating,
  animate = true,
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs font-medium',
    md: 'px-3 py-1 text-sm font-semibold',
    lg: 'px-4 py-2 text-lg font-bold',
  };

  const hasChanged = showChange && oldRating && oldRating !== rating;

  const content = (
    <span
      className={`
        inline-flex items-center justify-center
        rounded-md border
        ${sizeClasses[size]}
        ${getRatingBgColorClass(rating)}
        ${getRatingColorClass(rating)}
        min-w-[${size === 'sm' ? '40px' : size === 'md' ? '50px' : '60px'}]
        transition-all duration-300
      `}
    >
      {rating}
    </span>
  );

  if (animate && hasChanged) {
    return (
      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center gap-2"
      >
        {content}
        {oldRating && (
          <span className="text-gray-500 text-sm line-through opacity-50">
            {oldRating}
          </span>
        )}
      </motion.div>
    );
  }

  return content;
};

export default RatingBadge;
