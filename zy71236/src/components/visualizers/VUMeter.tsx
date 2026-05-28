import { useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../../engine/AudioEngine';

interface VUMeterProps {
  width?: number;
  height?: number;
  orientation?: 'horizontal' | 'vertical';
}

export function VUMeter({ width = 200, height = 24, orientation = 'horizontal' }: VUMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [isClipping, setIsClipping] = useState(false);
  const peakLevelRef = useRef(0);
  const peakHoldRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let clipCounter = 0;

    const draw = () => {
      const audioEngine = AudioEngine.getInstance();

      ctx.fillStyle = '#121212';
      ctx.fillRect(0, 0, width, height);

      let level = 0;
      if (audioEngine.getIsInitialized()) {
        level = audioEngine.getCurrentLevel();
      }

      const dbLevel = 20 * Math.log10(Math.max(level, 0.0001));
      const normalizedLevel = Math.max(0, Math.min(1, (dbLevel + 60) / 60));

      if (normalizedLevel > peakHoldRef.current) {
        peakHoldRef.current = normalizedLevel;
        peakLevelRef.current = Date.now();
      } else if (Date.now() - peakLevelRef.current > 1000) {
        peakHoldRef.current = Math.max(0, peakHoldRef.current - 0.01);
      }

      if (normalizedLevel > 0.95) {
        clipCounter++;
        if (clipCounter > 5) {
          setIsClipping(true);
          setTimeout(() => setIsClipping(false), 500);
          clipCounter = 0;
        }
      } else {
        clipCounter = Math.max(0, clipCounter - 1);
      }

      if (orientation === 'horizontal') {
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, '#22c55e');
        gradient.addColorStop(0.7, '#eab308');
        gradient.addColorStop(0.9, '#f97316');
        gradient.addColorStop(1, '#ef4444');

        ctx.fillStyle = '#374151';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 2, width * normalizedLevel, height - 4);

        if (peakHoldRef.current > 0.01) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(width * peakHoldRef.current - 2, 2, 2, height - 4);
        }

        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 1;
        for (let i = 1; i < 6; i++) {
          const x = (width / 6) * i;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
      } else {
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#22c55e');
        gradient.addColorStop(0.7, '#eab308');
        gradient.addColorStop(0.9, '#f97316');
        gradient.addColorStop(1, '#ef4444');

        ctx.fillStyle = '#374151';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = gradient;
        const barHeight = height * normalizedLevel;
        ctx.fillRect(2, height - barHeight, width - 4, barHeight);

        if (peakHoldRef.current > 0.01) {
          ctx.fillStyle = '#ffffff';
          const peakY = height - height * peakHoldRef.current;
          ctx.fillRect(2, peakY - 2, width - 4, 2);
        }
      }

      if (isClipping) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.fillRect(0, 0, width, height);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [width, height, orientation, isClipping]);

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`
          relative rounded overflow-hidden border
          ${isClipping ? 'border-red-500 animate-pulse' : 'border-gray-700'}
        `}
      >
        <canvas ref={canvasRef} width={width} height={height} className="block" />
      </div>
      {isClipping && (
        <div className="text-xs text-red-400 font-mono flex items-center gap-1">
          <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          CLIPPING
        </div>
      )}
    </div>
  );
}
