import { BatchReport, GameRecord, ExceptionRecord, ExceptionSummary, FunctionCard } from '../types';
import { generateId } from './curveGenerator';
import { getExceptionsByBatch, countExceptionsByType } from './exceptionManager';
import { filterRecordsByBatch, getPendingRecords, getExceptionRecords } from './recordManager';
import jsPDF from 'jspdf';

export const generateBatchReport = (
  batchId: string,
  records: GameRecord[],
  exceptions: ExceptionRecord[],
  functionCards: FunctionCard[],
  score: number,
  maxCombo: number,
  generatedBy: string = 'player'
): BatchReport => {
  const batchRecords = filterRecordsByBatch(records, batchId);
  const batchExceptions = getExceptionsByBatch(exceptions, batchId);

  const startTime = batchRecords.length > 0
    ? Math.min(...batchRecords.map(r => r.timestamp))
    : Date.now();
  const endTime = batchRecords.length > 0
    ? Math.max(...batchRecords.map(r => r.timestamp))
    : Date.now();

  const normalRecords = batchRecords.filter(r => r.status === 'normal' && r.recordType === 'normal');
  const exceptionRecords = getExceptionRecords(batchRecords);
  const pendingRecords = getPendingRecords(batchRecords);

  const functionCardIds = [...new Set(batchRecords.map(r => r.functionCardId))];
  const exceptionTypes = countExceptionsByType(batchExceptions);

  const exceptionSummaries: ExceptionSummary[] = Object.entries(exceptionTypes).map(
    ([type, count]) => {
      const typeExceptions = batchExceptions.filter(e => e.type === type);
      const maxSeverity = typeExceptions.reduce(
        (max, e) => {
          const severityOrder = { low: 0, medium: 1, high: 2 };
          return severityOrder[e.severity] > severityOrder[max as keyof typeof severityOrder]
            ? e.severity
            : max;
        },
        'low'
      );
      return {
        type,
        count,
        severity: maxSeverity,
      };
    }
  );

  return {
    id: generateId('rpt'),
    batchId,
    startTime,
    endTime,
    totalRecords: batchRecords.length,
    normalRecords: normalRecords.length,
    exceptionRecords: exceptionRecords.length,
    pendingRecords: pendingRecords.length,
    functionCards: functionCardIds,
    score,
    maxCombo,
    exceptions: exceptionSummaries,
    generatedAt: Date.now(),
    generatedBy,
  };
};

export const generateReportFileName = (batchId: string, format: 'json' | 'pdf'): string => {
  const datePart = batchId.replace('BATCH-', '').replace(/-/g, '');
  return `函数怪兽躲避战_${datePart}_${batchId}.${format}`;
};

export const exportReportToJson = (report: BatchReport): string => {
  return JSON.stringify(report, null, 2);
};

export const exportReportToPdf = async (
  report: BatchReport,
  functionCards: FunctionCard[]
): Promise<Blob> => {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text('函数怪兽躲避战 - 批次报告', 105, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.text(`批次号: ${report.batchId}`, 20, 35);
  doc.text(
    `时间段: ${new Date(report.startTime).toLocaleString('zh-CN')} ~ ${new Date(report.endTime).toLocaleString('zh-CN')}`,
    20,
    45
  );
  doc.text(`生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`, 20, 55);
  doc.text(`生成者: ${report.generatedBy}`, 20, 65);

  doc.setFontSize(14);
  doc.text('统计概览', 20, 80);
  doc.setFontSize(11);
  doc.text(`总记录数: ${report.totalRecords}`, 25, 90);
  doc.text(`正常记录: ${report.normalRecords}`, 25, 100);
  doc.text(`异常记录: ${report.exceptionRecords}`, 25, 110);
  doc.text(`待确认记录: ${report.pendingRecords}`, 25, 120);
  doc.text(`最终得分: ${report.score}`, 25, 130);
  doc.text(`最大连击: ${report.maxCombo}`, 25, 140);

  if (report.functionCards.length > 0) {
    doc.setFontSize(14);
    doc.text('使用的函数卡', 20, 155);
    doc.setFontSize(11);
    report.functionCards.forEach((cardId, index) => {
      const card = functionCards.find(c => c.id === cardId);
      const cardName = card ? card.name : cardId;
      doc.text(`${index + 1}. ${cardName}`, 25, 165 + index * 10);
    });
  }

  if (report.exceptions.length > 0) {
    const yOffset = 165 + report.functionCards.length * 10 + 15;
    doc.setFontSize(14);
    doc.text('异常分析', 20, yOffset);
    doc.setFontSize(11);
    report.exceptions.forEach((exc, index) => {
      const typeLabels: Record<string, string> = {
        out_of_bounds: '坐标越界',
        slope_misjudgment: '斜率误判',
        breakpoint_crossing: '断点穿越',
      };
      const severityLabels: Record<string, string> = {
        low: '低',
        medium: '中',
        high: '高',
      };
      doc.text(
        `${index + 1}. ${typeLabels[exc.type] || exc.type}: ${exc.count}次 (严重程度: ${severityLabels[exc.severity] || exc.severity})`,
        25,
        yOffset + 10 + index * 10
      );
    });
  }

  return doc.output('blob');
};

export const downloadFile = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportBatchReport = async (
  report: BatchReport,
  functionCards: FunctionCard[],
  format: 'json' | 'pdf'
): Promise<void> => {
  const filename = generateReportFileName(report.batchId, format);

  if (format === 'json') {
    const json = exportReportToJson(report);
    const blob = new Blob([json], { type: 'application/json' });
    downloadFile(blob, filename);
  } else {
    const blob = await exportReportToPdf(report, functionCards);
    downloadFile(blob, filename);
  }
};

export const formatReportDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getReportSummary = (report: BatchReport): {
  total: number;
  normalRate: string;
  exceptionRate: string;
  pendingRate: string;
} => {
  const total = report.totalRecords || 1;
  return {
    total: report.totalRecords,
    normalRate: ((report.normalRecords / total) * 100).toFixed(1) + '%',
    exceptionRate: ((report.exceptionRecords / total) * 100).toFixed(1) + '%',
    pendingRate: ((report.pendingRecords / total) * 100).toFixed(1) + '%',
  };
};
