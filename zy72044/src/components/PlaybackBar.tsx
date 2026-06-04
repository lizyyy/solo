import { useGameStore } from '@/store/useGameStore';
import { Play, Pause, SkipForward, SkipBack, X, FastForward } from 'lucide-react';
import { formatSeconds, getResourceColorClass } from '@/utils/formatUtils';
import { useEffect, useRef } from 'react';
import type { PlaybackSpeed } from '@/types/gameTypes';

const speeds: PlaybackSpeed[] = [0.5, 1, 2, 4];

export default function PlaybackBar() {
  const {
    currentReplayRecord,
    replayIndex,
    replayIsPlaying,
    replaySpeed,
    replayPlayToggle,
    replaySeekTo,
    replayStepForward,
    replayStepBackward,
    replaySetSpeed,
    stopReplay,
    getReplayResources,
  } = useGameStore();

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (replayIsPlaying && currentReplayRecord) {
      const interval = Math.max(100, 1000 / replaySpeed);
      timerRef.current = window.setInterval(() => {
        const { replayIndex: idx, currentReplayRecord: rec } = useGameStore.getState();
        if (rec && idx < rec.eventLog.length - 1) {
          useGameStore.getState().replayStepForward();
        } else {
          useGameStore.getState().replayPlayToggle();
        }
      }, interval);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [replayIsPlaying, replaySpeed, currentReplayRecord]);

  if (!currentReplayRecord) return null;

  const record = currentReplayRecord;
  const events = record.eventLog;
  const totalEvents = events.length;
  const resources = getReplayResources();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur-sm">
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <div>
          <h2 className="text-lg font-medium text-slate-100">回放模式</h2>
          <p className="text-xs text-slate-400">
            {record.configName} · {record.dataFormatVersion === 'v1' ? '旧口径数据' : '新口径数据'} · 来源：{record.source}
          </p>
        </div>
        <button
          onClick={stopReplay}
          className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(resources).map(([key, value]) => {
              const isNeg = value < 0;
              return (
                <div
                  key={key}
                  className={`p-4 rounded-lg border ${
                    isNeg ? 'bg-red-950/30 border-red-500/30' : 'bg-slate-800/50 border-slate-700/50'
                  }`}
                >
                  <div className="text-xs text-slate-400 mb-1">{key}</div>
                  <div className={`text-2xl font-mono font-bold tabular-nums ${getResourceColorClass(value, 0, 100)}`}>
                    {value}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            {events.map((event, idx) => {
              const isActive = idx <= replayIndex;
              const isCurrent = idx === replayIndex;
              const hasNeg = Object.values(event.resourceChanges).some(v => typeof v === 'number' && v < 0);

              return (
                <div
                  key={`${event.id}-${idx}`}
                  className={`p-3 rounded-lg border transition-all ${
                    isCurrent
                      ? hasNeg
                        ? 'bg-red-950/30 border-red-500/40 ring-1 ring-red-500/20'
                        : 'bg-emerald-950/30 border-emerald-500/40 ring-1 ring-emerald-500/20'
                      : isActive
                      ? 'bg-slate-800/50 border-slate-600/50'
                      : 'bg-slate-900/30 border-slate-700/30 opacity-40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-mono">#{idx + 1}</span>
                    <span className="text-sm text-slate-200">{event.name}</span>
                    <span className="text-xs text-slate-500 ml-auto">
                      {Object.entries(event.resourceChanges)
                        .map(([k, v]) => `${k}:${typeof v === 'number' ? (v > 0 ? '+' : '') + v : v}`)
                        .join(' ')}
                    </span>
                  </div>
                  {isCurrent && (
                    <div className="mt-1.5 text-xs text-slate-400">{event.description}</div>
                  )}
                  {isCurrent && (
                    <div className="mt-1 text-[10px] text-slate-500">来源：{event.source}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-700/50 bg-slate-800/80">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <input
              type="range"
              min={0}
              max={Math.max(0, totalEvents - 1)}
              value={replayIndex}
              onChange={(e) => replaySeekTo(Number(e.target.value))}
              className="flex-1 h-1.5 bg-slate-600 rounded-full appearance-none cursor-pointer accent-emerald-500"
            />
            <span className="text-xs text-slate-400 font-mono min-w-[60px] text-right">
              {replayIndex + 1} / {totalEvents}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={replayStepBackward}
                className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
              >
                <SkipBack size={18} />
              </button>
              <button
                onClick={replayPlayToggle}
                className="p-3 bg-emerald-600 hover:bg-emerald-500 rounded-full text-white transition-colors"
              >
                {replayIsPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button
                onClick={replayStepForward}
                className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
              >
                <SkipForward size={18} />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <FastForward size={14} className="text-slate-500" />
              {speeds.map((s) => (
                <button
                  key={s}
                  onClick={() => replaySetSpeed(s)}
                  className={`px-2 py-1 rounded text-xs font-mono ${
                    replaySpeed === s
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:bg-slate-700'
                  } transition-colors`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
