import React, { useRef, useEffect, useCallback } from 'react';
import type { Body, Marble, Vector2, GameStatus } from '@/types';

interface SimulationCanvasProps {
  bodies: Body[];
  marble: Marble;
  status: GameStatus;
  launchAngle: number;
  launchSpeed: number;
  width?: number;
  height?: number;
  onMarblePositionChange?: (position: Vector2) => void;
}

const CANVAS_WIDTH = 700;
const CANVAS_HEIGHT = 500;

export const SimulationCanvas: React.FC<SimulationCanvasProps> = ({
  bodies,
  marble,
  status,
  launchAngle,
  launchSpeed,
  width = CANVAS_WIDTH,
  height = CANVAS_HEIGHT,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<{ x: number; y: number; size: number; brightness: number }[]>([]);

  useEffect(() => {
    const stars = [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.5,
        brightness: Math.random() * 0.5 + 0.3,
      });
    }
    starsRef.current = stars;
  }, [width, height]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    for (const star of starsRef.current) {
      ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(0, 255, 136, 0.1)';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, width - 20, height - 20);
    ctx.setLineDash([]);

    const escapeRadius = Math.max(width, height) * 0.7;
    const centerX = width / 2;
    const centerY = height / 2;
    ctx.strokeStyle = 'rgba(255, 107, 53, 0.2)';
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, escapeRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (marble.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(marble.trail[0].x, marble.trail[0].y);

      for (let i = 1; i < marble.trail.length; i++) {
        const alpha = i / marble.trail.length;
        ctx.strokeStyle = `rgba(0, 255, 136, ${alpha * 0.8})`;
        ctx.lineWidth = 2 * alpha + 0.5;
        ctx.lineTo(marble.trail[i].x, marble.trail[i].y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(marble.trail[i].x, marble.trail[i].y);
      }
    }

    if (status === 'idle' || status === 'ready') {
      const angleRad = (launchAngle * Math.PI) / 180;
      const endX = marble.x + Math.cos(angleRad) * launchSpeed * 2;
      const endY = marble.y + Math.sin(angleRad) * launchSpeed * 2;

      const gradient = ctx.createLinearGradient(marble.x, marble.y, endX, endY);
      gradient.addColorStop(0, 'rgba(0, 255, 136, 0.8)');
      gradient.addColorStop(1, 'rgba(0, 255, 136, 0)');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(marble.x, marble.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);

      const arrowSize = 8;
      const arrowAngle = Math.atan2(endY - marble.y, endX - marble.x);
      ctx.fillStyle = '#00ff88';
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - arrowSize * Math.cos(arrowAngle - Math.PI / 6),
        endY - arrowSize * Math.sin(arrowAngle - Math.PI / 6)
      );
      ctx.lineTo(
        endX - arrowSize * Math.cos(arrowAngle + Math.PI / 6),
        endY - arrowSize * Math.sin(arrowAngle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    }

    for (const body of bodies) {
      const glowGradient = ctx.createRadialGradient(
        body.x, body.y, 0,
        body.x, body.y, body.radius * 2.5
      );
      glowGradient.addColorStop(0, `${body.color}60`);
      glowGradient.addColorStop(0.5, `${body.color}20`);
      glowGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(body.x, body.y, body.radius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      const bodyGradient = ctx.createRadialGradient(
        body.x - body.radius * 0.3,
        body.y - body.radius * 0.3,
        0,
        body.x,
        body.y,
        body.radius
      );
      bodyGradient.addColorStop(0, '#ffffff');
      bodyGradient.addColorStop(0.3, body.color);
      bodyGradient.addColorStop(1, `${body.color}80`);
      ctx.fillStyle = bodyGradient;
      ctx.beginPath();
      ctx.arc(body.x, body.y, body.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `${body.color}80`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const marbleGlow = ctx.createRadialGradient(
      marble.x, marble.y, 0,
      marble.x, marble.y, marble.radius * 3
    );
    marbleGlow.addColorStop(0, 'rgba(0, 255, 136, 0.6)');
    marbleGlow.addColorStop(0.5, 'rgba(0, 255, 136, 0.2)');
    marbleGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = marbleGlow;
    ctx.beginPath();
    ctx.arc(marble.x, marble.y, marble.radius * 3, 0, Math.PI * 2);
    ctx.fill();

    const marbleGradient = ctx.createRadialGradient(
      marble.x - marble.radius * 0.3,
      marble.y - marble.radius * 0.3,
      0,
      marble.x,
      marble.y,
      marble.radius
    );
    marbleGradient.addColorStop(0, '#ffffff');
    marbleGradient.addColorStop(0.3, '#00ff88');
    marbleGradient.addColorStop(1, '#00cc6a');
    ctx.fillStyle = marbleGradient;
    ctx.beginPath();
    ctx.arc(marble.x, marble.y, marble.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (status === 'running' || status === 'paused') {
      const speed = Math.sqrt(marble.vx * marble.vx + marble.vy * marble.vy);
      if (speed > 0) {
        const velScale = 20 / Math.max(speed, 1);
        const velEndX = marble.x + marble.vx * velScale;
        const velEndY = marble.y + marble.vy * velScale;

        ctx.strokeStyle = 'rgba(255, 230, 109, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(marble.x, marble.y);
        ctx.lineTo(velEndX, velEndY);
        ctx.stroke();

        const arrowSize = 6;
        const arrowAngle = Math.atan2(velEndY - marble.y, velEndX - marble.x);
        ctx.fillStyle = 'rgba(255, 230, 109, 0.8)';
        ctx.beginPath();
        ctx.moveTo(velEndX, velEndY);
        ctx.lineTo(
          velEndX - arrowSize * Math.cos(arrowAngle - Math.PI / 6),
          velEndY - arrowSize * Math.sin(arrowAngle - Math.PI / 6)
        );
        ctx.lineTo(
          velEndX - arrowSize * Math.cos(arrowAngle + Math.PI / 6),
          velEndY - arrowSize * Math.sin(arrowAngle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      }
    }

    const scanlineCount = Math.floor(height / 4);
    for (let i = 0; i < scanlineCount; i++) {
      ctx.fillStyle = `rgba(0, 0, 0, ${0.02 + (i % 2) * 0.01})`;
      ctx.fillRect(0, i * 4, width, 1);
    }

    const vignetteGradient = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.max(width, height) * 0.7
    );
    vignetteGradient.addColorStop(0, 'transparent');
    vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = vignetteGradient;
    ctx.fillRect(0, 0, width, height);
  }, [bodies, marble, status, launchAngle, launchSpeed, width, height]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded-lg border-2 border-gray-700 shadow-2xl"
        style={{
          boxShadow: '0 0 40px rgba(0, 255, 136, 0.1), inset 0 0 60px rgba(0, 0, 0, 0.5)',
        }}
      />
      <div className="absolute top-2 left-2 text-[10px] font-mono text-gray-500">
        三体引力模拟 · {width}×{height}
      </div>
      <div className="absolute bottom-2 right-2 text-[10px] font-mono text-gray-500">
        逃逸边界
      </div>
    </div>
  );
};
