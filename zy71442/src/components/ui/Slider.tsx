import { useRef, useState, useCallback, useEffect, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  label?: ReactNode;
  showValue?: boolean;
  unit?: string;
  disabled?: boolean;
  onChange?: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  className?: string;
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  label,
  showValue = true,
  unit,
  disabled = false,
  onChange,
  onChangeEnd,
  className,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const percentage = ((value - min) / (max - min)) * 100;

  const getValueFromPosition = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return value;
      const rect = trackRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      let newValue = min + percentage * (max - min);
      newValue = Math.round(newValue / step) * step;
      return Math.max(min, Math.min(max, newValue));
    },
    [min, max, step, value]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      setIsDragging(true);
      const newValue = getValueFromPosition(e.clientX);
      onChange?.(newValue);
    },
    [disabled, getValueFromPosition, onChange]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newValue = getValueFromPosition(e.clientX);
      onChange?.(newValue);
    };

    const handleMouseUp = (e: MouseEvent) => {
      setIsDragging(false);
      const newValue = getValueFromPosition(e.clientX);
      onChangeEnd?.(newValue);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, getValueFromPosition, onChange, onChangeEnd]);

  const formatValue = (val: number) => {
    if (step < 1) {
      return val.toFixed(2);
    }
    return val.toString();
  };

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <label className="text-xs font-medium text-slate-400">{label}</label>
          )}
          {showValue && (
            <span className="text-xs text-slate-300 font-mono">
              {formatValue(value)}
              {unit && <span className="text-slate-500 ml-1">{unit}</span>}
            </span>
          )}
        </div>
      )}
      <div
        ref={trackRef}
        className={cn(
          'relative w-full h-1.5 rounded-full bg-slate-700 border border-slate-600',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        )}
        onMouseDown={handleMouseDown}
      >
        <div
          className="absolute h-full rounded-full bg-blue-500 transition-all duration-75"
          style={{ width: `${percentage}%` }}
        />
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-blue-500 shadow-lg transition-transform duration-75',
            isDragging ? 'scale-125' : 'hover:scale-110',
            disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
          )}
          style={{ left: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-slate-500 font-mono">
          {formatValue(min)}
        </span>
        <span className="text-[10px] text-slate-500 font-mono">
          {formatValue(max)}
        </span>
      </div>
    </div>
  );
}

interface RangeSliderProps {
  value: [number, number];
  min: number;
  max: number;
  step?: number;
  label?: ReactNode;
  showValue?: boolean;
  unit?: string;
  disabled?: boolean;
  onChange?: (value: [number, number]) => void;
  onChangeEnd?: (value: [number, number]) => void;
  className?: string;
}

export function RangeSlider({
  value,
  min,
  max,
  step = 1,
  label,
  showValue = true,
  unit,
  disabled = false,
  onChange,
  onChangeEnd,
  className,
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeThumb, setActiveThumb] = useState<'min' | 'max' | null>(null);

  const minPercentage = ((value[0] - min) / (max - min)) * 100;
  const maxPercentage = ((value[1] - min) / (max - min)) * 100;

  const getValueFromPosition = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return min;
      const rect = trackRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      let newValue = min + percentage * (max - min);
      newValue = Math.round(newValue / step) * step;
      return Math.max(min, Math.min(max, newValue));
    },
    [min, max, step]
  );

  const handleMouseDown = useCallback(
    (thumb: 'min' | 'max') =>
      (e: React.MouseEvent) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        setActiveThumb(thumb);
      },
    [disabled]
  );

  useEffect(() => {
    if (!activeThumb) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newValue = getValueFromPosition(e.clientX);
      const newRange: [number, number] = [...value];

      if (activeThumb === 'min') {
        newRange[0] = Math.min(newValue, value[1] - step);
      } else {
        newRange[1] = Math.max(newValue, value[0] + step);
      }

      onChange?.(newRange);
    };

    const handleMouseUp = (e: MouseEvent) => {
      setActiveThumb(null);
      const newValue = getValueFromPosition(e.clientX);
      const newRange: [number, number] = [...value];

      if (activeThumb === 'min') {
        newRange[0] = Math.min(newValue, value[1] - step);
      } else {
        newRange[1] = Math.max(newValue, value[0] + step);
      }

      onChangeEnd?.(newRange);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeThumb, getValueFromPosition, onChange, onChangeEnd, value, step]);

  const formatValue = (val: number) => {
    if (step < 1) {
      return val.toFixed(2);
    }
    return val.toString();
  };

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <label className="text-xs font-medium text-slate-400">{label}</label>
          )}
          {showValue && (
            <span className="text-xs text-slate-300 font-mono">
              [{formatValue(value[0])}, {formatValue(value[1])}]
              {unit && <span className="text-slate-500 ml-1">{unit}</span>}
            </span>
          )}
        </div>
      )}
      <div
        ref={trackRef}
        className={cn(
          'relative w-full h-1.5 rounded-full bg-slate-700 border border-slate-600',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        )}
      >
        <div
          className="absolute h-full rounded-full bg-blue-500 transition-all duration-75"
          style={{
            left: `${minPercentage}%`,
            width: `${maxPercentage - minPercentage}%`,
          }}
        />
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-blue-500 shadow-lg transition-transform duration-75 z-10',
            activeThumb === 'min' ? 'scale-125' : 'hover:scale-110',
            disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
          )}
          style={{ left: `${minPercentage}%` }}
          onMouseDown={handleMouseDown('min')}
        />
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-blue-500 shadow-lg transition-transform duration-75 z-10',
            activeThumb === 'max' ? 'scale-125' : 'hover:scale-110',
            disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
          )}
          style={{ left: `${maxPercentage}%` }}
          onMouseDown={handleMouseDown('max')}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-slate-500 font-mono">
          {formatValue(min)}
        </span>
        <span className="text-[10px] text-slate-500 font-mono">
          {formatValue(max)}
        </span>
      </div>
    </div>
  );
}
