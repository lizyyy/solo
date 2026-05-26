import { useEffect, useRef, useState, useCallback } from 'react';
import type { ReplayFrame, Hazard, GameMap, MarkRecord } from '../game/types';

interface ReplayPlayerProps {
  frames: ReplayFrame[];
  hazards: Hazard[];
  map: GameMap;
  totalTime: number;
  onClose: () => void;
}

export function ReplayPlayer({ frames, hazards, map, totalTime, onClose }: ReplayPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  const canvasWidth = Math.min(800, map.width * map.tileSize);
  const canvasHeight = Math.min(600, map.height * map.tileSize);

  const getFrameAtTime = useCallback((time: number): ReplayFrame | null => {
    if (frames.length === 0) return null;
    
    let left = 0;
    let right = frames.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (frames[mid].timestamp === time) {
        return frames[mid];
      } else if (frames[mid].timestamp < time) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    return frames[Math.max(0, right)];
  }, [frames]);

  const drawFrame = useCallback((frame: ReplayFrame | null, time: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !frame) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const tile of map.tiles) {
      const x = tile.x * map.tileSize;
      const y = tile.y * map.tileSize;

      switch (tile.type) {
        case 'floor':
          ctx.fillStyle = '#374151';
          break;
        case 'wall':
          ctx.fillStyle = '#1f2937';
          break;
        case 'fire_exit':
          ctx.fillStyle = '#10b981';
          break;
        default:
          ctx.fillStyle = '#374151';
      }

      ctx.fillRect(x, y, map.tileSize, map.tileSize);
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, map.tileSize, map.tileSize);

      if (tile.type === 'fire_exit') {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('出口', x + map.tileSize / 2, y + map.tileSize / 2 + 4);
      }
    }

    for (const shelf of map.shelves) {
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(shelf.x, shelf.y, shelf.width, shelf.height);
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 2;
      ctx.strokeRect(shelf.x, shelf.y, shelf.width, shelf.height);
    }

    const markedHazardIds = new Set(frame.markedHazards.map(m => m.hazardId));
    const correctMarks = new Set(frame.markedHazards.filter(m => m.isCorrect).map(m => m.hazardId));

    for (const hazard of hazards) {
      const centerX = hazard.x + hazard.width / 2;
      const centerY = hazard.y + hazard.height / 2;

      if (markedHazardIds.has(hazard.id)) {
        ctx.fillStyle = correctMarks.has(hazard.id) ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 25, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = hazard.isHazard ? '#ef4444' : '#3b82f6';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#9ca3af';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(hazard.description, centerX, centerY + 20);

      if (markedHazardIds.has(hazard.id)) {
        ctx.fillStyle = correctMarks.has(hazard.id) ? '#22c55e' : '#ef4444';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(correctMarks.has(hazard.id) ? '✓' : '✗', centerX, centerY - 15);
      }
    }

    const player = frame.player;
    ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(player.x - 3, player.y - 3, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👮', player.x, player.y + 4);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(10, 10, 120, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`时间: ${time.toFixed(1)}秒`, 20, 30);
  }, [map, hazards]);

  useEffect(() => {
    if (!isPlaying) return;

    const animate = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      const newTime = Math.min(currentTime + delta * playbackSpeed, totalTime);
      setCurrentTime(newTime);

      const frame = getFrameAtTime(newTime * 1000);
      if (frame) {
        drawFrame(frame, newTime);
        setCurrentFrameIndex(frames.indexOf(frame));
      }

      if (newTime >= totalTime) {
        setIsPlaying(false);
        return;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, currentTime, playbackSpeed, totalTime, getFrameAtTime, drawFrame, frames]);

  useEffect(() => {
    const frame = getFrameAtTime(currentTime * 1000);
    if (frame) {
      drawFrame(frame, currentTime);
      setCurrentFrameIndex(frames.indexOf(frame));
    }
  }, [currentTime, getFrameAtTime, drawFrame, frames]);

  const handlePlayPause = () => {
    if (currentTime >= totalTime) {
      setCurrentTime(0);
    }
    setIsPlaying(!isPlaying);
    lastTimeRef.current = 0;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    setIsPlaying(false);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
  };

  const currentMarks = frames[currentFrameIndex]?.markedHazards || [];
  const markEvents = currentMarks.filter(m => !m.isDuplicate);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">历史回放</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <div className="flex justify-center mb-4">
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              className="rounded-lg border-2 border-gray-700 bg-gray-900"
            />
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={handlePlayPause}
                className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                  isPlaying 
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isPlaying ? '⏸ 暂停' : '▶ 播放'}
              </button>

              <input
                type="range"
                min={0}
                max={totalTime}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />

              <span className="text-white font-mono text-sm w-20 text-right">
                {currentTime.toFixed(1)} / {totalTime.toFixed(1)}s
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">速度:</span>
              {[0.5, 1, 2, 4].map(speed => (
                <button
                  key={speed}
                  onClick={() => handleSpeedChange(speed)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    playbackSpeed === speed 
                      ? 'bg-amber-600 text-white' 
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2">标记事件</h3>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {markEvents.length === 0 ? (
                  <p className="text-gray-400 text-sm">暂无标记事件</p>
                ) : (
                  markEvents.map((mark, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400">{(mark.timestamp / 1000).toFixed(1)}s</span>
                      <span className={mark.isCorrect ? 'text-green-400' : 'text-red-400'}>
                        {mark.isCorrect ? '✓ 正确' : '✗ 错误'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2">图例</h3>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <span className="text-gray-400">隐患</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full" />
                  <span className="text-gray-400">正常设施</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-full" />
                  <span className="text-gray-400">玩家</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded" />
                  <span className="text-gray-400">安全出口</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
