import { useState } from 'react';
import { ColorSample } from '@/types';
import { cn } from '@/lib/utils';

interface ColorSwatchProps {
  color: ColorSample;
  showPercentage?: boolean;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: (color: ColorSample) => void;
  selected?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16'
};

export function ColorSwatch({
  color,
  showPercentage = true,
  showDetails = false,
  size = 'md',
  onClick,
  selected = false,
  className
}: ColorSwatchProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const luminance = (0.299 * color.rgb_r + 0.587 * color.rgb_g + 0.114 * color.rgb_b) / 255;
  const textColor = luminance > 0.5 ? '#000000' : '#ffffff';

  return (
    <div
      className={cn(
        'relative group',
        onClick && 'cursor-pointer',
        className
      )}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={() => onClick?.(color)}
    >
      <div
        className={cn(
          'rounded-lg shadow-sm border-2 transition-all',
          sizeClasses[size],
          selected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'
        )}
        style={{ backgroundColor: color.hex }}
      >
        {showPercentage && size !== 'sm' && (
          <div
            className="absolute inset-0 flex items-center justify-center text-xs font-bold"
            style={{ color: textColor }}
          >
            {color.percentage.toFixed(0)}%
          </div>
        )}
      </div>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
          <div className="bg-slate-900 text-white text-xs rounded py-2 px-3 whitespace-nowrap shadow-lg">
            <p className="font-bold">{color.hex.toUpperCase()}</p>
            <p>RGB: {color.rgb_r}, {color.rgb_g}, {color.rgb_b}</p>
            <p>HSL: {color.hsl_h}°, {color.hsl_s}%, {color.hsl_l}%</p>
            <p>占比: {color.percentage.toFixed(2)}%</p>
            {color.isBackground && <p className="text-amber-400">背景色（已排除）</p>}
            {color.isExtreme && <p className="text-amber-400">极端色（已排除）</p>}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}

      {showDetails && (
        <div className="mt-2 text-center">
          <p className="text-xs font-mono text-slate-600">{color.hex.toUpperCase()}</p>
          <p className="text-xs text-slate-400">{color.percentage.toFixed(1)}%</p>
        </div>
      )}
    </div>
  );
}
