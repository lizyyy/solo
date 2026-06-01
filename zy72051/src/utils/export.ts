import html2canvas from 'html2canvas';
import type { Filters } from '../data/types';
import { formatFilterSummary, formatTimestamp } from './storage';
import { getHourLabel } from './sunPosition';

export interface ExportOptions {
  filters: Filters;
  currentHour: number;
  containerId?: string;
  filename?: string;
}

export async function exportScreenshot(options: ExportOptions): Promise<void> {
  const {
    filters,
    currentHour,
    containerId = 'sandbox-container',
    filename,
  } = options;

  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container with id "${containerId}" not found`);
  }

  const filterSummary = formatFilterSummary(filters);
  const timestamp = formatTimestamp();
  const timeLabel = getHourLabel(currentHour);

  const watermark = document.createElement('div');
  watermark.style.cssText = `
    position: absolute;
    bottom: 20px;
    right: 20px;
    background: rgba(10, 22, 40, 0.9);
    color: #ffffff;
    padding: 12px 20px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    border: 1px solid rgba(255, 179, 71, 0.5);
    border-radius: 4px;
    z-index: 9999;
    pointer-events: none;
    backdrop-filter: blur(8px);
  `;
  watermark.innerHTML = `
    <div style="font-weight: bold; color: #ffb347; margin-bottom: 4px;">城市天际线日照沙盘</div>
    <div style="opacity: 0.9;">筛选: ${filterSummary}</div>
    <div style="opacity: 0.9;">日照时间: ${timeLabel}</div>
    <div style="opacity: 0.7; margin-top: 4px; font-size: 10px;">导出时间: ${timestamp}</div>
  `;

  container.appendChild(watermark);

  try {
    const canvas = await html2canvas(container, {
      backgroundColor: '#0a1628',
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const link = document.createElement('a');
    link.download =
      filename ||
      `日照沙盘_${timestamp.replace(/[:\s]/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } finally {
    container.removeChild(watermark);
  }
}

export async function exportDataAsJSON(
  data: unknown,
  filename: string = 'sunlight-data.json'
): Promise<void> {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function generateExportMetadata(
  filters: Filters,
  currentHour: number,
  stats: { total: number; withAnomalies: number; needsConfirmation: number }
): Record<string, unknown> {
  return {
    exportTime: new Date().toISOString(),
    filters,
    filterSummary: formatFilterSummary(filters),
    currentHour,
    timeLabel: getHourLabel(currentHour),
    statistics: stats,
    version: '1.0.0',
  };
}
