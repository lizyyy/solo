import { cn } from '../../lib/utils';

interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Toggle({
  checked,
  onCheckedChange,
  disabled = false,
  size = 'md',
  className,
}: ToggleProps) {
  const sizeClasses = {
    sm: {
      track: 'w-8 h-4',
      thumb: 'w-3 h-3',
      translate: 'translate-x-4',
    },
    md: {
      track: 'w-10 h-5',
      thumb: 'w-4 h-4',
      translate: 'translate-x-5',
    },
    lg: {
      track: 'w-12 h-6',
      thumb: 'w-5 h-5',
      translate: 'translate-x-6',
    },
  };

  const currentSize = sizeClasses[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex items-center rounded-full border border-slate-600 transition-colors duration-200',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900',
        checked ? 'bg-blue-600' : 'bg-slate-700',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-slate-500',
        currentSize.track,
        className
      )}
    >
      <span
        className={cn(
          'inline-block rounded-full bg-white transition-transform duration-200 shadow-sm',
          currentSize.thumb,
          checked ? currentSize.translate : 'translate-x-0.5'
        )}
      />
    </button>
  );
}
