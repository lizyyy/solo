import { useRef, useCallback } from 'react';
import type { Vector2 } from '@/types';

interface OrbitDetectionResult {
  checkOrbit: (position: Vector2) => { isOrbit: boolean; period?: number };
  reset: () => void;
}

const MIN_CYCLES = 3;
const POSITION_TOLERANCE = 15;
const TIME_TOLERANCE = 0.3;

export function useOrbitDetection(): OrbitDetectionResult {
  const positionHistoryRef = useRef<{ position: Vector2; time: number }[]>([]);
  const cycleStartRef = useRef<{ position: Vector2; time: number; index: number } | null>(null);
  const cycleCountRef = useRef(0);
  const lastPeriodRef = useRef<number | null>(null);

  const checkOrbit = useCallback(
    (position: Vector2): { isOrbit: boolean; period?: number } => {
      const currentTime = Date.now();
      const history = positionHistoryRef.current;

      history.push({ position, time: currentTime });

      if (history.length < 60) {
        return { isOrbit: false };
      }

      if (history.length > 1000) {
        history.shift();
      }

      if (!cycleStartRef.current) {
        for (let i = 0; i < history.length - 30; i++) {
          const oldPos = history[i].position;
          const dx = position.x - oldPos.x;
          const dy = position.y - oldPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < POSITION_TOLERANCE) {
            cycleStartRef.current = {
              position: oldPos,
              time: history[i].time,
              index: i,
            };
            break;
          }
        }
        return { isOrbit: false };
      }

      const startPos = cycleStartRef.current.position;
      const dx = position.x - startPos.x;
      const dy = position.y - startPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < POSITION_TOLERANCE) {
        const timeDiff = (currentTime - cycleStartRef.current.time) / 1000;

        if (lastPeriodRef.current !== null) {
          const ratio = Math.abs(timeDiff - lastPeriodRef.current) / lastPeriodRef.current;
          if (ratio > TIME_TOLERANCE) {
            cycleCountRef.current = 0;
            lastPeriodRef.current = timeDiff;
            cycleStartRef.current = { position, time: currentTime, index: history.length - 1 };
            return { isOrbit: false };
          }
        }

        lastPeriodRef.current = timeDiff;
        cycleCountRef.current++;
        cycleStartRef.current = { position, time: currentTime, index: history.length - 1 };

        if (cycleCountRef.current >= MIN_CYCLES) {
          return { isOrbit: true, period: lastPeriodRef.current };
        }
      }

      return { isOrbit: false };
    },
    []
  );

  const reset = useCallback(() => {
    positionHistoryRef.current = [];
    cycleStartRef.current = null;
    cycleCountRef.current = 0;
    lastPeriodRef.current = null;
  }, []);

  return {
    checkOrbit,
    reset,
  };
}
