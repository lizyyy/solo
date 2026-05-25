import { useEffect, useRef } from 'react';
import { useAppStore } from '../../store';
import { formatTime } from '../../utils/statistics';
import { viewPresets } from '../../constants/viewPresets';

export const Timeline = () => {
  const data = useAppStore((state) => state.data);
  const currentTimeIndex = useAppStore((state) => state.currentTimeIndex);
  const setCurrentTimeIndex = useAppStore((state) => state.setCurrentTimeIndex);
  const isPlaying = useAppStore((state) => state.isPlaying);
  const togglePlaying = useAppStore((state) => state.togglePlaying);
  const playSpeed = useAppStore((state) => state.playSpeed);
  const setPlaySpeed = useAppStore((state) => state.setPlaySpeed);
  const nextTimeStep = useAppStore((state) => state.nextTimeStep);
  const prevTimeStep = useAppStore((state) => state.prevTimeStep);

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying && data) {
      intervalRef.current = window.setInterval(() => {
        nextTimeStep();
      }, 1000 / playSpeed);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, playSpeed, data, nextTimeStep]);

  if (!data) return null;

  const currentSnapshot = data.snapshots[currentTimeIndex];
  const progress = (currentTimeIndex / (data.snapshots.length - 1)) * 100;

  const getEventColor = (type: string) => {
    switch (type) {
      case 'competition': return 'bg-rose-500';
      case 'training': return 'bg-blue-500';
      case 'maintenance': return 'bg-amber-500';
      default: return 'bg-slate-500';
    }
  };

  const getEventPosition = (timestamp: number) => {
    const startTime = data.snapshots[0].timestamp;
    const endTime = data.snapshots[data.snapshots.length - 1].timestamp;
    return ((timestamp - startTime) / (endTime - startTime)) * 100;
  };

  return (
    <div className="h-32 bg-slate-900/95 border-t border-slate-700 p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={prevTimeStep}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              disabled={currentTimeIndex === 0}
            >
              <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={togglePlaying}
              className="p-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors"
            >
              {isPlaying ? (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>
            <button
              onClick={nextTimeStep}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              disabled={currentTimeIndex === data.snapshots.length - 1}
            >
              <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">速度:</span>
            <select
              value={playSpeed}
              onChange={(e) => setPlaySpeed(Number(e.target.value))}
              className="bg-slate-700 text-slate-300 text-sm rounded px-2 py-1 border-0"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </div>

          <div className="text-sm">
            <span className="text-slate-400">当前时间: </span>
            <span className="text-cyan-400 font-mono font-medium">
              {formatTime(currentSnapshot.timestamp)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">视角:</span>
          <div className="flex gap-1">
            {viewPresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => useAppStore.getState().setSelectedViewPreset(preset.id)}
                className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                title={preset.name}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
        <div className="absolute inset-x-0 top-4 h-6 bg-slate-800 rounded-full overflow-hidden">
          {data.events.map((event) => (
            <div
              key={event.id}
              className={`absolute h-full ${getEventColor(event.type)} opacity-30`}
              style={{
                left: `${getEventPosition(event.startTime)}%`,
                width: `${getEventPosition(event.endTime) - getEventPosition(event.startTime)}%`,
              }}
              title={event.name}
            />
          ))}

          <div
            className="absolute top-0 h-full w-1 bg-cyan-400 transition-all duration-200"
            style={{ left: `calc(${progress}% - 2px)` }}
          />
        </div>

        <input
          type="range"
          min={0}
          max={data.snapshots.length - 1}
          value={currentTimeIndex}
          onChange={(e) => setCurrentTimeIndex(Number(e.target.value))}
          className="absolute inset-x-0 top-4 w-full h-6 opacity-0 cursor-pointer"
        />

        <div className="absolute inset-x-0 bottom-0 flex justify-between text-xs text-slate-500 font-mono">
          <span>{formatTime(data.snapshots[0].timestamp)}</span>
          <span>{formatTime(data.snapshots[Math.floor(data.snapshots.length / 2)].timestamp)}</span>
          <span>{formatTime(data.snapshots[data.snapshots.length - 1].timestamp)}</span>
        </div>
      </div>
    </div>
  );
};
