export function exportScreenshotWithWatermark(
  canvas: HTMLCanvasElement,
  watermark: {
    filterText: string;
    timestamp: string;
    schemeName: string;
  }
): void {
  const w = canvas.width;
  const h = canvas.height;
  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const ctx = offscreen.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0);

  const padding = 16;
  const lineHeight = 20;
  const lines = [
    `筛选条件: ${watermark.filterText}`,
    `时间: ${watermark.timestamp}`,
    watermark.schemeName ? `方案: ${watermark.schemeName}` : '',
  ].filter(Boolean);

  const boxHeight = lines.length * lineHeight + padding * 2;
  const boxWidth = 360;

  ctx.fillStyle = 'rgba(10, 22, 40, 0.85)';
  ctx.fillRect(padding, h - boxHeight - padding, boxWidth, boxHeight);

  ctx.strokeStyle = 'rgba(0, 229, 204, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(padding, h - boxHeight - padding, boxWidth, boxHeight);

  ctx.font = '13px "JetBrains Mono", monospace';
  ctx.fillStyle = '#00E5CC';
  lines.forEach((line, i) => {
    ctx.fillText(line, padding + 10, h - boxHeight - padding + padding + 14 + i * lineHeight);
  });

  const link = document.createElement('a');
  link.download = `沙盘截图_${watermark.timestamp.replace(/[:.]/g, '-')}.png`;
  link.href = offscreen.toDataURL('image/png');
  link.click();
}

export function buildFilterText(filter: {
  sources: string[];
  anomalyTypes: string[];
  timeRange: [string, string];
}): string {
  const parts: string[] = [];
  if (filter.sources.length > 0 && filter.sources.length < 3) {
    parts.push(`来源=${filter.sources.join('/')}`);
  }
  if (filter.anomalyTypes.length > 0 && filter.anomalyTypes.length < 4) {
    parts.push(`状态=${filter.anomalyTypes.join('/')}`);
  }
  if (filter.timeRange[0] !== '2025-03-15T00:00:00' || filter.timeRange[1] !== '2025-03-15T23:59:59') {
    parts.push(`时间=${filter.timeRange[0].slice(0, 16)}~${filter.timeRange[1].slice(0, 16)}`);
  }
  return parts.length > 0 ? parts.join('; ') : '全部';
}
