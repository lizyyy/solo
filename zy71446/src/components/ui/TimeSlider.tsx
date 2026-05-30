import { useMemo } from 'react';
import { Play, Pause, SkipForward, SkipBack, FastForward } from 'lucide-react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { timeToMinutes, minutesToTime, generateTimeRange } from '../../utils/timeUtils';

export function TimeSlider() {
  const currentTime = useSimulationStore((state) => state.currentTime);
  const isPlaying = useSimulationStore((state) => state.isPlaying);
  const playSpeed = useSimulationStore((state) => state.playSpeed);
  const startTime = useSimulationStore((state) => state.startTime);
  const endTime = useSimulationStore((state) => state.endTime);
  const setTime = useSimulationStore((state) => state.setTime);
  const togglePlay = useSimulationStore((state) => state.togglePlay);
  const setPlaySpeed = useSimulationStore((state) => state.setPlaySpeed);
  const stepForward = useSimulationStore((state) => state.stepForward);

  const timeRange = useMemo(() => {
    return generateTimeRange(startTime, endTime, 1);
  }, [startTime, endTime]);

  const currentMinutes = timeToMinutes(currentTime);
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const progress = ((currentMinutes - startMinutes) / (endMinutes - startMinutes)) * 100;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    const newMinutes = startMinutes + (value / 100) * (endMinutes - startMinutes);
    setTime(minutesToTime(Math.floor(newMinutes)));
  };

  const handleSkipBack = () => {
    stepForward(-5);
  };

  const handleSkipForward = () => {
    stepForward(5);
  };

  const speedOptions = [0.5, 1, 2, 5];

  const majorTicks = ['07:00', '07:30', '08:00', '08:15', '08:30', '08:45', '09:00', '09:30'];
  const peakStart = timeToMinutes('07:30');
  const peakEnd = timeToMinutes('08:45');
  const peakProgressStart = ((peakStart - startMinutes) / (endMinutes - startMinutes)) * 100;
  const peakProgressEnd = ((peakEnd - startMinutes) / (endMinutes - startMinutes)) * 100;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-md border-t border-cyan-500/30 p-4 z-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <div className="text-cyan-400 font-mono text-xl font-bold">
              {currentTime}
            </div>
            <div className="text-slate-400 text-sm">
              早高峰时段: {startTime} - {endTime}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSkipBack}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition-all hover:scale-105"
              title="后退5分钟"
            >
              <SkipBack size={20} />
            </button>

            <button
              onClick={togglePlay}
              className={`p-3 rounded-lg transition-all hover:scale-105 ${
                isPlaying
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50'
                  : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/50'
              }`}
              title={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
            </button>

            <button
              onClick={handleSkipForward}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition-all hover:scale-105"
              title="前进5分钟"
            >
              <SkipForward size={20} />
            </button>

            <div className="flex items-center gap-1 ml-4">
              <FastForward size={16} className="text-slate-400" />
              {speedOptions.map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaySpeed(speed)}
                  className={`px-2 py-1 text-xs rounded transition-all ${
                    playSpeed === speed
                      ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="relative">
          <div
            className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full bg-orange-500/20"
            style={{
              left: `${peakProgressStart}%`,
              width: `${peakProgressEnd - peakProgressStart}%`,
            }}
          />

          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={handleSliderChange}
            className="w-full h-2 rounded-full appearance-none cursor-pointer
              bg-slate-700
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-5
              [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-cyan-400
              [&::-webkit-slider-thumb]:shadow-lg
              [&::-webkit-slider-thumb]:shadow-cyan-400/50
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-all
              [&::-webkit-slider-thumb]:hover:scale-125
              [&::-moz-range-thumb]:w-5
              [&::-moz-range-thumb]:h-5
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-cyan-400
              [&::-moz-range-thumb]:border-none"
            style={{
              background: `linear-gradient(to right, #00D4FF 0%, #00D4FF ${progress}%, #334155 ${progress}%, #334155 100%)`,
            }}
          />

          <div className="flex justify-between mt-2">
            {majorTicks.map((tick) => {
              const tickMinutes = timeToMinutes(tick);
              const tickProgress = ((tickMinutes - startMinutes) / (endMinutes - startMinutes)) * 100;
              const isPeak = tickMinutes >= peakStart && tickMinutes <= peakEnd;
              return (
                <div
                  key={tick}
                  className={`text-xs font-mono ${
                    isPeak ? 'text-orange-400' : 'text-slate-500'
                  }`}
                >
                  {tick}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
