import { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { gameState, currentVehicleIndex, allVehicles } = useGameStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, height / 2, 0, height);
    gradient.addColorStop(0, '#1e293b');
    gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, height / 2, width, height / 2);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(0, height * 0.75);
    ctx.lineTo(width, height * 0.75);
    ctx.stroke();
    ctx.setLineDash([]);

    const gateX = width * 0.85;
    ctx.fillStyle = '#475569';
    ctx.fillRect(gateX, height * 0.3, 8, height * 0.5);
    ctx.fillRect(gateX - 60, height * 0.25, 68, 15);

    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('闸口', gateX - 26, height * 0.23);

    const vehicleWidth = 100;
    const vehicleHeight = 50;
    const spacing = 120;
    const startX = width * 0.15;
    const vehicleY = height * 0.55;

    const displayCount = Math.min(4, gameState.queue.length + 1);
    
    for (let i = displayCount - 1; i >= 0; i--) {
      const vehicle = i === 0 ? gameState.currentVehicle : gameState.queue[i - 1];
      if (!vehicle) continue;

      const x = startX + i * spacing;
      const scale = i === 0 ? 1.1 : 1 - i * 0.1;
      const w = vehicleWidth * scale;
      const h = vehicleHeight * scale;
      const y = vehicleY - (h - vehicleHeight) / 2;

      ctx.fillStyle = i === 0 ? '#3b82f6' : '#64748b';
      ctx.fillRect(x, y, w, h);

      ctx.strokeStyle = i === 0 ? '#60a5fa' : '#94a3b8';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x + 5, y + 5, w - 10, h * 0.35);

      ctx.fillStyle = '#fbbf24';
      ctx.font = `bold ${Math.floor(10 * scale)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(vehicle.container.containerNo.slice(0, 7), x + w / 2, y + h * 0.3);

      if (vehicle.container.hasDangerous) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(x + w - 12, y + 12, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.floor(9 * scale)}px monospace`;
        ctx.fillText('!', x + w - 12, y + 15);
      }

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x + 5, y + h * 0.55, w - 10, h * 0.35);

      ctx.fillStyle = '#94a3b8';
      ctx.font = `${Math.floor(9 * scale)}px monospace`;
      ctx.fillText(vehicle.container.licensePlate, x + w / 2, y + h * 0.78);

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(x + 15, y + h + 3, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + w - 15, y + h + 3, 8, 0, Math.PI * 2);
      ctx.fill();

      if (i === 0) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
        ctx.setLineDash([]);
      }
    }

    const remaining = allVehicles.length - currentVehicleIndex - 1 - gameState.queue.length;
    if (remaining > 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`+${remaining} 等待中`, startX + displayCount * spacing, vehicleY + 30);
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`队列: ${gameState.queue.length + 1}/${gameState.level.maxQueueSize}`, 20, height - 15);

    if (gameState.queue.length >= 3) {
      ctx.fillStyle = '#f97316';
      ctx.fillText('⚠ 队列拥挤', 150, height - 15);
    }

    if (gameState.queue.length >= gameState.level.maxQueueSize - 1) {
      ctx.fillStyle = '#ef4444';
      ctx.fillText('⚠ 队列已满！', 260, height - 15);
    }

  }, [gameState.currentVehicle, gameState.queue, gameState.level.maxQueueSize, currentVehicleIndex, allVehicles.length]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-64 bg-slate-900 border-2 border-slate-700"
    />
  );
}
