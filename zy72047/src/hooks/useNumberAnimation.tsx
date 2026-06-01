import { useState, useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';

export const useNumberAnimation = (
  targetValue: number,
  duration: number = 500
) => {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | null>(null);
  const startValueRef = useRef(targetValue);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (targetValue === displayValue) return;

    startValueRef.current = displayValue;
    startTimeRef.current = null;
    setIsAnimating(true);

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValueRef.current + (targetValue - startValueRef.current) * easeProgress;

      setDisplayValue(Math.round(currentValue * 10) / 10);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetValue);
        setIsAnimating(false);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetValue, duration]);

  const getDeltaColor = (delta: number): string => {
    if (delta > 0) return 'text-green-400';
    if (delta < 0) return 'text-red-400';
    return 'text-vinyl-300';
  };

  const getDeltaSign = (delta: number): string => {
    if (delta > 0) return '+';
    if (delta < 0) return '';
    return '';
  };

  return {
    displayValue,
    isAnimating,
    getDeltaColor,
    getDeltaSign,
  };
};

export const AnimatedNumber = ({
  value,
  className = '',
  prefix = '',
  suffix = '',
  duration = 500,
}: {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) => {
  const { displayValue, isAnimating } = useNumberAnimation(value, duration);

  return (
    <motion.span
      className={`font-mono tabular-nums ${className}`}
      animate={{
        scale: isAnimating ? [1, 1.05, 1] : 1,
      }}
      transition={{ duration: 0.3 }}
    >
      {prefix}{displayValue}{suffix}
    </motion.span>
  );
};

export const useDeltaDisplay = (
  currentValue: number,
  previousValue: number | null
) => {
  const [showDelta, setShowDelta] = useState(false);
  const [delta, setDelta] = useState(0);

  useEffect(() => {
    if (previousValue === null || currentValue === previousValue) {
      setShowDelta(false);
      return;
    }

    setDelta(currentValue - previousValue);
    setShowDelta(true);

    const timer = setTimeout(() => {
      setShowDelta(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [currentValue, previousValue]);

  const getDeltaColor = (): string => {
    if (delta > 0) return 'text-green-400';
    if (delta < 0) return 'text-red-400';
    return 'text-vinyl-300';
  };

  const getDeltaSign = (): string => {
    if (delta > 0) return '+';
    if (delta < 0) return '';
    return '';
  };

  return {
    showDelta,
    delta,
    getDeltaColor,
    getDeltaSign,
  };
};
