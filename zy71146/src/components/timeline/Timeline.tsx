import { useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Gauge,
  ChevronUp,
  ChevronDown,
  Users,
} from 'lucide-react';
import { useSceneStore } from '@/store/sceneStore';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';

export function Timeline() {
  const timelineRef = useRef<HTMLDivElement>(null);
  
  const isPlaying = useSceneStore(state => state.isPlaying);
  const setIsPlaying = useSceneStore(state => state.setIsPlaying);
  const currentTime = useSceneStore(state => state.currentTime);
  const setCurrentTime = useSceneStore(state => state.setCurrentTime);
  const totalDuration = useSceneStore(state => state.totalDuration);
  const playbackSpeed = useSceneStore(state => state.playbackSpeed);
  const setPlaybackSpeed = useSceneStore(state => state.setPlaybackSpeed);
  const paths = useSceneStore(state => state.paths);
  const activePath = useSceneStore(state => state.activePath);
  const setActivePath = useSceneStore(state => state.setActivePath);
  
  const timelineExpanded = useUIStore(state => state.timelineExpanded);
  const setTimelineExpanded = useUIStore(state => state.setTimelineExpanded);

  const progress = (currentTime / totalDuration) * 100;

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    setCurrentTime(percentage * totalDuration);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const speedOptions = [0.5, 1, 1.5, 2];

  return (
    <div
      className={cn(
        'absolute bottom-4 left-1/2 -translate-x-1/2 z-20',
        'transition-all duration-300 ease-in-out',
        timelineExpanded ? 'w-4/5' : 'w-3/5'
      )}
    >
      <div className="bg-slate-900/90 backdrop-blur-md rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden">
        {timelineExpanded && (
          <div className="p-3 border-b border-slate-700/50">
            <div className="text-xs text-slate-400 font-semibold mb-2">人流路径</div>
            <div className="flex flex-wrap gap-2">
              {paths.map(path => (
                <button
                  key={path.id}
                  onClick={() => setActivePath(activePath === path.id ? null : path.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all',
                    activePath === path.id
                      ? 'bg-slate-700 border border-slate-600'
                      : 'bg-slate-800/50 hover:bg-slate-700/50'
                  )}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: path.color }}
                  />
                  <span className="text-slate-300">{path.name}</span>
                  <Users className="w-3 h-3 text-slate-500" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentTime(0)}
                className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors text-slate-400 hover:text-white"
                title="回到开始"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={cn(
                  'p-2.5 rounded-lg transition-all',
                  isPlaying
                    ? 'bg-cyan-600 text-white hover:bg-cyan-500'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                )}
                title={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              
              <button
                onClick={() => setCurrentTime(totalDuration)}
                className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors text-slate-400 hover:text-white"
                title="跳到结束"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1">
              <div
                ref={timelineRef}
                onClick={handleTimelineClick}
                className="relative h-8 cursor-pointer group"
              >
                <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                
                {paths.map(path => (
                  path.points.map((point, index) => {
                    const timestamp = path.timestamps?.[index];
                    if (timestamp === undefined) return null;
                    const markerPos = (timestamp / totalDuration) * 100;
                    return (
                      <div
                        key={`${path.id}-${index}`}
                        className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          left: `${markerPos}%`,
                          backgroundColor: path.color,
                        }}
                        title={`${path.name} - 关键点 ${index + 1}`}
                      />
                    );
                  })
                ))}

                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-cyan-400 rounded-full shadow-lg shadow-cyan-500/50 border-2 border-white transition-all"
                  style={{ left: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(totalDuration)}</span>
            </div>

            <div className="flex items-center gap-1">
              <Gauge className="w-4 h-4 text-slate-500" />
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded border border-slate-700 focus:outline-none focus:border-cyan-500"
              >
                {speedOptions.map(speed => (
                  <option key={speed} value={speed}>{speed}x</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setTimelineExpanded(!timelineExpanded)}
              className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors text-slate-400 hover:text-white"
              title={timelineExpanded ? '收起' : '展开'}
            >
              {timelineExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
