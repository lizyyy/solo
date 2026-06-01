import html2canvas from 'html2canvas';
import type { ExportMetadata } from '../types';

export async function captureScreenshot(element: HTMLElement): Promise<string> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#0a1628',
    scale: 2,
    useCORS: true,
    logging: false,
  });
  
  return canvas.toDataURL('image/png');
}

export async function captureScreenshotWithMetadata(
  element: HTMLElement,
  metadata: ExportMetadata
): Promise<string> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#0a1628',
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');

  const padding = 20;
  const lineHeight = 24;
  const metadataLines = [
    `遥感地块变化地球仪 - ${metadata.planName}`,
    `导出时间: ${metadata.exportTime}`,
    `地块: ${metadata.pointName}`,
    `判定: ${metadata.judgement}`,
    `处理人: ${metadata.handler} | 处理时间: ${metadata.handledAt}`,
  ];

  ctx.fillStyle = 'rgba(10, 22, 40, 0.9)';
  const textWidth = Math.max(...metadataLines.map(line => ctx.measureText(line).width)) + 40;
  const textHeight = metadataLines.length * lineHeight + 20;
  ctx.fillRect(padding, canvas.height - textHeight - padding, textWidth, textHeight);

  ctx.font = '14px Inter, sans-serif';
  ctx.fillStyle = '#ffffff';
  metadataLines.forEach((line, index) => {
    ctx.fillText(
      line,
      padding + 20,
      canvas.height - textHeight - padding + 30 + index * lineHeight
    );
  });

  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.strokeRect(padding, canvas.height - textHeight - padding, textWidth, textHeight);

  return canvas.toDataURL('image/png');
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function generateExportFilename(planName: string, pointName?: string): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 5).replace(/:/g, '');
  
  const pointPart = pointName ? `_${pointName.replace(/\s+/g, '_')}` : '';
  const planPart = planName.replace(/\s+/g, '_');
  
  return `遥感地球仪_${planPart}${pointPart}_${dateStr}_${timeStr}.png`;
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
