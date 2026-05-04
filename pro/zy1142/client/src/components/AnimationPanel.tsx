import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, FastForward, Rewind, Sliders } from 'lucide-react';
import { TrajectoryPoint, PhysicsProblemType } from '../../../shared/types';

interface AnimationPanelProps {
  trajectory: TrajectoryPoint[];
  problemType: PhysicsProblemType;
  title?: string;
}

const AnimationPanel: React.FC<AnimationPanelProps> = ({ 
  trajectory, 
  problemType,
  title = '动画演示'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  const totalFrames = trajectory.length;

  const drawIncline = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, point: TrajectoryPoint) => {
    const width = canvas.width;
    const height = canvas.height;
    const padding = 60;

    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, width, height);

    const startX = padding;
    const startY = height - padding;
    const angle = Math.atan2(trajectory[0].y, trajectory[trajectory.length - 1].x - trajectory[0].x);
    const maxLength = Math.max(...trajectory.map(p => Math.sqrt(p.x * p.x + p.y * p.y)));
    const scaleX = (width - 2 * padding) / maxLength;
    const scaleY = (height - 2 * padding) / (maxLength * Math.sin(angle || Math.PI / 6));

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    const endX = startX + maxLength * scaleX;
    const endY = startY - maxLength * Math.sin(angle || Math.PI / 6) * scaleY;
    ctx.lineTo(endX, endY);
    ctx.lineTo(endX, startY);
    ctx.closePath();
    ctx.fillStyle = '#374151';
    ctx.fill();
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    const dist = Math.sqrt(point.x * point.x + point.y * point.y);
    const currentX = startX + dist * scaleX * Math.cos(angle || Math.PI / 6);
    const currentY = startY - dist * scaleX * Math.sin(angle || Math.PI / 6);

    const boxSize = 30;
    ctx.save();
    ctx.translate(currentX, currentY);
    ctx.rotate(-(angle || Math.PI / 6));
    
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize);
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 2;
    ctx.strokeRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize);

    if (point.vx !== undefined && point.vy !== undefined) {
      const v = Math.sqrt(point.vx * point.vx + point.vy * point.vy);
      if (Math.abs(v) > 0.01) {
        const arrowLength = Math.min(50, Math.abs(v) * 10);
        const direction = v > 0 ? 1 : -1;
        
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(direction * arrowLength, 0);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(direction * arrowLength, 0);
        ctx.lineTo(direction * (arrowLength - 8), -5);
        ctx.lineTo(direction * (arrowLength - 8), 5);
        ctx.closePath();
        ctx.fillStyle = '#22c55e';
        ctx.fill();
      }
    }

    ctx.restore();

    ctx.fillStyle = '#e5e7eb';
    ctx.font = '12px sans-serif';
    ctx.fillText(`时间: ${point.time.toFixed(2)}s`, padding, height - 30);
    ctx.fillText(`速度: ${point.velocity ? point.velocity.toFixed(2) : 'N/A'} m/s`, padding, height - 15);
    ctx.fillText(`位置: (${point.x.toFixed(2)}, ${point.y.toFixed(2)}) m`, width / 2, height - 15);
  }, [trajectory]);

  const drawProjectile = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, point: TrajectoryPoint) => {
    const width = canvas.width;
    const height = canvas.height;
    const padding = 60;

    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, width, height);

    const maxX = Math.max(...trajectory.map(p => p.x));
    const maxY = Math.max(...trajectory.map(p => p.y)) * 1.2;
    const scaleX = (width - 2 * padding) / Math.max(maxX, 1);
    const scaleY = (height - 2 * padding - 50) / Math.max(maxY, 1);

    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    trajectory.forEach((p, i) => {
      const px = padding + p.x * scaleX;
      const py = height - padding - 50 - p.y * scaleY;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    });
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#4b5563';
    ctx.fillRect(padding - 10, height - padding - 50, width - 2 * padding + 20, 10);

    const currentX = padding + point.x * scaleX;
    const currentY = height - padding - 50 - point.y * scaleY;

    const ballRadius = 12;
    const gradient = ctx.createRadialGradient(currentX - 3, currentY - 3, 0, currentX, currentY, ballRadius);
    gradient.addColorStop(0, '#60a5fa');
    gradient.addColorStop(1, '#1d4ed8');
    ctx.beginPath();
    ctx.arc(currentX, currentY, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (point.vx !== undefined && point.vy !== undefined) {
      const vScale = 2;
      const vx = point.vx * vScale;
      const vy = -point.vy * vScale;
      const vMag = Math.sqrt(vx * vx + vy * vy);
      
      if (vMag > 2) {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(currentX, currentY);
        ctx.lineTo(currentX + vx, currentY + vy);
        ctx.stroke();

        const angle = Math.atan2(vy, vx);
        const arrowLength = 8;
        ctx.beginPath();
        ctx.moveTo(currentX + vx, currentY + vy);
        ctx.lineTo(
          currentX + vx - arrowLength * Math.cos(angle - Math.PI / 6),
          currentY + vy - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          currentX + vx - arrowLength * Math.cos(angle + Math.PI / 6),
          currentY + vy - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = '#22c55e';
        ctx.fill();
      }
    }

    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(currentX, currentY);
    ctx.lineTo(currentX, height - padding - 50);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(currentX, currentY);
    ctx.lineTo(padding, currentY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#e5e7eb';
    ctx.font = '12px sans-serif';
    ctx.fillText(`时间: ${point.time.toFixed(2)}s`, padding, height - 25);
    ctx.fillText(`位置: (${point.x.toFixed(2)}, ${point.y.toFixed(2)}) m`, padding, height - 10);
    ctx.fillText(`速度: (${point.vx?.toFixed(2) || 'N/A'}, ${point.vy?.toFixed(2) || 'N/A'}) m/s`, width / 2, height - 25);
    ctx.fillText(`速率: ${point.velocity ? point.velocity.toFixed(2) : 'N/A'} m/s`, width / 2, height - 10);
  }, [trajectory]);

  const drawSpring = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, point: TrajectoryPoint) => {
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    const padding = 60;

    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, width, height);

    const wallX = padding;
    const equilibriumX = width / 2;
    const maxDisplacement = Math.max(...trajectory.map(p => Math.abs(p.extension || p.x)));
    const scale = Math.min((width - 2 * padding - 100) / (maxDisplacement * 2.5), 200);

    const currentX = equilibriumX + (point.extension || point.x) * scale;
    const boxSize = 40;

    ctx.fillStyle = '#4b5563';
    ctx.fillRect(wallX - 10, centerY - 80, 10, 160);
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 2;
    ctx.strokeRect(wallX - 10, centerY - 80, 10, 160);

    const springStartX = wallX;
    const springEndX = currentX - boxSize / 2;
    const coils = 12;
    const springWidth = 20;
    
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(springStartX, centerY);
    
    if (springEndX > springStartX + 40) {
      const springLength = springEndX - springStartX - 40;
      const coilSpacing = springLength / coils;
      
      for (let i = 0; i <= coils; i++) {
        const x = springStartX + 20 + i * coilSpacing;
        const yOffset = (i % 2 === 0) ? -springWidth / 2 : springWidth / 2;
        ctx.lineTo(x, centerY + yOffset);
      }
      ctx.lineTo(springEndX, centerY);
    } else {
      ctx.lineTo(springEndX, centerY);
    }
    ctx.stroke();

    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(currentX - boxSize / 2, centerY - boxSize / 2, boxSize, boxSize);
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 2;
    ctx.strokeRect(currentX - boxSize / 2, centerY - boxSize / 2, boxSize, boxSize);

    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(equilibriumX, centerY - 100);
    ctx.lineTo(equilibriumX, centerY + 100);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#6b7280';
    ctx.font = '12px sans-serif';
    ctx.fillText('平衡位置', equilibriumX - 30, centerY - 110);

    if (point.velocity !== undefined) {
      const v = point.velocity;
      if (Math.abs(v) > 0.01) {
        const arrowLength = Math.min(60, Math.abs(v) * 15);
        const direction = v > 0 ? 1 : -1;
        
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(currentX, centerY);
        ctx.lineTo(currentX + direction * arrowLength, centerY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(currentX + direction * arrowLength, centerY);
        ctx.lineTo(currentX + direction * (arrowLength - 10), centerY - 6);
        ctx.lineTo(currentX + direction * (arrowLength - 10), centerY + 6);
        ctx.closePath();
        ctx.fillStyle = '#22c55e';
        ctx.fill();
      }
    }

    ctx.fillStyle = '#e5e7eb';
    ctx.font = '12px sans-serif';
    ctx.fillText(`时间: ${point.time.toFixed(2)}s`, padding, height - 30);
    ctx.fillText(`位移: ${(point.extension || point.x).toFixed(3)} m`, padding, height - 15);
    ctx.fillText(`速度: ${point.velocity ? point.velocity.toFixed(2) : 'N/A'} m/s`, width / 2, height - 30);
    ctx.fillText(`加速度: ${point.acceleration ? point.acceleration.toFixed(2) : 'N/A'} m/s²`, width / 2, height - 15);
  }, [trajectory]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || trajectory.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const point = trajectory[Math.min(currentFrame, trajectory.length - 1)];

    switch (problemType) {
      case 'incline':
        drawIncline(ctx, canvas, point);
        break;
      case 'projectile':
        drawProjectile(ctx, canvas, point);
        break;
      case 'spring':
        drawSpring(ctx, canvas, point);
        break;
      default:
        drawProjectile(ctx, canvas, point);
    }
  }, [currentFrame, trajectory, problemType, drawIncline, drawProjectile, drawSpring]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    if (isPlaying && totalFrames > 0) {
      const animate = (timestamp: number) => {
        if (lastTimeRef.current === 0) {
          lastTimeRef.current = timestamp;
        }

        const delta = (timestamp - lastTimeRef.current) / 1000;
        lastTimeRef.current = timestamp;

        const frameIncrement = Math.max(1, Math.floor(playbackSpeed * delta * 30));
        
        setCurrentFrame(prev => {
          const next = prev + frameIncrement;
          if (next >= totalFrames - 1) {
            setIsPlaying(false);
            return totalFrames - 1;
          }
          return next;
        });

        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, totalFrames]);

  const handlePlayPause = () => {
    if (currentFrame >= totalFrames - 1) {
      setCurrentFrame(0);
    }
    lastTimeRef.current = 0;
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentFrame(0);
    lastTimeRef.current = 0;
  };

  const handleFrameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsPlaying(false);
    setCurrentFrame(parseInt(e.target.value));
    lastTimeRef.current = 0;
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
  };

  if (trajectory.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-400">暂无轨迹数据，请先求解问题</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-gray-700 flex items-center justify-between">
        <h3 className="text-white font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-gray-400" />
          <span className="text-gray-400 text-sm">播放速度:</span>
          {[0.5, 1, 2, 3].map(speed => (
            <button
              key={speed}
              onClick={() => handleSpeedChange(speed)}
              className={`px-2 py-1 text-xs rounded ${
                playbackSpeed === speed
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        className="w-full border-b border-gray-700"
      />

      <div className="px-4 py-3 bg-gray-700">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setCurrentFrame(0);
              lastTimeRef.current = 0;
            }}
            className="p-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white transition-colors"
            title="跳转到开始"
          >
            <Rewind className="w-5 h-5" />
          </button>

          <button
            onClick={handlePlayPause}
            className="p-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </button>

          <button
            onClick={handleReset}
            className="p-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white transition-colors"
            title="重置"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              setCurrentFrame(totalFrames - 1);
              lastTimeRef.current = 0;
            }}
            className="p-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white transition-colors"
            title="跳转到结束"
          >
            <FastForward className="w-5 h-5" />
          </button>

          <div className="flex-1 flex items-center gap-3">
            <span className="text-gray-400 text-sm whitespace-nowrap">
              帧: {currentFrame + 1}/{totalFrames}
            </span>
            <input
              type="range"
              min={0}
              max={totalFrames - 1}
              value={currentFrame}
              onChange={handleFrameChange}
              className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentFrame / (totalFrames - 1)) * 100}%, #4b5563 ${(currentFrame / (totalFrames - 1)) * 100}%, #4b5563 100%)`
              }}
            />
            {trajectory[currentFrame] && (
              <span className="text-gray-400 text-sm whitespace-nowrap">
                t = {trajectory[currentFrame].time.toFixed(2)}s
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimationPanel;
