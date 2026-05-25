import { useState, useCallback, useEffect, useRef } from 'react';
import type { Operation, GameState, GameRecord } from '../engine/types';

interface UseReplayOptions {
  operations: Operation[];
  initialState: GameState;
  onStateChange?: (state: GameState) => void;
}

interface UseReplayReturn {
  currentIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  currentState: GameState;
  play: () => void;
  pause: () => void;
  reset: () => void;
  goToStep: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setSpeed: (speed: number) => void;
}

export function useReplay({
  operations,
  initialState,
  onStateChange,
}: UseReplayOptions): UseReplayReturn {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentState, setCurrentState] = useState<GameState>(initialState);
  const intervalRef = useRef<number | null>(null);

  const allStates = [initialState, ...operations.map((op) => op.gameStateSnapshot)];

  const updateState = useCallback(
    (index: number) => {
      const state = allStates[index] || initialState;
      setCurrentState(state);
      onStateChange?.(state);
    },
    [allStates, initialState, onStateChange]
  );

  useEffect(() => {
    setCurrentState(initialState);
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [initialState]);

  useEffect(() => {
    if (isPlaying) {
      const interval = 1000 / playbackSpeed;
      intervalRef.current = window.setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= operations.length) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          if (next < allStates.length) {
            updateState(next);
          }
          return next;
        });
      }, interval);
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, operations.length, allStates.length, updateState]);

  const play = useCallback(() => {
    if (currentIndex >= operations.length) {
      setCurrentIndex(0);
      updateState(0);
    }
    setIsPlaying(true);
  }, [currentIndex, operations.length, updateState]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const reset = useCallback(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
    updateState(0);
  }, [updateState]);

  const goToStep = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, operations.length));
      setCurrentIndex(clamped);
      updateState(clamped);
      setIsPlaying(false);
    },
    [operations.length, updateState]
  );

  const nextStep = useCallback(() => {
    goToStep(currentIndex + 1);
  }, [currentIndex, goToStep]);

  const prevStep = useCallback(() => {
    goToStep(currentIndex - 1);
  }, [currentIndex, goToStep]);

  const setSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(Math.max(0.5, Math.min(4, speed)));
  }, []);

  return {
    currentIndex,
    isPlaying,
    playbackSpeed,
    currentState,
    play,
    pause,
    reset,
    goToStep,
    nextStep,
    prevStep,
    setSpeed,
  };
}

export function useRecordReplay(record: GameRecord | undefined) {
  const [replayState, setReplayState] = useState<GameState | null>(null);

  const replay = useReplay({
    operations: record?.operations || [],
    initialState: record?.settlementResult.report.finalState || ({} as GameState),
    onStateChange: (state) => setReplayState(state),
  });

  return {
    ...replay,
    replayState,
  };
}
