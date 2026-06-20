content = '''
import { useEffect, useRef } from 'react';
import type { HeatmapPoint } from '../../shared/types';

interface HeatmapCanvasProps {
  data: HeatmapPoint[];
  width?: number;
  height?: number;
  radius?: number;
  highlightAreas?: string[];
  onPointClick?: (point: HeatmapPoint) => void;
}

export function HeatmapCanvas({
  data,
  width = 700,
  height = 500,
  radius = 40,
  highlightAreas = [],
  onPointClick,
}: HeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const areaLabels = [
      { name: '城西小区A区', x: 200, y: 200 },
      { name: '城西小区B区', x: 350, y: 200 },
      { name: '拆迁区东片', x: 500, y: 350 },
      { name: '人民广场', x: 300, y: 400 },
    ];

    areaLabels.forEach((area) => {
      const isHighlighted = highlightAreas.includes(area.name);
      ctx.strokeStyle = isHighlighted ? '#ef4444' : '#cbd5e1';
      ctx.lineWidth = isHighlighted ? 2 : 1;
      ctx.setLineDash(isHighlighted ? [5, 5] : []);
      ctx.strokeRect(area.x - 60, area.y - 60, 120, 120);
      ctx.setLineDash([]);

      ctx.fillStyle = isHighlighted ? '#ef4444' : '#64748b';
      ctx.font = '12px sans-serif';
      ctx.fillText(area.name, area.x - 40, area.y - 50);
    });

    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = width;
    shadowCanvas.height = height;
    const shadowCtx = shadowCanvas.getContext('2d');
    if (!shadowCtx) return;

    const maxValue = Math.max(...data.map((d) => d.value), 1);

    data.forEach((point) => {
      const gradient = shadowCtx.createRadialGradient(
        point.x,
        point.y,
        0,
        point.x,
        point.y,
        radius
      );
      const alpha = Math.min(point.value / maxValue, 1);
      gradient.addColorStop(0, `rgba(0, 0, 0, ${alpha * 0.8})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      shadowCtx.fillStyle = gradient;
      shadowCtx.beginPath();
      shadowCtx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      shadowCtx.fill();
    });

    const imageData = shadowCtx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3];
      if (alpha === 0) continue;

      let r, g, b;
      if (alpha < 60) {
        r = 59; g = 130; b = 246;
      } else if (alpha < 120) {
        r = 34; g = 197; b = 94;
      } else if (alpha < 180) {
        r = 234; g = 179; b = 8;
      } else {
        r = 239; g = 68; b = 68;
      }

      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = alpha * 0.7;
    }

    ctx.putImageData(imageData, 0, 0);

    data.forEach((point) => {
      const isHighlighted = point.areaName && highlightAreas.includes(point.areaName);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = isHighlighted ? '#ef4444' : 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
      ctx.strokeStyle = isHighlighted ? '#b91c1c' : 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [data, width, height, radius, highlightAreas]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onPointClick) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    let closestPoint: HeatmapPoint | null = null;
    let closestDist = Infinity;

    data.forEach((point) => {
      const dist = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2));
      if (dist < 25 && dist < closestDist) {
        closestDist = dist;
        closestPoint = point;
      }
    });

    if (closestPoint) {
      onPointClick(closestPoint);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded-xl border border-gray-200 cursor-pointer"
      onClick={handleCanvasClick}
    />
  );
}
'''

with open('/Users/lzy/pro/solo/workspaces/zy72478/src/components/HeatmapCanvas.tsx', 'w') as f:
    f.write(content)

print('HeatmapCanvas.tsx updated successfully')
