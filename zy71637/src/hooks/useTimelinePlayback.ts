import { useEffect, useRef, useCallback } from 'react';
import { useDataStore } from '../store/useDataStore';

export function useTimelinePlayback() {
  const {
    currentTimeIndex,
    processedSnapshots,
    isPlaying,
    playSpeed,
    playbackSpeed,
    setCurrentTimeIndex,
    setIsPlaying,
    setPlaybackSpeed,
  } = useDataStore();

  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  const play = useCallback(() => {
    if (processedSnapshots.length === 0) return;
    setIsPlaying(true);
  }, [processedSnapshots.length, setIsPlaying]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, [setIsPlaying]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const stepForward = useCallback(() => {
    if (processedSnapshots.length === 0) return;
    const nextIndex = Math.min(currentTimeIndex + 1, processedSnapshots.length - 1);
    setCurrentTimeIndex(nextIndex);
  }, [currentTimeIndex, processedSnapshots.length, setCurrentTimeIndex]);

  const stepBackward = useCallback(() => {
    if (processedSnapshots.length === 0) return;
    const prevIndex = Math.max(currentTimeIndex - 1, 0);
    setCurrentTimeIndex(prevIndex);
  }, [currentTimeIndex, processedSnapshots.length, setCurrentTimeIndex]);

  const jumpToStart = useCallback(() => {
    setCurrentTimeIndex(0);
  }, [setCurrentTimeIndex]);

  const jumpToEnd = useCallback(() => {
    if (processedSnapshots.length === 0) return;
    setCurrentTimeIndex(processedSnapshots.length - 1);
  }, [processedSnapshots.length, setCurrentTimeIndex]);

  useEffect(() => {
    if (!isPlaying || processedSnapshots.length === 0) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const baseInterval = 100;
    const interval = baseInterval / playSpeed;

    const animate = (timestamp: number) => {
      if (timestamp - lastUpdateRef.current >= interval) {
        setCurrentTimeIndex(prev => {
          if (prev >= processedSnapshots.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
        lastUpdateRef.current = timestamp;
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, playSpeed, processedSnapshots.length, setCurrentTimeIndex, setIsPlaying]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    play,
    pause,
    togglePlay,
    stepForward,
    stepBackward,
    jumpToStart,
    jumpToEnd,
    isPlaying,
    playbackSpeed: playbackSpeed,
    setPlaybackSpeed,
  };
}
