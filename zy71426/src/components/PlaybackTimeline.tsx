import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Clock, ChevronRight } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { getActionTypeLabel, formatTime } from '../utils/playbackManager';

const PlaybackTimeline = () => {
  const { playbackRecord, playbackStep, setPlaybackStep, stopPlayback, currentCaseId } = useGameStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying && playbackRecord) {
      intervalRef.current = window.setInterval(() => {
        setPlaybackStep(playbackStep + 1);
        if (playbackStep >= playbackRecord.actionTimeline.length - 1) {
          setIsPlaying(false);
        }
      }, 1000 / speed);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, playbackStep, speed, playbackRecord, setPlaybackStep]);

  if (!playbackRecord || playbackRecord.actionTimeline.length === 0) return null;

  const totalSteps = playbackRecord.actionTimeline.length;
  const currentAction = playbackRecord.actionTimeline[playbackStep];
  const progress = ((playbackStep + 1) / totalSteps) * 100;

  const handlePlayPause = () => {
    if (playbackStep >= totalSteps - 1) {
      setPlaybackStep(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSkipBack = () => {
    setPlaybackStep(Math.max(0, playbackStep - 1));
    setIsPlaying(false);
  };

  const handleSkipForward = () => {
    setPlaybackStep(Math.min(totalSteps - 1, playbackStep + 1));
    setIsPlaying(false);
  };

  const handleStepClick = (index: number) => {
    setPlaybackStep(index);
    setIsPlaying(false);
  };

  const handleSpeedChange = () => {
    const speeds = [0.5, 1, 1.5, 2];
    const currentIndex = speeds.indexOf(speed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    setSpeed(speeds[nextIndex]);
  };

  const getTimeForStep = (step: number) => {
    if (step < 0 || step >= playbackRecord.actionTimeline.length) return 0;
    return playbackRecord.actionTimeline[step].timestamp - playbackRecord.startTime;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-detective-bgLight border-t border-detective-bgLighter z-50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-detective-accent">
              <Clock className="w-4 h-4" />
              <span className="font-mono text-sm">
                {formatTime(getTimeForStep(playbackStep))} / {formatTime(getTimeForStep(totalSteps - 1))}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              步骤 {playbackStep + 1} / {totalSteps}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleSpeedChange}
              className="px-3 py-1 text-xs rounded bg-detective-bgLighter text-slate-300 hover:bg-detective-bgLighter/80"
            >
              {speed}x
            </button>
            <button
              onClick={stopPlayback}
              className="px-3 py-1 text-xs rounded bg-detective-danger/20 text-detective-danger hover:bg-detective-danger/30"
            >
              退出回放
            </button>
          </div>
        </div>

        <div className="relative h-12 flex items-center gap-1 mb-3 overflow-x-auto scrollbar-thin pb-2">
          {playbackRecord.actionTimeline.map((action, index) => {
            const isActive = index === playbackStep;
            const isPast = index < playbackStep;
            
            return (
              <button
                key={index}
                onClick={() => handleStepClick(index)}
                className={`flex-shrink-0 h-8 px-3 rounded text-xs transition-all duration-200 flex items-center gap-1 ${
                  isActive
                    ? 'bg-detective-accent text-detective-bg shadow-lg scale-105'
                    : isPast
                    ? 'bg-detective-accent/30 text-detective-accent'
                    : 'bg-detective-bgLighter text-slate-400 hover:bg-detective-bgLighter/80'
                }`}
                title={getActionTypeLabel(action.actionType)}
              >
                {isActive && <ChevronRight className="w-3 h-3" />}
                <span className="max-w-[80px] truncate">
                  {getActionTypeLabel(action.actionType)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative h-1 bg-detective-bgLighter rounded-full mb-3">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-detective-accent to-amber-400 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleSkipBack}
            disabled={playbackStep === 0}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-detective-bgLighter disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <SkipBack className="w-5 h-5" />
          </button>
          
          <button
            onClick={handlePlayPause}
            className="p-3 rounded-full bg-detective-accent text-detective-bg hover:bg-detective-accentLight transition-all hover:scale-110"
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </button>
          
          <button
            onClick={handleSkipForward}
            disabled={playbackStep >= totalSteps - 1}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-detective-bgLighter disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {currentAction && (
          <div className="mt-3 p-3 rounded-lg bg-detective-bgLighter/50 text-center">
            <p className="text-sm text-slate-300">
              <span className="text-detective-accent font-medium">
                {getActionTypeLabel(currentAction.actionType)}
              </span>
              {currentAction.payload && (
                <span className="text-slate-400 ml-2">
                  - {JSON.stringify(currentAction.payload).substring(0, 100)}
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaybackTimeline;
