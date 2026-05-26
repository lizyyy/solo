import { useEffect, useRef } from 'react';
import type { GameState, Level } from '../../engine/types';
import { COLORS } from '../../engine/constants';

interface ReservoirCanvasProps {
  state: GameState | null;
  level: Level | null;
  width?: number;
  height?: number;
}

export function ReservoirCanvas({ state, level, width = 600, height = 350 }: ReservoirCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<{ x: number; y: number; speed: number; size: number }[]>([]);

  useEffect(() => {
    if (state && state.outflow > 50) {
      const newParticles = [];
      for (let i = 0; i < Math.min(20, state.outflow / 50); i++) {
        newParticles.push({
          x: width * 0.52 + Math.random() * 20,
          y: height * 0.55 + Math.random() * 10,
          speed: 2 + Math.random() * 3,
          size: 2 + Math.random() * 3,
        });
      }
      particlesRef.current = [...particlesRef.current, ...newParticles].slice(-50);
    }
  }, [state, width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state || !level) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.4);
      skyGradient.addColorStop(0, '#0f172a');
      skyGradient.addColorStop(1, '#1e3a5f');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, width, height * 0.4);

      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.moveTo(0, height * 0.35);
      ctx.lineTo(width * 0.15, height * 0.25);
      ctx.lineTo(width * 0.3, height * 0.32);
      ctx.lineTo(width * 0.45, height * 0.28);
      ctx.lineTo(width * 0.5, height * 0.35);
      ctx.lineTo(0, height * 0.35);
      ctx.fill();

      const damX = width * 0.5;
      const damTopY = height * 0.35;
      const damBottomY = height * 0.75;
      const damWidth = width * 0.08;

      const reservoirBottomY = height * 0.7;
      const storageRatio = state.reservoirStorage / level.maxStorage;
      const waterHeight = Math.min(1, Math.max(0, storageRatio)) * (reservoirBottomY - damTopY);
      const waterSurfaceY = reservoirBottomY - waterHeight;

      ctx.fillStyle = '#78716c';
      ctx.beginPath();
      ctx.moveTo(0, reservoirBottomY);
      ctx.lineTo(damX - damWidth / 2, reservoirBottomY);
      ctx.lineTo(damX - damWidth / 2, damTopY + 20);
      ctx.lineTo(0, damTopY + 40);
      ctx.fill();

      const waterGradient = ctx.createLinearGradient(0, waterSurfaceY, 0, reservoirBottomY);
      waterGradient.addColorStop(0, COLORS.water);
      waterGradient.addColorStop(1, COLORS.waterDark);
      ctx.fillStyle = waterGradient;
      ctx.fillRect(2, waterSurfaceY, damX - damWidth / 2 - 2, reservoirBottomY - waterSurfaceY);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(2, waterSurfaceY, damX - damWidth / 2 - 2, 3);

      const damGradient = ctx.createLinearGradient(damX - damWidth / 2, 0, damX + damWidth / 2, 0);
      damGradient.addColorStop(0, COLORS.damDark);
      damGradient.addColorStop(0.5, COLORS.dam);
      damGradient.addColorStop(1, COLORS.damDark);
      ctx.fillStyle = damGradient;
      ctx.fillRect(damX - damWidth / 2, damTopY, damWidth, damBottomY - damTopY);

      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(damX - damWidth / 2 - 5, damTopY - 8, damWidth + 10, 12);

      const gateHeight = (damBottomY - damTopY) * 0.4;
      const gateWidth = damWidth * 0.6;
      const gateX = damX - gateWidth / 2;
      const gateY = damTopY + (damBottomY - damTopY - gateHeight) / 2;
      const gateOpenHeight = gateHeight * (state.gateOpening / 100);

      ctx.fillStyle = '#374151';
      ctx.fillRect(gateX - 3, gateY - 3, gateWidth + 6, gateHeight + 6);

      ctx.fillStyle = '#1f2937';
      ctx.fillRect(gateX, gateY, gateWidth, gateHeight - gateOpenHeight);

      if (gateOpenHeight > 2) {
        const outflowGradient = ctx.createLinearGradient(damX, 0, damX + 100, 0);
        outflowGradient.addColorStop(0, COLORS.water);
        outflowGradient.addColorStop(1, 'rgba(37, 99, 235, 0)');
        ctx.fillStyle = outflowGradient;
        ctx.fillRect(
          damX + damWidth / 2,
          gateY + gateHeight - gateOpenHeight,
          80,
          gateOpenHeight
        );

        particlesRef.current = particlesRef.current
          .map(p => ({ ...p, x: p.x + p.speed }))
          .filter(p => p.x < width);
        
        for (const particle of particlesRef.current) {
          ctx.fillStyle = `rgba(59, 130, 246, ${0.3 + Math.random() * 0.4})`;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const downstreamY = damBottomY + 10;
      const downstreamWidth = width - damX - damWidth / 2 - 20;
      const downstreamWaterHeight = 30 + (state.downstreamLevel / 100) * 40;
      
      ctx.fillStyle = '#78716c';
      ctx.fillRect(damX + damWidth / 2, downstreamY, downstreamWidth, 60);

      const downstreamGradient = ctx.createLinearGradient(0, downstreamY, 0, downstreamY + downstreamWaterHeight);
      downstreamGradient.addColorStop(0, state.isDownstreamDanger ? COLORS.danger : state.isDownstreamWarning ? COLORS.warning : COLORS.water);
      downstreamGradient.addColorStop(1, state.isDownstreamDanger ? '#991b1b' : state.isDownstreamWarning ? '#92400e' : COLORS.waterDark);
      ctx.fillStyle = downstreamGradient;
      ctx.fillRect(
        damX + damWidth / 2 + 5,
        downstreamY,
        downstreamWidth - 10,
        downstreamWaterHeight
      );

      ctx.fillStyle = state.isOvertopping ? COLORS.danger : '#374151';
      ctx.fillRect(width * 0.02, height * 0.05, 120, 28);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`水库水位`, width * 0.04, height * 0.07 + 6);
      ctx.fillStyle = state.isOvertopping ? COLORS.danger : '#60a5fa';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`${(storageRatio * 100).toFixed(1)}%`, width * 0.04 + 60, height * 0.07 + 8);

      ctx.strokeStyle = COLORS.safety;
      ctx.setLineDash([4, 4]);
      const normalWaterY = reservoirBottomY - (level.normalStorage / level.maxStorage) * (reservoirBottomY - damTopY);
      ctx.beginPath();
      ctx.moveTo(10, normalWaterY);
      ctx.lineTo(damX - damWidth / 2 - 5, normalWaterY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLORS.safety;
      ctx.font = '10px sans-serif';
      ctx.fillText('正常', damX - damWidth / 2 - 30, normalWaterY - 5);

      ctx.strokeStyle = COLORS.danger;
      ctx.setLineDash([3, 3]);
      const maxWaterY = damTopY + 10;
      ctx.beginPath();
      ctx.moveTo(10, maxWaterY);
      ctx.lineTo(damX - damWidth / 2 - 5, maxWaterY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLORS.danger;
      ctx.font = '10px sans-serif';
      ctx.fillText('上限', damX - damWidth / 2 - 30, maxWaterY - 5);

      ctx.fillStyle = state.isDownstreamDanger ? COLORS.danger : state.isDownstreamWarning ? COLORS.warning : '#374151';
      ctx.fillRect(width * 0.7, height * 0.05, 130, 28);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`下游水位`, width * 0.72, height * 0.07 + 6);
      ctx.fillStyle = state.isDownstreamDanger ? COLORS.danger : state.isDownstreamWarning ? COLORS.warning : '#60a5fa';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`${state.downstreamLevel.toFixed(0)}%`, width * 0.72 + 65, height * 0.07 + 8);

      ctx.fillStyle = '#374151';
      ctx.fillRect(width * 0.35, height * 0.05, 100, 28);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`闸门`, width * 0.37, height * 0.07 + 6);
      ctx.fillStyle = '#60a5fa';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`${state.gateOpening.toFixed(0)}%`, width * 0.37 + 35, height * 0.07 + 8);

      if (state.isOvertopping) {
        ctx.fillStyle = COLORS.danger;
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('⚠ 漫坝警告！', width * 0.02, height * 0.95);
      }
      if (state.isDownstreamDanger) {
        ctx.fillStyle = COLORS.danger;
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('⚠ 下游超警！', width * 0.7, height * 0.95);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state, level, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded-lg border border-slate-700"
    />
  );
}
