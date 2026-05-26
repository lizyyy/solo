import React, { useEffect, useRef, useState } from 'react';
import { WaterQuality, Level } from '../../types';
import { getWaterQualityColor } from '../../utils/simulation';

interface TankSimulationProps {
  waterQuality: WaterQuality;
  level: Level;
  isProcessing: boolean;
  isStirring: boolean;
}

export const TankSimulation: React.FC<TankSimulationProps> = ({
  waterQuality,
  level,
  isProcessing,
  isStirring
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [particles, setParticles] = useState<Array<{ x: number; y: number; vx: number; vy: number; life: number }>>([]);

  const waterColor = getWaterQualityColor(waterQuality, level.targetThresholds);

  useEffect(() => {
    if (isProcessing) {
      const newParticles = Array.from({ length: 20 }, () => ({
        x: 200 + Math.random() * 100 - 50,
        y: 50,
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 2 + 1,
        life: 1
      }));
      setParticles(prev => [...prev, ...newParticles]);
    }
  }, [isProcessing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const animate = () => {
      time += 0.05;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const tankX = 50;
      const tankY = 80;
      const tankWidth = 300;
      const tankHeight = 200;
      const waterLevel = 170;

      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(tankX, tankY, tankWidth, tankHeight, [0, 0, 8, 8]);
      ctx.fill();
      ctx.stroke();

      const gradient = ctx.createLinearGradient(tankX, tankY + waterLevel - 20, tankX, tankY + tankHeight);
      gradient.addColorStop(0, waterColor + '80');
      gradient.addColorStop(1, waterColor + 'cc');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(tankX + 2, tankY + waterLevel);
      
      for (let x = 0; x <= tankWidth - 4; x += 5) {
        const waveY = Math.sin((x + time * 50) * 0.05) * (isStirring ? 8 : 2);
        ctx.lineTo(tankX + 2 + x, tankY + waterLevel + waveY);
      }
      
      ctx.lineTo(tankX + tankWidth - 2, tankY + tankHeight - 2);
      ctx.lineTo(tankX + 2, tankY + tankHeight - 2);
      ctx.closePath();
      ctx.fill();

      if (isStirring) {
        ctx.strokeStyle = waterColor + '60';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          const centerX = tankX + tankWidth / 2;
          const centerY = tankY + waterLevel + 40;
          const radius = 30 + i * 25 + Math.sin(time * 3 + i) * 5;
          
          for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
            const x = centerX + Math.cos(angle + time * 2) * radius;
            const y = centerY + Math.sin(angle + time * 2) * radius * 0.6;
            if (angle === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      setParticles(prev => {
        const updated = prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            life: p.life - 0.02
          }))
          .filter(p => p.life > 0 && p.y < tankY + waterLevel);

        updated.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4 * p.life, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(147, 197, 253, ${p.life})`;
          ctx.fill();
        });

        return updated;
      });

      ctx.fillStyle = '#334155';
      ctx.fillRect(20, tankY + waterLevel - 15, 35, 8);
      ctx.fillStyle = '#22d3ee';
      ctx.font = '10px monospace';
      ctx.fillText('进水', 25, tankY + waterLevel + 25);

      ctx.fillStyle = '#334155';
      ctx.fillRect(tankX + tankWidth - 5, tankY + waterLevel + 30, 35, 8);
      ctx.fillStyle = '#22d3ee';
      ctx.fillText('出水', tankX + tankWidth + 5, tankY + waterLevel + 70);

      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(200, tankY + 20, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('药', 200, tankY + 24);
      ctx.textAlign = 'left';

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(animationId);
  }, [waterColor, isStirring, isProcessing]);

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 backdrop-blur-sm border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">处理池模拟</h3>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></span>
          <span className="text-sm text-slate-400">
            {isProcessing ? '处理中...' : isStirring ? '搅拌中' : '待机'}
          </span>
        </div>
      </div>
      
      <canvas
        ref={canvasRef}
        width={400}
        height={320}
        className="w-full bg-slate-900/50 rounded-lg"
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="p-3 bg-slate-900/50 rounded-lg">
          <div className="text-xs text-slate-500 mb-1">当前水质状态</div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: waterColor }}></div>
            <span className="text-sm font-medium text-white">
              {waterColor === '#4ade80' || waterColor === '#22c55e' ? '良好' :
               waterColor === '#fbbf24' ? '接近阈值' :
               waterColor === '#f97316' ? '超标风险' : '严重超标'}
            </span>
          </div>
        </div>
        <div className="p-3 bg-slate-900/50 rounded-lg">
          <div className="text-xs text-slate-500 mb-1">药剂成本单价</div>
          <div className="text-sm font-mono text-cyan-400">¥{level.chemicalCost}/单位</div>
        </div>
      </div>
    </div>
  );
};
