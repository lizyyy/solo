import { useState, useEffect, useCallback } from 'react';
import { PlaybackState } from '../types';
import './PlaybackControls.css';

interface PlaybackControlsProps {
  playback: PlaybackState;
  drillDuration: number;
  onPlaybackChange: (playback: PlaybackState) => void;
}

const PlaybackControls = ({ playback, drillDuration, onPlaybackChange }: PlaybackControlsProps) => {
  const [displayTime, setDisplayTime] = useState(playback.currentTime);

  useEffect(() => {
    setDisplayTime(playback.currentTime);
  }, [playback.currentTime]);

  // 播放/暂停
  const togglePlay = useCallback(() => {
    onPlaybackChange({
      ...playback,
      isPlaying: !playback.isPlaying
    });
  }, [playback, onPlaybackChange]);

  // 跳转到开始
  const goToStart = useCallback(() => {
    onPlaybackChange({
      ...playback,
      currentTime: playback.startTime,
      isPlaying: false
    });
  }, [playback, onPlaybackChange]);

  // 跳转结束
  const goToEnd = useCallback(() => {
    onPlaybackChange({
      ...playback,
      currentTime: playback.endTime,
      isPlaying: false
    });
  }, [playback, onPlaybackChange]);

  // 快进/快退
  const adjustTime = useCallback((delta: number) => {
    const newTime = Math.max(
      playback.startTime,
      Math.min(playback.endTime, playback.currentTime + delta)
    );
    onPlaybackChange({
      ...playback,
      currentTime: newTime
    });
  }, [playback, onPlaybackChange]);

  // 倍速切换
  const cycleSpeed = useCallback(() => {
    const speeds = [0.5, 1, 2, 5, 10];
    const currentIndex = speeds.indexOf(playback.speed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    onPlaybackChange({
      ...playback,
      speed: speeds[nextIndex]
    });
  }, [playback, onPlaybackChange]);

  // 滑块变化
  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const progress = parseFloat(e.target.value);
    const newTime = playback.startTime + (progress / 100) * (playback.endTime - playback.startTime);
    setDisplayTime(newTime);
  }, [playback]);

  const handleSliderRelease = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    const progress = parseFloat((e.target as HTMLInputElement).value);
    const newTime = playback.startTime + (progress / 100) * (playback.endTime - playback.startTime);
    onPlaybackChange({
      ...playback,
      currentTime: newTime
    });
  }, [playback, onPlaybackChange]);

  // 格式化时间显示
  const formatTime = (timestamp: number): string => {
    const relativeMs = timestamp - playback.startTime;
    const seconds = Math.floor(relativeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 计算进度百分比
  const progressPercent = playback.startTime !== playback.endTime
    ? ((playback.currentTime - playback.startTime) / (playback.endTime - playback.startTime)) * 100
    : 0;

  const displayProgressPercent = playback.startTime !== playback.endTime
    ? ((displayTime - playback.startTime) / (playback.endTime - playback.startTime)) * 100
    : 0;

  return (
    <div className="playback-controls">
      {/* 时间轴 */}
      <div className="timeline">
        <div className="time-labels">
          <span className="time-label">{formatTime(playback.startTime)}</span>
          <span className="time-label">{formatTime(playback.currentTime)}</span>
          <span className="time-label">{formatTime(playback.endTime)}</span>
        </div>
        
        <div className="slider-container">
          <div 
            className="slider-progress"
            style={{ width: `${progressPercent}%` }}
          />
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={displayProgressPercent}
            onChange={handleSliderChange}
            onMouseUp={handleSliderRelease}
            onTouchEnd={handleSliderRelease as unknown as (e: React.TouchEvent<HTMLInputElement>) => void}
            className="time-slider"
          />
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="controls-row">
        <div className="playback-buttons">
          {/* 回到开始 */}
          <button
            className="control-btn icon-btn"
            onClick={goToStart}
            title="回到开始"
          >
            ⏮
          </button>

          {/* 后退 */}
          <button
            className="control-btn icon-btn"
            onClick={() => adjustTime(-5000)}
            title="后退 5 秒"
          >
            ⏪
          </button>

          {/* 播放/暂停 */}
          <button
            className="control-btn play-btn"
            onClick={togglePlay}
            title={playback.isPlaying ? '暂停' : '播放'}
          >
            {playback.isPlaying ? '⏸' : '▶'}
          </button>

          {/* 前进 */}
          <button
            className="control-btn icon-btn"
            onClick={() => adjustTime(5000)}
            title="前进 5 秒"
          >
            ⏩
          </button>

          {/* 到结束 */}
          <button
            className="control-btn icon-btn"
            onClick={goToEnd}
            title="到结束"
          >
            ⏭
          </button>
        </div>

        <div className="speed-controls">
          <button
            className="control-btn speed-btn"
            onClick={cycleSpeed}
            title="播放速度"
          >
            {playback.speed}x
          </button>
        </div>

        {/* 当前时间显示 */}
        <div className="current-time-display">
          <span className="time-text">
            {new Date(playback.currentTime).toLocaleString('zh-CN', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PlaybackControls;
