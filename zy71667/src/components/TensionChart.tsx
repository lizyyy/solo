import { useRef, useEffect } from 'react';
import { useDrumStore } from '../store/useDrumStore';
import { generateCurveData } from '../utils/calculator';
import { exportChartAsPng } from '../utils/exportUtils';
import { Download } from 'lucide-react';

export default function TensionChart() {
  const { params, result } = useDrumStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    const w = rect.width;
    const h = rect.height;
    const pad = { top: 20, right: 24, bottom: 40, left: 55 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    ctx.fillStyle = '#1e1a16';
    ctx.fillRect(0, 0, w, h);

    const curveData = generateCurveData(
      params.diameter,
      params.diameterUnit,
      params.material,
      params.customDensity,
      params.tensionUnit
    );

    if (curveData.frequencies.length === 0) return;

    const minT = curveData.tensions[0];
    const maxT = curveData.tensions[curveData.tensions.length - 1];
    const minF = Math.min(...curveData.frequencies);
    const maxF = Math.max(...curveData.frequencies);
    const fRange = maxF - minF || 1;
    const tRange = maxT - minT || 1;

    const gridLines = 5;
    ctx.strokeStyle = '#2a2420';
    ctx.lineWidth = 1;
    ctx.font = '11px Source Sans 3';
    ctx.fillStyle = '#6a5e52';
    ctx.textAlign = 'right';

    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + plotH - (i / gridLines) * plotH;
      const freq = minF + (i / gridLines) * fRange;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      ctx.fillText(freq.toFixed(0), pad.left - 6, y + 4);
    }

    ctx.textAlign = 'center';
    for (let i = 0; i <= gridLines; i++) {
      const x = pad.left + (i / gridLines) * plotW;
      const tension = minT + (i / gridLines) * tRange;
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, h - pad.bottom);
      ctx.stroke();
      ctx.fillText(tension.toFixed(0), x, h - pad.bottom + 16);
    }

    ctx.fillStyle = '#6a5e52';
    ctx.textAlign = 'center';
    ctx.fillText('张力 (N/m)', w / 2, h - 4);

    ctx.save();
    ctx.translate(12, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('频率 (Hz)', 0, 0);
    ctx.restore();

    const gradient = ctx.createLinearGradient(pad.left, 0, w - pad.right, 0);
    gradient.addColorStop(0, 'rgba(200, 149, 106, 0.1)');
    gradient.addColorStop(1, 'rgba(200, 149, 106, 0.02)');

    ctx.beginPath();
    curveData.tensions.forEach((t, i) => {
      const x = pad.left + ((t - minT) / tRange) * plotW;
      const y = pad.top + plotH - ((curveData.frequencies[i] - minF) / fRange) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    const lastX = pad.left + plotW;
    ctx.lineTo(lastX, pad.top + plotH);
    ctx.lineTo(pad.left, pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.strokeStyle = '#c8956a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    curveData.tensions.forEach((t, i) => {
      const x = pad.left + ((t - minT) / tRange) * plotW;
      const y = pad.top + plotH - ((curveData.frequencies[i] - minF) / fRange) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    if (result && result.frequency > 0) {
      const currentT = result.tensionInNm;
      const currentF = result.frequency;
      if (currentT >= minT && currentT <= maxT) {
        const cx = pad.left + ((currentT - minT) / tRange) * plotW;
        const cy = pad.top + plotH - ((currentF - minF) / fRange) * plotH;

        ctx.strokeStyle = '#daa87d';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, pad.top + plotH);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pad.left, cy);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#daa87d';
        ctx.fill();
        ctx.strokeStyle = '#141210';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#e8e0d8';
        ctx.font = 'bold 12px Source Sans 3';
        ctx.textAlign = 'left';
        ctx.fillText(`${currentF.toFixed(1)} Hz`, cx + 10, cy - 6);
      }

      if (params.targetFreq > 0 && params.targetFreq >= minF && params.targetFreq <= maxF) {
        const targetY = pad.top + plotH - ((params.targetFreq - minF) / fRange) * plotH;
        ctx.strokeStyle = '#4a9e6a';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(pad.left, targetY);
        ctx.lineTo(w - pad.right, targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#4a9e6a';
        ctx.font = '11px Source Sans 3';
        ctx.textAlign = 'right';
        ctx.fillText(`目标 ${params.targetFreq.toFixed(1)} Hz`, w - pad.right - 4, targetY - 6);
      }
    }
  }, [params, result]);

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;
    exportChartAsPng(canvas, params, result);
  };

  return (
    <div className="bg-drum-card rounded-xl border border-drum-border p-5 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-drum-copper font-semibold text-sm">频率-张力曲线</span>
        {result && (
          <button
            onClick={handleExport}
            className="flex items-center gap-1 text-drum-textDim hover:text-drum-copper text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            导出 PNG
          </button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg"
        style={{ height: '280px' }}
      />
    </div>
  );
}
