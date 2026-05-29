import { useRef, useEffect, useState } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { formatNumber } from '../utils/calculator';

export function VoltageChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; value: number; time: number } | null>(null);
  
  const currentResult = useSimulationStore((state) => state.currentResult);
  const params = useSimulationStore((state) => state.session.params);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !currentResult) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    for (let i = 0; i <= 10; i++) {
      const x = padding.left + (chartWidth / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }

    const { voltage, timePoints, maxVoltage, minVoltage } = currentResult.result;
    const voltageRange = Math.max(Math.abs(maxVoltage), Math.abs(minVoltage), 0.001);
    
    ctx.strokeStyle = '#94a3b8';
    ctx.fillStyle = '#64748b';
    ctx.font = '11px JetBrains Mono';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      const value = voltageRange - (voltageRange * 2 / 4) * i;
      ctx.fillText(formatNumber(value, 2), padding.left - 8, y);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const maxTime = timePoints[timePoints.length - 1];
    for (let i = 0; i <= 5; i++) {
      const x = padding.left + (chartWidth / 5) * i;
      const time = (maxTime / 5) * i;
      ctx.fillText(formatNumber(time, 2) + 's', x, height - padding.bottom + 8);
    }

    ctx.fillStyle = '#1e293b';
    ctx.font = '12px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText('时间 t (s)', width / 2, height - 12);
    
    ctx.save();
    ctx.translate(12, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('感应电压 ε (V)', 0, 0);
    ctx.restore();

    if (voltage.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = params.direction === -1 ? '#f97316' : '#2563eb';
      ctx.lineWidth = 2;

      voltage.forEach((v, i) => {
        const x = padding.left + (i / (voltage.length - 1)) * chartWidth;
        const y = padding.top + chartHeight / 2 - (v / voltageRange) * (chartHeight / 2);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.moveTo(padding.left, padding.top + chartHeight / 2);
      ctx.lineTo(width - padding.right, padding.top + chartHeight / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [currentResult, params.direction]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !currentResult) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;

    if (x >= padding.left && x <= rect.width - padding.right) {
      const ratio = (x - padding.left) / chartWidth;
      const index = Math.round(ratio * (currentResult.result.voltage.length - 1));
      const clampedIndex = Math.max(0, Math.min(index, currentResult.result.voltage.length - 1));
      
      setHoveredPoint({
        x,
        y,
        value: currentResult.result.voltage[clampedIndex],
        time: currentResult.result.timePoints[clampedIndex],
      });
    } else {
      setHoveredPoint(null);
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredPoint(null)}
      />
      {hoveredPoint && (
        <div
          className="absolute pointer-events-none bg-slate-800 text-white px-3 py-2 rounded text-xs font-mono shadow-lg z-10"
          style={{
            left: hoveredPoint.x + 10,
            top: hoveredPoint.y - 40,
          }}
        >
          <div>t = {formatNumber(hoveredPoint.time, 3)} s</div>
          <div>ε = {formatNumber(hoveredPoint.value, 3)} V</div>
        </div>
      )}
    </div>
  );
}
