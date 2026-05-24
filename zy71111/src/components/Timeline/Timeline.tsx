
import { Play, Pause, SkipBack, SkipForward, Gauge } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useInspectionStore } from '../../store/useInspectionStore';
import { cn } from '../../lib/utils';

const EMPTY_ARRAY: never[] = [];

export function Timeline() {
  const inspectionData = useInspectionStore((state) => state.inspectionData);
  const isPlaying = useInspectionStore((state) => state.isPlaying);
  const playbackSpeed = useInspectionStore((state) => state.playbackSpeed);
  const togglePlay = useInspectionStore((state) => state.togglePlay);
  const setPlaybackSpeed = useInspectionStore((state) => state.setPlaybackSpeed);
  const filterLevel = useInspectionStore((state) => state.filterLevel);
  const filterStatus = useInspectionStore((state) => state.filterStatus);

  const [displayTime, setDisplayTime] = useState(0);
  const animationRef = useRef<number>();
  const localTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const playbackSpeedRef = useRef(1);
  const inspectionDataRef = useRef(inspectionData);
  const lastUpdateRef = useRef(0);
  const storeRef = useRef(useInspectionStore);

  const annotations = inspectionData?.annotations || EMPTY_ARRAY;
  const filteredAnnotations = annotations.filter(
    (ann) => filterLevel.includes(ann.crackLevel) && filterStatus.includes(ann.recheckStatus)
  );

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    inspectionDataRef.current = inspectionData;
    if (inspectionData) {
      localTimeRef.current = inspectionData.startTime;
      setDisplayTime(inspectionData.startTime);
    }
  }, [inspectionData]);

  useEffect(() => {
    if (!inspectionData || !isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
      return;
    }

    let lastFrameTime = 0;

    const animate = (timestamp: number) => {
      if (!isPlayingRef.current || !inspectionDataRef.current) {
        return;
      }

      if (lastFrameTime === 0) {
        lastFrameTime = timestamp;
      }

      const delta = (timestamp - lastFrameTime) * playbackSpeedRef.current;
      lastFrameTime = timestamp;

      let newTime = localTimeRef.current + delta;
      const data = inspectionDataRef.current;
      if (newTime >= data.endTime) {
        newTime = data.startTime;
      }

      localTimeRef.current = newTime;
      setDisplayTime(newTime);

      if (timestamp - lastUpdateRef.current > 100) {
        lastUpdateRef.current = timestamp;
        storeRef.current.getState().setCurrentTime(newTime);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
    };
  }, [isPlaying, inspectionData]);

  if (!inspectionData) return null;

  const { startTime, endTime } = inspectionData;
  const progress = ((displayTime - startTime) / (endTime - startTime)) * 100;

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor((ms - startTime) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = startTime + percentage * (endTime - startTime);
    const clampedTime = Math.max(startTime, Math.min(endTime, newTime));
    localTimeRef.current = clampedTime;
    setDisplayTime(clampedTime);
    storeRef.current.getState().setCurrentTime(clampedTime);
  };

  const handleSkipBack = () => {
    localTimeRef.current = startTime;
    setDisplayTime(startTime);
    storeRef.current.getState().setCurrentTime(startTime);
  };

  const handleSkipForward = () => {
    localTimeRef.current = endTime;
    setDisplayTime(endTime);
    storeRef.current.getState().setCurrentTime(endTime);
  };

  const speeds = [0.5, 1, 2, 4];

  return (
    <div className="absolute bottom-4 left-80 right-4 bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center gap-4">
        <button
          onClick={handleSkipBack}
          className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors text-slate-300"
        >
          <SkipBack size={20} />
        </button>

        <button
          onClick={togglePlay}
          className="p-3 rounded-full bg-cyan-600 hover:bg-cyan-500 transition-colors text-white"
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>

        <button
          onClick={handleSkipForward}
          className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors text-slate-300"
        >
          <SkipForward size={20} />
        </button>

        <div className="flex-1 mx-4">
          <div
            className="relative h-2 bg-slate-700 rounded-full cursor-pointer group"
            onClick={handleSeek}
          >
            <div
              className="absolute h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />

            {filteredAnnotations.map((ann) => {
              const annProgress = ((ann.timestamp - startTime) / (endTime - startTime)) * 100;
              return (
                <div
                  key={ann.id}
                  className="absolute w-1.5 h-4 -top-1 rounded-full bg-cyan-400/60 hover:bg-cyan-400 transition-colors"
                  style={{ left: `calc(${annProgress}% - 3px)` }}
                  title={ann.description}
                />
              );
            })}

            <div
              className="absolute w-4 h-4 -top-1 bg-white rounded-full shadow-lg transform -translate-x-1/2 transition-transform group-hover:scale-110"
              style={{ left: `${progress}%` }}
            />
          </div>

          <div className="flex justify-between mt-2 text-xs text-slate-400">
            <span>{formatTime(startTime)}</span>
            <span className="text-cyan-400 font-mono">{formatTime(displayTime)}</span>
            <span>{formatTime(endTime)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-slate-400" />
          <div className="flex gap-1">
            {speeds.map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={cn(
                  'px-2 py-1 text-xs rounded-md transition-colors',
                  playbackSpeed === speed
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
                )}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
