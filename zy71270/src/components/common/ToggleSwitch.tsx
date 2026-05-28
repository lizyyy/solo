import { cn } from '../../lib/utils';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
  activeColor?: string;
}

export default function ToggleSwitch({
  checked,
  onChange,
  label,
  className,
  activeColor = 'bg-accent-blue',
}: ToggleSwitchProps) {
  return (
    <label
      className={cn('flex items-center gap-2 cursor-pointer select-none', className)}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-10 h-5 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-accent-blue/50',
          checked ? activeColor : 'bg-slate-600'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm',
            checked && 'translate-x-5'
          )}
        />
      </button>
      {label && (
        <span className="text-xs text-slate-300">{label}</span>
      )}
    </label>
  );
}
