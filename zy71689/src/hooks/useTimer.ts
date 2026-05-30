import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';

interface UseTimerOptions {
  onTick?: (timeRemaining: number) => void;
  onComplete?: () => void;
  autoStart?: boolean;
}

export const useTimer = (
  initialTime: number = 60,
  options: UseTimerOptions = {}
) => {
  const { onTick, onComplete, autoStart = false } = options;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);
  const timeRemainingRef = useRef(initialTime);

  const { isTimerRunning, updateTimer } = useGameStore();

  const start = useCallback(() => {
    if (isRunningRef.current) return;

    isRunningRef.current = true;
    timeRemainingRef.current = initialTime;

    intervalRef.current = setInterval(() => {
      timeRemainingRef.current -= 0.1;

      if (timeRemainingRef.current <= 0) {
        timeRemainingRef.current = 0;
        stop();
        updateTimer(0);
        onComplete?.();
      } else {
        updateTimer(timeRemainingRef.current);
        onTick?.(timeRemainingRef.current);
      }
    }, 100);
  }, [initialTime, onTick, onComplete, updateTimer]);

  const stop = useCallback(() => {
    isRunningRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    isRunningRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    if (isRunningRef.current || timeRemainingRef.current <= 0) return;

    isRunningRef.current = true;

    intervalRef.current = setInterval(() => {
      timeRemainingRef.current -= 0.1;

      if (timeRemainingRef.current <= 0) {
        timeRemainingRef.current = 0;
        stop();
        updateTimer(0);
        onComplete?.();
      } else {
        updateTimer(timeRemainingRef.current);
        onTick?.(timeRemainingRef.current);
      }
    }, 100);
  }, [onTick, onComplete, stop, updateTimer]);

  const reset = useCallback((newTime?: number) => {
    stop();
    timeRemainingRef.current = newTime ?? initialTime;
    updateTimer(timeRemainingRef.current);
  }, [initialTime, stop, updateTimer]);

  useEffect(() => {
    if (autoStart) {
      start();
    }

    return () => {
      stop();
    };
  }, [autoStart, start, stop]);

  useEffect(() => {
    if (!isTimerRunning && isRunningRef.current) {
      pause();
    } else if (isTimerRunning && !isRunningRef.current && timeRemainingRef.current > 0) {
      resume();
    }
  }, [isTimerRunning, pause, resume]);

  return {
    timeLeft: timeRemainingRef.current,
    start,
    stop,
    pause,
    resume,
    reset,
    isRunning: isRunningRef.current,
    startTimer: start,
    stopTimer: stop,
    resetTimer: reset,
    getTimeRemaining: () => timeRemainingRef.current,
  };
};

export default useTimer;
