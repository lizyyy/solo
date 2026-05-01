import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Source, Event, CalibrationResult, PlaybackState } from '../types';
import { getEventTypeLabel } from '../models';
import { calculateTimelineBounds, applyOffsetsToEvents } from '../timeline';

interface TimelineViewProps {
  sources: Source[];
  events: Event[];
  calibrationResults: CalibrationResult[];
  playbackState: PlaybackState;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSetSpeed: (speed: number) => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({
  sources,
  events,
  calibrationResults,
  playbackState,
  onPlayPause,
  onSeek,
  onSetSpeed
}) => {
  const [hoveredEvent, setHoveredEvent] = useState<Event | null>(null);
  const [showCalibrated, setShowCalibrated] = useState(true);
  const timelineRef = useRef<HTMLDivElement>(null);

  const bounds = calculateTimelineBounds(events);
  const displayEvents = showCalibrated && calibrationResults.length > 0
    ? applyOffsetsToEvents(events, calibrationResults)
    : events.map(e => ({ ...e, offsetTimestamp: e.timestamp }));

  const effectiveBounds = calculateTimelineBounds(
    displayEvents.map(e => ({ ...e, timestamp: e.offsetTimestamp }))
  );

  const formatTime = (ms: number): string => {
    if (ms < 1000) {
      return `${ms.toFixed(0)}ms`;
    }
    const seconds = ms / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(2)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
  };

  const getEventPosition = useCallback((timestamp: number): number => {
    if (effectiveBounds.duration === 0) return 0;
    const relative = (timestamp - effectiveBounds.startTime) / effectiveBounds.duration;
    return Math.max(0, Math.min(1, relative));
  }, [effectiveBounds]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width;
    const time = effectiveBounds.startTime + relativeX * effectiveBounds.duration;
    onSeek(time);
  }, [effectiveBounds, onSeek]);

  const generateTicks = useCallback(() => {
    if (effectiveBounds.duration === 0) return [];
    
    const ticks: { time: number; label: string }[] = [];
    const targetTickCount = 10;
    const roughInterval = effectiveBounds.duration / targetTickCount;
    
    let interval = 1;
    if (roughInterval > 5000) interval = 5000;
    else if (roughInterval > 2000) interval = 2000;
    else if (roughInterval > 1000) interval = 1000;
    else if (roughInterval > 500) interval = 500;
    else if (roughInterval > 200) interval = 200;
    else if (roughInterval > 100) interval = 100;
    else if (roughInterval > 50) interval = 50;
    else interval = 10;

    const startTick = Math.floor(effectiveBounds.startTime / interval) * interval;
    for (let t = startTick; t <= effectiveBounds.endTime; t += interval) {
      ticks.push({
        time: t,
        label: formatTime(t - effectiveBounds.startTime)
      });
    }

    return ticks;
  }, [effectiveBounds]);

  const ticks = generateTicks();

  const getPlayheadPosition = useCallback((): number => {
    if (effectiveBounds.duration === 0) return 0;
    return getEventPosition(playbackState.currentTime);
  }, [playbackState.currentTime, effectiveBounds, getEventPosition]);

  const trackHeight = 60;

  return (
    <div className="timeline-container">
      <div className="timeline-controls">
        <div className="playback-controls">
          <button 
            className="btn btn-icon btn-secondary"
            onClick={() => onSeek(effectiveBounds.startTime)}
            title="跳到开头"
          >
            ⏮
          </button>
          
          <button 
            className={`btn btn-icon ${playbackState.isPlaying ? 'btn-primary' : 'btn-secondary'}`}
            onClick={onPlayPause}
            title={playbackState.isPlaying ? '暂停' : '播放'}
          >
            {playbackState.isPlaying ? '⏸' : '▶'}
          </button>
          
          <button 
            className="btn btn-icon btn-secondary"
            onClick={() => onSeek(effectiveBounds.endTime)}
            title="跳到结尾"
          >
            ⏭
          </button>

          <select 
            className="form-select"
            style={{ width: '80px', padding: '6px 10px' }}
            value={playbackState.speed}
            onChange={(e) => onSetSpeed(parseFloat(e.target.value))}
          >
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>

          <div className="checkbox">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={showCalibrated}
                onChange={(e) => setShowCalibrated(e.target.checked)}
              />
              <span style={{ fontSize: '12px' }}>
                {showCalibrated ? '已校准视图' : '原始视图'}
              </span>
            </label>
          </div>
        </div>

        <div className="time-display">
          {formatTime(playbackState.currentTime - effectiveBounds.startTime)} 
          <span style={{ color: 'var(--text-muted)' }}> / </span>
          {formatTime(effectiveBounds.duration)}
        </div>
      </div>

      <div className="timeline-view">
        {sources.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">暂无数据</div>
            <div className="empty-state-text">
              添加源和事件后，时间线将显示在这里。
              导入示例数据来体验完整功能。
            </div>
          </div>
        ) : (
          <>
            <div className="timeline-ruler">
              <div className="timeline-ruler-ticks">
                {ticks.map((tick, index) => (
                  <div
                    key={index}
                    className="tick-mark"
                    style={{ left: `${getEventPosition(tick.time) * 100}%` }}
                  >
                    <div className="tick-label">{tick.label}</div>
                  </div>
                ))}
              </div>
              
              {playbackState.isPlaying && (
                <div 
                  className="playhead"
                  style={{ 
                    left: `${getPlayheadPosition() * 100}%`,
                    transform: 'translateX(-50%)'
                  }}
                />
              )}
            </div>

            <div 
              className="timeline-tracks"
              ref={timelineRef}
            >
              {sources.map((source, index) => {
                const sourceEvents = displayEvents.filter(e => e.sourceId === source.id);
                
                return (
                  <div 
                    key={source.id} 
                    className="timeline-track"
                    style={{ height: trackHeight }}
                  >
                    <div className="track-header">
                      <span 
                        style={{ 
                          width: '8px', 
                          height: '8px', 
                          borderRadius: '2px', 
                          backgroundColor: source.color,
                          flexShrink: 0
                        }} 
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {source.name}
                      </span>
                    </div>
                    
                    <div className="track-content">
                      {sourceEvents.map(event => {
                        const position = getEventPosition(event.offsetTimestamp);
                        
                        return (
                          <div
                            key={event.id}
                            className={`event-marker ${event.type}`}
                            style={{
                              left: `${position * 100}%`
                            }}
                            onMouseEnter={() => setHoveredEvent(event)}
                            onMouseLeave={() => setHoveredEvent(null)}
                            title={`${getEventTypeLabel(event.type)}: ${event.timestamp}ms`}
                          />
                        );
                      })}
                      
                      {playbackState.isPlaying && (
                        <div 
                          className="playhead"
                          style={{ 
                            left: `${getPlayheadPosition() * 100}%`,
                            transform: 'translateX(-50%)',
                            top: 0,
                            height: '100%'
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {sources.length === 0 && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--text-muted)'
                }}>
                  没有源数据
                </div>
              )}
            </div>

            {hoveredEvent && (
              <div 
                className="tooltip"
                style={{
                  position: 'fixed',
                  bottom: '80px',
                  left: '50%',
                  transform: 'translateX(-50%)'
                }}
              >
                <div className="tooltip-title">
                  {getEventTypeLabel(hoveredEvent.type)}
                </div>
                <div className="tooltip-content">
                  <div>原始时间戳: {hoveredEvent.timestamp.toFixed(2)}ms</div>
                  {showCalibrated && 'offsetTimestamp' in hoveredEvent && (
                    <div>校准后时间戳: {(hoveredEvent as any).offsetTimestamp.toFixed(2)}ms</div>
                  )}
                  {hoveredEvent.value !== undefined && (
                    <div>值: {hoveredEvent.value.toFixed(4)}</div>
                  )}
                  {hoveredEvent.description && (
                    <div>描述: {hoveredEvent.description}</div>
                  )}
                  <div>置信度: {(hoveredEvent.confidence * 100).toFixed(1)}%</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {effectiveBounds.duration > 0 && (
        <div 
          className="timeline-progress-bar"
          onClick={handleProgressClick}
        >
          <div 
            className="progress-fill"
            style={{ 
              width: `${getPlayheadPosition() * 100}%` 
            }}
          />
        </div>
      )}
    </div>
  );
};

export default TimelineView;
