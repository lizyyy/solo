import { useState, useEffect, useRef } from 'react';

export function useCountUp(target: number, duration: number = 600) {
  const [displayValue, setDisplayValue] = useState(target);
  const previousValue = useRef(target);
  const startTime = useRef<number | null>(null);
  const startValue = useRef(target);

  useEffect(() => {
    if (previousValue.current === target) return;

    startValue.current = previousValue.current;
    startTime.current = null;

    const animate = (timestamp: number) => {
      if (startTime.current === null) {
        startTime.current = timestamp;
      }

      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = startValue.current + (target - startValue.current) * easeOutQuart;

      setDisplayValue(Math.round(currentValue));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        previousValue.current = target;
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return displayValue;
}
