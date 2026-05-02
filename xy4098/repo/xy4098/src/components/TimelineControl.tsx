import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../store';
import { formatTimestamp } from '../utils/dataParser';

export const TimelineControl: React.FC = () => {
  const {
    currentTime,
    timeRange,
    isPlaying,
    playSpeed,
    setCurrentTime,
    setIsPlaying,
    setPlaySpeed,
    sensors,
    thresholds,
    setAlerts,
    alerts,
  } = useAppStore();

  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const getProgress = useCallback((time: number) => {
    if (timeRange.end === timeRange.start) return 0;
    return ((time - timeRange.start) / (timeRange.end - timeRange.start)) * 100;
  }, [timeRange]);

  const getTimeFromProgress = useCallback((progress: number) => {
    return timeRange.start + (timeRange.end - timeRange.start) * (progress / 100);
  }, [timeRange]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const progress = parseFloat(e.target.value);
    const newTime = getTimeFromProgress(progress);
    setCurrentTime(newTime);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const progress = ((e.clientX - rect.left) / rect.width) * 100;
    const time = getTimeFromProgress(progress);
    setHoverTime(time);
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
  };

  useEffect(() => {
    if (isPlaying) {
      const animate = (timestamp: number) => {
        if (lastTimeRef.current === 0) {
          lastTimeRef.current = timestamp;
        }

        const delta = (timestamp - lastTimeRef.current) * playSpeed * 1000;
        lastTimeRef.current = timestamp;

        setCurrentTime((prevTime) => {
          const newTime = prevTime + delta;
          if (newTime >= timeRange.end) {
            setIsPlaying(false);
            return timeRange.end;
          }
          return newTime;
        });

        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      lastTimeRef.current = 0;
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, playSpeed, timeRange.end, setCurrentTime, setIsPlaying]);

  const alertTimestamps = new Set(alerts.map((a) => a.timestamp));

  return (
    <div className="timeline-control">
      <div className="timeline-header">
        <div className="time-display">
          <span className="label">开始时间:</span>
          <span className="value">{formatTimestamp(timeRange.start)}</span>
        </div>
        <div className="play-controls">
          <button
            className="play-btn"
            onClick={() => {
              if (currentTime >= timeRange.end) {
                setCurrentTime(timeRange.start);
              }
              setIsPlaying(!isPlaying);
            }}
          >
            {isPlaying ? '⏸ 暂停' : '▶ 播放'}
          </button>
          <select
            className="speed-select"
            value={playSpeed}
            onChange={(e) => setPlaySpeed(parseFloat(e.target.value))}
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={5}>5x</option>
            <option value={10}>10x</option>
          </select>
        </div>
        <div className="time-display">
          <span className="label">结束时间:</span>
          <span className="value">{formatTimestamp(timeRange.end)}</span>
        </div>
      </div>

      <div
        className="timeline-track"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="timeline-bg">
          <div
            className="timeline-progress"
            style={{ width: `${getProgress(currentTime)}%` }}
          />
          <div className="timeline-marks">
            {Array.from(alertTimestamps).map((ts, i) => (
              <div
                key={i}
                className="alert-mark"
                style={{ left: `${getProgress(ts)}%` }}
                title={`告警 - ${formatTimestamp(ts)}`}
              />
            ))}
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={0.01}
          value={getProgress(currentTime)}
          onChange={handleSliderChange}
          className="timeline-slider"
        />
        {hoverTime !== null && (
          <div
            className="hover-tooltip"
            style={{ left: `${getProgress(hoverTime)}%` }}
          >
            {formatTimestamp(hoverTime)}
          </div>
        )}
      </div>

      <div className="timeline-current">
        <span className="label">当前时间:</span>
        <span className="current-value">{formatTimestamp(currentTime)}</span>
      </div>
    </div>
  );
};
