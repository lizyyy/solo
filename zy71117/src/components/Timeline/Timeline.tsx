import { useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Gauge } from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';

export function Timeline() {
  const animationRef = useRef<number>();
  const { simulation, setProgress, setSimulationStatus, setSpeed } = useSimulationStore();

  useEffect(() => {
    if (simulation.status === 'playing') {
      const animate = () => {
        setProgress((prev) => {
          const next = prev + 0.005 * simulation.speed;
          if (next >= 1) {
            setSimulationStatus('finished');
            return 1;
          }
          return next;
        });
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [simulation.status, simulation.speed, setProgress, setSimulationStatus]);

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = parseFloat(e.target.value);
    setProgress(newProgress);
    if (simulation.status === 'idle') {
      setSimulationStatus('paused');
    }
  };

  const handleSkipBack = () => {
    setProgress(Math.max(0, simulation.progress - 0.1));
  };

  const handleSkipForward = () => {
    setProgress(Math.min(1, simulation.progress + 0.1));
  };

  const statusColors: Record<string, string> = {
    idle: 'bg-gray-500',
    calculating: 'bg-yellow-500',
    playing: 'bg-green-500',
    paused: 'bg-yellow-500',
    finished: 'bg-blue-500',
  };

  const statusLabels: Record<string, string> = {
    idle: '就绪',
    calculating: '计算中',
    playing: '播放中',
    paused: '已暂停',
    finished: '已完成',
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[700px]">
      <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700 p-4">
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${statusColors[simulation.status]} animate-pulse`} />
            <span className="text-sm text-gray-300">{statusLabels[simulation.status]}</span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-gray-400" />
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.5}
              value={simulation.speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-20 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-sm text-gray-400 w-12">{simulation.speed.toFixed(1)}x</span>
          </div>
        </div>

        <div className="relative">
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={simulation.progress}
            onChange={handleProgressChange}
            className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div
            className="absolute top-0 left-0 h-3 bg-blue-500/30 rounded-lg pointer-events-none"
            style={{ width: `${simulation.progress * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">0%</span>
          <span className="text-lg font-mono text-white">
            {Math.round(simulation.progress * 100)}%
          </span>
          <span className="text-xs text-gray-500">100%</span>
        </div>

        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={handleSkipBack}
            disabled={simulation.currentPath.length === 0}
            className="p-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            title="后退"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          {simulation.status === 'playing' ? (
            <button
              onClick={() => setSimulationStatus('paused')}
              className="p-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
              title="暂停"
            >
              <Pause className="w-6 h-6" />
            </button>
          ) : (
            <button
              onClick={() => {
                if (simulation.currentPath.length === 0) return;
                if (simulation.status === 'finished') {
                  setProgress(0);
                }
                setSimulationStatus('playing');
              }}
              disabled={simulation.currentPath.length === 0}
              className="p-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              title="播放"
            >
              <Play className="w-6 h-6" />
            </button>
          )}

          <button
            onClick={handleSkipForward}
            disabled={simulation.currentPath.length === 0}
            className="p-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            title="前进"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
