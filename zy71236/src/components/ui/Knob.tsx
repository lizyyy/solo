import { useKnobDrag } from '../../hooks/useKnobDrag';
import { formatValue } from '../../utils/validator';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  unit?: string;
  decimals?: number;
  isLogScale?: boolean;
  sensitivity?: number;
  warning?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Knob({
  label,
  value,
  min,
  max,
  onChange,
  unit,
  decimals = 2,
  isLogScale = false,
  sensitivity = 0.5,
  warning = false,
  size = 'md',
}: KnobProps) {
  const { isDragging, rotation, handleMouseDown, handleTouchStart, handleWheel, valueToPercent } =
    useKnobDrag({
      min,
      max,
      value,
      onChange,
      sensitivity,
      isLogScale,
    });

  const percent = valueToPercent(value);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  const indicatorSize = {
    sm: 'w-0.5 h-3',
    md: 'w-1 h-5',
    lg: 'w-1.5 h-7',
  };

  return (
    <div className="flex flex-col items-center gap-2 group">
      <div className="relative">
        <div
          ref={undefined}
          className={`
            ${sizeClasses[size]} relative rounded-full
            bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900
            border-2 ${warning ? 'border-orange-500' : 'border-gray-600'}
            shadow-lg
            ${isDragging ? 'shadow-cyan-500/30' : 'shadow-black/50'}
            cursor-grab active:cursor-grabbing
            transition-all duration-150
            group-hover:border-cyan-400/50
            select-none
            ${warning ? 'animate-pulse' : ''}
          `}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onWheel={handleWheel}
        >
          <div
            className="absolute inset-1 rounded-full bg-gradient-to-br from-gray-600 via-gray-700 to-gray-800"
            style={{
              boxShadow:
                'inset 0 2px 4px rgba(255,255,255,0.1), inset 0 -2px 4px rgba(0,0,0,0.3)',
            }}
          >
            <div
              className="absolute inset-0 flex items-start justify-center pt-2"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <div
                className={`
                  ${indicatorSize[size]} rounded-full
                  ${warning ? 'bg-orange-400' : 'bg-cyan-400'}
                  shadow-lg
                  ${warning ? 'shadow-orange-500/50' : 'shadow-cyan-500/50'}
                `}
              />
            </div>

            <div className="absolute inset-0 rounded-full border border-gray-600/30" />
          </div>

          <svg className="absolute -inset-1 w-full h-full -rotate-135" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#374151"
              strokeWidth="3"
              strokeDasharray="212"
              strokeDashoffset="70"
              strokeLinecap="round"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={warning ? '#f97316' : '#00F0FF'}
              strokeWidth="3"
              strokeDasharray="212"
              strokeDashoffset={212 - (percent / 100) * 142}
              strokeLinecap="round"
              className="transition-all duration-100"
              style={{
                filter: warning ? 'drop-shadow(0 0 4px #f97316)' : 'drop-shadow(0 0 4px #00F0FF)',
              }}
            />
          </svg>

          <div className="absolute -left-1 bottom-0 text-xs text-gray-500 font-mono">
            {formatValue(min, unit, decimals)}
          </div>
          <div className="absolute -right-1 bottom-0 text-xs text-gray-500 font-mono">
            {formatValue(max, unit, decimals)}
          </div>
        </div>
      </div>

      <div className="text-center">
        <div
          className={`
            font-mono text-sm px-2 py-0.5 rounded
            ${warning ? 'bg-orange-500/20 text-orange-400' : 'bg-cyan-500/10 text-cyan-400'}
            border ${warning ? 'border-orange-500/30' : 'border-cyan-500/30'}
          `}
          style={{
            textShadow: warning ? '0 0 8px rgba(249,115,22,0.5)' : '0 0 8px rgba(0,240,255,0.5)',
          }}
        >
          {formatValue(value, unit, decimals)}
        </div>
        <div className="text-xs text-gray-400 mt-1 font-medium tracking-wider">{label}</div>
      </div>
    </div>
  );
}
