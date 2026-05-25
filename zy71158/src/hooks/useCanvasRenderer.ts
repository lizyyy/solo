import { useRef, useEffect, useCallback } from 'react';
import { Stall, Customer, HistoryFrame } from '@/types/game';
import { calculateStallSmoke } from '@/utils/simulation';

interface CanvasRendererOptions {
  width: number;
  height: number;
  stalls: Stall[];
  customers: Customer[];
  totalElectricity: number;
  maxElectricity: number;
  totalSmoke: number;
  maxSmoke: number;
  phase: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  stallId: string;
}

export function useCanvasRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options: CanvasRendererOptions
) {
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const customerPositionsRef = useRef<Map<string, { x: number; y: number; targetX: number; targetY: number }>>(new Map());

  const spawnParticles = useCallback((stall: Stall, count: number) => {
    const smoke = calculateStallSmoke(stall);
    if (smoke <= 0) return;

    for (let i = 0; i < count; i++) {
      const particle: Particle = {
        x: stall.position.x + (Math.random() - 0.5) * 40,
        y: stall.position.y - 20,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -Math.random() * 1 - 0.5,
        alpha: 0.6 + Math.random() * 0.4,
        size: 15 + Math.random() * 25,
        stallId: stall.id,
      };
      particlesRef.current.push(particle);
    }

    const maxParticles = 200;
    if (particlesRef.current.length > maxParticles) {
      particlesRef.current = particlesRef.current.slice(-maxParticles);
    }
  }, []);

  const drawStall = useCallback(
    (ctx: CanvasRenderingContext2D, stall: Stall, isOverCapacity: boolean) => {
      const { x, y } = stall.position;
      const width = 70;
      const height = 50;

      ctx.save();

      ctx.shadowColor = stall.color;
      ctx.shadowBlur = stall.isOn ? 15 : 0;

      ctx.fillStyle = stall.isOn ? stall.color : '#3A3A5C';
      ctx.beginPath();
      ctx.roundRect(x - width / 2, y - height / 2, width, height, 8);
      ctx.fill();

      ctx.shadowBlur = 0;

      ctx.strokeStyle = isOverCapacity ? '#E63946' : stall.isOn ? '#FFD23F' : '#5A5A7C';
      ctx.lineWidth = isOverCapacity ? 3 : 2;
      ctx.beginPath();
      ctx.roundRect(x - width / 2, y - height / 2, width, height, 8);
      ctx.stroke();

      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(stall.emoji, x, y - 5);

      ctx.font = 'bold 10px system-ui';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(stall.name, x, y + 18);

      ctx.font = '10px system-ui';
      ctx.fillStyle = stall.isOn ? '#2EC4B6' : '#E63946';
      ctx.fillText(stall.isOn ? 'ON' : 'OFF', x + 25, y - height / 2 - 8);

      if (stall.isOn && stall.power > 0) {
        const barWidth = 50;
        const barHeight = 4;
        const barX = x - barWidth / 2;
        const barY = y + height / 2 + 4;

        ctx.fillStyle = '#3A3A5C';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const powerRatio = stall.power / 100;
        const powerColor = powerRatio > 0.8 ? '#E63946' : powerRatio > 0.5 ? '#FFD23F' : '#2EC4B6';
        ctx.fillStyle = powerColor;
        ctx.fillRect(barX, barY, barWidth * powerRatio, barHeight);
      }

      ctx.restore();
    },
    []
  );

  const drawParticles = useCallback((ctx: CanvasRenderingContext2D) => {
    const particles = particlesRef.current;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.008;
      p.size += 0.3;

      if (p.alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }

      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      gradient.addColorStop(0, `rgba(255, 107, 53, ${p.alpha * 0.6})`);
      gradient.addColorStop(0.5, `rgba(255, 107, 53, ${p.alpha * 0.3})`);
      gradient.addColorStop(1, 'rgba(255, 107, 53, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  const drawCustomers = useCallback(
    (ctx: CanvasRenderingContext2D, customers: Customer[], stalls: Stall[]) => {
      customers.forEach((customer) => {
        const stored = customerPositionsRef.current.get(customer.id);
        let cx = stored?.x ?? customer.x;
        let cy = stored?.y ?? customer.y;

        if (customer.targetStallId) {
          const targetStall = stalls.find((s) => s.id === customer.targetStallId);
          if (targetStall && targetStall.isOn) {
            const dx = targetStall.position.x - cx;
            const dy = targetStall.position.y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 5) {
              cx += (dx / dist) * customer.speed;
              cy += (dy / dist) * customer.speed;
            }
          }
        }

        customerPositionsRef.current.set(customer.id, {
          x: cx,
          y: cy,
          targetX: customer.x,
          targetY: customer.y,
        });

        ctx.fillStyle = '#FFD23F';
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1A1A2E';
        ctx.beginPath();
        ctx.arc(cx, cy - 2, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    },
    []
  );

  const drawBackground = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0D0D1A');
    gradient.addColorStop(0.5, '#1A1A2E');
    gradient.addColorStop(1, '#0D0D1A');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 50; i++) {
      const x = (i * 137) % width;
      const y = (i * 89) % (height * 0.6);
      const size = (i % 3) + 1;
      const alpha = 0.3 + (i % 5) * 0.15;

      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(255, 107, 53, 0.1)';
    ctx.fillRect(0, height - 80, width, 80);

    ctx.strokeStyle = 'rgba(255, 210, 63, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(0, height - 80);
    ctx.lineTo(width, height - 80);
    ctx.stroke();
    ctx.setLineDash([]);
  }, []);

  const drawCapacityBar = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, electricity: number, maxElectricity: number) => {
      const barWidth = width - 40;
      const barHeight = 12;
      const barX = 20;
      const barY = 20;

      ctx.fillStyle = '#252540';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barWidth, barHeight, 6);
      ctx.fill();

      const ratio = Math.min(electricity / maxElectricity, 1.2);
      const fillWidth = Math.min(barWidth * ratio, barWidth);
      const fillColor = ratio > 1 ? '#E63946' : ratio > 0.85 ? '#FF6B35' : '#2EC4B6';

      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.roundRect(barX, barY, fillWidth, barHeight, 6);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(barX + barWidth * 0.85, barY - 2);
      ctx.lineTo(barX + barWidth * 0.85, barY + barHeight + 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = 'bold 12px system-ui';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.fillText(`⚡ ${Math.round(electricity)} / ${maxElectricity}`, barX, barY - 6);
    },
    []
  );

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height, stalls, customers, totalElectricity, maxElectricity, totalSmoke, maxSmoke } = options;

    drawBackground(ctx, width, height);

    const isOverCapacity = totalElectricity > maxElectricity;

    stalls.forEach((stall) => {
      if (stall.isOn && Math.random() < 0.3) {
        spawnParticles(stall, 1);
      }
      drawStall(ctx, stall, isOverCapacity);
    });

    drawParticles(ctx);
    drawCustomers(ctx, customers, stalls);
    drawCapacityBar(ctx, width, totalElectricity, maxElectricity);

    if (options.phase === 'paused') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, width, height);

      ctx.font = 'bold 36px system-ui';
      ctx.fillStyle = '#FFD23F';
      ctx.textAlign = 'center';
      ctx.fillText('⏸ 已暂停', width / 2, height / 2);
    }

    animationRef.current = requestAnimationFrame(render);
  }, [options, canvasRef, drawBackground, drawStall, drawParticles, drawCustomers, drawCapacityBar, spawnParticles]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [render]);

  return { particlesRef };
}