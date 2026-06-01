import { jsPDF } from 'jspdf';
import { SolutionFilters, CoordinateSystem, MonitoringPoint } from '../types';
import { getStatusLabel, getSourceLabel } from './terrain';

export interface ExportMetadata {
  solutionName: string;
  filters: SolutionFilters;
  coordinateSystem: CoordinateSystem;
  exportedAt: string;
  handler: string;
  pointCount: number;
  warningCount: number;
  dangerCount: number;
}

export function generateWatermarkText(metadata: ExportMetadata): string[] {
  const lines: string[] = [];
  lines.push(`方案名称: ${metadata.solutionName || '未命名方案'}`);
  lines.push(`导出时间: ${metadata.exportedAt}`);
  lines.push(`坐标系: ${metadata.coordinateSystem.toUpperCase()}`);
  lines.push(`处理人: ${metadata.handler}`);
  lines.push(`点位统计: ${metadata.pointCount}个 (预警:${metadata.warningCount} 危险:${metadata.dangerCount})`);
  lines.push(`状态筛选: ${metadata.filters.status.map(getStatusLabel).join(', ')}`);
  lines.push(`来源筛选: ${metadata.filters.source.map(getSourceLabel).join(', ')}`);
  return lines;
}

export function downloadCanvasWithWatermark(
  canvas: HTMLCanvasElement,
  metadata: ExportMetadata,
  filename: string = 'slope-warning-export.png'
): void {
  const watermarkLines = generateWatermarkText(metadata);
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height + 80 + watermarkLines.length * 20;
  const ctx = tempCanvas.getContext('2d');
  
  if (!ctx) return;

  ctx.fillStyle = '#1D2129';
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  ctx.drawImage(canvas, 0, 0);

  const footerY = canvas.height;
  ctx.fillStyle = '#2D3748';
  ctx.fillRect(0, footerY, tempCanvas.width, tempCanvas.height - canvas.height);

  ctx.fillStyle = '#165DFF';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('矿山边坡滑移预警 - 导出截图', 20, footerY + 25);

  ctx.font = '12px monospace';
  ctx.fillStyle = '#A0AEC0';
  watermarkLines.forEach((line, index) => {
    ctx.fillText(line, 20, footerY + 50 + index * 18);
  });

  ctx.fillStyle = '#718096';
  ctx.font = '10px sans-serif';
  ctx.fillText('注：本截图包含当前筛选条件，评审时请确认版本一致性', 20, tempCanvas.height - 10);

  const link = document.createElement('a');
  link.download = filename;
  link.href = tempCanvas.toDataURL('image/png');
  link.click();
}

export function generatePDFReport(
  canvas: HTMLCanvasElement,
  metadata: ExportMetadata,
  points: MonitoringPoint[],
  filename: string = 'slope-warning-report.pdf'
): void {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor(29, 33, 41);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setFontSize(20);
  doc.setTextColor(22, 93, 255);
  doc.text('矿山边坡滑移预警报告', 15, 20);

  doc.setFontSize(10);
  doc.setTextColor(160, 174, 192);
  doc.text(`导出时间: ${metadata.exportedAt}`, 15, 30);
  doc.text(`处理人: ${metadata.handler}`, 15, 36);
  doc.text(`坐标系: ${metadata.coordinateSystem.toUpperCase()}`, 15, 42);

  const imgData = canvas.toDataURL('image/jpeg', 0.8);
  const imgWidth = pageWidth - 30;
  const imgHeight = (canvas.height / canvas.width) * imgWidth;
  doc.addImage(imgData, 'JPEG', 15, 50, imgWidth, Math.min(imgHeight, 120));

  const tableY = 50 + Math.min(imgHeight, 120) + 15;
  
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('异常点位清单', 15, tableY);

  const abnormalPoints = points.filter((p) => p.status !== 'normal');
  if (abnormalPoints.length > 0) {
    const headers = ['点位名称', '状态', '位移量(mm)', '来源', '处理建议'];
    const colWidths = [50, 25, 30, 30, 80];
    let y = tableY + 8;

    doc.setFillColor(45, 55, 72);
    doc.rect(15, y, pageWidth - 30, 8, 'F');
    
    let x = 15;
    headers.forEach((header, i) => {
      doc.setFontSize(9);
      doc.setTextColor(200, 200, 200);
      doc.text(header, x + 2, y + 5);
      x += colWidths[i];
    });

    y += 10;

    abnormalPoints.slice(0, 8).forEach((point, index) => {
      if (index % 2 === 0) {
        doc.setFillColor(30, 34, 42);
      } else {
        doc.setFillColor(35, 40, 50);
      }
      doc.rect(15, y, pageWidth - 30, 7, 'F');

      x = 15;
      doc.setFontSize(8);
      doc.setTextColor(220, 220, 220);
      doc.text(point.name, x + 2, y + 4.5);
      x += colWidths[0];

      doc.setTextColor(
        point.status === 'danger' ? 245 : point.status === 'warning' ? 255 : 0,
        point.status === 'danger' ? 63 : point.status === 'warning' ? 125 : 180,
        point.status === 'danger' ? 63 : point.status === 'warning' ? 0 : 42
      );
      doc.text(getStatusLabel(point.status), x + 2, y + 4.5);
      x += colWidths[1];

      doc.setTextColor(220, 220, 220);
      doc.text(point.displacement.toFixed(1), x + 2, y + 4.5);
      x += colWidths[2];

      doc.text(getSourceLabel(point.source), x + 2, y + 4.5);
      x += colWidths[3];

      doc.setTextColor(160, 174, 192);
      const suggestion = point.suggestion || '待处理';
      doc.text(suggestion.length > 15 ? suggestion.substring(0, 15) + '...' : suggestion, x + 2, y + 4.5);

      y += 8;
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(160, 174, 192);
    doc.text('当前筛选下无异常点位', 15, tableY + 15);
  }

  doc.setFontSize(10);
  doc.setTextColor(113, 128, 150);
  doc.text('--- 业务处理建议 ---', 15, pageHeight - 25);
  doc.setFontSize(8);
  doc.text('1. 异常点位请在24小时内安排现场复核  2. 危险点位建议启动预警响应机制  3. 所有处理请保留记录备查', 15, pageHeight - 18);
  doc.text('--- 矿山边坡滑移预警系统 ---', pageWidth - 70, pageHeight - 10);

  doc.save(filename);
}

export function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

export function generateExportFilename(type: 'screenshot' | 'report'): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 5).replace(/:/g, '');
  return `边坡预警_${type === 'screenshot' ? '截图' : '报告'}_${dateStr}_${timeStr}`;
}
