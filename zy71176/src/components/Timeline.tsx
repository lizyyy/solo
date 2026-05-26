import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../game/state';
import { getLevelById } from '../game/levels';
import { formatTime } from '../game/rules';

interface TimelineProps {
  height?: number;
}

export function Timeline({ height = 120 }: TimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentTime = useGameStore((state) => state.currentTime);
  const guests = useGameStore((state) => state.guests);
  const rooms = useGameStore((state) => state.rooms);
  const currentLevel = useGameStore((state) => state.currentLevel);
  const cleaners = useGameStore((state) => state.cleaners);

  const level = getLevelById(currentLevel);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !level) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#1a202c';
    ctx.fillRect(0, 0, width, height);

    const padding = { top: 30, bottom: 20, left: 60, right: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const timeRange = level.duration;
    const pixelsPerMinute = chartWidth / timeRange;

    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 1;

    for (let i = 0; i <= timeRange; i += 10) {
      const x = padding.left + i * pixelsPerMinute;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();

      ctx.fillStyle = '#718096';
      ctx.font = '10px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(formatTime(i), x, padding.top - 8);
    }

    const currentX = padding.left + currentTime * pixelsPerMinute;
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(currentX, padding.top - 15);
    ctx.lineTo(currentX, height - padding.bottom + 15);
    ctx.stroke();

    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.moveTo(currentX, padding.top - 20);
    ctx.lineTo(currentX - 6, padding.top - 12);
    ctx.lineTo(currentX + 6, padding.top - 12);
    ctx.closePath();
    ctx.fill();

    const rowHeight = chartHeight / 8;

    guests.forEach((guest, index) => {
      const y = padding.top + index * rowHeight + rowHeight / 2;

      if (guest.status === 'waiting' || guest.status === 'checked-in') {
        const startX = padding.left + guest.arrivalTime * pixelsPerMinute;
        const endX = padding.left + guest.departureTime * pixelsPerMinute;

        const color = guest.status === 'checked-in' ? '#4299e1' : '#a0aec0';

        ctx.fillStyle = color;
        ctx.fillRect(startX, y - 8, Math.max(2, endX - startX), 16);

        ctx.fillStyle = '#fff';
        ctx.font = '10px Inter';
        ctx.textAlign = 'left';
        ctx.fillText(guest.avatar, startX + 4, y + 4);

        if (guest.hasExtendRequest && guest.status === 'checked-in') {
          ctx.fillStyle = '#9f7aea';
          ctx.beginPath();
          ctx.arc(endX, y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = '8px Inter';
          ctx.textAlign = 'center';
          ctx.fillText('续', endX, y + 3);
        }

        if (guest.arrivalTime < currentTime && guest.status === 'waiting') {
          ctx.fillStyle = '#f56565';
          ctx.beginPath();
          ctx.arc(startX + 10, y - 12, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    ctx.fillStyle = '#a0aec0';
    ctx.font = '11px Inter';
    ctx.textAlign = 'right';
    ctx.fillText('客人', padding.left - 10, padding.top + 20);

    const cleaningRowY = height - padding.bottom - 30;
    cleaners.forEach((cleaner, index) => {
      const y = cleaningRowY + index * 15;

      if (cleaner.status === 'cleaning' && cleaner.currentRoomId !== undefined) {
        const room = rooms.find((r) => r.id === cleaner.currentRoomId);
        if (room) {
          const progress = cleaner.progress / 100;
          const barWidth = 50 * progress;

          ctx.fillStyle = '#48bb78';
          ctx.fillRect(padding.left + index * 70, y, barWidth, 10);

          ctx.fillStyle = '#a0aec0';
          ctx.font = '9px Inter';
          ctx.fillText(`${cleaner.name}:${room.number}`, padding.left + index * 70, y - 2);
        }
      } else {
        ctx.fillStyle = '#718096';
        ctx.fillRect(padding.left + index * 70, y, 50, 10);

        ctx.fillStyle = '#718096';
        ctx.font = '9px Inter';
        ctx.fillText(`${cleaner.name}:空闲`, padding.left + index * 70, y - 2);
      }
    });
  }, [currentTime, guests, rooms, cleaners, level, height]);

  useEffect(() => {
    draw();

    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  return (
    <div ref={containerRef} className="w-full bg-gray-900 rounded-lg overflow-hidden">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
