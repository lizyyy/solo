import React from 'react';
import { cn } from '@/lib/utils';

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export const SliderInput: React.FC<SliderInputProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  disabled = false,
  className,
}) => {
  const percentage = ((value - min) / (max - min)) * 100;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    onChange(Math.round(newValue / step) * step);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = parseFloat(e.target.value);
    if (isNaN(newValue)) return;
    newValue = Math.max(min, Math.min(max, newValue));
    onChange(Math.round(newValue / step) * step);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between items-center">
        <label className="text-xs text-gray-400 font-mono">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={handleInputChange}
            disabled={disabled}
            className={cn(
              'w-20 px-2 py-1 text-right text-sm font-mono bg-gray-800 border border-gray-700 rounded',
              'focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
          {unit && <span className="text-xs text-gray-500 w-6">{unit}</span>}
        </div>
      </div>
      <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-150"
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={handleSliderChange}
          disabled={disabled}
          className={cn(
            'absolute inset-0 w-full h-full opacity-0 cursor-pointer',
            'disabled:cursor-not-allowed'
          )}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-600 font-mono">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};
