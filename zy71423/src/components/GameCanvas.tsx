import { useEffect, useRef, useCallback } from 'react';
import { FunctionCard, CurvePoint, Point } from '../types';
import { getDifferentiabilityFeedback } from '../utils/obstacleDetector';

interface GameCanvasProps {
  functionCard: FunctionCard;
  curvePoints: CurvePoint[];
  playerPosition: Point;
  width?: number;
  height?: number;
}

export const GameCanvas = ({
  functionCard,
  curvePoints,
  playerPosition,
  width = 800,
  height = 500,
}: GameCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const glowPhaseRef = useRef(0);

  const [minX, maxX] = functionCard.domain;
  const padding = 60;

  const getYBounds = useCallback(() => {
    let minY = Infinity;
    let maxY = -Infinity;
    curvePoints.forEach(p => {
      if (isFinite(p.y)) {
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
    });
    const yPadding = (maxY - minY) * 0.2 || 2;
    return [minY - yPadding, maxY + yPadding];
  }, [curvePoints]);

  const toCanvasX = useCallback(
    (x: number) => padding + ((x - minX) / (maxX - minX)) * (width - 2 * padding),
    [minX, maxX, width, padding]
  );

  const toCanvasY = useCallback(
    (y: number) => {
      const [minY, maxY] = getYBounds();
      return height - padding - ((y - minY) / (maxY - minY)) * (height - 2 * padding);
    },
    [getYBounds, height, padding]
  );

  const drawGrid = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
      ctx.lineWidth = 1;

      const [minY, maxY] = getYBounds();

      for (let x = Math.ceil(minX); x <= Math.floor(maxX); x++) {
        const canvasX = toCanvasX(x);
        ctx.beginPath();
        ctx.moveTo(canvasX, padding);
        ctx.lineTo(canvasX, height - padding);
        ctx.stroke();
      }

      for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
        const canvasY = toCanvasY(y);
        ctx.beginPath();
        ctx.moveTo(padding, canvasY);
        ctx.lineTo(width - padding, canvasY);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.lineWidth = 2;

      const yZero = toCanvasY(0);
      if (yZero > padding && yZero < height - padding) {
        ctx.beginPath();
        ctx.moveTo(padding, yZero);
        ctx.lineTo(width - padding, yZero);
        ctx.stroke();
      }

      const xZero = toCanvasX(0);
      if (xZero > padding && xZero < width - padding) {
        ctx.beginPath();
        ctx.moveTo(xZero, padding);
        ctx.lineTo(xZero, height - padding);
        ctx.stroke();
      }

      ctx.fillStyle = '#94A3B8';
      ctx.font = '12px Noto Sans SC';
      ctx.textAlign = 'center';

      for (let x = Math.ceil(minX); x <= Math.floor(maxX); x += 2) {
        ctx.fillText(x.toString(), toCanvasX(x), height - padding + 20);
      }

      ctx.textAlign = 'right';
      for (let y = Math.ceil(minY); y <= Math.floor(maxY); y += 2) {
        ctx.fillText(y.toString(), padding - 10, toCanvasY(y) + 4);
      }
    },
    [minX, maxX, padding, width, height, toCanvasX, toCanvasY, getYBounds]
  );

  const drawCurve = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (curvePoints.length < 2) return;

      ctx.save();
      ctx.shadowColor = '#06B6D4';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      let isDrawing = false;
      ctx.beginPath();

      for (let i = 0; i < curvePoints.length; i++) {
        const point = curvePoints[i];
        const canvasX = toCanvasX(point.x);
        const canvasY = toCanvasY(point.y);

        if (!isFinite(point.y)) {
          if (isDrawing) {
            ctx.stroke();
            ctx.beginPath();
            isDrawing = false;
          }
          continue;
        }

        if (point.isDiscontinuity) {
          if (isDrawing) {
            ctx.stroke();
            ctx.beginPath();
          }
          ctx.moveTo(canvasX, canvasY);
          isDrawing = true;
        } else if (!isDrawing) {
          ctx.moveTo(canvasX, canvasY);
          isDrawing = true;
        } else {
          ctx.lineTo(canvasX, canvasY);
        }
      }

      if (isDrawing) {
        ctx.stroke();
      }

      ctx.restore();
    },
    [curvePoints, toCanvasX, toCanvasY]
  );

  const drawTraps = useCallback(
    (ctx: CanvasRenderingContext2D, glowPhase: number) => {
      functionCard.traps.forEach(trap => {
        const trapY = functionCard.fn(trap.x);
        if (!isFinite(trapY)) return;

        const canvasX = toCanvasX(trap.x);
        const canvasY = toCanvasY(trapY);
        const pulseSize = 15 + Math.sin(glowPhase) * 3;

        const gradient = ctx.createRadialGradient(
          canvasX,
          canvasY,
          0,
          canvasX,
          canvasY,
          pulseSize * 2
        );
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
        gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.3)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');

        ctx.save();
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 20;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, pulseSize * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, pulseSize * 0.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠', canvasX, canvasY);

        ctx.restore();
      });
    },
    [functionCard, toCanvasX, toCanvasY]
  );

  const drawPlayer = useCallback(
    (ctx: CanvasRenderingContext2D, glowPhase: number) => {
      const canvasX = toCanvasX(playerPosition.x);
      const canvasY = toCanvasY(playerPosition.y);
      const playerSize = 12 + Math.sin(glowPhase * 2) * 2;

      const outerGradient = ctx.createRadialGradient(
        canvasX,
        canvasY,
        0,
        canvasX,
        canvasY,
        playerSize * 3
      );
      outerGradient.addColorStop(0, 'rgba(245, 158, 11, 0.6)');
      outerGradient.addColorStop(0.5, 'rgba(245, 158, 11, 0.2)');
      outerGradient.addColorStop(1, 'rgba(245, 158, 11, 0)');

      ctx.save();
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 25;

      ctx.fillStyle = outerGradient;
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, playerSize * 3, 0, Math.PI * 2);
      ctx.fill();

      const innerGradient = ctx.createRadialGradient(
        canvasX - playerSize * 0.3,
        canvasY - playerSize * 0.3,
        0,
        canvasX,
        canvasY,
        playerSize
      );
      innerGradient.addColorStop(0, '#FEF3C7');
      innerGradient.addColorStop(0.5, '#F59E0B');
      innerGradient.addColorStop(1, '#D97706');

      ctx.fillStyle = innerGradient;
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, playerSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(canvasX - playerSize * 0.3, canvasY - playerSize * 0.3, playerSize * 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    },
    [playerPosition, toCanvasX, toCanvasY]
  );

  const drawSlopeIndicator = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const currentPoint = curvePoints.find(
        p => Math.abs(p.x - playerPosition.x) < 0.02
      );
      if (!currentPoint) return;

      const feedback = getDifferentiabilityFeedback(currentPoint.isDifferentiable, currentPoint);
      const canvasX = toCanvasX(playerPosition.x);
      const canvasY = toCanvasY(playerPosition.y);

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = feedback.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = feedback.color;
      ctx.shadowBlur = 10;

      const indicatorWidth = 180;
      const indicatorHeight = 70;
      const indicatorX = Math.min(Math.max(canvasX - indicatorWidth / 2, 10), width - indicatorWidth - 10);
      const indicatorY = canvasY - 100;

      ctx.beginPath();
      ctx.roundRect(indicatorX, indicatorY, indicatorWidth, indicatorHeight, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = feedback.color;
      ctx.font = 'bold 14px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText(
        `斜率: ${currentPoint.slope.toFixed(2)}`,
        indicatorX + indicatorWidth / 2,
        indicatorY + 25
      );

      ctx.fillStyle = feedback.color;
      ctx.font = '12px Noto Sans SC';
      ctx.fillText(
        `${feedback.icon} ${feedback.text}`,
        indicatorX + indicatorWidth / 2,
        indicatorY + 50
      );

      ctx.restore();
    },
    [curvePoints, playerPosition, toCanvasX, toCanvasY, width]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    glowPhaseRef.current += 0.05;

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    drawGrid(ctx);
    drawCurve(ctx);
    drawTraps(ctx, glowPhaseRef.current);
    drawPlayer(ctx, glowPhaseRef.current);
    drawSlopeIndicator(ctx);

    animationRef.current = requestAnimationFrame(draw);
  }, [width, height, drawGrid, drawCurve, drawTraps, drawPlayer, drawSlopeIndicator]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded-lg border-2 border-cyan-500/30 shadow-lg shadow-cyan-500/20"
    />
  );
};
