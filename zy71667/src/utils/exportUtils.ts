import type { DrumParams, CalcResult } from './calculator';
import { MATERIALS, type MaterialKey } from './constants';
import { generateCurveData } from './calculator';

export function exportChartAsPng(
  canvas: HTMLCanvasElement,
  params: DrumParams,
  result: CalcResult
): void {
  const link = document.createElement('a');
  link.download = `鼓皮曲线_${params.diameter}${params.diameterUnit}_${MATERIALS[params.material].label}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function generateReportText(
  params: DrumParams,
  result: CalcResult
): string {
  const mat = MATERIALS[params.material];
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════');
  lines.push('       鼓皮张力频率换算报告');
  lines.push('═══════════════════════════════════════');
  lines.push('');
  lines.push(`生成时间: ${new Date(params.createdAt).toLocaleString('zh-CN')}`);
  lines.push('');
  lines.push('── 输入参数 ──');
  lines.push(`鼓皮直径: ${params.diameter} ${params.diameterUnit === 'inch' ? '英寸' : '厘米'}`);
  lines.push(`张力读数: ${params.tension} ${params.tensionUnit}`);
  lines.push(`鼓皮材质: ${mat.label} (面密度 ${params.material === 'custom' ? params.customDensity : mat.density} kg/m²)`);
  if (params.targetFreq > 0) {
    lines.push(`目标频率: ${params.targetFreq.toFixed(2)} Hz${params.targetNote ? ` (${params.targetNote})` : ''}`);
  }
  lines.push('');
  lines.push('── 计算结果 ──');
  lines.push(`估算基频: ${result.frequency.toFixed(2)} Hz (${result.noteName})`);
  lines.push(`换算张力 (N/m): ${result.tensionInNm.toFixed(2)} N/m`);
  if (params.targetFreq > 0) {
    lines.push(`目标所需张力: ${result.requiredTension.toFixed(2)} ${params.tensionUnit}`);
    lines.push(`偏差: ${result.deviation >= 0 ? '+' : ''}${result.deviation.toFixed(2)}%`);
    lines.push(`音分差: ${result.centsDiff >= 0 ? '+' : ''}${result.centsDiff.toFixed(1)} 音分`);
  }
  lines.push('');

  if (result.octaveWarning) {
    lines.push('⚠ 倍频警告: 计算频率与目标频率可能存在倍频关系，请确认目标八度是否正确。');
    lines.push('');
  }

  if (result.errors.length > 0) {
    lines.push('── 注意事项 ──');
    result.errors.forEach(e => {
      lines.push(`${e.recovered ? '●' : '✖'} ${e.message}`);
    });
    lines.push('');
  }

  if (params.notes.trim()) {
    lines.push('── 调试备注 ──');
    lines.push(params.notes);
    lines.push('');
  }

  lines.push('═══════════════════════════════════════');

  return lines.join('\n');
}

export function generateReportHtml(
  params: DrumParams,
  result: CalcResult,
  chartDataUrl?: string
): string {
  const mat = MATERIALS[params.material];
  const deviationColor = Math.abs(result.deviation) <= 5 ? '#4a9e6a' : Math.abs(result.deviation) <= 10 ? '#d4a030' : '#c05050';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>鼓皮张力频率换算报告</title>
<style>
  body { font-family: 'Source Sans 3', sans-serif; max-width: 700px; margin: 32px auto; color: #222; background: #faf8f6; padding: 0 16px; }
  h1 { font-family: 'Playfair Display', serif; font-size: 24px; border-bottom: 2px solid #c8956a; padding-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { text-align: left; padding: 6px 12px; border-bottom: 1px solid #ddd; }
  th { color: #666; font-weight: 600; width: 40%; }
  .section { margin: 20px 0; }
  .section-title { font-weight: 700; color: #c8956a; margin-bottom: 8px; }
  .warning { background: #fff3cd; border-left: 3px solid #d4a030; padding: 8px 12px; margin: 8px 0; }
  .error { background: #f8d7da; border-left: 3px solid #c05050; padding: 8px 12px; margin: 8px 0; }
  .ok { background: #d4edda; border-left: 3px solid #4a9e6a; padding: 8px 12px; margin: 8px 0; }
  .deviation { font-size: 28px; font-weight: 700; color: ${deviationColor}; }
  .note { font-size: 13px; color: #888; margin-top: 24px; }
  img { max-width: 100%; }
</style>
</head>
<body>
<h1>鼓皮张力频率换算报告</h1>
<p style="color:#888;">生成时间: ${new Date(params.createdAt).toLocaleString('zh-CN')}</p>

<div class="section">
  <div class="section-title">输入参数</div>
  <table>
    <tr><th>鼓皮直径</th><td>${params.diameter} ${params.diameterUnit === 'inch' ? '英寸' : '厘米'}</td></tr>
    <tr><th>张力读数</th><td>${params.tension} ${params.tensionUnit}</td></tr>
    <tr><th>鼓皮材质</th><td>${mat.label} (面密度 ${params.material === 'custom' ? params.customDensity : mat.density} kg/m²)</td></tr>
    ${params.targetFreq > 0 ? `<tr><th>目标频率</th><td>${params.targetFreq.toFixed(2)} Hz${params.targetNote ? ` (${params.targetNote})` : ''}</td></tr>` : ''}
  </table>
</div>

<div class="section">
  <div class="section-title">计算结果</div>
  <table>
    <tr><th>估算基频</th><td><strong>${result.frequency.toFixed(2)} Hz</strong> (${result.noteName})</td></tr>
    <tr><th>换算张力</th><td>${result.tensionInNm.toFixed(2)} N/m</td></tr>
    ${params.targetFreq > 0 ? `
    <tr><th>目标所需张力</th><td>${result.requiredTension.toFixed(2)} ${params.tensionUnit}</td></tr>
    <tr><th>偏差</th><td><span class="deviation">${result.deviation >= 0 ? '+' : ''}${result.deviation.toFixed(2)}%</span></td></tr>
    <tr><th>音分差</th><td>${result.centsDiff >= 0 ? '+' : ''}${result.centsDiff.toFixed(1)} 音分</td></tr>
    ` : ''}
  </table>
</div>

${result.octaveWarning ? '<div class="warning">⚠ 倍频警告: 计算频率与目标频率可能存在倍频关系，请确认目标八度是否正确。</div>' : ''}

${result.errors.length > 0 ? `
<div class="section">
  <div class="section-title">注意事项</div>
  ${result.errors.map(e => `<div class="${e.recovered ? 'warning' : 'error'}">${e.recovered ? '●' : '✖'} ${e.message}</div>`).join('\n')}
</div>
` : ''}

${params.notes.trim() ? `
<div class="section">
  <div class="section-title">调试备注</div>
  <p>${params.notes.replace(/\n/g, '<br>')}</p>
</div>
` : ''}

${chartDataUrl ? `
<div class="section">
  <div class="section-title">频率-张力曲线</div>
  <img src="${chartDataUrl}" alt="频率-张力曲线" />
</div>
` : ''}

<p class="note">本报告由「鼓皮张力频率换算」工具自动生成，基于圆形膜基频公式 f = (k₀₁/2π) × √(T/(σ·a²))</p>
</body>
</html>`;
}

export function printReport(
  params: DrumParams,
  result: CalcResult,
  chartDataUrl?: string
): void {
  const html = generateReportHtml(params, result, chartDataUrl);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.print();
  };
}

export function downloadReportAsText(
  params: DrumParams,
  result: CalcResult
): void {
  const text = generateReportText(params, result);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.download = `鼓皮换算报告_${params.diameter}${params.diameterUnit}_${new Date().toLocaleDateString('zh-CN')}.txt`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

export function getChartDataUrl(
  params: DrumParams
): string | null {
  const curveData = generateCurveData(
    params.diameter,
    params.diameterUnit,
    params.material,
    params.customDensity,
    params.tensionUnit
  );
  if (curveData.frequencies.length === 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const w = canvas.width;
  const h = canvas.height;
  const pad = 50;
  const plotW = w - pad * 2;
  const plotH = h - pad * 2;

  ctx.fillStyle = '#faf8f6';
  ctx.fillRect(0, 0, w, h);

  const minT = curveData.tensions[0];
  const maxT = curveData.tensions[curveData.tensions.length - 1];
  const minF = Math.min(...curveData.frequencies);
  const maxF = Math.max(...curveData.frequencies);
  const fRange = maxF - minF || 1;

  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.stroke();

  ctx.strokeStyle = '#c8956a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  curveData.tensions.forEach((t, i) => {
    const x = pad + ((t - minT) / (maxT - minT)) * plotW;
    const y = h - pad - ((curveData.frequencies[i] - minF) / fRange) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = '#666';
  ctx.font = '11px Source Sans 3';
  ctx.textAlign = 'center';
  ctx.fillText('张力 (N/m)', w / 2, h - 8);
  ctx.save();
  ctx.translate(12, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('频率 (Hz)', 0, 0);
  ctx.restore();

  return canvas.toDataURL('image/png');
}
