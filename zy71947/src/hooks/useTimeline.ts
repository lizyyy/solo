import { useMemo } from 'react';
import type { TimeFormat } from '../types';
import { TimeService } from '../services/timeService';

export const useTimeline = (
  startTime: number,
  endTime: number,
  zoom: number,
  pan: number,
  containerWidth: number
) => {
  const visibleDuration = (endTime - startTime) / zoom;
  const viewStartTime = startTime + pan * visibleDuration;
  const viewEndTime = viewStartTime + visibleDuration;

  const pixelsPerSecond = useMemo(() => {
    return containerWidth / visibleDuration;
  }, [containerWidth, visibleDuration]);

  const getXPosition = (relativeSeconds: number): number => {
    return (relativeSeconds - viewStartTime) * pixelsPerSecond;
  };

  const getTimeFromX = (x: number): number => {
    return viewStartTime + x / pixelsPerSecond;
  };

  const getWidth = (durationSeconds: number): number => {
    return durationSeconds * pixelsPerSecond;
  };

  const getTicks = (format: TimeFormat): { value: number; label: string }[] => {
    const ticks: { value: number; label: string }[] = [];
    const targetTickCount = 10;
    const rawInterval = visibleDuration / targetTickCount;

    let interval: number;
    if (rawInterval < 60) interval = 60;
    else if (rawInterval < 300) interval = 300;
    else if (rawInterval < 600) interval = 600;
    else if (rawInterval < 1800) interval = 1800;
    else if (rawInterval < 3600) interval = 3600;
    else interval = 7200;

    const firstTick = Math.ceil(viewStartTime / interval) * interval;

    for (let t = firstTick; t <= viewEndTime; t += interval) {
      const timePoint = TimeService.createTimePoint(t, new Date());
      ticks.push({
        value: t,
        label: TimeService.formatByTimeFormat(timePoint, format),
      });
    }

    return ticks;
  };

  const isInView = (startSeconds: number, endSeconds: number): boolean => {
    return endSeconds >= viewStartTime && startSeconds <= viewEndTime;
  };

  const clampToView = (value: number): number => {
    return Math.max(viewStartTime, Math.min(viewEndTime, value));
  };

  return {
    visibleDuration,
    viewStartTime,
    viewEndTime,
    pixelsPerSecond,
    getXPosition,
    getTimeFromX,
    getWidth,
    getTicks,
    isInView,
    clampToView,
  };
};
