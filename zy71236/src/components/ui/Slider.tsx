import { formatValue } from '../../utils/validator';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  unit?: string;
  decimals?: number;
  isLogScale?: boolean;
  warning?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

export function Slider({
  label,
  value,
  min,
  max,
  onChange,
  unit,
  decimals = 2,
  isLogScale = false,
  warning = false,
  orientation = 'vertical',
}: SliderProps) {
  const valueToPercent = (val: number): number => {
    if (isLogScale) {
      const logMin = Math.log(min);
      const logMax = Math.log(max);
      const logVal = Math.log(Math.max(val, min));
      return (logVal - logMin) / (logMax - logMin);
    }
    return (val - min) / (max - min);
  };

  const percentToValue = (percent: number): number => {
    if (isLogScale) {
      const logMin = Math.log(min);
      const logMax = Math.log(max);
      const logVal = logMin + percent * (logMax - logMin);
      return Math.exp(logVal);
    }
    return min + percent * (max - min);
  };

  const percent = valueToPercent(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPercent = parseFloat(e.target.value) / 100;
    onChange(percentToValue(newPercent));
  };

  if (orientation === 'vertical') {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="text-xs text-gray-400 font-medium tracking-wider">{label}</div>

        <div className="relative h-40 w-8 flex flex-col justify-between">
          <div className="text-xs text-gray-500 font-mono">{formatValue(max, unit, decimals)}</div>
          <div className="text-xs text-gray-500 font-mono">{formatValue(min, unit, decimals)}</div>
        </div>

        <div className="relative h-40 w-8">
          <div
            className={`
              absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-full
              bg-gray-800 rounded-full
              border ${warning ? 'border-orange-500/50' : 'border-gray-700'}
              overflow-hidden
            `}
          >
            <div
              className={`
                absolute bottom-0 left-0 right-0
                ${warning ? 'bg-gradient-to-t from-orange-500 to-orange-400' : 'bg-gradient-to-t from-cyan-500 to-cyan-400'}
                transition-all duration-100
              `}
              style={{
                height: `${percent * 100}%`,
                boxShadow: warning
                  ? '0 0 10px rgba(249,115,22,0.5)'
                  : '0 0 10px rgba(0,240,255,0.5)',
              }}
            />
          </div>

          <input
            type="range"
            min="0"
            max="100"
            value={percent * 100}
            onChange={handleChange}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-40 h-8
              appearance-none bg-transparent cursor-pointer
              origin-bottom-left -rotate-90
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-6
              [&::-webkit-slider-thumb]:h-6
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-gradient-to-br
              [&::-webkit-slider-thumb]:from-gray-600
              [&::-webkit-slider-thumb]:to-gray-800
              [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:shadow-lg
              [&::-webkit-slider-thumb]:transition-all
              [&::-webkit-slider-thumb]:hover:scale-110
              [&::-webkit-slider-runnable-track]:appearance-none
              [&::-webkit-slider-runnable-track]:bg-transparent
              [&::-moz-range-thumb]:w-6
              [&::-moz-range-thumb]:h-6
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-gradient-to-br
              [&::-moz-range-thumb]:from-gray-600
              [&::-moz-range-thumb]:to-gray-800
              [&::-moz-range-thumb]:border-2
              [&::-moz-range-thumb]:shadow-lg
              [&::-moz-range-track]:bg-transparent
            "
            style={{
              WebkitAppearance: 'slider-vertical',
              // @ts-expect-error - non-standard css
              writingMode: 'bt-lr',
            }}
          />
        </div>

        <div
          className={`
            font-mono text-xs px-2 py-0.5 rounded
            ${warning ? 'bg-orange-500/20 text-orange-400' : 'bg-cyan-500/10 text-cyan-400'}
            border ${warning ? 'border-orange-500/30' : 'border-cyan-500/30'}
          `}
        >
          {formatValue(value, unit, decimals)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <div className="text-xs text-gray-400 font-medium tracking-wider">{label}</div>
        <div
          className={`
            font-mono text-xs px-2 py-0.5 rounded
            ${warning ? 'bg-orange-500/20 text-orange-400' : 'bg-cyan-500/10 text-cyan-400'}
            border ${warning ? 'border-orange-500/30' : 'border-cyan-500/30'}
          `}
        >
          {formatValue(value, unit, decimals)}
        </div>
      </div>

      <div className="relative h-8">
        <div
          className={`
            absolute top-1/2 -translate-y-1/2 left-0 right-0 h-2
            bg-gray-800 rounded-full
            border ${warning ? 'border-orange-500/50' : 'border-gray-700'}
            overflow-hidden
          `}
        >
          <div
            className={`
              absolute top-0 bottom-0 left-0
              ${warning ? 'bg-gradient-to-r from-orange-500 to-orange-400' : 'bg-gradient-to-r from-cyan-500 to-cyan-400'}
              transition-all duration-100
            `}
            style={{
              width: `${percent * 100}%`,
              boxShadow: warning
                ? '0 0 10px rgba(249,115,22,0.5)'
                : '0 0 10px rgba(0,240,255,0.5)',
            }}
          />
        </div>

        <input
          type="range"
          min="0"
          max="100"
          value={percent * 100}
          onChange={handleChange}
          className="absolute top-1/2 -translate-y-1/2 left-0 right-0 w-full h-8
            appearance-none bg-transparent cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-gradient-to-br
            [&::-webkit-slider-thumb]:from-gray-600
            [&::-webkit-slider-thumb]:to-gray-800
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:shadow-lg
            [&::-webkit-slider-thumb]:transition-all
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-moz-range-thumb]:w-5
            [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-gradient-to-br
            [&::-moz-range-thumb]:from-gray-600
            [&::-moz-range-thumb]:to-gray-800
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:shadow-lg
          "
        />
      </div>

      <div className="flex justify-between text-xs text-gray-500 font-mono">
        <span>{formatValue(min, unit, decimals)}</span>
        <span>{formatValue(max, unit, decimals)}</span>
      </div>
    </div>
  );
}
