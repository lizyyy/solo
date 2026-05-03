import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { Subtitle, AudioMarker, ProgramSegment } from '../types';
import { formatTimeDisplay } from '../utils/timeUtils';
import './Timeline.css';

interface TimelineProps {
  onSelectSubtitle: (subtitle: Subtitle) => void;
}

export function Timeline({ onSelectSubtitle }: TimelineProps) {
  const { state, dispatch } = useAppContext();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragInfo, setDragInfo] = useState<{
    subtitleId: string;
    edge: 'start' | 'end' | 'both';
    startTime: number;
    startX: number;
  } | null>(null);

  const totalDuration = Math.max(
    ...state.audioMarkers.map((m) => m.endTime),
    ...state.subtitles.map((s) => s.endTime),
    ...state.programSegments.map((s) => s.endTime),
    30
  );

  const getTimeFromX = useCallback(
    (x: number): number => {
      if (!timelineRef.current) return 0;
      const rect = timelineRef.current.getBoundingClientRect();
      const relativeX = x - rect.left;
      const scale = totalDuration * zoom / rect.width;
      return Math.max(0, relativeX * scale);
    },
    [totalDuration, zoom]
  );

  const getXFromTime = useCallback(
    (time: number): number => {
      if (!timelineRef.current) return 0;
      const rect = timelineRef.current.getBoundingClientRect();
      const scale = rect.width / (totalDuration * zoom);
      return time * scale;
    },
    [totalDuration, zoom]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, subtitle: Subtitle, edge: 'start' | 'end' | 'both') => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      setDragInfo({
        subtitleId: subtitle.id,
        edge,
        startTime: edge === 'start' ? subtitle.startTime : edge === 'end' ? subtitle.endTime : subtitle.startTime,
        startX: e.clientX,
      });
      onSelectSubtitle(subtitle);
    },
    [onSelectSubtitle]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragInfo) return;

      const subtitle = state.subtitles.find((s) => s.id === dragInfo.subtitleId);
      if (!subtitle) return;

      const deltaTime = getTimeFromX(e.clientX) - getTimeFromX(dragInfo.startX);
      
      let newStartTime = subtitle.startTime;
      let newEndTime = subtitle.endTime;

      if (dragInfo.edge === 'start') {
        newStartTime = Math.max(0, dragInfo.startTime + deltaTime);
        if (newStartTime >= subtitle.endTime - 0.1) {
          newStartTime = subtitle.endTime - 0.1;
        }
      } else if (dragInfo.edge === 'end') {
        newEndTime = Math.max(subtitle.startTime + 0.1, dragInfo.startTime + deltaTime);
      } else {
        const duration = subtitle.endTime - subtitle.startTime;
        newStartTime = Math.max(0, dragInfo.startTime + deltaTime);
        newEndTime = newStartTime + duration;
      }

      dispatch({
        type: 'UPDATE_SUBTITLE',
        payload: {
          id: subtitle.id,
          updates: {
            startTime: newStartTime,
            endTime: newEndTime,
          },
        },
      });
    },
    [isDragging, dragInfo, state.subtitles, getTimeFromX, dispatch]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setDragInfo(null);
      dispatch({ type: 'VALIDATE' });
    }
  }, [isDragging, dispatch]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const renderTimeRuler = () => {
    const markers: JSX.Element[] = [];
    const interval = totalDuration > 60 ? 10 : totalDuration > 30 ? 5 : 2;
    
    for (let t = 0; t <= totalDuration * zoom; t += interval) {
      const x = getXFromTime(t);
      markers.push(
        <div key={t} className="time-marker" style={{ left: x }}>
          <div className="time-tick" />
          <span className="time-label">{formatTimeDisplay(t)}</span>
        </div>
      );
    }
    return markers;
  };

  const renderAudioMarkers = () => {
    return state.audioMarkers.map((marker, index) => (
      <div
        key={marker.id}
        className={`audio-marker ${marker.type}`}
        style={{
          left: getXFromTime(marker.startTime),
          width: getXFromTime(marker.endTime) - getXFromTime(marker.startTime),
        }}
        title={`${marker.type === 'speech' ? '说话' : '静音'}: ${formatTimeDisplay(marker.startTime)} - ${formatTimeDisplay(marker.endTime)}`}
      >
        <span className="marker-label">{marker.type === 'speech' ? '🎤' : '🔇'}</span>
      </div>
    ));
  };

  const renderProgramSegments = () => {
    return state.programSegments.map((segment, index) => {
      const colors = [
        'rgba(102, 126, 234, 0.15)',
        'rgba(16, 185, 129, 0.15)',
        'rgba(245, 158, 11, 0.15)',
        'rgba(239, 68, 68, 0.15)',
      ];
      return (
        <div
          key={segment.id}
          className="program-segment"
          style={{
            left: getXFromTime(segment.startTime),
            width: getXFromTime(segment.endTime) - getXFromTime(segment.startTime),
            backgroundColor: colors[index % colors.length],
          }}
        >
          <span className="segment-label">{segment.name}</span>
        </div>
      );
    });
  };

  const renderSubtitles = () => {
    return state.subtitles.map((subtitle) => {
      const isSelected = state.selectedSubtitleId === subtitle.id;
      const hasIssue = state.validationIssues.some((i) => i.subtitleId === subtitle.id);
      const isModified = subtitle.isModified;

      return (
        <div
          key={subtitle.id}
          className={`subtitle-block ${isSelected ? 'selected' : ''} ${hasIssue ? 'has-issue' : ''} ${isModified ? 'modified' : ''}`}
          style={{
            left: getXFromTime(subtitle.startTime),
            width: Math.max(10, getXFromTime(subtitle.endTime) - getXFromTime(subtitle.startTime)),
          }}
          onClick={() => onSelectSubtitle(subtitle)}
          onMouseDown={(e) => handleMouseDown(e, subtitle, 'both')}
        >
          <div
            className="handle left-handle"
            onMouseDown={(e) => handleMouseDown(e, subtitle, 'start')}
          />
          <div className="subtitle-content">
            <span className="subtitle-index">#{subtitle.index}</span>
            <span className="subtitle-text">{subtitle.text.substring(0, 20)}</span>
          </div>
          <div
            className="handle right-handle"
            onMouseDown={(e) => handleMouseDown(e, subtitle, 'end')}
          />
        </div>
      );
    });
  };

  if (state.subtitles.length === 0 && state.audioMarkers.length === 0) {
    return (
      <div className="timeline-empty">
        <p>请先导入文件以查看时间轴</p>
      </div>
    );
  }

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <h3>时间轴</h3>
        <div className="zoom-controls">
          <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} className="zoom-btn">
            −
          </button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(Math.min(4, zoom + 0.25))} className="zoom-btn">
            +
          </button>
        </div>
      </div>
      
      <div className="timeline-legend">
        <div className="legend-item">
          <div className="legend-color speech" />
          <span>说话区间</span>
        </div>
        <div className="legend-item">
          <div className="legend-color silence" />
          <span>静音区间</span>
        </div>
        <div className="legend-item">
          <div className="legend-color subtitle" />
          <span>字幕</span>
        </div>
        <div className="legend-item">
          <div className="legend-color has-issue" />
          <span>有问题</span>
        </div>
      </div>

      <div className="time-ruler">
        {renderTimeRuler()}
      </div>

      <div className="timeline-track audio-track">
        <div className="track-label">音频</div>
        <div ref={timelineRef} className="track-content">
          {renderAudioMarkers()}
        </div>
      </div>

      {state.programSegments.length > 0 && (
        <div className="timeline-track segment-track">
          <div className="track-label">段落</div>
          <div className="track-content">
            {renderProgramSegments()}
          </div>
        </div>
      )}

      <div className="timeline-track subtitle-track">
        <div className="track-label">字幕</div>
        <div className="track-content">
          {renderSubtitles()}
        </div>
      </div>

      <div className="timeline-tip">
        💡 拖拽字幕块整体移动，拖拽左右边缘调整时间
      </div>
    </div>
  );
}
