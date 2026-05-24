import { Play, Pause, SkipBack, SkipForward, Gauge } from 'lucide-react';
import { useSceneStore } from '../../store/useSceneStore';

export function Timeline() {
  const {
    playback,
    startPlayback,
    pausePlayback,
    setPlaybackTime,
    setPlaybackSpeed,
    isDataLoaded
  } = useSceneStore();

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDataLoaded) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * playback.duration;
    setPlaybackTime(Math.max(0, Math.min(newTime, playback.duration)));
  };

  const speeds = [0.5, 1, 2, 4];

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 w-full max-w-4xl px-4">
      <div className="bg-gray-900/80 backdrop-blur-md rounded-xl border border-gray-700/50 p-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPlaybackTime(0)}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
              disabled={!isDataLoaded}
            >
              <SkipBack size={18} />
            </button>
            
            <button
              onClick={playback.isPlaying ? pausePlayback : startPlayback}
              className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-colors disabled:opacity-50"
              disabled={!isDataLoaded}
            >
              {playback.isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            
            <button
              onClick={() => setPlaybackTime(playback.duration)}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
              disabled={!isDataLoaded}
            >
              <SkipForward size={18} />
            </button>
          </div>

          <div className="flex-1">
            <div
              className="relative h-3 bg-gray-700 rounded-full cursor-pointer overflow-hidden"
              onClick={handleProgressClick}
            >
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all"
                style={{ width: `${(playback.currentTime / playback.duration) * 100 || 0}%` }}
              />
              <div
                className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg cursor-grab"
                style={{ left: `calc(${(playback.currentTime / playback.duration) * 100 || 0}% - 8px)` }}
              />
            </div>
            
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>{formatTime(playback.currentTime)}</span>
              <span>{formatTime(playback.duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Gauge size={16} className="text-gray-400" />
            <div className="flex gap-1">
              {speeds.map(speed => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    playback.speed === speed
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  disabled={!isDataLoaded}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Timeline;
