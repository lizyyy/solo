import React from 'react';
import { cn } from '@/lib/utils';

interface ParameterSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  presets?: { label: string; value: number }[];
  className?: string;
}

export const ParameterSlider: React.FC<ParameterSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  unit = '',
  onChange,
  presets,
  className,
}) => {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(parseFloat(e.target.value) || min)}
            className="w-24 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-right"
          />
          <span className="text-sm text-slate-500 w-8">{unit}</span>
        </div>
      </div>
      <div className="relative">
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-slate-700 to-amber-500 rounded-full transition-all duration-150"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
      {presets && presets.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-2">
          {presets.map((preset, index) => (
            <button
              key={index}
              onClick={() => onChange(preset.value)}
              className={cn(
                'px-2 py-1 text-xs border rounded transition-colors',
                Math.abs(value - preset.value) < 0.001
                  ? 'bg-slate-800 text-amber-400 border-slate-800'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-amber-500 hover:text-amber-600'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
