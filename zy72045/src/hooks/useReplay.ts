import { useState, useEffect, useCallback } from 'react';
import type { HistoryRecord } from '../types/history';

export function useReplay(record: HistoryRecord | null) {
  const [currentRound, setCurrentRound] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const totalRounds = record?.totalRounds || 0;

  const currentRoundData = record?.rounds.find((r) => r.roundNumber === currentRound);

  useEffect(() => {
    if (!isPlaying || !record) return;

    const interval = setInterval(() => {
      setCurrentRound((prev) => {
        if (prev >= totalRounds) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 2000 / speed);

    return () => clearInterval(interval);
  }, [isPlaying, speed, totalRounds, record]);

  const goToRound = useCallback((round: number) => {
    if (round >= 1 && round <= totalRounds) {
      setCurrentRound(round);
    }
  }, [totalRounds]);

  const goToFirst = useCallback(() => {
    setCurrentRound(1);
    setIsPlaying(false);
  }, []);

  const goToLast = useCallback(() => {
    setCurrentRound(totalRounds);
    setIsPlaying(false);
  }, [totalRounds]);

  const goToPrev = useCallback(() => {
    setCurrentRound((prev) => Math.max(1, prev - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentRound((prev) => Math.min(totalRounds, prev + 1));
  }, [totalRounds]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const stop = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const speedOptions = [0.5, 1, 2, 4];

  return {
    currentRound,
    totalRounds,
    isPlaying,
    speed,
    currentRoundData,
    goToRound,
    goToFirst,
    goToLast,
    goToPrev,
    goToNext,
    togglePlay,
    stop,
    setSpeed,
    speedOptions,
  };
}
