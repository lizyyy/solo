import { FunctionCard } from '../types';
import { getTrapTypeLabel } from '../utils/obstacleDetector';

interface FunctionCardComponentProps {
  card: FunctionCard;
  selected?: boolean;
  onClick?: () => void;
}

export const FunctionCardComponent = ({
  card,
  selected = false,
  onClick,
}: FunctionCardComponentProps) => {
  const difficultyColors: Record<string, string> = {
    easy: 'bg-green-500/20 text-green-400 border-green-500/50',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    hard: 'bg-red-500/20 text-red-400 border-red-500/50',
  };

  const typeLabels: Record<string, string> = {
    linear: '线性函数',
    quadratic: '二次函数',
    piecewise: '分段函数',
    trigonometric: '三角函数',
  };

  const difficultyLabels: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative p-4 rounded-xl cursor-pointer transition-all duration-300
        bg-slate-800/80 backdrop-blur-sm border-2
        ${selected
          ? 'border-cyan-400 shadow-lg shadow-cyan-500/30 scale-105'
          : 'border-slate-600/50 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10'
        }
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-bold text-white font-orbitron">
            {card.name}
          </h3>
          <p className="text-sm text-cyan-400 font-mono mt-1">
            {card.expression}
          </p>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-bold border ${difficultyColors[card.difficulty]}`}>
          {difficultyLabels[card.difficulty]}
        </div>
      </div>

      <p className="text-sm text-slate-300 mb-3">
        {card.description}
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <span className="px-2 py-1 rounded text-xs bg-slate-700/50 text-slate-300">
          {typeLabels[card.type]}
        </span>
        <span className="px-2 py-1 rounded text-xs bg-slate-700/50 text-slate-300">
          定义域: [{card.domain[0]}, {card.domain[1]}]
        </span>
      </div>

      {card.traps.length > 0 && (
        <div className="border-t border-slate-700/50 pt-3">
          <p className="text-xs text-red-400 font-bold mb-2">⚠️ 陷阱位置</p>
          <div className="flex flex-wrap gap-1">
            {card.traps.map((trap, index) => (
              <span
                key={index}
                className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-300 border border-red-500/30"
              >
                x={trap.x}: {getTrapTypeLabel(trap.type)}
              </span>
            ))}
          </div>
        </div>
      )}

      {card.nonDifferentiablePoints.length > 0 && (
        <div className="mt-2 text-xs text-orange-400">
          不可导点: {card.nonDifferentiablePoints.join(', ')}
        </div>
      )}

      {selected && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs">✓</span>
        </div>
      )}
    </div>
  );
};
