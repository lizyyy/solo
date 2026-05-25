import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: number;
  showNumber?: boolean;
}

export const StarRating = ({ rating, maxRating = 5, size = 20, showNumber = false }: StarRatingProps) => {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxRating }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={`
            transition-all duration-300
            ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
          `}
          style={{
            animationDelay: `${i * 0.1}s`,
            animation: i < rating ? 'starPop 0.5s ease-out' : 'none',
          }}
        />
      ))}
      {showNumber && (
        <span className="ml-2 text-sm font-medium text-gray-600">{rating}/{maxRating}</span>
      )}
      <style>{`
        @keyframes starPop {
          0% { transform: scale(0); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};
