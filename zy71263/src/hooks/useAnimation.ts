import { useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { generateInterpolationPath } from '@/utils/interpolation';
import type { Quaternion } from '@/types';

export function useAnimation() {
  const isPlaying = useAppStore((s) => s.isPlaying);
  const setProgress = useAppStore((s) => s.setAnimationProgress);
  const stopPlayback = useAppStore((s) => s.stopPlayback);
  const progress = useAppStore((s) => s.animationProgress);
  const config = useAppStore((s) => s.interpolationConfig);
  const currentQ = useAppStore((s) => s.currentQuaternion);
  const targetQ = useAppStore((s) => s.targetQuaternion);
  const ref = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const durationMs = config.steps * 50;

  const getCurrentInterpolated = useCallback((): Quaternion | null => {
    const path = generateInterpolationPath(currentQ, targetQ, config.steps, config.method);
    const idx = Math.min(Math.floor(progress * path.length), path.length - 1);
    return path[idx] ?? null;
  }, [currentQ, targetQ, config.steps, config.method, progress]);

  useEffect(() => {
    if (!isPlaying) {
      if (ref.current) cancelAnimationFrame(ref.current);
      startTimeRef.current = null;
      return;
    }

    startTimeRef.current = performance.now() - progress * durationMs;

    const tick = (now: number) => {
      const elapsed = now - (startTimeRef.current ?? now);
      const p = Math.min(elapsed / durationMs, 1);
      setProgress(p);
      if (p >= 1) {
        stopPlayback();
        return;
      }
      ref.current = requestAnimationFrame(tick);
    };

    ref.current = requestAnimationFrame(tick);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [isPlaying, durationMs, progress, setProgress, stopPlayback]);

  return { getCurrentInterpolated };
}
