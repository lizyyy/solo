import { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, FastForward } from 'lucide-react';
import type { GameRecord, Position } from '@/game/types';
import { useCanvas } from '@/hooks/useCanvas';
import { LEVELS } from '@/game/levels';

interface ReplayPlayerProps {
  record: GameRecord;
}

export default function ReplayPlayer({ record }: ReplayPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(40);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const level = LEVELS.find((l) => l.id.toString() === record.levelId);
  const path = record.path || [];
  const totalFrames = path.length;

  const calculateCellSize = useCallback(() => {
    if (!containerRef.current || !level) return 40;

    const containerWidth = containerRef.current.clientWidth - 40;
    const containerHeight = containerRef.current.clientHeight - 40;
    const { width, height } = level.gridSize;

    const maxCellWidth = Math.floor(containerWidth / width);
    const maxCellHeight = Math.floor(containerHeight / height);
    const newCellSize = Math.min(maxCellWidth, maxCellHeight, 60);

    return Math.max(newCellSize, 20);
  }, [level]);

  useEffect(() => {
    const updateSize = () => {
      const newCellSize = calculateCellSize();
      setCellSize(newCellSize);

      if (canvasRef.current && level) {
        const canvas = canvasRef.current;
        const { width, height } = level.gridSize;
        canvas.width = width * newCellSize + 40;
        canvas.height = height * newCellSize + 40;
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
    };
  }, [level, calculateCellSize]);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentFrame((prev) => {
        if (prev >= totalFrames - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / speed);

    return () => clearInterval(interval);
  }, [isPlaying, speed, totalFrames]);

  const currentPosition: Position | null = path[currentFrame] || null;
  const executedPath = path.slice(0, currentFrame + 1);
  const currentRound = currentFrame;

  const currentEvents = record.events.filter(
    (e) => e.round !== undefined && e.round <= currentRound
  );

  useCanvas(canvasRef, {
    level: level || null,
    playerPosition: currentPosition,
    plannedPath: [],
    executedPath,
    guards: level?.guards || [],
    currentRound,
    events: currentEvents,
    isDesiccantActive: false,
    cellSize,
  });

  const handlePlayPause = () => {
    if (currentFrame >= totalFrames - 1) {
      setCurrentFrame(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentFrame(0);
    setIsPlaying(false);
  };

  const handleStepForward = () => {
    if (currentFrame < totalFrames - 1) {
      setCurrentFrame(currentFrame + 1);
    }
  };

  const handleStepBackward = () => {
    if (currentFrame > 0) {
      setCurrentFrame(currentFrame - 1);
    }
  };

  const handleSpeedChange = () => {
    const speeds = [1, 2, 3];
    const currentIndex = speeds.indexOf(speed);
    setSpeed(speeds[(currentIndex + 1) % speeds.length]);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentFrame(parseInt(e.target.value, 10));
    setIsPlaying(false);
  };

  const formatTime = (frame: number) => {
    const seconds = Math.floor(frame / speed);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="hud-panel flex-1 flex flex-col">
      <div ref={containerRef} className="flex-1 flex items-center justify-center p-5 min-h-0">
        <canvas
          ref={canvasRef}
          className="rounded-lg border border-museum-bgLighter"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        />
      </div>

      <div className="p-4 border-t border-museum-bgLighter bg-museum-bg/30">
        <div className="flex items-center gap-4 mb-3">
          <button
            onClick={handleReset}
            className="btn-secondary p-2"
            title="重置"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={handleStepBackward}
            className="btn-secondary p-2"
            disabled={currentFrame === 0}
            title="上一帧"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={handlePlayPause}
            className="btn-primary p-3"
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={handleStepForward}
            className="btn-secondary p-2"
            disabled={currentFrame >= totalFrames - 1}
            title="下一帧"
          >
            <SkipForward className="w-4 h-4" />
          </button>
          <button
            onClick={handleSpeedChange}
            className="btn-secondary flex items-center gap-1 px-3"
            title="播放速度"
          >
            <FastForward className="w-4 h-4" />
            <span className="text-sm">{speed}x</span>
          </button>

          <div className="flex-1" />

          <span className="text-museum-bgLighter text-sm font-mono">
            {formatTime(currentFrame)} / {formatTime(totalFrames - 1)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-museum-bgLighter w-8">
            {currentFrame + 1}
          </span>
          <input
            type="range"
            min="0"
            max={totalFrames - 1}
            value={currentFrame}
            onChange={handleSliderChange}
            className="flex-1 h-2 bg-museum-bgLighter rounded-lg appearance-none cursor-pointer slider"
          />
          <span className="text-xs text-museum-bgLighter w-8 text-right">
            {totalFrames}
          </span>
        </div>

        <div className="mt-3 text-center text-sm text-museum-bgLighter">
          回合 {currentRound} / {record.totalRounds}
        </div>
      </div>
    </div>
  );
}
