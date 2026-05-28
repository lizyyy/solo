import {
  Play,
  Pause,
  Rewind,
  FastForward,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFilterStore, useViewStore } from '../../store';
import dayjs from 'dayjs';

const SPEED_OPTIONS = [0.5, 1, 2, 4];

export default function TimelineControl() {
  const isPlaying = useViewStore((s) => s.isPlayingTimeline);
  const togglePlayback = useViewStore((s) => s.togglePlayback);
  const playbackSpeed = useViewStore((s) => s.timelinePlaybackSpeed);
  const setTimelinePlaybackSpeed = useViewStore(
    (s) => s.setTimelinePlaybackSpeed
  );

  const timeRange = useFilterStore((s) => s.timeRange);
  const setTimeRange = useFilterStore((s) => s.setTimeRange);

  const rangeMs = timeRange.end - timeRange.start;
  const progress = rangeMs > 0
    ? ((Date.now() - timeRange.start) / rangeMs) * 100
    : 0;
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="glass rounded-lg px-4 py-3 flex items-center gap-4">
      <button
        onClick={togglePlayback}
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-full transition-all',
          isPlaying
            ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/40'
            : 'bg-warehouse-surface text-slate-300 border border-warehouse-border/50 hover:border-accent-blue/40'
        )}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1">
        <div
          className="timeline-track"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            const newStart = timeRange.start + pct * rangeMs;
            setTimeRange({ start: newStart, end: timeRange.end });
          }}
        >
          <div
            className="timeline-progress"
            style={{ width: `${clampedProgress}%` }}
          />
          <div
            className="timeline-thumb"
            style={{ left: `${clampedProgress}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>{dayjs(timeRange.start).format('HH:mm:ss')}</span>
          <span>{dayjs(timeRange.end).format('HH:mm:ss')}</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {SPEED_OPTIONS.map((speed) => (
          <button
            key={speed}
            onClick={() => setTimelinePlaybackSpeed(speed)}
            className={cn(
              'px-2 py-1 rounded text-[11px] font-mono transition-all border',
              playbackSpeed === speed
                ? 'bg-accent-blue/20 text-accent-blue border-accent-blue/40'
                : 'bg-warehouse-surface text-slate-400 border-warehouse-border/50 hover:border-slate-500'
            )}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
}
