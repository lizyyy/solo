import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, FastForward } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useSyncState } from '../../hooks/useSyncState';

export function TimelineControl() {
  const {
    currentTime,
    timeRange,
    isPlaying,
    playbackSpeed,
    anomalies,
    togglePlayback,
    setPlaybackSpeed,
  } = useAppStore();

  const { handleTimeChange } = useSyncState();
  const intervalRef = useRef<number | null>(null);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const progress = useMemo(() => {
    return ((currentTime - timeRange[0]) / (timeRange[1] - timeRange[0])) * 100;
  }, [currentTime, timeRange]);

  const anomalyMarkers = useMemo(() => {
    const markers: { time: number; level: string }[] = [];
    const uniqueTimes = new Set<number>();

    for (const anomaly of anomalies) {
      const timeKey = Math.floor(anomaly.timestamp / (60 * 60 * 1000)) * (60 * 60 * 1000);
      if (!uniqueTimes.has(timeKey)) {
        uniqueTimes.add(timeKey);
        markers.push({ time: anomaly.timestamp, level: anomaly.level });
      }
    }

    return markers;
  }, [anomalies]);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = window.setInterval(() => {
        const step = 30 * 60 * 1000 * playbackSpeed;
        const newTime = currentTime + step;
        if (newTime > timeRange[1]) {
          handleTimeChange(timeRange[0]);
        } else {
          handleTimeChange(newTime);
        }
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, currentTime, timeRange, handleTimeChange]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percentage = parseFloat(e.target.value);
    const newTime = timeRange[0] + (percentage / 100) * (timeRange[1] - timeRange[0]);
    handleTimeChange(newTime);
  };

  const handleSkipBack = () => {
    const step = 60 * 60 * 1000;
    const newTime = Math.max(timeRange[0], currentTime - step);
    handleTimeChange(newTime);
  };

  const handleSkipForward = () => {
    const step = 60 * 60 * 1000;
    const newTime = Math.min(timeRange[1], currentTime + step);
    handleTimeChange(newTime);
  };

  const handleSpeedChange = () => {
    const speeds = [0.5, 1, 2, 4, 8];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIndex]);
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute bottom-0 left-0 right-0 px-6 py-4"
    >
      <div className="glass-panel px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <span className="text-cyan-glow font-orbitron text-sm glow-text">
              {formatTime(timeRange[0])}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSkipBack}
                className="p-2 rounded-lg bg-ocean-blue/50 hover:bg-ocean-blue/80 transition-all hover:shadow-glow"
              >
                <SkipBack size={18} className="text-cyan-glow" />
              </button>
              <button
                onClick={togglePlayback}
                className="p-3 rounded-full bg-cyan-glow hover:bg-cyan-dim transition-all hover:shadow-glow"
              >
                {isPlaying ? (
                  <Pause size={20} className="text-deep-ocean" />
                ) : (
                  <Play size={20} className="text-deep-ocean" />
                )}
              </button>
              <button
                onClick={handleSkipForward}
                className="p-2 rounded-lg bg-ocean-blue/50 hover:bg-ocean-blue/80 transition-all hover:shadow-glow"
              >
                <SkipForward size={18} className="text-cyan-glow" />
              </button>
              <button
                onClick={handleSpeedChange}
                className="px-3 py-2 rounded-lg bg-ocean-blue/50 hover:bg-ocean-blue/80 transition-all hover:shadow-glow flex items-center gap-1"
              >
                <FastForward size={16} className="text-cyan-glow" />
                <span className="text-cyan-glow text-sm font-roboto-mono">
                  {playbackSpeed}x
                </span>
              </button>
            </div>
            <span className="text-cyan-glow font-orbitron text-sm glow-text">
              {formatTime(timeRange[1])}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-cyan-dim text-sm">当前时间:</span>
            <span className="text-cyan-glow font-orbitron text-lg glow-text">
              {formatTime(currentTime)}
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="relative h-2 bg-ocean-blue/50 rounded-full overflow-hidden">
            <motion.div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-dim to-cyan-glow rounded-full"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />

            <AnimatePresence>
              {anomalyMarkers.map((marker, index) => {
                const markerProgress =
                  ((marker.time - timeRange[0]) / (timeRange[1] - timeRange[0])) * 100;
                const colors: Record<string, string> = {
                  low: '#2ED573',
                  medium: '#FFA502',
                  high: '#FF6348',
                  critical: '#FF4757',
                };

                return (
                  <motion.div
                    key={index}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                    style={{
                      left: `${markerProgress}%`,
                      backgroundColor: colors[marker.level],
                      boxShadow: `0 0 8px ${colors[marker.level]}`,
                    }}
                    title={`${formatTime(marker.time)} - ${marker.level}`}
                  />
                );
              })}
            </AnimatePresence>

            <motion.div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-cyan-glow border-2 border-white shadow-glow cursor-pointer"
              style={{ left: `calc(${progress}% - 8px)` }}
              whileHover={{ scale: 1.3 }}
              whileTap={{ scale: 0.9 }}
            />
          </div>

          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progress}
            onChange={handleSliderChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        <div className="flex justify-between mt-2 px-1">
          {[0, 12, 24, 36, 48, 60, 72].map((hours) => {
            const time = timeRange[0] + hours * 60 * 60 * 1000;
            return (
              <span
                key={hours}
                className="text-cyan-dim/60 text-xs font-roboto-mono"
              >
                {formatTime(time)}
              </span>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
