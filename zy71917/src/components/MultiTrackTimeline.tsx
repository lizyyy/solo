import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useProjectStore } from '@/store/projectStore';

interface MultiTrackTimelineProps {
  width?: number;
  height?: number;
}

const TRACK_HEIGHT = 60;
const TRACK_PADDING = 8;
const LABEL_WIDTH = 100;
const RULER_HEIGHT = 30;

const MultiTrackTimeline: React.FC<MultiTrackTimelineProps> = ({ width = 1200, height = 500 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const [hoveredEntry, setHoveredEntry] = useState<string | null>(null);

  const {
    currentProject,
    tracks,
    entries,
    editPoints,
    issues,
    timeline,
    playback,
    setTimeline,
    setEditingEntry,
    setRightPanel,
  } = useProjectStore();

  const trackColors: Record<string, string> = {
    zh: '#2EC4B6',
    en: '#0F3460',
  };

  const getVisibleEntries = useCallback(() => {
    const { zoom, scrollX } = timeline;
    const pixelsPerSecond = 100 * zoom;
    const visibleStart = scrollX / pixelsPerSecond;
    const visibleEnd = (scrollX + width - LABEL_WIDTH) / pixelsPerSecond;

    return entries.filter(
      (e) => e.endTime >= visibleStart && e.startTime <= visibleEnd
    );
  }, [entries, timeline, width]);

  const getVisibleEditPoints = useCallback(() => {
    const { zoom, scrollX } = timeline;
    const pixelsPerSecond = 100 * zoom;
    const visibleStart = scrollX / pixelsPerSecond;
    const visibleEnd = (scrollX + width - LABEL_WIDTH) / pixelsPerSecond;

    return editPoints.filter(
      (p) => p.time >= visibleStart && p.time <= visibleEnd
    );
  }, [editPoints, timeline, width]);

  const getVisibleIssues = useCallback(() => {
    const { zoom, scrollX } = timeline;
    const pixelsPerSecond = 100 * zoom;
    const visibleStart = scrollX / pixelsPerSecond;
    const visibleEnd = (scrollX + width - LABEL_WIDTH) / pixelsPerSecond;

    return issues.filter(
      (i) => i.status === 'open' && i.endTime >= visibleStart && i.startTime <= visibleEnd
    );
  }, [issues, timeline, width]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentProject) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { zoom, scrollX, playheadPosition } = timeline;
    const pixelsPerSecond = 100 * zoom;

    ctx.fillStyle = '#1A1A2E';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#16213E';
    ctx.fillRect(0, 0, LABEL_WIDTH, height);

    ctx.fillStyle = '#16213E';
    ctx.fillRect(LABEL_WIDTH, 0, width - LABEL_WIDTH, RULER_HEIGHT);

    ctx.strokeStyle = '#2A2A4E';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = LABEL_WIDTH + (i * (width - LABEL_WIDTH)) / 10;
      const time = (scrollX + (i * (width - LABEL_WIDTH)) / 10) / pixelsPerSecond;
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);

      ctx.beginPath();
      ctx.moveTo(x, RULER_HEIGHT - 15);
      ctx.lineTo(x, RULER_HEIGHT);
      ctx.stroke();

      ctx.fillStyle = '#888';
      ctx.font = '10px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${minutes}:${seconds.toString().padStart(2, '0')}`,
        x,
        RULER_HEIGHT - 20
      );
    }

    const audioY = RULER_HEIGHT + TRACK_PADDING;
    ctx.fillStyle = '#1E1E3A';
    ctx.fillRect(LABEL_WIDTH, audioY, width - LABEL_WIDTH, TRACK_HEIGHT);
    ctx.fillStyle = '#444';
    ctx.font = '12px JetBrains Mono';
    ctx.textAlign = 'left';
    ctx.fillText('音轨', 10, audioY + 35);

    const waveCount = Math.floor((width - LABEL_WIDTH) / 3);
    for (let i = 0; i < waveCount; i++) {
      const baseX = LABEL_WIDTH + i * 3;
      const barHeight = (Math.sin(i * 0.1 + scrollX * 0.01) * 0.5 + 0.5) * (TRACK_HEIGHT - 10);
      const barY = audioY + (TRACK_HEIGHT - barHeight) / 2;
      ctx.fillStyle = '#FF6B35';
      ctx.globalAlpha = 0.6;
      ctx.fillRect(baseX, barY, 2, barHeight);
    }
    ctx.globalAlpha = 1;

    tracks.forEach((track, trackIndex) => {
      const trackY =
        RULER_HEIGHT + TRACK_PADDING * (trackIndex + 2) + TRACK_HEIGHT * (trackIndex + 1);
      const color = trackColors[track.language] || '#666';

      ctx.fillStyle = '#1E1E3A';
      ctx.fillRect(LABEL_WIDTH, trackY, width - LABEL_WIDTH, TRACK_HEIGHT);

      ctx.fillStyle = color;
      ctx.font = '12px JetBrains Mono';
      ctx.textAlign = 'left';
      ctx.fillText(track.label, 10, trackY + 35);

      const trackEntries = entries
        .filter((e) => e.trackId === track.id)
        .filter(
          (e) => e.endTime >= scrollX / pixelsPerSecond && e.startTime <= (scrollX + width - LABEL_WIDTH) / pixelsPerSecond
        );

      trackEntries.forEach((entry) => {
        const entryX = LABEL_WIDTH + (entry.startTime * pixelsPerSecond - scrollX);
        const entryWidth = Math.max(10, (entry.endTime - entry.startTime) * pixelsPerSecond);

        const isHovered = hoveredEntry === entry.id;
        ctx.fillStyle = isHovered ? color : color + 'CC';
        ctx.beginPath();
        ctx.roundRect(entryX, trackY + 5, entryWidth, TRACK_HEIGHT - 10, 4);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = '11px Noto Sans SC';
        ctx.textAlign = 'left';
        const displayText = entry.text.length > 30 ? entry.text.slice(0, 30) + '...' : entry.text;
        ctx.fillText(displayText, entryX + 5, trackY + 28);

        if (entry.isManuallyAdjusted) {
          ctx.strokeStyle = '#FF6B35';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.roundRect(entryX, trackY + 5, entryWidth, TRACK_HEIGHT - 10, 4);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    });

    const editPointsY =
      RULER_HEIGHT + TRACK_PADDING * (tracks.length + 2) + TRACK_HEIGHT * (tracks.length + 1);

    ctx.fillStyle = '#1E1E3A';
    ctx.fillRect(LABEL_WIDTH, editPointsY, width - LABEL_WIDTH, TRACK_HEIGHT);
    ctx.fillStyle = '#888';
    ctx.font = '12px JetBrains Mono';
    ctx.textAlign = 'left';
    ctx.fillText('剪辑点 / 口播', 10, editPointsY + 35);

    const visiblePoints = getVisibleEditPoints();
    visiblePoints.forEach((point) => {
      const pointX = LABEL_WIDTH + (point.time * pixelsPerSecond - scrollX);
      const color = point.type === 'cut' ? '#E94560' : point.type === 'ad' ? '#FF6B35' : '#0F3460';

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(pointX, editPointsY + 10);
      ctx.lineTo(pointX - 6, editPointsY + 25);
      ctx.lineTo(pointX + 6, editPointsY + 25);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(pointX, editPointsY + 25);
      ctx.lineTo(pointX, editPointsY + TRACK_HEIGHT - 5);
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.stroke();
    });

    const visibleIssuesList = getVisibleIssues();
    visibleIssuesList.forEach((issue) => {
      const issueX = LABEL_WIDTH + (issue.startTime * pixelsPerSecond - scrollX);
      const color = issue.severity === 'error' ? '#E94560' : issue.severity === 'warning' ? '#FF6B35' : '#0F3460';
      const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;

      ctx.beginPath();
      ctx.arc(issueX, RULER_HEIGHT + 15, 8 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.8;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.beginPath();
      ctx.arc(issueX, RULER_HEIGHT + 15, 12, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    const playheadX = LABEL_WIDTH + (playheadPosition * pixelsPerSecond - scrollX);
    ctx.strokeStyle = '#FF6B35';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, RULER_HEIGHT);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    ctx.fillStyle = '#FF6B35';
    ctx.beginPath();
    ctx.moveTo(playheadX - 8, RULER_HEIGHT);
    ctx.lineTo(playheadX, RULER_HEIGHT + 12);
    ctx.lineTo(playheadX + 8, RULER_HEIGHT);
    ctx.closePath();
    ctx.fill();
  }, [currentProject, tracks, entries, editPoints, timeline, width, height, hoveredEntry, getVisibleEditPoints, getVisibleIssues]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (x < LABEL_WIDTH) return;

      const { zoom, scrollX } = timeline;
      const pixelsPerSecond = 100 * zoom;

      const clickedTime = (x - LABEL_WIDTH + scrollX) / pixelsPerSecond;

      for (let ti = 0; ti < tracks.length; ti++) {
        const trackY =
          RULER_HEIGHT + TRACK_PADDING * (ti + 2) + TRACK_HEIGHT * (ti + 1);
        if (y >= trackY + 5 && y <= trackY + TRACK_HEIGHT - 5) {
          const track = tracks[ti];
          const trackEntries = entries.filter((e) => e.trackId === track.id);

          for (const entry of trackEntries) {
            if (clickedTime >= entry.startTime && clickedTime <= entry.endTime) {
              setEditingEntry(entry);
              setRightPanel('edit');
              return;
            }
          }
        }
      }

      setTimeline({ playheadPosition: clickedTime });
    },
    [tracks, entries, timeline, setTimeline, setEditingEntry, setRightPanel]
  );

  useEffect(() => {
    const animate = () => {
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [draw]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom, scrollX } = timeline;
      const pixelsPerSecond = 100 * zoom;

      if (e.ctrlKey || e.metaKey) {
        const newZoom = Math.max(0.1, Math.min(10, zoom - e.deltaY * 0.001));
        setTimeline({ zoom: newZoom });
      } else {
        const maxScroll = currentProject ? currentProject.audioDuration * pixelsPerSecond - (width - LABEL_WIDTH) : 0;
        const newScrollX = Math.max(0, Math.min(maxScroll, scrollX + e.deltaX));
        setTimeline({ scrollX: newScrollX });
      }
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => canvas?.removeEventListener('wheel', handleWheel);
  }, [timeline, currentProject, width, setTimeline]);

  const handleDrag = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.buttons !== 1) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      if (x < LABEL_WIDTH) return;

      const { zoom, scrollX } = timeline;
      const pixelsPerSecond = 100 * zoom;
      const clickedTime = (x - LABEL_WIDTH + scrollX) / pixelsPerSecond;

      setTimeline({ playheadPosition: clickedTime });
    },
    [timeline, setTimeline]
  );

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-lg border border-[#2A2A4E]" style={{ width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleClick}
        onMouseMove={handleDrag}
        className="cursor-crosshair"
      />
    </div>
  );
};

export default MultiTrackTimeline;
