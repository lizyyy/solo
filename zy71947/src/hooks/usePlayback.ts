import { useEffect, useRef, useCallback } from 'react';
import { usePlaybackStore } from '../store/usePlaybackStore';

export const usePlayback = () => {
  const {
    isPlaying,
    currentTime,
    playbackSpeed,
    startTime,
    endTime,
    setCurrentTime,
    setPlaying,
  } = usePlaybackStore();

  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>();

  const updatePlayback = useCallback(
    (timestamp: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }

      const deltaReal = (timestamp - lastTimeRef.current) / 1000;
      const deltaSimulated = deltaReal * playbackSpeed * 60;

      const newTime = currentTime + deltaSimulated;

      if (newTime >= endTime) {
        setCurrentTime(endTime);
        setPlaying(false);
        lastTimeRef.current = undefined;
        return;
      }

      setCurrentTime(newTime);
      lastTimeRef.current = timestamp;
      animationRef.current = requestAnimationFrame(updatePlayback);
    },
    [currentTime, playbackSpeed, endTime, setCurrentTime, setPlaying]
  );

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = undefined;
      animationRef.current = requestAnimationFrame(updatePlayback);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      lastTimeRef.current = undefined;
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, updatePlayback]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          setPlaying(!isPlaying);
          break;
        case 'ArrowRight':
          e.preventDefault();
          usePlaybackStore.getState().stepForward();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          usePlaybackStore.getState().stepBackward();
          break;
        case 'Home':
          e.preventDefault();
          usePlaybackStore.getState().jumpToStart();
          break;
        case 'End':
          e.preventDefault();
          usePlaybackStore.getState().jumpToEnd();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, setPlaying]);

  return {
    isPlaying,
    currentTime,
    playbackSpeed,
    startTime,
    endTime,
  };
};
