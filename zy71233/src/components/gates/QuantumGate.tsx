import { GateType, NoiseType } from '@/types';
import { getGateInfo, getNoiseInfo } from '@/utils/quantum/quantumEngine';
import { cn } from '@/lib/utils';

interface QuantumGateProps {
  type: GateType;
  isDragging?: boolean;
  isError?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

interface NoiseCardProps {
  type: NoiseType;
  isDragging?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}

const gateColors: Record<GateType, string> = {
  H: 'from-cyan-400 to-cyan-600',
  X: 'from-purple-400 to-purple-600',
  Y: 'from-pink-400 to-pink-600',
  Z: 'from-orange-400 to-orange-600',
  T: 'from-green-400 to-green-600',
  S: 'from-yellow-400 to-yellow-600',
  CNOT: 'from-blue-400 to-blue-600',
  Measure: 'from-red-400 to-red-600',
};

const noiseColors: Record<NoiseType, string> = {
  'bit-flip': 'from-red-500 to-red-700',
  'phase-flip': 'from-amber-500 to-amber-700',
  depolarizing: 'from-gray-500 to-gray-700',
};

export const QuantumGate = ({
  type,
  isDragging = false,
  isError = false,
  onClick,
  onRemove,
  size = 'md',
  showLabel = true,
}: QuantumGateProps) => {
  const gateInfo = getGateInfo(type);

  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-14 h-14 text-lg',
    lg: 'w-16 h-16 text-xl',
  };

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center cursor-grab transition-all duration-200',
        sizeClasses[size],
        isDragging && 'opacity-50 scale-110 cursor-grabbing',
        isError && 'ring-2 ring-red-500 ring-offset-2 ring-offset-slate-900',
        onClick && 'hover:scale-105 active:scale-95'
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          'w-full h-full rounded-lg bg-gradient-to-br flex items-center justify-center font-bold text-white shadow-lg',
          gateColors[type],
          type === 'CNOT' && 'rounded-full'
        )}
      >
        <span className="drop-shadow-md">{gateInfo.symbol}</span>
      </div>
      {showLabel && (
        <span className="mt-1 text-xs text-slate-400 font-mono">{gateInfo.name}</span>
      )}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center hover:bg-red-600 transition-colors z-10"
        >
          ×
        </button>
      )}
    </div>
  );
};

export const NoiseCardComponent = ({
  type,
  isDragging = false,
  onClick,
  onRemove,
}: NoiseCardProps) => {
  const noiseInfo = getNoiseInfo(type);

  return (
    <div
      className={cn(
        'relative w-14 h-14 flex flex-col items-center justify-center cursor-grab transition-all duration-200',
        isDragging && 'opacity-50 scale-110 cursor-grabbing',
        onClick && 'hover:scale-105'
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          'w-full h-full rounded-lg bg-gradient-to-br flex items-center justify-center shadow-lg border-2 border-dashed',
          noiseColors[type],
          'border-white/30'
        )}
      >
        <span className="text-white text-xs font-bold text-center px-1">
          {noiseInfo.name}
        </span>
      </div>
      <span className="mt-1 text-xs text-red-400 font-mono">噪声</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center hover:bg-red-600 transition-colors z-10"
        >
          ×
        </button>
      )}
    </div>
  );
};

export const GateSlot = ({
  isOccupied = false,
  isHighlighted = false,
  isError = false,
  onClick,
  children,
}: {
  isOccupied?: boolean;
  isHighlighted?: boolean;
  isError?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        'w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center transition-all duration-200',
        isOccupied
          ? 'border-transparent bg-slate-800/50'
          : isHighlighted
          ? 'border-cyan-400 bg-cyan-400/10 scale-105'
          : isError
          ? 'border-red-500 bg-red-500/10'
          : 'border-slate-600 bg-slate-800/30 hover:border-slate-500',
        onClick && !isOccupied && 'cursor-pointer hover:bg-slate-700/30'
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
