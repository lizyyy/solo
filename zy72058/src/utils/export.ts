import * as THREE from 'three';

export interface ExportStats {
  totalComponents: number;
  anomalyCount: number;
  emptyCount: number;
  duplicateCount: number;
  boundaryCount: number;
  normalCount: number;
  coordinateSystems: Record<string, number>;
  sourceTypes: Record<string, number>;
  exportTime: string;
}

export function generateExportFileName(prefix: string, ext: string): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5).replace(':', '-');
  return `${prefix}-${dateStr}-${timeStr}.${ext}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function captureThreeCanvas(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl);
    });
  });
}

export async function exportScreenshotFromCanvas(
  canvas: HTMLCanvasElement,
  overlayInfo?: {
    title: string;
    stats: ExportStats;
  }
): Promise<void> {
  const dataUrl = await captureThreeCanvas(canvas);
  
  if (!overlayInfo) {
    const link = document.createElement('a');
    link.download = generateExportFileName('古建筑修缮构件库-截图', 'png');
    link.href = dataUrl;
    link.click();
    return;
  }

  const img = new Image();
  img.onload = () => {
    const outCanvas = document.createElement('canvas');
    const headerHeight = 80;
    const footerHeight = 60;
    outCanvas.width = img.width;
    outCanvas.height = img.height + headerHeight + footerHeight;
    
    const ctx = outCanvas.getContext('2d')!;
    ctx.fillStyle = '#1a1f2e';
    ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
    
    ctx.drawImage(img, 0, headerHeight);
    
    ctx.fillStyle = '#c9a227';
    ctx.font = 'bold 24px "Noto Serif SC", serif';
    ctx.fillText(overlayInfo.title, 30, 45);
    
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px "Noto Sans SC", sans-serif';
    const statsText = [
      `总计: ${overlayInfo.stats.totalComponents}`,
      `异常: ${overlayInfo.stats.anomalyCount}`,
      `空值: ${overlayInfo.stats.emptyCount}`,
      `重复: ${overlayInfo.stats.duplicateCount}`,
      `边界: ${overlayInfo.stats.boundaryCount}`,
    ].join('  |  ');
    ctx.fillText(statsText, 30, 70);
    
    ctx.fillStyle = '#64748b';
    ctx.font = '12px "Noto Sans SC", sans-serif';
    ctx.fillText(`导出时间: ${overlayInfo.stats.exportTime}`, 30, outCanvas.height - 25);
    ctx.fillText('古建筑修缮构件库 - 3D可视化系统', outCanvas.width - 250, outCanvas.height - 25);
    
    const outDataUrl = outCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = generateExportFileName('古建筑修缮构件库-截图', 'png');
    link.href = outDataUrl;
    link.click();
  };
  img.src = dataUrl;
}

export function calculateStats(components: any[]): ExportStats {
  const now = new Date().toLocaleString('zh-CN');
  const stats: ExportStats = {
    totalComponents: components.length,
    anomalyCount: 0,
    emptyCount: 0,
    duplicateCount: 0,
    boundaryCount: 0,
    normalCount: 0,
    coordinateSystems: {},
    sourceTypes: {},
    exportTime: now,
  };

  components.forEach((c) => {
    if (c.isAnomaly) stats.anomalyCount++;
    if (c.status === 'empty') stats.emptyCount++;
    if (c.status === 'duplicate') stats.duplicateCount++;
    if (c.status === 'boundary') stats.boundaryCount++;
    if (c.status === 'normal') stats.normalCount++;
    
    stats.coordinateSystems[c.coordinateSystem] = (stats.coordinateSystems[c.coordinateSystem] || 0) + 1;
    stats.sourceTypes[c.sourceType] = (stats.sourceTypes[c.sourceType] || 0) + 1;
  });

  return stats;
}

export function exportJSONData(data: any): void {
  const stats = calculateStats(data.components);
  const exportData = {
    ...data,
    stats,
    version: '1.0.0',
    generatedBy: '古建筑修缮构件库系统',
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  
  downloadBlob(blob, generateExportFileName('古建筑修缮构件库-完整数据', 'json'));
}

export function exportReportCSV(components: any[]): void {
  const headers = [
    'ID', '构件名称', 'X坐标', 'Y坐标', 'Z坐标', '坐标系', 
    '数据来源', '来源类型', '状态', '是否异常', '备注', 
    '创建时间', '更新时间'
  ];
  
  const rows = components.map((c) => [
    c.id,
    c.name,
    c.x ?? '空值',
    c.y ?? '空值',
    c.z ?? '空值',
    c.coordinateSystem,
    c.source,
    c.sourceType,
    c.status,
    c.isAnomaly ? '是' : '否',
    c.remark || '',
    c.createdAt,
    c.updatedAt,
  ]);
  
  const csvContent = [
    '\uFEFF' + headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, generateExportFileName('古建筑修缮构件库-报表', 'csv'));
}
