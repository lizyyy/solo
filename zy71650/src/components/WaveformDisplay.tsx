import { useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store';

interface WaveformDisplayProps {
  waveformData: number[];
  onsetSample: number;
}

export default function WaveformDisplay({ waveformData, onsetSample }: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const setOnsetSample = useAppStore((s) => s.setOnsetSample);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || waveformData.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    ctx.fillStyle = '#0F1117';
    ctx.fillRect(0, 0, w, h);

    const midY = h * 0.45;
    const ampScale = h * 0.35;

    ctx.strokeStyle = '#39FF14';
    ctx.lineWidth = 1;
    ctx.beginPath();

    const step = w / waveformData.length;
    for (let i = 0; i < waveformData.length; i++) {
      const x = i * step;
      const y = midY - waveformData[i] * ampScale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i < waveformData.length; i++) {
      const x = i * step;
      const y = midY + waveformData[i] * ampScale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const onsetRatio = onsetSample / waveformData.length;
    const onsetX = onsetRatio * w;

    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(onsetX, 0);
    ctx.lineTo(onsetX, h - 24);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#FFB800';
    ctx.font = '10px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText('ONSET', onsetX, 12);

    ctx.strokeStyle = '#2A2D3E';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - 24);
    ctx.lineTo(w, h - 24);
    ctx.stroke();

    ctx.fillStyle = '#6B7280';
    ctx.font = '9px JetBrains Mono';
    ctx.textAlign = 'center';
    const totalSec = waveformData.length;
    const tickCount = Math.min(10, Math.floor(w / 60));
    for (let i = 0; i <= tickCount; i++) {
      const x = (i / tickCount) * w;
      const sec = Math.round((i / tickCount) * totalSec);
      ctx.fillText(`${sec}s`, x, h - 8);
    }
  }, [waveformData, onsetSample]);

  useEffect(() => {
    draw();
    const resizeObserver = new ResizeObserver(draw);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [draw]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || waveformData.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;
      const sample = Math.round(ratio * waveformData.length);
      setOnsetSample(Math.max(0, Math.min(sample, waveformData.length - 1)));
    },
    [waveformData.length, setOnsetSample],
  );

  return (
    <div
      ref={containerRef}
      className="w-full h-48 rounded-xl bg-synth-bg border border-synth-border overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="w-full h-full cursor-crosshair"
      />
    </div>
  );
}
