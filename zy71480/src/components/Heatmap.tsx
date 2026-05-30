import { useEffect, useRef, useState, useMemo } from 'react';
import { useStore } from '../store';
import { Speaker } from '../types';

export function Heatmap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { results, speakers, selectedResultId, selectResult, splThreshold } = useStore();
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; spl: number } | null>(null);

  const bounds = useMemo(() => {
    if (results.length === 0) {
      return { minX: 0, maxX: 20, minY: 0, maxY: 15, minSpl: 60, maxSpl: 120 };
    }

    const xs = results.map((r) => r.x);
    const ys = results.map((r) => r.y);
    const spls = results.map((r) => r.totalSpl);

    return {
      minX: Math.min(...xs) - 1,
      maxX: Math.max(...xs) + 1,
      minY: Math.min(...ys) - 1,
      maxY: Math.max(...ys) + 1,
      minSpl: Math.floor(Math.min(...spls) - 5),
      maxSpl: Math.ceil(Math.max(...spls) + 5),
    };
  }, [results]);

  const getColorForSpl = (spl: number, minSpl: number, maxSpl: number): string => {
    const normalized = Math.max(0, Math.min(1, (spl - minSpl) / (maxSpl - minSpl)));

    const r = Math.round(255 * normalized);
    const g = Math.round(255 * (1 - Math.abs(normalized - 0.5) * 2));
    const b = Math.round(255 * (1 - normalized));

    return `rgb(${r}, ${g}, ${b})`;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    const padding = 50;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;

    const toCanvasX = (x: number) => padding + ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * plotWidth;
    const toCanvasY = (y: number) => padding + plotHeight - ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * plotHeight;

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.5;

    for (let x = Math.ceil(bounds.minX); x <= bounds.maxX; x++) {
      const cx = toCanvasX(x);
      ctx.beginPath();
      ctx.moveTo(cx, padding);
      ctx.lineTo(cx, padding + plotHeight);
      ctx.stroke();
    }

    for (let y = Math.ceil(bounds.minY); y <= bounds.maxY; y++) {
      const cy = toCanvasY(y);
      ctx.beginPath();
      ctx.moveTo(padding, cy);
      ctx.lineTo(padding + plotWidth, cy);
      ctx.stroke();
    }

    ctx.fillStyle = '#64748b';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';

    for (let x = Math.ceil(bounds.minX); x <= bounds.maxX; x += 2) {
      const cx = toCanvasX(x);
      ctx.fillText(`${x}`, cx, padding + plotHeight + 15);
    }

    ctx.textAlign = 'right';
    for (let y = Math.ceil(bounds.minY); y <= bounds.maxY; y += 3) {
      const cy = toCanvasY(y);
      ctx.fillText(`${y}`, padding - 8, cy + 3);
    }

    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.font = '12px Noto Sans SC, sans-serif';
    ctx.fillText('X (m)', padding + plotWidth / 2, height - 10);

    ctx.save();
    ctx.translate(15, padding + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Y (m)', 0, 0);
    ctx.restore();

    if (results.length > 0) {
      const stepX = (bounds.maxX - bounds.minX) / 20;
      const stepY = (bounds.maxY - bounds.minY) / 15;
      const cellWidth = plotWidth / ((bounds.maxX - bounds.minX) / stepX);
      const cellHeight = plotHeight / ((bounds.maxY - bounds.minY) / stepY);

      results.forEach((result) => {
        const cx = toCanvasX(result.x);
        const cy = toCanvasY(result.y);

        const color = getColorForSpl(result.totalSpl, bounds.minSpl, bounds.maxSpl);

        const hasError = result.errors.length > 0;
        const isSelected = result.id === selectedResultId;

        if (hasError) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
          ctx.fillRect(cx - cellWidth / 2 - 2, cy - cellHeight / 2 - 2, cellWidth + 4, cellHeight + 4);
        }

        if (isSelected) {
          ctx.fillStyle = 'rgba(6, 182, 212, 0.4)';
          ctx.fillRect(cx - cellWidth / 2 - 4, cy - cellHeight / 2 - 4, cellWidth + 8, cellHeight + 8);
        }

        ctx.fillStyle = color;
        ctx.fillRect(cx - cellWidth / 2, cy - cellHeight / 2, cellWidth, cellHeight);
      });

      speakers.forEach((speaker: Speaker, index: number) => {
        const sx = toCanvasX(speaker.x);
        const sy = toCanvasY(speaker.y);

        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.moveTo(sx, sy - 12);
        ctx.lineTo(sx - 10, sy + 8);
        ctx.lineTo(sx + 10, sy + 8);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${index + 1}`, sx, sy + 4);

        ctx.fillStyle = '#06b6d4';
        ctx.font = '10px Noto Sans SC, sans-serif';
        ctx.fillText(speaker.name, sx, sy + 20);
      });

      const legendX = width - 60;
      const legendY = padding;
      const legendHeight = plotHeight;
      const legendWidth = 20;

      const gradient = ctx.createLinearGradient(0, legendY + legendHeight, 0, legendY);
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const ratio = i / steps;
        const spl = bounds.minSpl + ratio * (bounds.maxSpl - bounds.minSpl);
        gradient.addColorStop(ratio, getColorForSpl(spl, bounds.minSpl, bounds.maxSpl));
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(legendX, legendY, legendWidth, legendHeight);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'left';

      for (let i = 0; i <= 5; i++) {
        const ratio = i / 5;
        const y = legendY + legendHeight - ratio * legendHeight;
        const spl = bounds.minSpl + ratio * (bounds.maxSpl - bounds.minSpl);
        ctx.fillText(`${spl.toFixed(0)}dB`, legendX + 25, y + 3);
      }

      if (splThreshold >= bounds.minSpl && splThreshold <= bounds.maxSpl) {
        const thresholdY = legendY + legendHeight - ((splThreshold - bounds.minSpl) / (bounds.maxSpl - bounds.minSpl)) * legendHeight;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(legendX - 5, thresholdY);
        ctx.lineTo(legendX + legendWidth + 5, thresholdY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#ef4444';
        ctx.fillText('阈值', legendX + 25, thresholdY - 5);
      }
    }
  }, [results, speakers, selectedResultId, bounds, splThreshold]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || results.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = 50;
    const plotWidth = rect.width - padding * 2;
    const plotHeight = rect.height - padding * 2;

    const worldX = bounds.minX + ((x - padding) / plotWidth) * (bounds.maxX - bounds.minX);
    const worldY = bounds.maxY - ((y - padding) / plotHeight) * (bounds.maxY - bounds.minY);

    let closestResult = null;
    let minDist = Infinity;

    results.forEach((result) => {
      const dx = result.x - worldX;
      const dy = result.y - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist && dist < 1.5) {
        minDist = dist;
        closestResult = result;
      }
    });

    if (closestResult) {
      selectResult(closestResult.id === selectedResultId ? null : closestResult.id);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || results.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = 50;
    const plotWidth = rect.width - padding * 2;
    const plotHeight = rect.height - padding * 2;

    const worldX = bounds.minX + ((x - padding) / plotWidth) * (bounds.maxX - bounds.minX);
    const worldY = bounds.maxY - ((y - padding) / plotHeight) * (bounds.maxY - bounds.minY);

    let closestResult = null;
    let minDist = Infinity;

    results.forEach((result) => {
      const dx = result.x - worldX;
      const dy = result.y - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist && dist < 1.5) {
        minDist = dist;
        closestResult = result;
      }
    });

    if (closestResult) {
      setHoveredPoint({ x: closestResult.x, y: closestResult.y, spl: closestResult.totalSpl });
      canvas.style.cursor = 'pointer';
    } else {
      setHoveredPoint(null);
      canvas.style.cursor = 'default';
    }
  };

  return (
    <div className="h-full flex flex-col bg-acoustic-800 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-acoustic-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">声场热力图</h2>
        <div className="flex items-center gap-4 text-sm">
          {hoveredPoint && (
            <span className="text-gray-400">
              位置: <span className="text-accent-primary font-mono">({hoveredPoint.x.toFixed(1)}, {hoveredPoint.y.toFixed(1)})</span>
              {' | '}
              声压: <span className="font-mono" style={{ color: getColorForSpl(hoveredPoint.spl, bounds.minSpl, bounds.maxSpl) }}>
                {hoveredPoint.spl.toFixed(1)} dB
              </span>
            </span>
          )}
          {results.length > 0 && (
            <span className="text-gray-500">
              共 {results.length} 个测点 | {speakers.length} 个音箱
            </span>
          )}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
          className="absolute inset-0"
        />

        {results.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p>暂无计算结果</p>
              <p className="text-sm mt-2">添加音箱后点击"开始计算"</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
