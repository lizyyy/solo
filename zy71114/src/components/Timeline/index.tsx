import { Play, Pause, SkipBack, SkipForward, RotateCcw, Gauge } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { SIMULATION_CONFIG } from '../../utils/constants';

export function Timeline() {
  const { simulation, togglePlay, setProgress, resetSimulation, setSimulation } = useAppStore();
  const { isPlaying, progress, speed } = simulation;

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = parseFloat(e.target.value);
    setProgress(newProgress);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSimulation({ speed: newSpeed });
  };

  const skipToStart = () => {
    setProgress(0);
  };

  const skipToEnd = () => {
    setProgress(1);
  };

  const progressPercent = Math.round(progress * 100);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20">
      <div className="bg-gray-900/95 backdrop-blur-sm border-t border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={resetSimulation}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                title="重置"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={skipToStart}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                title="回到起点"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={togglePlay}
                className={`p-3 rounded-lg transition-colors ${
                  isPlaying
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
                title={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button
                onClick={skipToEnd}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                title="跳到终点"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1">
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.001"
                  value={progress}
                  onChange={handleProgressChange}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div
                  className="absolute top-0 left-0 h-2 bg-gradient-to-r from-blue-500 to-blue-400 rounded-lg pointer-events-none"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-500">入口</span>
                <span className="text-xs text-blue-400 font-medium">{progressPercent}%</span>
                <span className="text-xs text-gray-500">车库内</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-gray-400" />
              <div className="flex items-center gap-1">
                {[0.1, 0.3, 0.5, 1.0].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSpeedChange(s)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      Math.abs(speed - s) < 0.01
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
