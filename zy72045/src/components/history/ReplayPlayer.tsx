import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { Timeline } from './Timeline';
import { useReplay } from '../../hooks/useReplay';
import type { HistoryRecord } from '../../types/history';

interface ReplayPlayerProps {
  record: HistoryRecord | null;
}

export function ReplayPlayer({ record }: ReplayPlayerProps) {
  const {
    currentRound,
    totalRounds,
    isPlaying,
    speed,
    goToRound,
    goToFirst,
    goToLast,
    togglePlay,
    stop,
    setSpeed,
    speedOptions,
  } = useReplay(record);

  if (!record) return null;

  return (
    <div className="space-y-4">
      <Timeline
        currentRound={currentRound}
        totalRounds={totalRounds}
        onRoundChange={goToRound}
      />

      <div className="card">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={goToFirst}
            className="p-2 rounded hover:bg-neutral-100 transition-colors"
            title="回到开始"
          >
            <RotateCcw size={18} />
          </button>

          <button
            onClick={goToFirst}
            className="p-2 rounded hover:bg-neutral-100 transition-colors"
            title="上一回合"
          >
            <SkipBack size={18} />
          </button>

          <button
            onClick={togglePlay}
            className="p-4 rounded-full bg-primary-500 text-white hover:bg-primary-600 transition-colors shadow-lg"
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
          </button>

          <button
            onClick={goToLast}
            className="p-2 rounded hover:bg-neutral-100 transition-colors"
            title="下一回合"
          >
            <SkipForward size={18} />
          </button>

          <button
            onClick={goToLast}
            className="p-2 rounded hover:bg-neutral-100 transition-colors"
            title="跳到结尾"
          >
            <RotateCcw size={18} className="scale-x-[-1]" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="text-xs text-neutral-500 mr-2">播放速度：</span>
          {speedOptions.map((s) => (
            <button
              key={s}
              onClick={() => {
                setSpeed(s);
                stop();
              }}
              className={`px-3 py-1 text-xs rounded font-medium transition-all ${
                speed === s
                  ? 'bg-primary-500 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
