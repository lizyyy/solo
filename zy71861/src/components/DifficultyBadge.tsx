import { Difficulty } from '@/types';
import { getDifficultyLabel } from '@/utils/chainBuilder';

interface DifficultyBadgeProps {
  difficulty: Difficulty;
  className?: string;
}

const DifficultyBadge = ({ difficulty, className = '' }: DifficultyBadgeProps) => {
  const configs: Record<Difficulty, { bg: string; text: string }> = {
    easy: {
      bg: 'bg-blue-100',
      text: 'text-blue-700'
    },
    medium: {
      bg: 'bg-purple-100',
      text: 'text-purple-700'
    },
    hard: {
      bg: 'bg-rose-100',
      text: 'text-rose-700'
    }
  };

  const config = configs[difficulty];

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} ${className}`}>
      {getDifficultyLabel(difficulty)}
    </span>
  );
};

export default DifficultyBadge;
