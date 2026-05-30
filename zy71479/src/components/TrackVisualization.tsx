import { useEffect, useRef } from 'react';
import type { CornerData } from '../types';
import { getStatusColor } from '../utils/calculations';

interface TrackVisualizationProps {
  corners: CornerData[];
  selectedCorner: CornerData | null;
  onSelectCorner: (corner: CornerData) => void;
}

const TrackVisualization = ({ corners, selectedCorner, onSelectCorner }: TrackVisualizationProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const trackPath = [
      { x: 80, y: 200 },
      { x: 100, y: 100 },
      { x: 250, y: 80 },
      { x: 400, y: 120 },
      { x: 480, y: 220 },
      { x: 420, y: 320 },
      { x: 280, y: 350 },
      { x: 140, y: 320 },
      { x: 80, y: 240 },
    ];

    ctx.beginPath();
    ctx.moveTo(trackPath[0].x, trackPath[0].y);
    for (let i = 1; i < trackPath.length; i++) {
      const xc = (trackPath[i].x + trackPath[i - 1].x) / 2;
      const yc = (trackPath[i].y + trackPath[i - 1].y) / 2;
      ctx.quadraticCurveTo(trackPath[i - 1].x, trackPath[i - 1].y, xc, yc);
    }
    ctx.closePath();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 40;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 42;
    ctx.stroke();

    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    corners.forEach((corner) => {
      const isSelected = selectedCorner?.id === corner.id;
      const color = getStatusColor(corner.status);
      const pulseSize = isSelected ? 8 : 0;

      if (isSelected) {
        const gradient = ctx.createRadialGradient(
          corner.position.x,
          corner.position.y,
          0,
          corner.position.x,
          corner.position.y,
          35
        );
        gradient.addColorStop(0, color + '40');
        gradient.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(corner.position.x, corner.position.y, 35, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(corner.position.x, corner.position.y, 14 + pulseSize, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#ffffff' : '#1e293b';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`T${corner.cornerNumber}`, corner.position.x, corner.position.y);
    });

    corners.forEach((corner) => {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${corner.speed.value}km/h`, corner.position.x, corner.position.y - 24);
    });
  }, [corners, selectedCorner]);

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white">赛道可视化</h2>
        <span className="text-xs text-slate-400">点击弯道查看详情</span>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={560}
          height={400}
          className="w-full rounded-lg cursor-pointer"
          onClick={(e) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const scaleX = 560 / rect.width;
            const scaleY = 400 / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;

            const clicked = corners.find((c) => {
              const dx = c.position.x - x;
              const dy = c.position.y - y;
              return Math.sqrt(dx * dx + dy * dy) < 25;
            });

            if (clicked) {
              onSelectCorner(clicked);
            }
          }}
        />
      </div>
    </div>
  );
};

export default TrackVisualization;
