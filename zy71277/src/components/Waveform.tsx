import { useEffect, useRef, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../store/appStore';
import type { BeatPoint, AnomalyRegion } from '../../shared/types';

interface WaveformProps {
  waveform: number[];
  duration: number;
  beatPoints?: BeatPoint[];
  selectedAnomalies?: AnomalyRegion[];
}

export default function Waveform({
  waveform,
  duration,
  beatPoints: propsBeatPoints,
  selectedAnomalies = [],
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragBeatId, setDragBeatId] = useState<string | null>(null);

  const {
    zoomLevel,
    scrollOffset,
    voicePart,
    beatPoints: storeBeatPoints,
    addBeatPoint,
    updateBeatPoint,
    setScrollOffset,
  } = useAppStore();

  const beatPoints = propsBeatPoints || storeBeatPoints;
  const canvasWidth = 800;
  const canvasHeight = 200;
  const timeAxisHeight = 30;
  const totalHeight = canvasHeight + timeAxisHeight;

  const visibleDuration = duration / zoomLevel;
  const startTime = scrollOffset * duration;
  const endTime = startTime + visibleDuration;

  const timeToX = useCallback((timeMs: number) => {
    const timeSec = timeMs / 1000;
    const relativeTime = (timeSec - startTime) / visibleDuration;
    return relativeTime * canvasWidth;
  }, [startTime, visibleDuration]);

  const xToTime = useCallback((x: number) => {
    const relativeX = x / canvasWidth;
    return (startTime + relativeX * visibleDuration) * 1000;
  }, [startTime, visibleDuration]);

  const drawWaveform = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#16213E';
    ctx.fillRect(0, 0, canvasWidth, totalHeight);

    if (waveform.length === 0) return;

    const samplesPerPixel = Math.floor(waveform.length / (duration * zoomLevel));
    const startSample = Math.floor((scrollOffset * duration) * (waveform.length / duration));
    const visibleSamples = Math.floor(canvasWidth * samplesPerPixel);
    const endSample = Math.min(startSample + visibleSamples, waveform.length);

    ctx.strokeStyle = '#9494A3';
    ctx.lineWidth = 1;
    ctx.beginPath();

    const centerY = canvasHeight / 2;
    const amplitude = canvasHeight / 2 - 10;

    for (let x = 0; x < canvasWidth; x++) {
      const sampleIndex = startSample + Math.floor((x / canvasWidth) * visibleSamples);
      if (sampleIndex >= endSample) break;

      const chunkStart = Math.max(0, sampleIndex - Math.floor(samplesPerPixel / 2));
      const chunkEnd = Math.min(waveform.length, sampleIndex + Math.floor(samplesPerPixel / 2));

      let min = 1;
      let max = -1;

      for (let i = chunkStart; i < chunkEnd; i++) {
        const val = waveform[i];
        if (val < min) min = val;
        if (val > max) max = val;
      }

      const yMin = centerY - min * amplitude;
      const yMax = centerY - max * amplitude;

      ctx.moveTo(x, yMin);
      ctx.lineTo(x, yMax);
    }

    ctx.stroke();
  }, [waveform, duration, zoomLevel, scrollOffset]);

  const drawAnomalies = useCallback((ctx: CanvasRenderingContext2D) => {
    selectedAnomalies.forEach((anomaly) => {
      const startX = timeToX(anomaly.startMs);
      const endX = timeToX(anomaly.endMs);

      if (endX < 0 || startX > canvasWidth) return;

      const x = Math.max(0, startX);
      const width = Math.min(canvasWidth, endX) - x;

      ctx.fillStyle = 'rgba(245, 166, 35, 0.3)';
      ctx.fillRect(x, 0, width, canvasHeight);
    });
  }, [selectedAnomalies, timeToX]);

  const drawBeatPoints = useCallback((ctx: CanvasRenderingContext2D) => {
    const filteredBeats = beatPoints.filter((b) => b.voicePart === voicePart);

    filteredBeats.forEach((beat) => {
      const x = timeToX(beat.timeMs);

      if (x < 0 || x > canvasWidth) return;

      const isLowConfidence = beat.confidence < 0.6;
      const color = isLowConfidence ? '#F5A623' : '#00F5D4';

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();

      const diamondSize = 8;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, canvasHeight / 2 - diamondSize);
      ctx.lineTo(x + diamondSize, canvasHeight / 2);
      ctx.lineTo(x, canvasHeight / 2 + diamondSize);
      ctx.lineTo(x - diamondSize, canvasHeight / 2);
      ctx.closePath();
      ctx.fill();
    });
  }, [beatPoints, voicePart, timeToX]);

  const drawTimeAxis = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#16213E';
    ctx.fillRect(0, canvasHeight, canvasWidth, timeAxisHeight);

    ctx.strokeStyle = '#3A3A4A';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvasHeight);
    ctx.lineTo(canvasWidth, canvasHeight);
    ctx.stroke();

    const interval = getTimeInterval(visibleDuration);
    const firstTick = Math.ceil(startTime / interval) * interval;

    ctx.fillStyle = '#9494A3';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.textAlign = 'center';

    for (let t = firstTick; t <= endTime; t += interval) {
      const x = timeToX(t * 1000);

      if (x < 0 || x > canvasWidth) continue;

      ctx.beginPath();
      ctx.moveTo(x, canvasHeight);
      ctx.lineTo(x, canvasHeight + 8);
      ctx.stroke();

      const minutes = Math.floor(t / 60);
      const seconds = Math.floor(t % 60);
      const label = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      ctx.fillText(label, x, canvasHeight + 22);
    }
  }, [startTime, endTime, visibleDuration, timeToX]);

  const drawHoverIndicator = useCallback((ctx: CanvasRenderingContext2D) => {
    if (hoverTime === null) return;

    const x = timeToX(hoverTime);

    if (x < 0 || x > canvasWidth) return;

    ctx.strokeStyle = 'rgba(232, 232, 236, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [hoverTime, timeToX]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, totalHeight);

    drawWaveform(ctx);
    drawAnomalies(ctx);
    drawBeatPoints(ctx);
    drawTimeAxis(ctx);
    drawHoverIndicator(ctx);
  }, [drawWaveform, drawAnomalies, drawBeatPoints, drawTimeAxis, drawHoverIndicator]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scaleX = canvasWidth / rect.width;
    const canvasX = x * scaleX;

    if (isDragging && dragBeatId) {
      const newTimeMs = xToTime(canvasX);
      updateBeatPoint(dragBeatId, { timeMs: Math.max(0, newTimeMs) });
    } else {
      const timeMs = xToTime(canvasX);
      setHoverTime(timeMs);
      setHoverX(e.clientX);
    }
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
    if (isDragging) {
      setIsDragging(false);
      setDragBeatId(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scaleX = canvasWidth / rect.width;
    const canvasX = x * scaleX;
    const timeMs = xToTime(canvasX);

    const filteredBeats = beatPoints.filter((b) => b.voicePart === voicePart);
    const clickedBeat = filteredBeats.find((beat) => {
      const beatX = timeToX(beat.timeMs);
      return Math.abs(canvasX - beatX) < 10;
    });

    if (clickedBeat) {
      setIsDragging(true);
      setDragBeatId(clickedBeat.id);
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      setDragBeatId(null);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const audioFile = useAppStore.getState().audioFile;
    if (!audioFile) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scaleX = canvasWidth / rect.width;
    const canvasX = x * scaleX;
    const timeMs = xToTime(canvasX);

    const filteredBeats = beatPoints.filter((b) => b.voicePart === voicePart);
    const existingBeat = filteredBeats.find((beat) => {
      const beatX = timeToX(beat.timeMs);
      return Math.abs(canvasX - beatX) < 10;
    });

    if (!existingBeat) {
      const newBeat: BeatPoint = {
        id: uuidv4(),
        audioId: audioFile.id,
        voicePart,
        timeMs: Math.max(0, timeMs),
        confidence: 1.0,
        isManual: true,
      };
      addBeatPoint(newBeat);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const maxOffset = 1 - 1 / zoomLevel;
    const scrollDelta = (e.deltaY / canvasWidth) * (1 / zoomLevel);
    const newOffset = Math.max(0, Math.min(maxOffset, scrollOffset + scrollDelta));
    setScrollOffset(newOffset);
  };

  const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor((totalSeconds % 1) * 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={totalHeight}
        className="w-full rounded-lg cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
      />
      {hoverTime !== null && (
        <div
          className="absolute top-2 px-2 py-1 bg-charcoal-900 text-xs font-mono rounded pointer-events-none"
          style={{
            left: `${(hoverX - containerRef.current?.getBoundingClientRect().left || 0)}px`,
            transform: 'translateX(-50%)',
          }}
        >
          {formatTime(hoverTime)}
        </div>
      )}
    </div>
  );
}

function getTimeInterval(visibleDuration: number): number {
  if (visibleDuration <= 5) return 0.5;
  if (visibleDuration <= 15) return 1;
  if (visibleDuration <= 30) return 2;
  if (visibleDuration <= 60) return 5;
  if (visibleDuration <= 120) return 10;
  if (visibleDuration <= 300) return 30;
  return 60;
}
