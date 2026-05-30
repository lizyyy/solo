import React, { useState, useRef, useCallback, useEffect } from 'react';
import { KnobType } from '../types';

interface KnobProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  type: KnobType;
  onChange: (value: number) => void;
  onChangeStart?: () => void;
  onChangeEnd?: () => void;
  disabled?: boolean;
}

const formatValue = (value: number, type: KnobType): string => {
  switch (type) {
    case 'frequency':
      return `${Math.round(value)}Hz`;
    case 'volume':
      return `${Math.round(value * 100)}%`;
    case 'phase':
      return `${Math.round(value * 360)}°`;
    default:
      return value.toFixed(2);
  }
};

const Knob: React.FC<KnobProps> = ({
  value,
  min,
  max,
  step = 1,
  label,
  type,
  onChange,
  onChangeStart,
  onChangeEnd,
  disabled = false,
}) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startValueRef = useRef(0);

  const valueToAngle = useCallback((val: number) => {
    const range = max - min;
    const normalized = (val - min) / range;
    return -135 + normalized * 270;
  }, [min, max]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startValueRef.current = value;
    onChangeStart?.();
  }, [disabled, value, onChangeStart]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    setIsDragging(true);
    startYRef.current = e.touches[0].clientY;
    startValueRef.current = value;
    onChangeStart?.();
  }, [disabled, value, onChangeStart]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const deltaY = startYRef.current - e.clientY;
      const range = max - min;
      const sensitivity = range / 200;
      let newValue = startValueRef.current + deltaY * sensitivity;
      
      newValue = Math.max(min, Math.min(max, newValue));
      newValue = Math.round(newValue / step) * step;
      
      onChange(newValue);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      
      const deltaY = startYRef.current - e.touches[0].clientY;
      const range = max - min;
      const sensitivity = range / 200;
      let newValue = startValueRef.current + deltaY * sensitivity;
      
      newValue = Math.max(min, Math.min(max, newValue));
      newValue = Math.round(newValue / step) * step;
      
      onChange(newValue);
    };

    const handleEnd = () => {
      if (isDragging) {
        setIsDragging(false);
        onChangeEnd?.();
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, min, max, step, onChange, onChangeEnd]);

  const angle = valueToAngle(value);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-cyber-muted uppercase tracking-wider">{label}</span>
      <div
        ref={knobRef}
        className={`knob ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'} ${isDragging ? 'scale-105' : ''} transition-transform duration-150`}
        style={{ transform: `rotate(${angle}deg)` }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `rotate(${-angle}deg)` }}
        >
          <span className="text-[8px] text-cyber-primary font-orbitron font-bold opacity-80">
            {formatValue(value, type)}
          </span>
        </div>
      </div>
      <span className="text-xs font-orbitron text-cyber-primary">
        {formatValue(value, type)}
      </span>
    </div>
  );
};

export default Knob;
