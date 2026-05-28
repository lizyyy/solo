import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  value?: number | [number, number];
  onChange?: (value: number | [number, number]) => void;
  showLabel?: boolean;
  className?: string;
  disabled?: boolean;
  range?: boolean;
}

export default function Slider({
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  showLabel = true,
  className,
  disabled = false,
  range = false,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [internalValue, setInternalValue] = useState<number | [number, number]>(
    value ?? (range ? [min, max] : min)
  );
  const [isDragging, setIsDragging] = useState(false);
  const [activeThumb, setActiveThumb] = useState<'min' | 'max' | null>(null);

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  const getPercentage = useCallback((val: number) => {
    return ((val - min) / (max - min)) * 100;
  }, [min, max]);

  const getValueFromPosition = useCallback((clientX: number) => {
    if (!trackRef.current) return min;
    const rect = trackRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawValue = min + percentage * (max - min);
    return Math.round(rawValue / step) * step;
  }, [min, max, step]);

  const handleMouseDown = (thumb: 'min' | 'max') => (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    setActiveThumb(thumb);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || disabled) return;

    const newValue = getValueFromPosition(e.clientX);

    if (range && Array.isArray(internalValue)) {
      const [minVal, maxVal] = internalValue;
      let updated: [number, number];

      if (activeThumb === 'min') {
        updated = [Math.min(newValue, maxVal - step), maxVal];
      } else {
        updated = [minVal, Math.max(newValue, minVal + step)];
      }

      setInternalValue(updated);
      onChange?.(updated);
    } else {
      setInternalValue(newValue);
      onChange?.(newValue);
    }
  }, [isDragging, disabled, range, internalValue, activeThumb, getValueFromPosition, onChange, step]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setActiveThumb(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const renderThumb = (val: number, thumb: 'min' | 'max') => {
    const percentage = getPercentage(val);
    const isActive = activeThumb === thumb;

    return (
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20"
        style={{ left: `${percentage}%` }}
        animate={{ scale: isActive ? 1.3 : 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <div
          onMouseDown={handleMouseDown(thumb)}
          className={cn(
            'w-5 h-5 rounded-full border-3 border-primary-400 cursor-pointer transition-all duration-200',
            disabled ? 'cursor-not-allowed opacity-50' : 'hover:scale-110',
            isActive ? 'shadow-glow-green' : ''
          )}
          style={{
            backgroundColor: '#00FF9D',
            borderWidth: '3px',
            boxShadow: isActive ? '0 0 20px rgba(0, 255, 157, 0.8)' : '0 0 10px rgba(0, 255, 157, 0.5)',
          }}
        />
        {showLabel && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 5 }}
            className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap"
            style={{
              backgroundColor: 'rgba(0, 255, 157, 0.9)',
              color: '#0A1628',
            }}
          >
            {val}
          </motion.div>
        )}
      </motion.div>
    );
  };

  const minPercent = Array.isArray(internalValue) ? getPercentage(internalValue[0]) : 0;
  const maxPercent = Array.isArray(internalValue) ? getPercentage(internalValue[1]) : getPercentage(internalValue as number);

  return (
    <div className={cn('w-full', className)}>
      <div
        ref={trackRef}
        className={cn(
          'relative w-full h-1.5 rounded-full overflow-hidden',
          disabled ? 'opacity-50' : ''
        )}
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        <motion.div
          className="absolute inset-y-0 rounded-full"
          style={{
            left: `${range ? minPercent : 0}%`,
            right: `${100 - maxPercent}%`,
            background: 'linear-gradient(90deg, #00FF9D 0%, #00D4FF 50%, #9D4EDD 100%)',
          }}
          layout
        />
      </div>

      {range ? (
        <>
          {renderThumb((internalValue as [number, number])[0], 'min')}
          {renderThumb((internalValue as [number, number])[1], 'max')}
        </>
      ) : (
        renderThumb(internalValue as number, 'max')
      )}
    </div>
  );
}
