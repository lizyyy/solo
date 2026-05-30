import * as XLSX from 'xlsx';
import type { AlignedSample, OperationSegment, Anomaly, AnalysisReport, ExportFormat } from '../types';
import { formatTimestamp, formatTorque, formatSpeed, formatTemperature, formatLoadLevel } from './formatters';

export function exportToJSON(
  data: AlignedSample[] | OperationSegment[] | Anomaly[] | AnalysisReport,
  filename: string
): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  downloadBlob(blob, filename);
}

export function exportToCSV(
  data: Array<Record<string, unknown>>,
  filename: string
): void {
  if (data.length === 0) {
    const blob = new Blob(['\ufeff'], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, filename);
    return;
  }

  const keys = Object.keys(data[0]);
  const headers = keys;
  
  const rows = data.map(row => 
    keys.map(key => {
      const value = row[key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    })
  );
  
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, filename);
}

export function exportToExcel(
  data: Record<string, Array<Record<string, unknown>>>,
  filename: string
): void {
  const wb = XLSX.utils.book_new();
  
  Object.entries(data).forEach(([sheetName, sheetData]) => {
    const ws = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });
  
  XLSX.writeFile(wb, filename);
}

export function exportSegmentsToExcel(
  segments: OperationSegment[],
  anomalies: Anomaly[],
  samples: AlignedSample[],
  filename: string
): void {
  const wb = XLSX.utils.book_new();
  
  const segmentData = segments.map(s => ({
    '工况段 ID': s.id,
    '开始时间': formatTimestamp(s.startTime),
    '结束时间': formatTimestamp(s.endTime),
    '持续时间 (s)': ((s.endTime - s.startTime) / 1000).toFixed(1),
    '负载档位': s.loadLevel,
    '采样点数': s.sampleCount,
    '平均转速 (rpm)': s.avgSpeed.toFixed(0),
    '平均扭矩 (N·m)': s.avgTorque.toFixed(3),
    '最大扭矩 (N·m)': s.maxTorque.toFixed(3),
    '最小扭矩 (N·m)': s.minTorque.toFixed(3),
    '平均温度 (°C)': s.avgTemperature.toFixed(1),
    '最高温度 (°C)': s.maxTemperature.toFixed(1),
    '存在异常': s.hasAnomaly ? '是' : '否',
    '关联异常 ID': s.anomalyIds.join('; ')
  }));
  
  const segmentWs = XLSX.utils.json_to_sheet(segmentData);
  XLSX.utils.book_append_sheet(wb, segmentWs, '工况分段');
  
  const anomalyData = anomalies.map(a => ({
    '异常 ID': a.id,
    '异常类型': a.type,
    '严重程度': a.severity,
    '状态': a.status,
    '检测时间': formatTimestamp(a.detectedAt),
    '描述': a.description,
    '详细信息': JSON.stringify(a.detail),
    '影响采样点数': a.affectedSampleIds.length,
    '影响工况段数': a.affectedSegmentIds.length,
    '确认人': a.confirmedBy ?? '',
    '确认时间': a.confirmedAt ? formatTimestamp(a.confirmedAt) : '',
    '确认备注': a.confirmedNote ?? ''
  }));
  
  const anomalyWs = XLSX.utils.json_to_sheet(anomalyData);
  XLSX.utils.book_append_sheet(wb, anomalyWs, '异常记录');
  
  const sampleData = samples.map(s => ({
    '采样点 ID': s.id,
    '原始数据 ID': s.rawSampleId,
    '时间戳': formatTimestamp(s.timestamp),
    '设备编号': s.deviceId,
    '转速 (rpm)': s.speed,
    '扭矩 (N·m)': s.torque,
    '原始扭矩 (mV/V)': s.torqueRaw,
    '温度 (°C)': s.temperature,
    '负载档位': s.loadLevel,
    '对齐状态': s.alignmentStatus,
    '偏移量 (ms)': s.shiftOffset ?? '',
    '关联异常 ID': s.anomalyIds.join('; ')
  }));
  
  const sampleWs = XLSX.utils.json_to_sheet(sampleData);
  XLSX.utils.book_append_sheet(wb, sampleWs, '采样明细');
  
  XLSX.writeFile(wb, filename);
}

export function exportReportToExcel(
  report: AnalysisReport,
  samples: AlignedSample[],
  filename: string
): void {
  exportSegmentsToExcel(report.segments, report.anomalies, samples, filename);
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

export function generateExportFilename(
  prefix: string,
  deviceId: string,
  format: ExportFormat
): string {
  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') + '_' +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0');
  
  const extensions: Record<ExportFormat, string> = {
    pdf: 'pdf',
    xlsx: 'xlsx',
    json: 'json',
    csv: 'csv'
  };
  
  return `${prefix}_${deviceId}_${timestamp}.${extensions[format]}`;
}
