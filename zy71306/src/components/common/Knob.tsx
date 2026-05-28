import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface KnobProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'default' | 'danger' | 'warning';
  disabled?: boolean;
}

export default function Knob({
  value,
  min,
  max,
  step = 0.1,
  onChange,
  label,
  unit = '',
  size = 'md',
  color = 'default',
  disabled = false,
}: KnobProps) {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startValueRef = useRef(0);

  const normalizedValue = (value - min) / (max - min);
  const rotation = normalizedValue * 270 - 135;

  const sizes = {
    sm: { knob: 'w-16 h-16', indicator: 'w-1 h-4', value: 'text-sm' },
    md: { knob: 'w-20 h-20', indicator: 'w-1.5 h-5', value: 'text-base' },
    lg: { knob: 'w-28 h-28', indicator: 'w-2 h-7', value: 'text-lg' },
  };

  const colorStyles = {
    default: {
      ring: 'border-brass-500',
      glow: 'shadow-[0_0_15px_rgba(212,175,55,0.3)]',
      indicator: 'bg-brass-400',
      text: 'text-brass-300',
    },
    danger: {
      ring: 'border-danger-500',
      glow: 'shadow-[0_0_15px_rgba(196,30,58,0.3)]',
      indicator: 'bg-danger-500',
      text: 'text-danger-500',
    },
    warning: {
      ring: 'border-amber-500',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]',
      indicator: 'bg-amber-500',
      text: 'text-amber-500',
    },
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      setIsDragging(true);
      startYRef.current = e.clientY;
      startValueRef.current = value;
    },
    [disabled, value]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = startYRef.current - e.clientY;
      const sensitivity = (max - min) / 200;
      let newValue = startValueRef.current + deltaY * sensitivity;
      newValue = Math.round(newValue / step) * step;
      newValue = Math.max(min, Math.min(max, newValue));
      onChange(newValue);
    },
    [isDragging, min, max, step, onChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (disabled) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -step : step;
      const newValue = Math.max(min, Math.min(max, value + delta));
      onChange(newValue);
    },
    [disabled, min, max, step, value, onChange]
  );

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <span className="text-sm text-walnut-300 font-medium">{label}</span>
      )}
      <div
        ref={knobRef}
        className={cn(
          'relative rounded-full border-4 bg-walnut-800 cursor-ns-resize select-none',
          'transition-all duration-200 hover:scale-105',
          sizes[size].knob,
          colorStyles[color].ring,
          isDragging && colorStyles[color].glow,
          disabled && 'opacity-50 cursor-not-allowed hover:scale-100'
        )}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        <div
          className={cn(
            'absolute left-1/2 -translate-x-1/2 rounded-full top-2',
            sizes[size].indicator,
            colorStyles[color].indicator
          )}
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)`, transformOrigin: 'center bottom' }}
        />

        <svg className="absolute inset-0 w-full h-full -rotate-135">
          <circle
            cx="50%"
            cy="50%"
            r="40%"
            fill="none"
            stroke="rgba(212,175,55,0.2)"
            strokeWidth="2"
            strokeDasharray={`${(normalizedValue * 270 / 360) * 2 * Math.PI * 40} ${2 * Math.PI * 40}`}
            strokeLinecap="round"
          />
        </svg>

        <div
          className={cn(
            'absolute inset-4 rounded-full bg-walnut-900 border border-walnut-700',
            'flex items-center justify-center'
          )}
        >
          <span
            className={cn(
              'font-mono font-bold',
              sizes[size].value,
              colorStyles[color].text
            )}
          >
            {value.toFixed(step < 1 ? 2 : 0)}
          </span>
        </div>
      </div>
      {unit && (
        <span className="text-xs text-walnut-400 font-mono">{unit}</span>
      )}
    </div>
  );
}
