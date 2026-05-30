import React, { useRef, useEffect, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, ZoomIn, ZoomOut, SkipBack, SkipForward } from 'lucide-react';
import type { Beat, Segment } from '@/types';
import { SEGMENT_COLORS, formatTime } from '@/types';

interface WaveformViewerProps {
  audioUrl: string | null;
  beats: Beat[];
  segments: Segment[];
  onSeek?: (time: number) => void;
  onBeatClick?: (beat: Beat) => void;
  onSegmentClick?: (segment: Segment) => void;
  onAddBeat?: (time: number) => void;
  bestInPoint?: number;
  bestOutPoint?: number;
}

const WaveformViewer: React.FC<WaveformViewerProps> = ({
  audioUrl,
  beats,
  segments,
  onSeek,
  onBeatClick,
  onSegmentClick,
  onAddBeat,
  bestInPoint,
  bestOutPoint,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [zoom, setZoom] = useState(50);

  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#334155',
      progressColor: '#06b6d4',
      cursorColor: '#ec4899',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 128,
      normalize: true,
      backend: 'WebAudio',
    });

    ws.load(audioUrl);

    ws.on('ready', () => {
      setDuration(ws.getDuration());
    });

    ws.on('audioprocess', () => {
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on('seeking', () => {
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    ws.on('interaction', (time: number) => {
      onSeek?.(time);
    });

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [audioUrl, onSeek]);

  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.zoom(zoom);
    }
  }, [zoom]);

  const drawOverlay = useCallback(() => {
    if (!overlayRef.current || !wavesurferRef.current || !duration) return;

    const canvas = overlayRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    segments.forEach((segment) => {
      const startX = (segment.startTime / duration) * width;
      const endX = (segment.endTime / duration) * width;
      const segWidth = endX - startX;

      ctx.fillStyle = `${SEGMENT_COLORS[segment.type]}20`;
      ctx.fillRect(startX, 0, segWidth, height);

      ctx.fillStyle = SEGMENT_COLORS[segment.type];
      ctx.fillRect(startX, 0, 2, height);
      ctx.fillRect(endX - 2, 0, 2, height);

      if (segWidth > 60) {
        ctx.fillStyle = SEGMENT_COLORS[segment.type];
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          segment.type.toUpperCase(),
          startX + segWidth / 2,
          16
        );
      }
    });

    beats.forEach((beat) => {
      const x = (beat.time / duration) * width;
      ctx.strokeStyle = beat.isManual ? '#06b6d4' : '#64748b';
      ctx.lineWidth = beat.isManual ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, height - 10);
      ctx.stroke();

      if (beat.isManual) {
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(x, height - 5, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    if (bestInPoint !== undefined) {
      const x = (bestInPoint / duration) * width;
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.moveTo(x - 8, 0);
      ctx.lineTo(x + 8, 0);
      ctx.lineTo(x, 12);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#10b981';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('IN', x, 28);
    }

    if (bestOutPoint !== undefined) {
      const x = (bestOutPoint / duration) * width;
      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.moveTo(x - 8, 0);
      ctx.lineTo(x + 8, 0);
      ctx.lineTo(x, 12);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ec4899';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('OUT', x, 28);
    }
  }, [beats, segments, duration, bestInPoint, bestOutPoint]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay, currentTime]);

  useEffect(() => {
    const handleResize = () => drawOverlay();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawOverlay]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!overlayRef.current || !duration || !onAddBeat) return;
    
    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    
    onAddBeat(time);
  };

  const togglePlay = () => {
    wavesurferRef.current?.playPause();
  };

  const skip = (seconds: number) => {
    if (wavesurferRef.current) {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      wavesurferRef.current.seekTo(newTime / duration);
    }
  };

  return (
    <div className="waveform-container">
      <div className="relative">
        <div ref={containerRef} className="w-full" />
        <canvas
          ref={overlayRef}
          className="absolute top-0 left-0 w-full h-full cursor-crosshair"
          onClick={handleOverlayClick}
        />
      </div>

      <div className="flex items-center justify-between p-4 bg-bg-secondary/50 border-t border-bg-tertiary">
        <div className="flex items-center gap-2">
          <button
            onClick={() => skip(-5)}
            className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
            title="后退5秒"
          >
            <SkipBack size={18} />
          </button>
          <button
            onClick={togglePlay}
            className="p-3 bg-accent-cyan text-bg-primary rounded-full hover:shadow-glow transition-all"
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          <button
            onClick={() => skip(5)}
            className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
            title="前进5秒"
          >
            <SkipForward size={18} />
          </button>
          <span className="ml-4 font-mono text-sm text-text-secondary">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(Math.max(10, zoom - 20))}
            className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
            title="缩小"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-sm text-text-muted w-16 text-center">{zoom}%</span>
          <button
            onClick={() => setZoom(Math.min(200, zoom + 20))}
            className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
            title="放大"
          >
            <ZoomIn size={18} />
          </button>
        </div>
      </div>

      <div className="px-4 py-2 bg-bg-tertiary/30 text-xs text-text-muted flex flex-wrap gap-3">
        <span>💡 点击波形任意位置添加拍点</span>
        <span>•</span>
        <span className="text-accent-cyan">青色竖线</span> = 手动拍点
        <span>•</span>
        <span className="text-text-muted">灰色竖线</span> = 自动拍点
        <span>•</span>
        <span className="text-accent-green">绿色三角</span> = 最佳入点
        <span>•</span>
        <span className="text-accent-magenta">粉色三角</span> = 最佳出点
      </div>
    </div>
  );
};

export default WaveformViewer;
