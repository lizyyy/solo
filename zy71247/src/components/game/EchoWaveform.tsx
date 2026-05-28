import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';

export function EchoWaveform() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const scanPosition = useRef(0);
  const { params } = useGameStore();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#081020';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(100, 255, 218, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const sampleCount = Math.floor(width / params.sampling.interval) - 1;
    const samples: number[] = [];
    
    for (let i = 0; i < sampleCount; i++) {
      const t = i / sampleCount;
      const baseSignal = Math.sin(t * Math.PI * 4) * 0.3 + 0.5;
      const detail = Math.sin(t * Math.PI * 16 + params.flightPath.offsetX * 0.1) * 0.1;
      const noise = (Math.random() - 0.5) * (params.noise.level / 100) * 0.3;
      samples.push(Math.max(0.1, Math.min(0.9, baseSignal + detail + noise)));
    }

    ctx.strokeStyle = '#64FFDA';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#64FFDA';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    
    samples.forEach((sample, i) => {
      const x = (i / sampleCount) * width;
      const y = height - sample * height * 0.8 - 10;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#FFB703';
    const actualSamplePoints = Math.floor(params.sampling.count / 4);
    for (let i = 0; i < actualSamplePoints && i < samples.length; i++) {
      const idx = Math.floor((i / actualSamplePoints) * (samples.length - 1));
      const x = (idx / samples.length) * width;
      const y = height - samples[idx] * height * 0.8 - 10;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(255, 183, 3, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, height - 5);
      ctx.stroke();
    }

    scanPosition.current = (scanPosition.current + 2) % width;
    ctx.fillStyle = 'rgba(100, 255, 218, 0.3)';
    ctx.fillRect(scanPosition.current - 1, 0, 2, height);

    const gradient = ctx.createLinearGradient(scanPosition.current - 30, 0, scanPosition.current, 0);
    gradient.addColorStop(0, 'rgba(100, 255, 218, 0)');
    gradient.addColorStop(1, 'rgba(100, 255, 218, 0.1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(scanPosition.current - 30, 0, 30, height);

  }, [params]);

  useEffect(() => {
    const animate = () => {
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw]);

  return (
    <div className="card-bg rounded-lg p-4 border border-tech-500/30">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-orbitron text-tech-400 text-sm font-semibold">雷达回波</h3>
        <div className="flex gap-4 text-xs">
          <span className="text-space-300">采样点: <span className="text-alert-yellow">{params.sampling.count}</span></span>
          <span className="text-space-300">间隔: <span className="text-tech-400">{params.sampling.interval}ms</span></span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={350}
        height={120}
        className="w-full rounded border border-tech-500/20"
      />
      <div className="mt-2 flex justify-between text-xs">
        <span className="text-space-400">0</span>
        <span className="text-space-400">时间 →</span>
        <span className="text-space-400">t</span>
      </div>
    </div>
  );
}
