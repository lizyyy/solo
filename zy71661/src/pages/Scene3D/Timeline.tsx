import { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSimulationStore } from '@/store/useSimulationStore';
import { PLAYBACK_SPEEDS } from '@/constants/config';
import { ANOMALY_COLORS } from '@/constants/config';
import { Play, Pause } from 'lucide-react';

export default function Timeline() {
  const { currentSimulation, currentTime, isPlaying, playbackSpeed, setCurrentTime, togglePlay, setPlaybackSpeed } = useSimulationStore();
  const totalTime = currentSimulation?.dataPoints?.length
    ? currentSimulation.dataPoints[currentSimulation.dataPoints.length - 1].timestamp
    : 0;
  const anomalies = currentSimulation?.anomalies ?? [];
  const sliderRef = useRef<HTMLInputElement>(null);

  useFrame((_, delta) => {
    if (!isPlaying || totalTime <= 0) return;
    const next = currentTime + delta * playbackSpeed;
    if (next >= totalTime) {
      setCurrentTime(totalTime);
      useSimulationStore.getState().togglePlay();
    } else {
      setCurrentTime(next);
    }
  });

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTime(parseFloat(e.target.value));
  }, [setCurrentTime]);

  const pct = totalTime > 0 ? (currentTime / totalTime) * 100 : 0;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gray-900/95 border-t border-gray-700 px-4 py-2 flex items-center gap-4 z-50">
      <button
        onClick={togglePlay}
        className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-colors shrink-0"
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>

      <div className="flex items-center gap-1 shrink-0">
        {PLAYBACK_SPEEDS.map(speed => (
          <button
            key={speed}
            onClick={() => setPlaybackSpeed(speed)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              playbackSpeed === speed
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>

      <div className="flex-1 relative h-6 flex items-center">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-gray-700 rounded-full">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
        </div>
        {anomalies.map(a => {
          const anomalyPct = totalTime > 0 ? (a.timestamp / totalTime) * 100 : 0;
          return (
            <div
              key={a.id}
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
              style={{ left: `${anomalyPct}%`, backgroundColor: ANOMALY_COLORS[a.severity] ?? '#ef4444' }}
              title={a.description}
            />
          );
        })}
        <input
          ref={sliderRef}
          type="range"
          min={0}
          max={totalTime || 1}
          step={0.01}
          value={currentTime}
          onChange={handleSliderChange}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
      </div>

      <div className="font-mono text-sm text-gray-300 shrink-0 w-14 text-right">
        {currentTime.toFixed(2)}s
      </div>
    </div>
  );
}
