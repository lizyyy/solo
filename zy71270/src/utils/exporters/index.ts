import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import type {
  DataQualityIssue,
  PathSegment,
  Robot,
  CongestionReport,
  DataModification,
} from '../../types';
import { formatTimestamp, formatDuration } from '../format';

type ReportType = 'density' | 'congestion' | 'charging' | 'full';

interface PDFReportConfig {
  warehouseName: string;
  robotCount: number;
  segmentCount: number;
  congestionCount: number;
  timeRange: { start: number; end: number };
  reportType: ReportType;
  includeHeatmap: boolean;
  includePaths: boolean;
  includeQueue: boolean;
  includeModificationHistory: boolean;
  topCongestedShelves?: Array<{ id: string; level: number }>;
  modifications?: DataModification[];
  chargingQueueCount?: number;
}

export async function exportToPDF(
  config: PDFReportConfig,
  filename: string = 'report.pdf'
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 20;

  const reportTitles: Record<ReportType, string> = {
    density: '路径密度分析报告',
    congestion: '拥堵热力分析报告',
    charging: '充电排队分析报告',
    full: '仓储路径云图完整报告',
  };

  doc.setFontSize(18);
  doc.text(reportTitles[config.reportType], pageWidth / 2, y, { align: 'center' });
  y += 12;

  doc.setFontSize(10);
  doc.text(`生成时间: ${formatTimestamp(Date.now())}`, margin, y);
  y += 8;
  doc.text(`仓库: ${config.warehouseName}`, margin, y);
  y += 8;
  doc.text(`统计时间: ${formatTimestamp(config.timeRange.start)} - ${formatTimestamp(config.timeRange.end)}`, margin, y);
  y += 12;

  doc.setFontSize(14);
  doc.text('数据概览', margin, y);
  y += 10;

  doc.setFontSize(10);
  const stats: string[] = [];
  if (config.includePaths) stats.push(`路径段数量: ${config.segmentCount}`);
  stats.push(`机器人数量: ${config.robotCount}`);
  if (config.includeHeatmap) stats.push(`拥堵报告数量: ${config.congestionCount}`);
  if (config.includeQueue && config.chargingQueueCount !== undefined) {
    stats.push(`充电排队数量: ${config.chargingQueueCount}`);
  }
  for (const stat of stats) {
    doc.text(stat, margin + 5, y);
    y += 7;
  }

  if (config.includeHeatmap && config.topCongestedShelves && config.topCongestedShelves.length > 0) {
    y += 5;
    doc.setFontSize(12);
    doc.text('拥堵货架 TOP 5', margin, y);
    y += 8;
    doc.setFontSize(9);
    config.topCongestedShelves.slice(0, 5).forEach((shelf, idx) => {
      doc.text(`${idx + 1}. ${shelf.id} - 拥堵等级: ${(shelf.level * 100).toFixed(1)}%`, margin + 5, y);
      y += 6;
    });
  }

  if (config.includeModificationHistory && config.modifications && config.modifications.length > 0) {
    y += 5;
    doc.setFontSize(12);
    doc.text('最近修改记录', margin, y);
    y += 8;
    doc.setFontSize(8);
    config.modifications.slice(0, 10).forEach((mod) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const time = formatTimestamp(mod.modifiedAt).split(' ')[1];
      doc.text(
        `${time} | ${mod.entityType}.${mod.fieldName}: ${mod.oldValue} → ${mod.newValue}`,
        margin + 5,
        y
      );
      y += 5;
    });
  }

  doc.save(filename);
}

interface ExcelExportConfig {
  pathSegments?: PathSegment[];
  congestionReports?: CongestionReport[];
  robots?: Robot[];
  modifications?: DataModification[];
  includePaths: boolean;
  includeHeatmap: boolean;
  includeQueue: boolean;
  includeModificationHistory: boolean;
  reportType: ReportType;
}

export function exportToExcel(
  config: ExcelExportConfig,
  filename: string = 'export.xlsx'
): void {
  const workbook = XLSX.utils.book_new();

  if (config.includePaths && config.pathSegments && config.pathSegments.length > 0) {
    const filteredSegments = config.reportType === 'density'
      ? config.pathSegments.filter(s => s.density > 0)
      : config.pathSegments;
    const flatSegments = filteredSegments.map(s => ({
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

  if (config.includeHeatmap && config.congestionReports && config.congestionReports.length > 0) {
    const flatCongestion = config.congestionReports.map(c => ({
      id: c.id,
      shelfId: c.shelfId,
      startTime: formatTimestamp(c.startTime),
      endTime: formatTimestamp(c.endTime),
      duration: formatDuration((c.endTime - c.startTime) / 1000),
      reason: c.reason,
      robotCount: c.robotCount,
      avgWaitTime: c.avgWaitTime,
      isManuallyModified: c.isManuallyModified ? '是' : '否',
    }));
    const ws2 = XLSX.utils.json_to_sheet(flatCongestion);
    XLSX.utils.book_append_sheet(workbook, ws2, '拥堵报告');
  }

  if (config.robots && config.robots.length > 0) {
    const flatRobots = config.robots.map(r => ({
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

  if (config.includeModificationHistory && config.modifications && config.modifications.length > 0) {
    const flatMods = config.modifications.map(m => ({
      id: m.id,
      entityType: m.entityType,
      entityId: m.entityId,
      fieldName: m.fieldName,
      oldValue: m.oldValue,
      newValue: m.newValue,
      modifiedBy: m.modifiedBy,
      modifiedAt: formatTimestamp(m.modifiedAt),
      reason: m.reason,
      isRollback: m.isRollback ? '是' : '否',
      rollbackFrom: m.rollbackFrom ?? '',
    }));
    const ws4 = XLSX.utils.json_to_sheet(flatMods);
    XLSX.utils.book_append_sheet(workbook, ws4, '修改历史');
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
