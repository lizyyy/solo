import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Gauge } from 'lucide-react';
import { formatTime } from '@/utils/math';

interface TimelineControlsProps {
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  playSpeed: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onSpeedChange: (speed: number) => void;
}

export const TimelineControls: React.FC<TimelineControlsProps> = ({
  currentTime,
  totalDuration,
  isPlaying,
  playSpeed,
  onPlayPause,
  onSeek,
  onStepForward,
  onStepBackward,
  onSpeedChange,
}) => {
  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div
      style={{
        backgroundColor: '#16213e',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <button
          onClick={onStepBackward}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#e94560',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <SkipBack size={20} />
        </button>

        <button
          onClick={onPlayPause}
          style={{
            backgroundColor: '#e94560',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            padding: '10px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#c73e54')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#e94560')}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          {isPlaying ? '暂停' : '播放'}
        </button>

        <button
          onClick={onStepForward}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#e94560',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <SkipForward size={20} />
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginLeft: '16px',
            backgroundColor: '#1a1a2e',
            padding: '6px 12px',
            borderRadius: '6px',
          }}
        >
          <Gauge size={16} color="#8888aa" />
          <select
            value={playSpeed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#aaaacc',
              fontSize: '13px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value={0.25} style={{ backgroundColor: '#1a1a2e' }}>0.25x</option>
            <option value={0.5} style={{ backgroundColor: '#1a1a2e' }}>0.5x</option>
            <option value={1} style={{ backgroundColor: '#1a1a2e' }}>1x</option>
            <option value={2} style={{ backgroundColor: '#1a1a2e' }}>2x</option>
            <option value={4} style={{ backgroundColor: '#1a1a2e' }}>4x</option>
          </select>
        </div>

        <div
          style={{
            marginLeft: 'auto',
            fontFamily: '"SF Mono", Monaco, "Cascadia Code", monospace',
            fontSize: '14px',
            color: '#0f3460',
            backgroundColor: '#e94560',
            padding: '6px 12px',
            borderRadius: '4px',
            fontWeight: '600',
          }}
        >
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </div>
      </div>

      <div style={{ position: 'relative', height: '24px' }}>
        <input
          type="range"
          min={0}
          max={totalDuration || 100}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          style={{
            position: 'absolute',
            width: '100%',
            height: '6px',
            top: '9px',
            appearance: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            zIndex: 2,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '9px',
            left: 0,
            right: 0,
            height: '6px',
            backgroundColor: '#1a1a2e',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              backgroundColor: '#e94560',
              borderRadius: '3px',
              transition: 'width 0.1s linear',
            }}
          />
        </div>
      </div>
    </div>
  );
};
