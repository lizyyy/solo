import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';

const WIDTH = 1000;
const HEIGHT = 420;

function MapCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const state = useGameStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    const grd = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    grd.addColorStop(0, '#141E33');
    grd.addColorStop(1, '#0E1625');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = 'rgba(74,100,145,0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }

    if (!state.level) return;

    state.routes.forEach((route) => {
      const path = route.stops;
      ctx.strokeStyle = route.color;
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      path.forEach((sid, i) => {
        const s = state.level!.stations.find((x) => x.id === sid);
        if (!s) return;
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (route.altStops) {
        ctx.strokeStyle = route.color;
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        route.altStops.forEach((sid, i) => {
          const s = state.level!.stations.find((x) => x.id === sid);
          if (!s) return;
          if (i === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    });

    state.closures.forEach((c) => {
      if (state.currentMinute < c.startMinute || state.currentMinute > c.endMinute) return;
      const a = state.level!.stations.find((s) => s.id === c.fromStop);
      const b = state.level!.stations.find((s) => s.id === c.toStop);
      if (!a || !b) return;
      ctx.strokeStyle = '#E05252';
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#E05252';
      ctx.font = '12px sans-serif';
      ctx.fillText('🚧 施工', (a.x + b.x) / 2 - 25, (a.y + b.y) / 2 - 8);
    });

    state.level.stations.forEach((s) => {
      ctx.fillStyle = '#E6EDF7';
      ctx.strokeStyle = '#4A6491';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const waiting = state.waitingPassengers[s.id] || 0;
      if (waiting > 0) {
        ctx.fillStyle = '#E2A93B';
        ctx.beginPath();
        ctx.arc(s.x + 10, s.y - 10, 6 + Math.min(8, waiting / 2), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0E1625';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(waiting), s.x + 10, s.y - 7);
        ctx.textAlign = 'start';
      }

      ctx.fillStyle = '#E6EDF7';
      ctx.font = '12px sans-serif';
      ctx.fillText(s.name, s.x + 10, s.y + 18);
    });

    state.vehicles.forEach((v) => {
      if (v.status === 'idle' || v.status === 'finished') return;
      const route = state.routes.find((r) => r.id === v.routeId);
      if (!route) return;
      const path = v.useAltPath && route.altStops ? route.altStops : route.stops;
      const a = state.level!.stations.find((s) => s.id === path[v.stopIndex]);
      const b = state.level!.stations.find((s) => s.id === path[v.stopIndex + 1]);
      if (!a) return;
      let x = a.x;
      let y = a.y;
      if (b) {
        x = a.x + (b.x - a.x) * v.progress;
        y = a.y + (b.y - a.y) * v.progress;
      }
      ctx.fillStyle = route.color;
      ctx.strokeStyle = '#0E1625';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0E1625';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(v.id, x, y + 3);
      ctx.textAlign = 'start';

      if (v.load > 0) {
        const ratio = v.load / v.capacity;
        ctx.fillStyle = ratio > 0.8 ? '#E05252' : '#49B265';
        ctx.fillRect(x - 10, y - 18, 20 * ratio, 3);
      }
    });

    ctx.fillStyle = 'rgba(226,169,59,0.9)';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`T+${state.currentMinute.toFixed(1)} min`, 12, 22);
    ctx.fillStyle = '#9FB0C9';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${state.phase === 'running' ? '运行中' : state.phase === 'paused' ? '已暂停' : state.phase === 'ended' ? '已结束' : state.phase === 'replay' ? '回放' : '待开始'} · ${state.speed}x`, 12, 40);
  }, [state]);

  return (
    <div className="card p-3">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="w-full rounded-lg bg-base-900"
        style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}
      />
    </div>
  );
}

export default MapCanvas;
