import { formatValue } from '../../utils/validator';

interface LedDisplayProps {
  value: number | string;
  label?: string;
  unit?: string;
  decimals?: number;
  variant?: 'cyan' | 'magenta' | 'orange' | 'green';
  size?: 'sm' | 'md' | 'lg';
}

export function LedDisplay({
  value,
  label,
  unit,
  decimals = 2,
  variant = 'cyan',
  size = 'md',
}: LedDisplayProps) {
  const colorClasses: Record<string, { bg: string; text: string; border: string; shadow: string }> = {
    cyan: {
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-400',
      border: 'border-cyan-500/30',
      shadow: 'shadow-cyan-500/50',
    },
    magenta: {
      bg: 'bg-pink-500/10',
      text: 'text-pink-400',
      border: 'border-pink-500/30',
      shadow: 'shadow-pink-500/50',
    },
    orange: {
      bg: 'bg-orange-500/10',
      text: 'text-orange-400',
      border: 'border-orange-500/30',
      shadow: 'shadow-orange-500/50',
    },
    green: {
      bg: 'bg-green-500/10',
      text: 'text-green-400',
      border: 'border-green-500/30',
      shadow: 'shadow-green-500/50',
    },
  };

  const sizeClasses: Record<string, { text: string; padding: string }> = {
    sm: { text: 'text-xs', padding: 'px-2 py-1' },
    md: { text: 'text-sm', padding: 'px-3 py-1.5' },
    lg: { text: 'text-lg', padding: 'px-4 py-2' },
  };

  const colors = colorClasses[variant];
  const sizes = sizeClasses[size];

  const displayValue =
    typeof value === 'number' ? formatValue(value, unit, decimals) : value;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="text-xs text-gray-500 font-medium tracking-wider uppercase">
          {label}
        </div>
      )}
      <div
        className={`
          font-mono font-bold
          ${colors.bg} ${colors.text} ${colors.border}
          ${sizes.text} ${sizes.padding}
          rounded border
          shadow-inner
          flex items-center justify-center
          min-w-[60px]
        `}
        style={{
          textShadow: `0 0 10px currentColor`,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.1em',
        }}
      >
        {displayValue}
      </div>
    </div>
  );
}
