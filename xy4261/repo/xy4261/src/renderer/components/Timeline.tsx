import React, { useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { 
  getCueStartTime, 
  getCueEndTime, 
  getCueFadeInPeriod, 
  getCueFadeOutPeriod 
} from '../../shared/models';
import { Cue } from '../../shared/models/types';

interface TimelineProps {
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ className }) => {
  const { state, selectCue } = useApp();
  
  const project = state.project;
  const cues = project.cues;
  const selectedCueId = state.selectedCueId;
  
  const sortedCues = useMemo(() => {
    return [...cues].sort((a, b) => a.time - b.time);
  }, [cues]);

  const timeRange = useMemo(() => {
    if (sortedCues.length === 0) {
      return { min: 0, max: 100 };
    }
    
    const minTime = Math.min(...sortedCues.map(c => getCueStartTime(c)));
    const maxTime = Math.max(...sortedCues.map(c => getCueEndTime(c)));
    const padding = (maxTime - minTime) * 0.1 || 10;
    
    return {
      min: Math.max(0, minTime - padding),
      max: maxTime + padding
    };
  }, [sortedCues]);

  const timelineWidth = 800;
  const timeToPixel = (time: number) => {
    const normalized = (time - timeRange.min) / (timeRange.max - timeRange.min);
    return normalized * timelineWidth;
  };

  const getCueColor = (cue: Cue, isSelected: boolean) => {
    if (isSelected) {
      return { bg: 'var(--accent-primary)', border: 'var(--accent-secondary)' };
    }
    if (cue.isBlackout) {
      return { bg: '#333', border: '#555' };
    }
    if (cue.isLocked) {
      return { bg: 'var(--bg-tertiary)', border: 'var(--info)' };
    }
    return { bg: 'var(--bg-secondary)', border: 'var(--border-color)' };
  };

  const renderTimeMarkers = () => {
    const markers: React.ReactNode[] = [];
    const range = timeRange.max - timeRange.min;
    const step = range / 10;
    const roundedStep = Math.max(1, Math.pow(10, Math.floor(Math.log10(step))));
    
    for (let t = Math.ceil(timeRange.min / roundedStep) * roundedStep; t <= timeRange.max; t += roundedStep) {
      const x = timeToPixel(t);
      markers.push(
        <div
          key={t}
          className="time-marker"
          style={{ left: `${x}px` }}
        >
          <div className="time-line"></div>
          <span className="time-label">{t.toFixed(1)}s</span>
        </div>
      );
    }
    
    return markers;
  };

  return (
    <div className={`timeline-container ${className || ''}`}>
      <div className="timeline-header">
        <h3>时间轴</h3>
        {sortedCues.length > 0 && (
          <span className="time-range">
            总时长: {(timeRange.max - timeRange.min).toFixed(1)}s
          </span>
        )}
      </div>
      
      <div className="timeline-wrapper">
        <div className="timeline-axis">
          {renderTimeMarkers()}
        </div>
        
        <div className="timeline-tracks">
          {sortedCues.length === 0 ? (
            <div className="empty-state">
              暂无 Cue，请导入或添加 Cue
            </div>
          ) : (
            <div className="cue-track">
              {sortedCues.map((cue, index) => {
                const isSelected = cue.id === selectedCueId;
                const startTime = getCueStartTime(cue);
                const endTime = getCueEndTime(cue);
                const fadeIn = getCueFadeInPeriod(cue);
                const fadeOut = getCueFadeOutPeriod(cue);
                
                const left = timeToPixel(startTime);
                const width = Math.max(4, timeToPixel(endTime) - timeToPixel(startTime));
                const colors = getCueColor(cue, isSelected);
                
                return (
                  <div
                    key={cue.id}
                    className={`cue-bar ${isSelected ? 'selected' : ''}`}
                    style={{
                      left: `${left}px`,
                      width: `${width}px`,
                      backgroundColor: colors.bg,
                      borderColor: colors.border,
                      top: `${index * 36 + 8}px`
                    }}
                    onClick={() => selectCue(cue.id)}
                  >
                    <div className="cue-bar-content">
                      <span className="cue-number">{cue.number}</span>
                      <span className="cue-name">{cue.name}</span>
                    </div>
                    
                    {cue.fadeIn > 0 && (
                      <div
                        className="fade-indicator fade-in"
                        style={{
                          left: 0,
                          width: `${Math.max(4, timeToPixel(fadeIn.end) - timeToPixel(startTime))}px`
                        }}
                      />
                    )}
                    
                    {cue.fadeOut > 0 && (
                      <div
                        className="fade-indicator fade-out"
                        style={{
                          right: 0,
                          width: `${Math.max(4, timeToPixel(endTime) - timeToPixel(fadeOut.start))}px`
                        }}
                      />
                    )}
                    
                    {cue.isBlackout && (
                      <div className="cue-badge blackout">黑场</div>
                    )}
                    {cue.isLocked && (
                      <div className="cue-badge locked">🔒</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .timeline-container {
          display: flex;
          flex-direction: column;
          background-color: var(--bg-secondary);
          border-radius: 8px;
          border: 1px solid var(--border-color);
          overflow: hidden;
        }

        .timeline-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .timeline-header h3 {
          font-size: 14px;
          font-weight: 600;
          margin: 0;
        }

        .time-range {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .timeline-wrapper {
          position: relative;
          overflow-x: auto;
          overflow-y: hidden;
        }

        .timeline-axis {
          position: relative;
          height: 32px;
          border-bottom: 1px solid var(--border-color);
          min-width: ${timelineWidth}px;
        }

        .time-marker {
          position: absolute;
          top: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .time-line {
          width: 1px;
          height: 8px;
          background-color: var(--border-color);
        }

        .time-label {
          font-size: 10px;
          color: var(--text-secondary);
          margin-top: 4px;
          white-space: nowrap;
        }

        .timeline-tracks {
          position: relative;
          min-height: 120px;
          min-width: ${timelineWidth}px;
        }

        .empty-state {
          padding: 40px;
          text-align: center;
          color: var(--text-secondary);
          font-size: 14px;
        }

        .cue-track {
          position: relative;
          padding: 4px 0;
        }

        .cue-bar {
          position: absolute;
          height: 28px;
          border: 2px solid;
          border-radius: 4px;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
          overflow: hidden;
          min-width: 20px;
        }

        .cue-bar:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
          z-index: 10;
        }

        .cue-bar.selected {
          z-index: 20;
          transform: scale(1.02);
          box-shadow: 0 0 0 2px var(--accent-secondary);
        }

        .cue-bar-content {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 8px;
          height: 100%;
          overflow: hidden;
        }

        .cue-number {
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .cue-name {
          font-size: 11px;
          opacity: 0.8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .fade-indicator {
          position: absolute;
          top: 0;
          bottom: 0;
          pointer-events: none;
        }

        .fade-in {
          background: linear-gradient(90deg, rgba(74, 222, 128, 0.6), transparent);
        }

        .fade-out {
          background: linear-gradient(-90deg, rgba(248, 113, 113, 0.6), transparent);
        }

        .cue-badge {
          position: absolute;
          top: 2px;
          right: 4px;
          padding: 1px 4px;
          border-radius: 2px;
          font-size: 8px;
          font-weight: 600;
        }

        .cue-badge.blackout {
          background-color: rgba(0, 0, 0, 0.8);
          color: white;
        }

        .cue-badge.locked {
          background-color: rgba(96, 165, 250, 0.3);
          color: var(--info);
        }
      `}</style>
    </div>
  );
};
