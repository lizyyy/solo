import { useMemo } from 'react';
import { formatTimeShort } from '@/utils/time';

interface TimelineRulerProps {
  totalDuration: number;
  zoomLevel: number;
  scrollOffset: number;
  visibleWidth: number;
}

export function TimelineRuler({ totalDuration, zoomLevel, scrollOffset, visibleWidth }: TimelineRulerProps) {
  const pixelsPerSecond = zoomLevel * 2;
  const totalWidth = Math.max(totalDuration * pixelsPerSecond, visibleWidth);

  const marks = useMemo(() => {
    const result: { time: number; major: boolean }[] = [];
    const interval = zoomLevel < 0.5 ? 60 : zoomLevel < 1 ? 30 : zoomLevel < 2 ? 15 : 10;

    for (let t = 0; t <= totalDuration; t += interval) {
      result.push({ time: t, major: t % 60 === 0 });
    }
    return result;
  }, [totalDuration, zoomLevel]);

  return (
    <div className="relative h-10 bg-bg-tertiary border-b border-border-primary overflow-hidden">
      <div
        className="absolute top-0 left-0 h-full"
        style={{
          width: `${totalWidth}px`,
          transform: `translateX(${-scrollOffset}px)`,
        }}
      >
        {marks.map((mark, index) => {
          const left = mark.time * pixelsPerSecond;
          return (
            <div
              key={index}
              className="absolute top-0 bottom-0"
              style={{ left: `${left}px` }}
            >
              <div
                className={`absolute left-0 border-l ${mark.major ? 'h-6 border-text-muted' : 'h-3 border-border-secondary'}`}
              />
              {mark.major && (
                <span className="absolute top-6 left-1 code-text text-text-muted whitespace-nowrap">
                  {formatTimeShort(mark.time)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
