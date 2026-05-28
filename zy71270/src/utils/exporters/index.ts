import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import type { DataQualityIssue, PathSegment, Robot, CongestionReport } from '../../types';
import { formatTimestamp } from '../format';

interface PDFReportData {
  warehouseName: string;
  robotCount: number;
  segmentCount: number;
  congestionCount: number;
  timeRange: { start: number; end: number };
}

export async function exportToPDF(
  data: PDFReportData,
  filename: string = 'report.pdf'
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 20;

  doc.setFontSize(18);
  doc.text('仓储路径云图报告', pageWidth / 2, y, { align: 'center' });
  y += 12;

  doc.setFontSize(10);
  doc.text(`生成时间: ${formatTimestamp(Date.now())}`, margin, y);
  y += 8;
  doc.text(`仓库: ${data.warehouseName}`, margin, y);
  y += 8;
  doc.text(`统计时间: ${formatTimestamp(data.timeRange.start)} - ${formatTimestamp(data.timeRange.end)}`, margin, y);
  y += 12;

  doc.setFontSize(14);
  doc.text('数据概览', margin, y);
  y += 10;

  doc.setFontSize(10);
  const stats = [
    `机器人数量: ${data.robotCount}`,
    `路径段数量: ${data.segmentCount}`,
    `拥堵报告数量: ${data.congestionCount}`,
  ];
  for (const stat of stats) {
    doc.text(stat, margin + 5, y);
    y += 7;
  }

  doc.save(filename);
}

interface ExcelExportData {
  pathSegments?: PathSegment[];
  congestionReports?: CongestionReport[];
  robots?: Robot[];
}

export function exportToExcel(
  data: ExcelExportData,
  filename: string = 'export.xlsx'
): void {
  const workbook = XLSX.utils.book_new();

  if (data.pathSegments && data.pathSegments.length > 0) {
    const flatSegments = data.pathSegments.map(s => ({
      id: s.id,
      robotId: s.robotId,
      startPoint_x: s.startPoint.position.x,
      startPoint_y: s.startPoint.position.y,
      startPoint_z: s.startPoint.position.z,
      endPoint_x: s.endPoint.position.x,
      endPoint_y: s.endPoint.position.y,
      endPoint_z: s.endPoint.position.z,
      density: s.density,
      avgSpeed: s.avgSpeed,
      isBroken: s.isBroken,
      floor: s.startPoint.floor,
    }));
    const ws1 = XLSX.utils.json_to_sheet(flatSegments);
    XLSX.utils.book_append_sheet(workbook, ws1, '路径段');
  }

  if (data.congestionReports && data.congestionReports.length > 0) {
    const ws2 = XLSX.utils.json_to_sheet(data.congestionReports);
    XLSX.utils.book_append_sheet(workbook, ws2, '拥堵报告');
  }

  if (data.robots && data.robots.length > 0) {
    const flatRobots = data.robots.map(r => ({
      id: r.id,
      name: r.name,
      model: r.model,
      status: r.status,
      batteryLevel: r.batteryLevel,
      currentPosition_x: r.currentPosition?.x ?? null,
      currentPosition_y: r.currentPosition?.y ?? null,
      currentPosition_z: r.currentPosition?.z ?? null,
      currentFloor: r.currentFloor ?? null,
    }));
    const ws3 = XLSX.utils.json_to_sheet(flatRobots);
    XLSX.utils.book_append_sheet(workbook, ws3, '机器人');
  }

  XLSX.writeFile(workbook, filename);
}

export async function captureScene(
  element: HTMLElement,
  filename: string = 'scene.png'
): Promise<string> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#1a1a2e',
    scale: 2,
    useCORS: true,
  });

  const dataUrl = canvas.toDataURL('image/png');

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();

  return dataUrl;
}
