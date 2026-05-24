import React from 'react';
import { Play, Pause, SkipBack, SkipForward, FastForward, Clock } from 'lucide-react';
import { useSceneStore } from '../../store/useSceneStore';

const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const Timeline: React.FC = () => {
  const isPlaying = useSceneStore((state) => state.isPlaying);
  const currentTime = useSceneStore((state) => state.currentTime);
  const totalDuration = useSceneStore((state) => state.totalDuration);
  const playbackSpeed = useSceneStore((state) => state.playbackSpeed);
  const batches = useSceneStore((state) => state.batches);
  const trajectories = useSceneStore((state) => state.trajectories);
  
  const setPlaying = useSceneStore((state) => state.setPlaying);
  const setCurrentTime = useSceneStore((state) => state.setCurrentTime);
  const setPlaybackSpeed = useSceneStore((state) => state.setPlaybackSpeed);

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const handleSkipBack = () => {
    setCurrentTime(Math.max(0, currentTime - 10000));
  };

  const handleSkipForward = () => {
    setCurrentTime(Math.min(totalDuration, currentTime + 10000));
  };

  const handleReset = () => {
    setCurrentTime(0);
    setPlaying(false);
  };

  if (totalDuration === 0) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-full max-w-4xl px-4">
      <div className="bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-xl p-4">
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
              title="回到开始"
            >
              <SkipBack className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={handleSkipBack}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
              title="后退10秒"
            >
              <SkipBack className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={() => setPlaying(!isPlaying)}
              className="p-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 transition-colors"
              title={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white" />
              )}
            </button>
            <button
              onClick={handleSkipForward}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
              title="前进10秒"
            >
              <SkipForward className="w-4 h-4 text-white" />
            </button>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <FastForward className="w-4 h-4 text-slate-400" />
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="bg-slate-800 text-white text-sm px-2 py-1.5 rounded-lg border border-slate-600 focus:border-cyan-500 focus:outline-none cursor-pointer"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
              <option value={8}>8x</option>
            </select>
          </div>

          <div className="flex items-center gap-2 ml-auto text-white text-sm font-mono">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-400">{formatTime(currentTime)}</span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-400">{formatTime(totalDuration)}</span>
          </div>
        </div>

        <div className="relative">
          <div
            className="relative h-3 bg-slate-800 rounded-full overflow-hidden cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = x / rect.width;
              setCurrentTime(percentage * totalDuration);
            }}
          >
            {batches.map((batch) => {
              const start = (batch.startTime / totalDuration) * 100;
              const width = ((batch.endTime - batch.startTime) / totalDuration) * 100;
              return (
                <div
                  key={batch.id}
                  className="absolute top-0 h-full bg-cyan-600/30"
                  style={{ left: `${start}%`, width: `${width}%` }}
                  title={batch.name}
                />
              );
            })}
            
            <div
              className="absolute top-0 h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
            
            {trajectories.map((traj) => {
              const trajStart = (traj.startTime / totalDuration) * 100;
              return (
                <div
                  key={traj.visitorId}
                  className="absolute top-0 w-1 h-full bg-green-400/50"
                  style={{ left: `${trajStart}%` }}
                />
              );
            })}
          </div>

          <input
            type="range"
            min={0}
            max={totalDuration}
            value={currentTime}
            onChange={(e) => setCurrentTime(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        <div className="flex justify-between mt-2">
          {batches.length > 0 && (
            <div className="flex items-center gap-4">
              {batches.map((batch) => (
                <div
                  key={batch.id}
                  className="text-xs text-slate-400"
                  style={{ marginLeft: `${(batch.startTime / totalDuration) * 100}%` }}
                >
                  {batch.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Timeline;
