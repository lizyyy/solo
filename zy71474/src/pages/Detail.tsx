import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Play, Pause, FileJson, FileSpreadsheet, AlertTriangle, Zap } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { formatNumber, downloadJson, downloadCsv } from '@/utils/helpers';
import { cn } from '@/lib/utils';

const BALL_COLORS = ['#FF6B35', '#00E5FF', '#00E676', '#FFD600', '#FF1744'];

export default function Detail() {
  const { id } = useParams<{ id: string }>();
  const { experiments, loadFromStorage } = useStore();

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  const experiment = experiments.find(e => e.id === id);
  const result = experiment?.result;
  const frames = result?.trajectoryFrames ?? [];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef(0);

  const boundsRef = useRef({ minX: 0, maxX: 1, minY: 0, maxY: 1 });

  useEffect(() => {
    if (frames.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    frames.forEach(f => f.balls.forEach(b => {
      if (b.x < minX) minX = b.x;
      if (b.x > maxX) maxX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.y > maxY) maxY = b.y;
    }));
    if (minX === maxX) { minX -= 50; maxX += 50; }
    if (minY === maxY) { minY -= 50; maxY += 50; }
    boundsRef.current = { minX, maxX, minY, maxY };
  }, [frames]);

  const drawFrame = useCallback((idx: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !frames.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const frame = frames[idx];
    if (!frame) return;

    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 300, 200);

    const { minX, maxX, minY, maxY } = boundsRef.current;
    const pad = 20;
    const scaleX = (300 - pad * 2) / (maxX - minX);
    const scaleY = (200 - pad * 2) / (maxY - minY);
    const scale = Math.min(scaleX, scaleY);
    const offX = pad + ((300 - pad * 2) - (maxX - minX) * scale) / 2;
    const offY = pad + ((200 - pad * 2) - (maxY - minY) * scale) / 2;

    frame.balls.forEach((b, i) => {
      const x = (b.x - minX) * scale + offX;
      const y = (b.y - minY) * scale + offY;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = BALL_COLORS[i % BALL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }, [frames]);

  useEffect(() => { drawFrame(frameIdx); }, [frameIdx, drawFrame]);

  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(animRef.current);
      return;
    }
    lastTimeRef.current = 0;
    const fps = 60;
    const interval = 1000 / fps;
    const step = (time: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = time;
      if (time - lastTimeRef.current >= interval) {
        lastTimeRef.current = time;
        setFrameIdx(prev => {
          if (prev >= frames.length - 1) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, frames.length]);

  if (!experiment) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center font-body">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-4 text-brand-red" size={48} />
          <p className="text-brand-text text-lg">实验未找到</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center font-body">
        <p className="text-brand-muted">该实验尚未运行模拟</p>
      </div>
    );
  }

  const momentumPct = result.momentumDeviation * 100;
  const energyChange = result.energyAfter - result.energyBefore;
  const energyPct = result.energyBefore !== 0 ? (energyChange / result.energyBefore * 100) : 0;
  const currentFrame = frames[frameIdx];

  return (
    <div className="min-h-screen bg-brand-bg p-6 font-body space-y-6">
      <h1 className="font-display text-brand-text text-xl">{experiment.name}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div id="momentum" className="bg-brand-card rounded-xl border border-brand-border p-5 space-y-4">
          <h2 className="font-display text-brand-cyan text-sm">动量守恒</h2>
          <div className="flex justify-between">
            <div>
              <p className="text-brand-muted text-xs mb-1">碰前</p>
              <p className="font-display text-2xl text-brand-text">{formatNumber(result.momentumBefore)}</p>
            </div>
            <div>
              <p className="text-brand-muted text-xs mb-1">碰后</p>
              <p className="font-display text-2xl text-brand-text">{formatNumber(result.momentumAfter)}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16">
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#2A3050" strokeWidth="2" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke={result.momentumConserved ? '#00E676' : '#FF1744'}
                  strokeWidth="2"
                  strokeDasharray={`${Math.min(momentumPct, 100)} ${100 - Math.min(momentumPct, 100)}`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-display text-brand-text">
                {formatNumber(momentumPct, 1)}%
              </span>
            </div>
            <span className={cn('text-sm font-medium', result.momentumConserved ? 'text-brand-green' : 'text-brand-red')}>
              {result.momentumConserved ? '守恒' : '不守恒'}
            </span>
          </div>
          <a href="#trajectory" className="text-brand-cyan text-xs hover:underline block">查看轨迹 →</a>
        </div>

        <div id="energy" className="bg-brand-card rounded-xl border border-brand-border p-5 space-y-4">
          <h2 className="font-display text-brand-orange text-sm">能量校验</h2>
          <div className="flex justify-between">
            <div>
              <p className="text-brand-muted text-xs mb-1">碰前</p>
              <p className="font-display text-2xl text-brand-text">{formatNumber(result.energyBefore)}</p>
            </div>
            <div>
              <p className="text-brand-muted text-xs mb-1">碰后</p>
              <p className="font-display text-2xl text-brand-text">{formatNumber(result.energyAfter)}</p>
            </div>
          </div>
          <div>
            <p className="text-brand-muted text-xs">能量变化</p>
            <p className={cn('font-display text-lg', energyChange >= 0 ? 'text-brand-red' : 'text-brand-amber')}>
              {energyChange >= 0 ? '+' : ''}{formatNumber(energyChange)}
              <span className="text-xs ml-1">({formatNumber(energyPct, 1)}%)</span>
            </p>
          </div>
          {energyChange > 0 && (
            <div className="flex items-center gap-2 bg-brand-red/10 px-3 py-1.5 rounded-lg animate-pulse-red">
              <Zap size={14} className="text-brand-red" />
              <span className="text-brand-red text-xs font-medium">⚠ 能量增加</span>
            </div>
          )}
          <a href="#momentum" className="text-brand-cyan text-xs hover:underline block">查看动量 →</a>
        </div>

        <div id="trajectory" className="bg-brand-card rounded-xl border border-brand-border p-5 space-y-4">
          <h2 className="font-display text-brand-green text-sm">轨迹动画</h2>
          <canvas ref={canvasRef} width={300} height={200} className="rounded-lg border border-brand-border mx-auto block" />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPlaying(p => !p)}
              className="p-1.5 rounded-lg bg-brand-surface border border-brand-border hover:border-brand-cyan transition-colors"
            >
              {playing ? <Pause size={14} className="text-brand-cyan" /> : <Play size={14} className="text-brand-cyan" />}
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(frames.length - 1, 0)}
              value={frameIdx}
              onChange={e => { setFrameIdx(Number(e.target.value)); setPlaying(false); }}
              className="flex-1"
            />
            <span className="text-brand-muted text-xs w-14 text-right">{frameIdx}/{Math.max(frames.length - 1, 0)}</span>
          </div>
          {currentFrame && (
            <div className="text-xs space-y-1">
              {currentFrame.balls.map((b, i) => (
                <div key={b.id} className="flex gap-2 text-brand-muted">
                  <span style={{ color: BALL_COLORS[i % BALL_COLORS.length] }}>球{i + 1}</span>
                  <span>x={formatNumber(b.x, 1)}</span>
                  <span>y={formatNumber(b.y, 1)}</span>
                  <span>vx={formatNumber(b.vx, 1)}</span>
                  <span>vy={formatNumber(b.vy, 1)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-4">
            <a href="#momentum" className="text-brand-cyan text-xs hover:underline">查看动量 →</a>
            <a href="#energy" className="text-brand-cyan text-xs hover:underline">查看能量 →</a>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => downloadJson(experiment, `${experiment.name}.json`)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-surface border border-brand-border hover:border-brand-cyan text-brand-text text-sm transition-colors"
        >
          <FileJson size={16} /> 下载 JSON
        </button>
        <button
          onClick={() => {
            const flat = [{
              id: experiment.id,
              name: experiment.name,
              type: experiment.collisionType,
              momentumBefore: result.momentumBefore,
              momentumAfter: result.momentumAfter,
              energyBefore: result.energyBefore,
              energyAfter: result.energyAfter,
              version: experiment.version,
            }];
            downloadCsv(flat, `${experiment.name}.csv`);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-surface border border-brand-border hover:border-brand-cyan text-brand-text text-sm transition-colors"
        >
          <FileSpreadsheet size={16} /> 下载 CSV
        </button>
      </div>
    </div>
  );
}
