import { useEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Move, Layers, Maximize2, Crosshair } from 'lucide-react';
import type { Annotation, CloudMask } from '@/shared/types';
import { cn } from '@/lib/utils';

interface ScreenshotViewerProps {
  annotation: Annotation;
  highlightRef?: string;
  onHighlightCleared?: () => void;
  className?: string;
}

interface PresetPalette {
  bg: string;
  reef: string[];
  bleach: string[];
  deep: string;
  sand: string;
}

const PALETTES: Record<string, PresetPalette> = {
  xisha: {
    bg: '#1a5f7a',
    reef: ['#2a9d8f', '#4ecdc4', '#264653'],
    bleach: ['#f4e4c1', '#ffe8d6', '#ddbea9'],
    deep: '#0f3b5f',
    sand: '#e9c46a',
  },
  nansha: {
    bg: '#1d3557',
    reef: ['#2a9d8f', '#38b000', '#52b788'],
    bleach: ['#fff1e6', '#f0e6d6', '#e8d5b7'],
    deep: '#081c15',
    sand: '#f1faee',
  },
  zhongsha: {
    bg: '#1b4332',
    reef: ['#40916c', '#52b788', '#2d6a4f'],
    bleach: ['#fefae0', '#faedcd', '#e9edc9'],
    deep: '#081c15',
    sand: '#d4a373',
  },
  dongsha: {
    bg: '#023047',
    reef: ['#219ebc', '#8ecae6', '#0077b6'],
    bleach: ['#fdffb6', '#fdffb6', '#caffbf'],
    deep: '#03045e',
    sand: '#ffb703',
  },
};

interface Blob {
  x: number;
  y: number;
  r: number;
  color: string;
}

const generateBlobs = (seed: string, w: number, h: number, pal: PresetPalette): Blob[] => {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const blobs: Blob[] = [];
  const reefCount = 14;
  for (let i = 0; i < reefCount; i++) {
    blobs.push({
      x: rand() * w,
      y: rand() * h,
      r: 20 + rand() * 70,
      color: pal.reef[Math.floor(rand() * pal.reef.length)],
    });
  }
  const bleachCount = seed === 'zhongsha' ? 9 : seed === 'nansha' ? 8 : seed === 'dongsha' ? 4 : 5;
  for (let i = 0; i < bleachCount; i++) {
    blobs.push({
      x: rand() * w,
      y: rand() * h,
      r: 15 + rand() * 45,
      color: pal.bleach[Math.floor(rand() * pal.bleach.length)],
    });
  }
  const sandCount = 6;
  for (let i = 0; i < sandCount; i++) {
    blobs.push({
      x: rand() * w,
      y: rand() * h,
      r: 18 + rand() * 35,
      color: pal.sand,
    });
  }
  return blobs;
};

const parseBadDataRect = (ref?: string): { x1: number; y1: number; x2: number; y2: number } | null => {
  if (!ref) return null;
  const m = ref.match(/pixel:(\d+),(\d+)-(\d+),(\d+)/);
  if (!m) return null;
  return { x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] };
};

const parseCloudRect = (mask?: CloudMask, w = 520, h = 440): { x1: number; y1: number; x2: number; y2: number } | null => {
  if (!mask) return null;
  const m = mask.polygon.match(/M\s*([\d.]+),([\d.]+)\s+L\s+([\d.]+),([\d.]+)\s+L\s+([\d.]+),([\d.]+)\s+L\s+([\d.]+),([\d.]+)/);
  if (!m) return { x1: w * 0.55, y1: 0, x2: w, y2: h * 0.4 };
  const xs = [+m[1], +m[3], +m[5], +m[7]];
  const ys = [+m[2], +m[4], +m[6], +m[8]];
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
};

export default function ScreenshotViewer({
  annotation,
  highlightRef,
  onHighlightCleared,
  className,
}: ScreenshotViewerProps) {
  const W = 520;
  const H = 440;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<'对比' | '原始' | '标注'>('对比');
  const [splitX, setSplitX] = useState(W / 2);
  const [blinking, setBlinking] = useState(false);
  const [badBlink, setBadBlink] = useState(false);

  const palKey = (['xisha', 'nansha', 'zhongsha', 'dongsha'] as const).includes(
    annotation.screenshotUrl as never,
  )
    ? annotation.screenshotUrl
    : 'xisha';
  const palette = PALETTES[palKey];

  const blobs = useMemo(() => generateBlobs(palKey, W, H, palette), [palKey, palette]);
  const badRect = useMemo(() => parseBadDataRect(annotation.badDataRef), [annotation.badDataRef]);
  const cloudRect = useMemo(() => parseCloudRect(annotation.cloudMask, W, H), [annotation.cloudMask]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, palette.deep);
    grad.addColorStop(1, palette.bg);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      const y = (i * H) / 60 + ((i * 37) % 20);
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(W / 3, y - 8, (2 * W) / 3, y + 8, W, y);
      ctx.stroke();
    }

    blobs.forEach((b) => {
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, b.color + 'cc');
      g.addColorStop(0.6, b.color + '66');
      g.addColorStop(1, b.color + '00');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.r, b.r * 0.75, (b.x + b.y) * 0.01, 0, Math.PI * 2);
      ctx.fill();
    });

    const drawGrid = () => {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y <= H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    };
    drawGrid();

    const drawCloud = () => {
      if (!cloudRect) return;
      const { x1, y1, x2, y2 } = cloudRect;
      ctx.save();
      const cg = ctx.createLinearGradient(x1, y1, x2, y2);
      cg.addColorStop(0, 'rgba(200,200,220,0.75)');
      cg.addColorStop(0.5, 'rgba(240,240,250,0.65)');
      cg.addColorStop(1, 'rgba(180,180,210,0.8)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      const w = x2 - x1;
      const h = y2 - y1;
      for (let i = 0; i < 10; i++) {
        const cx = x1 + (i + 0.5) * (w / 10) + Math.sin(i * 1.3) * 10;
        const cy = y1 + h / 2 + Math.cos(i * 0.9) * (h * 0.25);
        const rr = Math.min(w, h) * (0.25 + ((i * 7) % 10) / 40);
        ctx.moveTo(cx + rr, cy);
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.strokeStyle = 'rgba(139,123,191,0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x1 + 2, y1 + 2, w - 4, h - 4);
      ctx.setLineDash([]);
      ctx.fillStyle = '#8B7BBF';
      ctx.font = 'bold 11px system-ui';
      ctx.fillText('☁ 云遮挡 已排除', x1 + 8, y1 + 18);
      ctx.restore();
    };

    const drawBadBox = () => {
      if (!badRect) return;
      const { x1, y1, x2, y2 } = badRect;
      ctx.save();
      ctx.strokeStyle = badBlink ? '#FF7A59' : 'rgba(255,122,89,0.5)';
      ctx.lineWidth = badBlink ? 3 : 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.setLineDash([]);
      if (badBlink) {
        ctx.fillStyle = 'rgba(255,122,89,0.18)';
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      }
      ctx.fillStyle = '#FF7A59';
      ctx.font = 'bold 10px system-ui';
      ctx.fillText('⚠ 改判区域 (坏数据回跳)', x1, y1 - 4);
      ctx.restore();
    };

    drawCloud();
    drawBadBox();

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px monospace';
    ctx.fillText('N', W - 16, 18);
    ctx.beginPath();
    ctx.moveTo(W - 12, 40);
    ctx.lineTo(W - 8, 28);
    ctx.lineTo(W - 4, 40);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
  }, [blobs, palette, cloudRect, badRect, badBlink]);

  useEffect(() => {
    if (!highlightRef) return;
    setBadBlink(true);
    setBlinking(true);
    if (badRect) {
      const cx = (badRect.x1 + badRect.x2) / 2;
      const cy = (badRect.y1 + badRect.y2) / 2;
      setPan({ x: W / 2 - cx, y: H / 2 - cy });
      setZoom(1.6);
    }
    const t = setTimeout(() => {
      setBadBlink(false);
      setBlinking(false);
      onHighlightCleared?.();
    }, 4200);
    return () => clearTimeout(t);
  }, [highlightRef, badRect, onHighlightCleared, W, H]);

  const transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;

  return (
    <div
      className={cn(
        'relative bg-ocean-800 rounded-xl overflow-hidden border border-ocean-600/60 shadow-2xl',
        className,
      )}
    >
      <div className="flex items-center justify-between px-4 py-2 bg-ocean-700/80 border-b border-ocean-600/50">
        <div className="flex items-center gap-2 text-ocean-50 text-xs">
          <Layers size={14} className="text-coral-300" />
          <span className="font-mono">{annotation.screenshotMeta.orbitId}</span>
          <span className="text-ocean-300">·</span>
          <span>{annotation.screenshotMeta.dataSource}</span>
          <span className="text-ocean-300">·</span>
          <span>{annotation.screenshotMeta.bandCombo}</span>
          <span className="text-ocean-300">·</span>
          <span className="font-mono">{annotation.screenshotMeta.resolution}</span>
        </div>
        <div className="flex items-center gap-1">
          {(['对比', '原始', '标注'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={cn(
                'px-2 py-1 text-[11px] rounded-md transition-all',
                viewMode === m
                  ? 'bg-coral-400 text-white shadow'
                  : 'text-ocean-200 hover:bg-ocean-600/60',
              )}
            >
              {m}
            </button>
          ))}
          <div className="w-px h-4 bg-ocean-500 mx-1" />
          <button
            onClick={() => setZoom((z) => Math.min(z * 1.2, 3))}
            className="p-1.5 text-ocean-200 hover:bg-ocean-600/60 rounded"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z / 1.2, 0.6))}
            className="p-1.5 text-ocean-200 hover:bg-ocean-600/60 rounded"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1.5 text-ocean-200 hover:bg-ocean-600/60 rounded"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden bg-ocean-900" style={{ height: 440 }}>
        <div
          className={cn('origin-center transition-transform duration-300', blinking && 'animate-pulse-ring')}
          style={{ transform, width: W, height: H, margin: '0 auto' }}
        >
          <canvas ref={canvasRef} width={W} height={H} className="block" />
          {viewMode === '对比' && (
            <>
              <div
                className="absolute top-0 bottom-0 left-0 overflow-hidden pointer-events-none border-r-2 border-white/70 shadow-[2px_0_12px_rgba(0,0,0,0.4)]"
                style={{ width: splitX }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-coral-500/5 to-transparent mix-blend-overlay" />
                <div className="absolute top-2 left-2 text-[10px] font-bold text-white bg-ocean-900/70 px-2 py-0.5 rounded backdrop-blur">
                  标注层
                </div>
              </div>
              <div
                onMouseDown={(e) => {
                  const startX = e.clientX;
                  const startSplit = splitX;
                  const move = (ev: MouseEvent) => {
                    setSplitX(Math.max(10, Math.min(W - 10, startSplit + ev.clientX - startX)));
                  };
                  const up = () => {
                    window.removeEventListener('mousemove', move);
                    window.removeEventListener('mouseup', up);
                  };
                  window.addEventListener('mousemove', move);
                  window.addEventListener('mouseup', up);
                }}
                className="absolute top-0 bottom-0 w-1 cursor-col-resize bg-white/90 hover:bg-coral-400"
                style={{ left: splitX - 2 }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-5 h-8 bg-white rounded-full shadow flex items-center justify-center">
                  <Move size={10} className="text-ocean-600" />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="absolute bottom-2 left-3 flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-ocean-200/40 border border-ocean-300/60"></span>
            <span className="text-ocean-100">海水</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm" style={{ background: palette.reef[0] }}></span>
            <span className="text-ocean-100">健康珊瑚</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm" style={{ background: palette.bleach[0] }}></span>
            <span className="text-ocean-100">白化区域</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm" style={{ background: palette.sand }}></span>
            <span className="text-ocean-100">砂质</span>
          </div>
          {annotation.hasCloudCover && (
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-purple-300/80 border border-purple-500"></span>
              <span className="text-ocean-100">云遮挡(已排除)</span>
            </div>
          )}
          {annotation.badDataRef && (
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm border-2 border-coral-400 border-dashed"></span>
              <span className="text-ocean-100">改判锚点</span>
            </div>
          )}
        </div>

        <div className="absolute bottom-2 right-3 text-[10px] text-ocean-200/80 font-mono flex items-center gap-1">
          <Crosshair size={11} />
          <span>
            {Math.round(-pan.x / zoom + W / 2 / zoom)}, {Math.round(-pan.y / zoom + H / 2 / zoom)} px · {zoom.toFixed(1)}x
          </span>
        </div>
      </div>

      <div className="px-4 py-1.5 bg-ocean-700/60 text-[11px] text-ocean-200 font-mono flex items-center justify-between border-t border-ocean-600/50">
        <span>像素范围: {annotation.screenshotMeta.pixelRange}</span>
        <span>ID: {annotation.id}</span>
      </div>
    </div>
  );
}
