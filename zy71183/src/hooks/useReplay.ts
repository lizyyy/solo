import { useState, useCallback, useRef, useEffect } from 'react';
import type { OperationRecord, LevelConfig } from '../types';

interface ReplayState {
  isPlaying: boolean;
  currentIndex: number;
  progress: number;
  speed: number;
}

export function useReplay(operations: OperationRecord[], _levelConfig: LevelConfig | null = null) {
  const [replayState, setReplayState] = useState<ReplayState>({
    isPlaying: false,
    currentIndex: -1,
    progress: 0,
    speed: 1,
  });

  const intervalRef = useRef<number | null>(null);

  const play = useCallback(() => {
    if (operations.length === 0) return;
    
    setReplayState(prev => ({
      ...prev,
      isPlaying: true,
      currentIndex: prev.currentIndex >= operations.length - 1 ? -1 : prev.currentIndex,
    }));
  }, [operations.length]);

  const pause = useCallback(() => {
    setReplayState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const reset = useCallback(() => {
    setReplayState({
      isPlaying: false,
      currentIndex: -1,
      progress: 0,
      speed: 1,
    });
  }, []);

  const seekTo = useCallback((index: number) => {
    const clampedIndex = Math.max(-1, Math.min(index, operations.length - 1));
    setReplayState(prev => ({
      ...prev,
      currentIndex: clampedIndex,
      progress: operations.length > 0 ? (clampedIndex + 1) / operations.length : 0,
    }));
  }, [operations.length]);

  const setSpeed = useCallback((speed: number) => {
    setReplayState(prev => ({ ...prev, speed: Math.max(0.5, Math.min(3, speed)) }));
  }, []);

  useEffect(() => {
    if (!replayState.isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setReplayState(prev => {
        if (prev.currentIndex >= operations.length - 1) {
          return { ...prev, isPlaying: false };
        }
        const newIndex = prev.currentIndex + 1;
        return {
          ...prev,
          currentIndex: newIndex,
          progress: operations.length > 0 ? (newIndex + 1) / operations.length : 0,
        };
      });
    }, 1000 / replayState.speed);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [replayState.isPlaying, replayState.speed, operations.length]);

  const getHighlightedPointId = useCallback((): string | null => {
    if (replayState.currentIndex < 0 || replayState.currentIndex >= operations.length) {
      return null;
    }
    return operations[replayState.currentIndex]?.targetId || null;
  }, [replayState.currentIndex, operations]);

  const getCurrentOperation = useCallback((): OperationRecord | null => {
    if (replayState.currentIndex < 0 || replayState.currentIndex >= operations.length) {
      return null;
    }
    return operations[replayState.currentIndex] || null;
  }, [replayState.currentIndex, operations]);

  return {
    ...replayState,
    totalOperations: operations.length,
    play,
    pause,
    reset,
    seekTo,
    setSpeed,
    getHighlightedPointId,
    getCurrentOperation,
  };
}
