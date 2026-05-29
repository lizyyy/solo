import { ColorSample } from '@/types';
import { cn } from '@/lib/utils';

interface ColorBarProps {
  colors: ColorSample[];
  height?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  className?: string;
}

const heightClasses = {
  sm: 'h-8',
  md: 'h-12',
  lg: 'h-16'
};

export function ColorBar({ colors, height = 'md', showLabels = true, className }: ColorBarProps) {
  const validColors = colors.filter(c => !c.isBackground && !c.isExtreme);

  if (validColors.length === 0) {
    return (
      <div className={cn(
        'rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 text-sm',
        heightClasses[height],
        className
      )}>
        无有效颜色数据
      </div>
    );
  }

  const totalPercentage = validColors.reduce((sum, c) => sum + c.percentage, 0);
  const normalizedColors = validColors.map(c => ({
    ...c,
    width: (c.percentage / totalPercentage) * 100
  }));

  return (
    <div className={className}>
      <div className={cn(
        'flex rounded-lg overflow-hidden',
        heightClasses[height]
      )}>
        {normalizedColors.map((color, index) => (
          <div
            key={color.id}
            className="relative group transition-all hover:flex-grow"
            style={{
              width: `${color.width}%`,
              backgroundColor: color.hex
            }}
            title={`${color.hex.toUpperCase()} - ${color.percentage.toFixed(1)}%`}
          >
            {showLabels && height !== 'sm' && color.width > 10 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-xs font-bold px-1 py-0.5 rounded"
                  style={{
                    color: color.hsl_l > 50 ? '#000000' : '#ffffff',
                    textShadow: color.hsl_l > 50 ? 'none' : '0 1px 2px rgba(0,0,0,0.5)'
                  }}
                >
                  {color.percentage.toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {showLabels && height !== 'sm' && (
        <div className="flex flex-wrap gap-2 mt-3">
          {normalizedColors.map(color => (
            <div
              key={color.id}
              className="flex items-center gap-1.5 text-xs"
            >
              <div
                className="w-3 h-3 rounded border border-slate-200"
                style={{ backgroundColor: color.hex }}
              />
              <span className="text-slate-600 font-mono">{color.hex.toUpperCase()}</span>
              <span className="text-slate-400">({color.percentage.toFixed(1)}%)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
