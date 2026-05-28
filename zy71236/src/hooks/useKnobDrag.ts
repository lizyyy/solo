import { useState, useRef, useCallback, useEffect } from 'react';

interface UseKnobDragOptions {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  sensitivity?: number;
  isLogScale?: boolean;
}

export function useKnobDrag({
  min,
  max,
  value,
  onChange,
  sensitivity = 0.5,
  isLogScale = false,
}: UseKnobDragOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startValueRef = useRef(0);
  const knobRef = useRef<HTMLDivElement>(null);

  const valueToPercent = useCallback(
    (val: number): number => {
      if (isLogScale) {
        const logMin = Math.log(min);
        const logMax = Math.log(max);
        const logVal = Math.log(Math.max(val, min));
        return ((logVal - logMin) / (logMax - logMin)) * 100;
      }
      return ((val - min) / (max - min)) * 100;
    },
    [min, max, isLogScale]
  );

  const percentToValue = useCallback(
    (percent: number): number => {
      if (isLogScale) {
        const logMin = Math.log(min);
        const logMax = Math.log(max);
        const logVal = logMin + (percent / 100) * (logMax - logMin);
        return Math.exp(logVal);
      }
      return min + (percent / 100) * (max - min);
    },
    [min, max, isLogScale]
  );

  const rotation = (valueToPercent(value) / 100) * 270 - 135;

  const handleStart = useCallback(
    (clientY: number) => {
      setIsDragging(true);
      startYRef.current = clientY;
      startValueRef.current = value;
    },
    [value]
  );

  const handleMove = useCallback(
    (clientY: number) => {
      if (!isDragging) return;

      const delta = startYRef.current - clientY;
      const percentChange = delta * sensitivity;
      const currentPercent = valueToPercent(startValueRef.current);
      const newPercent = Math.max(0, Math.min(100, currentPercent + percentChange));
      const newValue = percentToValue(newPercent);

      onChange(newValue);
    },
    [isDragging, sensitivity, valueToPercent, percentToValue, onChange]
  );

  const handleEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleMove(e.clientY);
    };

    const handleMouseUp = () => {
      handleEnd();
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientY);
    };

    const handleTouchEnd = () => {
      handleEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleMove, handleEnd]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      handleStart(e.clientY);
    },
    [handleStart]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      handleStart(e.touches[0].clientY);
    },
    [handleStart]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = -e.deltaY * 0.1;
      const currentPercent = valueToPercent(value);
      const newPercent = Math.max(0, Math.min(100, currentPercent + delta));
      onChange(percentToValue(newPercent));
    },
    [value, valueToPercent, percentToValue, onChange]
  );

  return {
    knobRef,
    isDragging,
    rotation,
    handleMouseDown,
    handleTouchStart,
    handleWheel,
    valueToPercent,
    percentToValue,
  };
}
