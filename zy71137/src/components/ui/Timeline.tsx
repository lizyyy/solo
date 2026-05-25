import { useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useSimulationStore } from '@/store/useSimulationStore';

export function Timeline() {
  const { isPlaying, setPlaying, simulationTime, setSimulationTime, resetSimulation, params } = useSimulationStore();
  const lastTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  const maxTime = 60;
  const progress = (simulationTime / maxTime) * 100;

  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    lastTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      setSimulationTime((prev) => {
        const newTime = prev + deltaTime * params.simulationSpeed;
        if (newTime >= maxTime) {
          setPlaying(false);
          return maxTime;
        }
        return newTime;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, params.simulationSpeed, setSimulationTime, setPlaying]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 h-20 bg-gray-900/90 backdrop-blur-md border-t border-gray-700/50 z-10">
      <div className="h-full flex items-center justify-center gap-6 px-8">
        <div className="flex items-center gap-2">
          <button
            onClick={resetSimulation}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
          >
            <SkipBack size={18} />
          </button>

          <button
            onClick={() => setPlaying(!isPlaying)}
            className={`p-3 rounded-full transition-all ${
              isPlaying
                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>

          <button
            onClick={() => setSimulationTime(Math.min(maxTime, simulationTime + 5))}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
          >
            <SkipForward size={18} />
          </button>
        </div>

        <div className="flex-1 max-w-2xl">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400 w-12 text-right">
              {formatTime(simulationTime)}
            </span>
            <div className="flex-1 relative">
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <input
                type="range"
                min="0"
                max={maxTime}
                value={simulationTime}
                onChange={(e) => setSimulationTime(parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>00:00</span>
                <span>00:30</span>
                <span>01:00</span>
              </div>
            </div>
            <span className="text-sm text-gray-400 w-12">
              {formatTime(maxTime)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-gray-500">模拟状态</div>
            <div className={`text-sm font-medium ${
              isPlaying ? 'text-green-400' : 'text-gray-400'
            }`}>
              {isPlaying ? '运行中' : '已暂停'}
            </div>
          </div>
          <div className={`w-3 h-3 rounded-full ${
            isPlaying ? 'bg-green-500 animate-pulse' : 'bg-gray-600'
          }`} />
        </div>
      </div>
    </div>
  );
}