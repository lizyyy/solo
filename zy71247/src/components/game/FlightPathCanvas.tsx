import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';

export function FlightPathCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { params, updateParams, getCurrentScene } = useGameStore();
  const isDragging = useRef(false);

  const scene = getCurrentScene();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.fillStyle = '#081020';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(100, 255, 218, 0.1)';
    ctx.lineWidth = 1;
    const gridSize = 30;
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(100, 255, 218, 0.3)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    const actualX = centerX + params.flightPath.offsetX * 2;
    const actualY = centerY + params.flightPath.offsetY * 2;

    ctx.strokeStyle = 'rgba(255, 183, 3, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.min(width, height) * 0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = '#64FFDA';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#64FFDA';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(20, actualY);
    ctx.bezierCurveTo(
      width * 0.33, actualY + params.flightPath.curvature * 0.5,
      width * 0.66, actualY - params.flightPath.curvature * 0.5,
      width - 20, actualY
    );
    ctx.stroke();
    ctx.shadowBlur = 0;

    const planeX = actualX;
    const planeY = actualY;

    ctx.save();
    ctx.translate(planeX, planeY);
    
    ctx.fillStyle = '#64FFDA';
    ctx.shadowColor = '#64FFDA';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-10, -8);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.fillStyle = '#64FFDA';
    ctx.beginPath();
    ctx.arc(actualX, actualY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(100, 255, 218, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(actualX, actualY);
    ctx.lineTo(centerX, actualY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX, actualY);
    ctx.lineTo(centerX, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#64FFDA';
    ctx.font = '10px JetBrains Mono';
    ctx.fillText(`X: ${params.flightPath.offsetX.toFixed(0)}`, (actualX + centerX) / 2, actualY - 8);
    ctx.fillText(`Y: ${params.flightPath.offsetY.toFixed(0)}`, centerX + 8, (actualY + centerY) / 2);

  }, [params]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    handleMouseMove(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const offsetX = (x - centerX) / 2;
    const offsetY = (y - centerY) / 2;

    updateParams({
      flightPath: {
        ...params.flightPath,
        offsetX: Math.max(-50, Math.min(50, offsetX)),
        offsetY: Math.max(-50, Math.min(50, offsetY))
      }
    });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  return (
    <div className="card-bg rounded-lg p-4 border border-tech-500/30">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-orbitron text-tech-400 text-sm font-semibold">航迹控制</h3>
        <span className="text-xs text-space-200">拖拽飞机调整位置</span>
      </div>
      <canvas
        ref={canvasRef}
        width={350}
        height={250}
        className="w-full rounded cursor-crosshair border border-tech-500/20"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div className="mt-2 flex justify-between text-xs text-space-300">
        <span>理想航迹: (0, 0)</span>
        <span className={scene && Math.abs(params.flightPath.offsetX) + Math.abs(params.flightPath.offsetY) > scene.thresholds.track.warning ? 'text-alert-red' : 'text-tech-400'}>
          当前: ({params.flightPath.offsetX.toFixed(0)}, {params.flightPath.offsetY.toFixed(0)})
        </span>
      </div>
    </div>
  );
}
