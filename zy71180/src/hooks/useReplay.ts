import { useState, useEffect, useRef, useCallback } from 'react';

interface UseReplayOptions {
  totalTurns: number;
  currentTurnIndex: number;
  onTurnChange: (index: number) => void;
}

interface UseReplayReturn {
  isPlaying: boolean;
  speed: number;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  nextTurn: () => void;
  prevTurn: () => void;
  goToTurn: (index: number) => void;
  setSpeed: (speed: number) => void;
}

export const useReplay = ({
  totalTurns,
  currentTurnIndex,
  onTurnChange,
}: UseReplayOptions): UseReplayReturn => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<number | null>(null);

  const getIntervalDuration = useCallback(() => {
    return 2000 / speed;
  }, [speed]);

  const play = useCallback(() => {
    if (currentTurnIndex >= totalTurns - 1) {
      onTurnChange(0);
    }
    setIsPlaying(true);
  }, [currentTurnIndex, totalTurns, onTurnChange]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const nextTurn = useCallback(() => {
    if (currentTurnIndex < totalTurns - 1) {
      onTurnChange(currentTurnIndex + 1);
    } else {
      pause();
    }
  }, [currentTurnIndex, totalTurns, onTurnChange, pause]);

  const prevTurn = useCallback(() => {
    if (currentTurnIndex > 0) {
      onTurnChange(currentTurnIndex - 1);
    }
  }, [currentTurnIndex, onTurnChange]);

  const goToTurn = useCallback(
    (index: number) => {
      const clampedIndex = Math.max(0, Math.min(totalTurns - 1, index));
      onTurnChange(clampedIndex);
    },
    [totalTurns, onTurnChange]
  );

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = window.setInterval(() => {
        nextTurn();
      }, getIntervalDuration());
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, getIntervalDuration, nextTurn]);

  useEffect(() => {
    if (currentTurnIndex >= totalTurns - 1) {
      pause();
    }
  }, [currentTurnIndex, totalTurns, pause]);

  return {
    isPlaying,
    speed,
    play,
    pause,
    togglePlay,
    nextTurn,
    prevTurn,
    goToTurn,
    setSpeed,
  };
};
