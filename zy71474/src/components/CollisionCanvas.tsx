import { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Save } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { Ball, TrajectoryFrame } from '@/types';

const CANVAS_HEIGHT = 400;
const GRID_SIZE = 40;
const ARROW_SCALE = 8;
const COLLISION_FLASH_FRAMES = 15;

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = '#2A3050';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= width; x += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawBall(ctx: CanvasRenderingContext2D, ball: Ball) {
  const r = ball.radius * 1.5;
  const x = ball.positionX;
  const y = ball.positionY;

  ctx.save();
  ctx.shadowBlur = 15;
  ctx.shadowColor = ball.color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = ball.color;
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  const arrowLen = ball.velocity * ARROW_SCALE;
  const endX = x + arrowLen;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(endX, y);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (Math.abs(arrowLen) > 4) {
    const dir = arrowLen > 0 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(endX, y);
    ctx.lineTo(endX - dir * 6, y - 4);
    ctx.lineTo(endX - dir * 6, y + 4);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  ctx.font = '10px Orbitron, monospace';
  ctx.fillStyle = '#E5E7EB';
  ctx.textAlign = 'center';
  ctx.fillText(ball.mass.toFixed(1), x, y + r + 14);
}

function drawCollisionFlash(
  ctx: CanvasRenderingContext2D,
  frames: TrajectoryFrame[],
  currentIdx: number
) {
  if (frames.length === 0) return;
  const midIdx = Math.floor(frames.length / 2);
  const flashProgress = currentIdx - midIdx;
  if (flashProgress < 0 || flashProgress > COLLISION_FLASH_FRAMES) return;

  const midFrame = frames[midIdx];
  if (!midFrame) return;

  const avgX = midFrame.balls.reduce((s, b) => s + b.x, 0) / midFrame.balls.length;
  const avgY = midFrame.balls.reduce((s, b) => s + b.y, 0) / midFrame.balls.length;

  const t = flashProgress / COLLISION_FLASH_FRAMES;
  const ringRadius = 10 + t * 60;
  const alpha = 1 - t;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avgX, avgY, ringRadius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 107, 53, ${alpha})`;
  ctx.lineWidth = 3 * (1 - t * 0.5);
  ctx.shadowBlur = 20 * alpha;
  ctx.shadowColor = `rgba(255, 107, 53, ${alpha * 0.5})`;
  ctx.stroke();
  ctx.restore();
}

export default function CollisionCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const [canvasWidth, setCanvasWidth] = useState(800);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const balls = useStore((s) => s.balls);
  const simulationStatus = useStore((s) => s.simulationStatus);
  const trajectoryFrames = useStore((s) => s.trajectoryFrames);
  const currentFrameIndex = useStore((s) => s.currentFrameIndex);
  const setFrameIndex = useStore((s) => s.setFrameIndex);
  const setSimulationStatus = useStore((s) => s.setSimulationStatus);
  const pauseSimulation = useStore((s) => s.pauseSimulation);
  const startSimulation = useStore((s) => s.startSimulation);
  const saveExperiment = useStore((s) => s.saveExperiment);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasWidth(entry.contentRect.width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, CANVAS_HEIGHT);
    ctx.fillStyle = '#0A0E1A';
    ctx.fillRect(0, 0, canvasWidth, CANVAS_HEIGHT);
    drawGrid(ctx, canvasWidth, CANVAS_HEIGHT);

    if (simulationStatus === 'running' || simulationStatus === 'paused' || simulationStatus === 'finished') {
      const frame = trajectoryFrames[currentFrameIndex];
      if (frame) {
        const ballMap = new Map(balls.map((b) => [b.id, b]));
        frame.balls.forEach((fb) => {
          const original = ballMap.get(fb.id);
          if (original) {
            drawBall(ctx, {
              ...original,
              positionX: fb.x,
              positionY: fb.y,
              velocity: fb.vx,
            });
          }
        });
        drawCollisionFlash(ctx, trajectoryFrames, currentFrameIndex);
      }
    } else {
      balls.forEach((ball) => drawBall(ctx, ball));
    }
  }, [balls, simulationStatus, trajectoryFrames, currentFrameIndex, canvasWidth]);

  useEffect(() => {
    render();
  }, [render]);

  useEffect(() => {
    if (simulationStatus !== 'running') return;

    const animate = () => {
      const nextIdx = currentFrameIndex + 1;
      if (nextIdx >= trajectoryFrames.length) {
        setSimulationStatus('finished');
        return;
      }
      setFrameIndex(nextIdx);
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [simulationStatus, currentFrameIndex, trajectoryFrames.length, setFrameIndex, setSimulationStatus]);

  const totalFrames = trajectoryFrames.length;

  const handleSave = () => {
    if (!saveName.trim()) return;
    saveExperiment(saveName.trim());
    setSaveName('');
    setShowSaveInput(false);
  };

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="rounded-xl border border-brand-border overflow-hidden">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={CANVAS_HEIGHT}
          className="block"
        />
      </div>

      <div className="flex items-center justify-between bg-brand-card rounded-xl border border-brand-border px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFrameIndex(Math.max(0, currentFrameIndex - 1))}
            disabled={simulationStatus === 'idle' || currentFrameIndex <= 0}
            className="text-brand-muted hover:text-brand-text disabled:opacity-30 transition-colors"
          >
            <SkipBack size={16} />
          </button>

          {simulationStatus === 'running' ? (
            <button onClick={pauseSimulation} className="text-brand-orange hover:text-brand-orange/80 transition-colors">
              <Pause size={16} />
            </button>
          ) : (
            <button
              onClick={startSimulation}
              disabled={simulationStatus === 'finished'}
              className="text-brand-orange hover:text-brand-orange/80 disabled:opacity-30 transition-colors"
            >
              <Play size={16} />
            </button>
          )}

          <button
            onClick={() => setFrameIndex(Math.min(totalFrames - 1, currentFrameIndex + 1))}
            disabled={simulationStatus === 'idle' || currentFrameIndex >= totalFrames - 1}
            className="text-brand-muted hover:text-brand-text disabled:opacity-30 transition-colors"
          >
            <SkipForward size={16} />
          </button>
        </div>

        <span className="font-display text-xs text-brand-muted">
          帧: {simulationStatus === 'idle' ? '—' : `${currentFrameIndex + 1}/${totalFrames}`}
        </span>

        {simulationStatus === 'finished' && (
          <div className="flex items-center gap-2">
            {showSaveInput ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  placeholder="实验名称"
                  className="bg-brand-surface border border-brand-border rounded px-2 py-1 text-xs text-brand-text font-body w-28 focus:outline-none focus:border-brand-cyan"
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  className="text-brand-green hover:text-brand-green/80 text-xs font-body"
                >
                  确认
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveInput(true)}
                className="flex items-center gap-1 text-brand-cyan hover:text-brand-cyan/80 text-xs font-body transition-colors"
              >
                <Save size={14} />
                保存实验
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
