import { useRef, useEffect, useState, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import AlertPanel from '@/components/AlertPanel';
import PendingPanel from '@/components/PendingPanel';
import { useNavigate } from 'react-router-dom';
import { Sliders, Eye, ArrowUpRight } from 'lucide-react';

function lerpColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  if (clamped < 0.5) {
    const p = clamped * 2;
    const r = Math.round(72 + (232 - 72) * p);
    const g = Math.round(187 + (168 - 187) * p);
    const b = Math.round(120 + (56 - 120) * p);
    return `rgb(${r},${g},${b})`;
  }
  const p = (clamped - 0.5) * 2;
  const r = Math.round(232 + (252 - 232) * p);
  const g = Math.round(168 + (129 - 168) * p);
  const b = Math.round(56 + (129 - 56) * p);
  return `rgb(${r},${g},${b})`;
}

function HeatmapCanvas({ works, distances }: { works: ReturnType<typeof useStore.getState>['works']; distances: ReturnType<typeof useStore.getState>['distances'] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; row: string; col: string; dist: number } | null>(null);
  const navigate = useNavigate();
  const n = works.length;
  const cellSize = Math.max(28, Math.min(48, 420 / n));
  const labelWidth = 60;
  const labelHeight = 60;
  const width = labelWidth + n * cellSize;
  const height = labelHeight + n * cellSize;

  const distMap = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const m = new Map<string, number>();
    for (const d of distances) {
      m.set(`${d.workAId}-${d.workBId}`, d.ciede2000);
      m.set(`${d.workBId}-${d.workAId}`, d.ciede2000);
    }
    distMap.current = m;
  }, [distances]);

  const getDist = useCallback((a: string, b: string) => {
    if (a === b) return -1;
    return distMap.current.get(`${a}-${b}`) ?? 0;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#1A1A2E';
    ctx.fillRect(0, 0, width, height);

    ctx.font = '10px DM Sans, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#A0AEC0';
    for (let i = 0; i < n; i++) {
      const label = works[i].title.length > 4 ? works[i].title.slice(0, 4) : works[i].title;
      ctx.fillText(label, labelWidth - 6, labelHeight + i * cellSize + cellSize / 2);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (let j = 0; j < n; j++) {
      const label = works[j].title.length > 4 ? works[j].title.slice(0, 4) : works[j].title;
      ctx.save();
      ctx.translate(labelWidth + j * cellSize + cellSize / 2, labelHeight - 6);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const d = getDist(works[i].id, works[j].id);
        const x = labelWidth + j * cellSize;
        const y = labelHeight + i * cellSize;
        if (d < 0) {
          ctx.fillStyle = '#0F3460';
        } else {
          const t = Math.min(d / 30, 1);
          ctx.fillStyle = lerpColor(t);
        }
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);

        if (d >= 0 && cellSize >= 36) {
          ctx.fillStyle = d > 15 ? '#1A1A2E' : '#0F3460';
          ctx.font = '9px DM Sans, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(d.toFixed(1), x + cellSize / 2, y + cellSize / 2);
        }
      }
    }
  }, [works, distances, n, cellSize, width, height, labelWidth, labelHeight, getDist]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const col = Math.floor((mx - labelWidth) / cellSize);
    const row = Math.floor((my - labelHeight) / cellSize);
    if (col >= 0 && col < n && row >= 0 && row < n) {
      const d = getDist(works[row].id, works[col].id);
      if (d >= 0) {
        setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, row: works[row].title, col: works[col].title, dist: d });
        return;
      }
    }
    setTooltip(null);
  }, [works, n, cellSize, labelWidth, labelHeight, getDist]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const my = e.clientY - rect.top;
    const row = Math.floor((my - labelHeight) / cellSize);
    if (row >= 0 && row < n) {
      navigate(`/work/${works[row].id}`);
    }
  }, [works, n, cellSize, labelHeight, navigate]);

  return (
    <div ref={containerRef} className="relative">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        onClick={handleClick}
        className="cursor-pointer rounded-lg"
      />
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-bg-secondary/95 border border-border-custom rounded-lg px-3 py-2 text-xs shadow-xl z-50"
          style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}
        >
          <div className="text-text-primary font-medium">{tooltip.row}</div>
          <div className="text-text-secondary">vs {tooltip.col}</div>
          <div className="text-accent-warm font-semibold mt-1">ΔE = {tooltip.dist.toFixed(2)}</div>
        </div>
      )}
    </div>
  );
}

function ClusterWheel({ clusters, works, swatches }: { clusters: ReturnType<typeof useStore.getState>['clusters']; works: ReturnType<typeof useStore.getState>['works']; swatches: ReturnType<typeof useStore.getState>['swatches'] }) {
  const size = 400;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 170;
  const innerR = 130;
  const clusterColors = ['#E8A838', '#48BB78', '#63B3ED', '#FC8181', '#B794F4', '#F687B3', '#68D391', '#FBD38D'];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[400px] mx-auto">
      <defs>
        {clusters.map((_, i) => (
          <linearGradient key={`cg${i}`} id={`hueGrad${i}`} gradientUnits="userSpaceOnUse"
            x1={cx + outerR * Math.cos(((i * 360 / clusters.length) - 90) * Math.PI / 180)}
            y1={cy + outerR * Math.sin(((i * 360 / clusters.length) - 90) * Math.PI / 180)}
            x2={cx + outerR * Math.cos((((i + 1) * 360 / clusters.length) - 90) * Math.PI / 180)}
            y2={cy + outerR * Math.sin((((i + 1) * 360 / clusters.length) - 90) * Math.PI / 180)}
          >
            <stop offset="0%" stopColor={`hsl(${i * 360 / clusters.length}, 70%, 55%)`} />
            <stop offset="100%" stopColor={`hsl(${(i + 1) * 360 / clusters.length}, 70%, 55%)`} />
          </linearGradient>
        ))}
      </defs>

      {Array.from({ length: 360 }).map((_, deg) => (
        <line
          key={deg}
          x1={cx + innerR * Math.cos((deg - 90) * Math.PI / 180)}
          y1={cy + innerR * Math.sin((deg - 90) * Math.PI / 180)}
          x2={cx + outerR * Math.cos((deg - 90) * Math.PI / 180)}
          y2={cy + outerR * Math.sin((deg - 90) * Math.PI / 180)}
          stroke={`hsl(${deg}, 70%, 50%)`}
          strokeWidth="1.5"
          opacity="0.6"
        />
      ))}

      <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="#2D3748" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="#2D3748" strokeWidth="1" />

      {clusters.map((cluster, ci) => {
        const arcSpan = 360 / clusters.length;
        const midAngle = cluster.avgHue;
        const labelR = outerR + 20;
        const lx = cx + labelR * Math.cos((midAngle - 90) * Math.PI / 180);
        const ly = cy + labelR * Math.sin((midAngle - 90) * Math.PI / 180);
        const clusterWorkIds = new Set(cluster.workIds);

        const dots = clusterWorkIds.size > 0 ? works.filter(w => clusterWorkIds.has(w.id)).map(w => {
          const wSwatches = swatches.filter(s => s.workId === w.id && !s.isBackground);
          if (wSwatches.length === 0) return null;
          const avgH = wSwatches.reduce((s, c) => s + c.hue, 0) / wSwatches.length;
          const avgS = wSwatches.reduce((s, c) => s + c.saturation, 0) / wSwatches.length;
          const dotR = innerR + (avgS / 100) * (outerR - innerR) * 0.6;
          const dx = cx + dotR * Math.cos((avgH - 90) * Math.PI / 180);
          const dy = cy + dotR * Math.sin((avgH - 90) * Math.PI / 180);
          return { dx, dy, hex: wSwatches[0].hex, title: w.title };
        }).filter(Boolean) : [];

        const arcStart = midAngle - arcSpan / 2;
        const arcEnd = midAngle + arcSpan / 2;
        const r1 = outerR + 4;
        const r2 = outerR + 10;
        const path = [
          `M ${cx + r1 * Math.cos((arcStart - 90) * Math.PI / 180)} ${cy + r1 * Math.sin((arcStart - 90) * Math.PI / 180)}`,
          `A ${r1} ${r1} 0 0 1 ${cx + r1 * Math.cos((arcEnd - 90) * Math.PI / 180)} ${cy + r1 * Math.sin((arcEnd - 90) * Math.PI / 180)}`,
          `L ${cx + r2 * Math.cos((arcEnd - 90) * Math.PI / 180)} ${cy + r2 * Math.sin((arcEnd - 90) * Math.PI / 180)}`,
          `A ${r2} ${r2} 0 0 0 ${cx + r2 * Math.cos((arcStart - 90) * Math.PI / 180)} ${cy + r2 * Math.sin((arcStart - 90) * Math.PI / 180)}`,
          'Z',
        ].join(' ');

        return (
          <g key={cluster.id}>
            <path d={path} fill={clusterColors[ci % clusterColors.length]} opacity="0.7" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill={clusterColors[ci % clusterColors.length]} fontSize="10" fontWeight="600" fontFamily="DM Sans, sans-serif">
              {cluster.label}
            </text>
            {dots.map((dot, di) => dot && (
              <g key={di}>
                <circle cx={dot.dx} cy={dot.dy} r="5" fill={dot.hex} stroke="#1A1A2E" strokeWidth="1.5" />
              </g>
            ))}
          </g>
        );
      })}

      <circle cx={cx} cy={cy} r={innerR - 30} fill="#1A1A2E" opacity="0.85" />
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#F7F8FC" fontSize="11" fontWeight="600" fontFamily="DM Sans, sans-serif">
        {clusters.length} 聚类
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#A0AEC0" fontSize="9" fontFamily="DM Sans, sans-serif">
        {works.length} 件作品
      </text>
    </svg>
  );
}

export default function Overview() {
  const works = useStore(s => s.works);
  const distances = useStore(s => s.distances);
  const clusters = useStore(s => s.clusters);
  const swatches = useStore(s => s.swatches);
  const clusterThreshold = useStore(s => s.clusterThreshold);
  const setClusterThreshold = useStore(s => s.setClusterThreshold);

  return (
    <div className="min-h-screen bg-bg-primary font-body text-text-primary p-6 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-wide">
            配色总览
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            CIEDE2000 距离矩阵 · 作品聚类分析 · 数据质量监控
          </p>
        </div>
        <div className="flex items-center gap-2 text-text-secondary text-xs">
          <Eye className="w-4 h-4" />
          <span>{works.length} 件作品</span>
          <span className="text-border-custom">|</span>
          <ArrowUpRight className="w-4 h-4" />
          <span>{distances.length} 组距离</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-bg-secondary rounded-2xl border border-border-custom p-5 overflow-auto">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-accent-warm" />
            <h2 className="text-sm font-semibold text-text-primary">CIEDE2000 距离矩阵</h2>
          </div>
          <HeatmapCanvas works={works} distances={distances} />
          <div className="flex items-center gap-3 mt-4 text-[10px] text-text-secondary">
            <span>0</span>
            <div className="flex-1 h-2 rounded-full" style={{ background: `linear-gradient(to right, #48BB78, #E8A838, #FC8181)` }} />
            <span>30+</span>
            <span className="ml-2">ΔE 距离值</span>
          </div>
        </div>

        <div className="col-span-1 space-y-4">
          <div className="bg-bg-secondary rounded-2xl border border-border-custom p-4">
            <AlertPanel />
          </div>
          <div className="bg-bg-secondary rounded-2xl border border-border-custom p-4">
            <PendingPanel />
          </div>
        </div>
      </div>

      <div className="bg-bg-secondary rounded-2xl border border-border-custom p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent-green" />
            <h2 className="text-sm font-semibold text-text-primary">色彩聚类分布</h2>
          </div>
          <div className="flex items-center gap-3 bg-bg-card rounded-xl px-4 py-2 border border-border-custom">
            <Sliders className="w-3.5 h-3.5 text-accent-warm" />
            <span className="text-xs text-text-secondary">阈值</span>
            <input
              type="range"
              min={5}
              max={50}
              step={1}
              value={clusterThreshold}
              onChange={e => setClusterThreshold(Number(e.target.value))}
              className="w-28 accent-accent-warm cursor-pointer"
            />
            <span className="text-xs font-mono text-accent-warm font-semibold w-6 text-right">{clusterThreshold}</span>
          </div>
        </div>
        <div className="flex items-start gap-8">
          <ClusterWheel clusters={clusters} works={works} swatches={swatches} />
          <div className="flex-1 grid grid-cols-2 gap-3 py-2">
            {clusters.map((cluster, i) => {
              const colors = ['#E8A838', '#48BB78', '#63B3ED', '#FC8181', '#B794F4', '#F687B3', '#68D391', '#FBD38D'];
              return (
                <div key={cluster.id} className="bg-bg-card/60 rounded-xl p-3 border border-border-custom/50">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                    <span className="text-xs font-semibold text-text-primary">{cluster.label}</span>
                    <span className="text-[10px] text-text-secondary ml-auto">{cluster.workIds.length} 件</span>
                  </div>
                  <p className="text-[10px] text-text-secondary leading-relaxed">{cluster.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
