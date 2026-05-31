import React, { useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';

const PlaybackControls: React.FC = () => {
  const { currentProject, playback, setPlayback, setTimeline } = useProjectStore();
  const intervalRef = useRef<number | null>(null);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (playback.isPlaying) {
      intervalRef.current = window.setInterval(() => {
        const newTime = playback.currentTime + 0.016 * playback.playbackRate;
        if (playback.loopStart !== undefined && playback.loopEnd !== undefined) {
          if (newTime >= playback.loopEnd) {
            setPlayback({ currentTime: playback.loopStart });
            setTimeline({ playheadPosition: playback.loopStart });
          } else {
            setPlayback({ currentTime: newTime });
            setTimeline({ playheadPosition: newTime });
          }
        } else if (currentProject && newTime < currentProject.audioDuration) {
          setPlayback({ currentTime: newTime });
          setTimeline({ playheadPosition: newTime });
        } else {
          setPlayback({ isPlaying: false });
        }
      }, 16);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [playback.isPlaying, playback.currentTime, playback.playbackRate, playback.loopStart, playback.loopEnd, currentProject, setPlayback, setTimeline]);

  const togglePlay = () => {
    if (playback.isPlaying) {
      setPlayback({ isPlaying: false });
    } else if (currentProject) {
      if (playback.currentTime >= currentProject.audioDuration) {
        setPlayback({ currentTime: 0, isPlaying: true });
        setTimeline({ playheadPosition: 0 });
      } else {
        setPlayback({ isPlaying: true });
      }
    }
  };

  const skipBack = () => {
    const newTime = Math.max(0, playback.currentTime - 5);
    setPlayback({ currentTime: newTime });
    setTimeline({ playheadPosition: newTime });
  };

  const skipForward = () => {
    const newTime = currentProject ? Math.min(currentProject.audioDuration, playback.currentTime + 5) : playback.currentTime + 5;
    setPlayback({ currentTime: newTime });
    setTimeline({ playheadPosition: newTime });
  };

  const toggleLoop = () => {
    if (playback.loopStart !== undefined && playback.loopEnd !== undefined) {
      setPlayback({ loopStart: undefined, loopEnd: undefined });
    } else {
      setPlayback({ loopStart: playback.currentTime, loopEnd: playback.currentTime + 10 });
    }
  };

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentProject) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const newTime = ratio * currentProject.audioDuration;
    setPlayback({ currentTime: newTime });
    setTimeline({ playheadPosition: newTime });
  };

  return (
    <div className="bg-[#16213E] border-t border-[#2A2A4E] px-4 py-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={skipBack}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#1A1A2E] rounded-lg transition-colors"
            title="后退 5 秒"
          >
            <SkipBack size={20} />
          </button>
          <button
            onClick={togglePlay}
            className="p-3 bg-[#FF6B35] hover:bg-[#ff7a4a] text-white rounded-lg transition-colors"
          >
            {playback.isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={skipForward}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#1A1A2E] rounded-lg transition-colors"
            title="前进 5 秒"
          >
            <SkipForward size={20} />
          </button>
          <button
            onClick={toggleLoop}
            className={`p-2 rounded-lg transition-colors ${
              playback.loopStart !== undefined
                ? 'text-[#FF6B35] bg-[#1A1A2E]'
                : 'text-gray-400 hover:text-white hover:bg-[#1A1A2E]'
            }`}
            title="A-B 循环"
          >
            <Repeat size={20} />
          </button>
        </div>

        <div className="flex-1">
          <div
            className="relative h-2 bg-[#1A1A2E] rounded-full cursor-pointer"
            onClick={handleProgressClick}
          >
            <div
              className="absolute h-full bg-[#FF6B35] rounded-full"
              style={{
                width: currentProject
                  ? `${(playback.currentTime / currentProject.audioDuration) * 100}%`
                  : '0%',
              }}
            />
            {playback.loopStart !== undefined && playback.loopEnd !== undefined && currentProject && (
              <>
                <div
                  className="absolute h-full bg-[#FF6B35] opacity-30 rounded-full"
                  style={{
                    left: `${(playback.loopStart / currentProject.audioDuration) * 100}%`,
                    width: `${((playback.loopEnd - playback.loopStart) / currentProject.audioDuration) * 100}%`,
                  }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-[#FF6B35] rounded"
                  style={{ left: `${(playback.loopStart / currentProject.audioDuration) * 100}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-[#FF6B35] rounded"
                  style={{ left: `${(playback.loopEnd / currentProject.audioDuration) * 100}%` }}
                />
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-mono text-gray-300">
            {formatTime(playback.currentTime)} / {formatTime(currentProject?.audioDuration || 0)}
          </span>

          <div className="flex items-center gap-1">
            {speeds.map((speed) => (
              <button
                key={speed}
                onClick={() => setPlayback({ playbackRate: speed })}
                className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
                  playback.playbackRate === speed
                    ? 'bg-[#FF6B35] text-white'
                    : 'text-gray-400 hover:text-white hover:bg-[#1A1A2E]'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaybackControls;
