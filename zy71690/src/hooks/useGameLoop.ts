import { useEffect, useRef, useCallback } from 'react';

interface GameLoopOptions {
  onUpdate: (deltaTime: number) => void;
  onRender?: () => void;
  isRunning: boolean;
  maxFrameTime?: number;
}

export function useGameLoop({
  onUpdate,
  onRender,
  isRunning,
  maxFrameTime = 0.1,
}: GameLoopOptions) {
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const isRunningRef = useRef(isRunning);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  const loop = useCallback(
    (currentTime: number) => {
      if (!isRunningRef.current) {
        animationFrameRef.current = null;
        return;
      }

      const deltaTime = Math.min((currentTime - lastTimeRef.current) / 1000, maxFrameTime);
      lastTimeRef.current = currentTime;

      onUpdate(deltaTime);
      onRender?.();

      animationFrameRef.current = requestAnimationFrame(loop);
    },
    [onUpdate, onRender, maxFrameTime]
  );

  useEffect(() => {
    if (isRunning) {
      lastTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(loop);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isRunning, loop]);

  return {
    isRunning,
  };
}
