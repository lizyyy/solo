import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';

export function useGameTimer() {
  const { session, tickTimer } = useGameStore();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (session?.status === 'running') {
      intervalRef.current = window.setInterval(() => {
        tickTimer();
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [session?.status, tickTimer]);

  return intervalRef;
}
