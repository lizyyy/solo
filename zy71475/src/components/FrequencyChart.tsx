import { useRef, useEffect, useState } from 'react';
import type { ModalRecord, FrequencyPeak } from '@/types';
import { generateFrequencyData } from '@/utils/sampleData';

const COLORS = [
  { line: '#3E2723', fill: 'rgba(62, 39, 35, 0.08)', label: '#3E2723' },
  { line: '#D4A84B', fill: 'rgba(212, 168, 75, 0.08)', label: '#D4A84B' },
  { line: '#5D4037', fill: 'rgba(93, 64, 55, 0.08)', label: '#5D4037' },
  { line: '#8D6E63', fill: 'rgba(141, 110, 99, 0.08)', label: '#8D6E63' },
  { line: '#A1887F', fill: 'rgba(161, 136, 127, 0.08)', label: '#A1887F' },
];

interface FrequencyChartProps {
  records: ModalRecord[];
}

export default function FrequencyChart({ records }: FrequencyChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const [hoveredFreq, setHoveredFreq] = useState<number | null>(null);

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

    const W = rect.width;
    const H = rect.height;
    const padding = { top: 30, right: 20, bottom: 40, left: 60 };
    const plotW = W - padding.left - padding.right;
    const plotH = H - padding.top - padding.bottom;

    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = '#FFFDF8';
    ctx.fillRect(0, 0, W, H);

    const allPeaks: FrequencyPeak[] = records.flatMap((r) => r.peaks);
    if (allPeaks.length === 0) {
      ctx.fillStyle = '#A8A29E';
      ctx.font = '14px "Noto Sans SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无频率数据，请先计算并保存记录', W / 2, H / 2);
      return;
    }

    const minFreq = Math.min(...allPeaks.map((p) => p.frequency)) * 0.5;
    const maxFreq = Math.max(...allPeaks.map((p) => p.frequency)) * 1.3;

    const maxAmp = 1.2;

    function freqToX(f: number) {
      return padding.left + ((f - minFreq) / (maxFreq - minFreq)) * plotW;
    }
    function ampToY(a: number) {
      return padding.top + plotH - (a / maxAmp) * plotH;
    }

    ctx.strokeStyle = '#E7E5E4';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = ampToY((maxAmp / 5) * i);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(W - padding.right, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 6; i++) {
      const f = minFreq + ((maxFreq - minFreq) / 6) * i;
      const x = freqToX(f);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, H - padding.bottom);
      ctx.stroke();

      ctx.fillStyle = '#A8A29E';
      ctx.font = '10px "Noto Sans SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(f)}`, x, H - padding.bottom + 16);
    }

    ctx.fillStyle = '#78716C';
    ctx.font = '11px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('频率 (Hz)', W / 2, H - 4);

    ctx.save();
    ctx.translate(12, padding.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('幅值', 0, 0);
    ctx.restore();

    records.forEach((record, rIdx) => {
      if (record.peaks.length === 0) return;
      const color = COLORS[rIdx % COLORS.length];
      const data = generateFrequencyData(record.peaks, 300);

      if (data.datasets.length === 0) return;

      ctx.beginPath();
      ctx.strokeStyle = color.line;
      ctx.lineWidth = 2;
      let started = false;
      for (const point of data.datasets) {
        const x = freqToX(point.x);
        const y = ampToY(point.y);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = color.fill;
      for (let i = 0; i < data.datasets.length; i++) {
        const x = freqToX(data.datasets[i].x);
        const y = ampToY(data.datasets[i].y);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(freqToX(data.datasets[data.datasets.length - 1].x), ampToY(0));
      ctx.lineTo(freqToX(data.datasets[0].x), ampToY(0));
      ctx.closePath();
      ctx.fill();

      for (const peak of record.peaks) {
        const x = freqToX(peak.frequency);
        const y = ampToY(peak.amplitude);

        if (peak.isOverlapping) {
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(251, 146, 60, 0.3)';
          ctx.fill();
          ctx.strokeStyle = '#F97316';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = color.line;
          ctx.fill();
        }
      }
    });

    const legendX = padding.left + 8;
    let legendY = padding.top + 8;
    records.forEach((record, rIdx) => {
      const color = COLORS[rIdx % COLORS.length];
      ctx.fillStyle = color.line;
      ctx.fillRect(legendX, legendY, 12, 3);
      ctx.fillStyle = '#57534E';
      ctx.font = '10px "Noto Sans SC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(record.name.length > 18 ? record.name.slice(0, 18) + '…' : record.name, legendX + 16, legendY + 4);
      legendY += 16;
    });

    const hasOverlap = allPeaks.some((p) => p.isOverlapping);
    if (hasOverlap) {
      ctx.fillStyle = '#F97316';
      ctx.font = 'bold 10px "Noto Sans SC", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('⚠ 检测到频率重叠', W - padding.right, padding.top + 14);
    }
  }, [records]);

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const allPeaks = records.flatMap((r) => r.peaks);
    if (allPeaks.length === 0) return;

    const minFreq = Math.min(...allPeaks.map((p) => p.frequency)) * 0.5;
    const maxFreq = Math.max(...allPeaks.map((p) => p.frequency)) * 1.3;

    const padding = { top: 30, right: 20, bottom: 40, left: 60 };
    const plotW = rect.width - padding.left - padding.right;

    const freq = minFreq + ((x - padding.left) / plotW) * (maxFreq - minFreq);

    let nearest: FrequencyPeak | null = null;
    let nearestDist = Infinity;
    for (const p of allPeaks) {
      const dist = Math.abs(p.frequency - freq);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = p;
      }
    }

    if (nearest && nearestDist < (maxFreq - minFreq) * 0.03) {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        content: `${nearest.modeLabel}\n${nearest.frequency} Hz${nearest.isOverlapping ? ' (重叠)' : ''}`,
      });
      setHoveredFreq(nearest.frequency);
    } else {
      setTooltip(null);
      setHoveredFreq(null);
    }
  }

  return (
    <div className="relative h-full min-h-[360px]">
      <canvas
        ref={canvasRef}
        className="h-full w-full rounded-xl border border-stone-200"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setTooltip(null); setHoveredFreq(null); }}
      />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}
        >
          {tooltip.content.split('\n').map((line, i) => (
            <div key={i} className={i === 1 ? 'font-medium text-stone-800' : 'text-stone-500'}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
