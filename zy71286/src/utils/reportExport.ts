import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import type {
  TransitionMatrix,
  ForecastResult,
  AnomalyRecord,
  WeeklyRecord,
  ContentType,
  ReportFormat,
  ReportBatch,
  ProductStatus,
} from '@/types';
import { PRODUCT_STATUSES, STATUS_LABELS, ANOMALY_LABELS } from '@/types';

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

let batchCounter = 0;
const weekBatchMap: Record<string, number> = {};

export function generateBatchId(date: Date = new Date()): string {
  const year = date.getFullYear();
  const week = getISOWeek(date);
  const key = `${year}-W${week}`;

  if (!weekBatchMap[key]) {
    weekBatchMap[key] = 1;
  } else {
    weekBatchMap[key]++;
  }

  batchCounter = weekBatchMap[key];
  return `${year}-W${String(week).padStart(2, '0')}-BATCH-${String(batchCounter).padStart(3, '0')}`;
}

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  FULL_REPORT: '完整分析报告',
  MATRIX_ONLY: '转移矩阵数据',
  FORECAST_ONLY: '状态预测结果',
  ANOMALY_ONLY: '异常诊断报告',
};

const FORMAT_EXTENSIONS: Record<ReportFormat, string> = {
  EXCEL: 'xlsx',
  PDF: 'pdf',
  JSON: 'json',
};

export function generateReportName(
  contentType: ContentType,
  format: ReportFormat,
  batchId: string
): string {
  const typeLabel = CONTENT_TYPE_LABELS[contentType];
  const ext = FORMAT_EXTENSIONS[format];
  return `${batchId}_${typeLabel}.${ext}`;
}

export function exportToExcel(
  matrix: TransitionMatrix | null,
  forecast: ForecastResult[],
  anomalies: AnomalyRecord[],
  records: WeeklyRecord[],
  contentType: ContentType
): ReportBatch | null {
  if (!matrix) return null;

  const wb = XLSX.utils.book_new();
  const batchId = generateBatchId();
  const fileName = generateReportName(contentType, 'EXCEL', batchId);

  if (contentType === 'FULL_REPORT' || contentType === 'MATRIX_ONLY') {
    const matrixData: (string | number)[][] = [
      ['转移概率矩阵', '', '', '', '', '', '样本量矩阵', '', '', '', '', ''],
      ['从\\到', ...PRODUCT_STATUSES.map(s => STATUS_LABELS[s]), '', '从\\到', ...PRODUCT_STATUSES.map(s => STATUS_LABELS[s])],
    ];

    for (let i = 0; i < PRODUCT_STATUSES.length; i++) {
      const row: (string | number)[] = [STATUS_LABELS[PRODUCT_STATUSES[i]]];
      for (let j = 0; j < PRODUCT_STATUSES.length; j++) {
        row.push(`${(matrix.probabilities[i][j] * 100).toFixed(2)}%`);
      }
      row.push('');
      row.push(STATUS_LABELS[PRODUCT_STATUSES[i]]);
      for (let j = 0; j < PRODUCT_STATUSES.length; j++) {
        row.push(matrix.sampleCounts[i][j]);
      }
      matrixData.push(row);
    }

    matrixData.push([]);
    matrixData.push(['生成时间:', matrix.generatedAt.toLocaleString('zh-CN')]);
    matrixData.push(['数据窗口:', `${matrix.windowSize} 周`]);
    matrixData.push(['包含促销:', matrix.includePromo ? '是' : '否']);

    const ws1 = XLSX.utils.aoa_to_sheet(matrixData);
    XLSX.utils.book_append_sheet(wb, ws1, '转移矩阵');
  }

  if (contentType === 'FULL_REPORT' || contentType === 'FORECAST_ONLY') {
    const forecastData: (string | number)[][] = [
      ['周次', ...PRODUCT_STATUSES.map(s => `${STATUS_LABELS[s]}_概率`), ...PRODUCT_STATUSES.map(s => `${STATUS_LABELS[s]}_下限`), ...PRODUCT_STATUSES.map(s => `${STATUS_LABELS[s]}_上限`)],
    ];

    forecast.forEach(f => {
      const row: (string | number)[] = [`第${f.week}周`];
      PRODUCT_STATUSES.forEach(s => row.push(`${(f.probabilities[s] * 100).toFixed(2)}%`));
      PRODUCT_STATUSES.forEach(s => row.push(`${(f.confidenceInterval.lower[s] * 100).toFixed(2)}%`));
      PRODUCT_STATUSES.forEach(s => row.push(`${(f.confidenceInterval.upper[s] * 100).toFixed(2)}%`));
      forecastData.push(row);
    });

    const ws2 = XLSX.utils.aoa_to_sheet(forecastData);
    XLSX.utils.book_append_sheet(wb, ws2, '状态预测');
  }

  if (contentType === 'FULL_REPORT' || contentType === 'ANOMALY_ONLY') {
    const anomalyData: (string | number)[][] = [
      ['异常类型', '严重程度', '源状态', '目标状态', '描述', '建议', '样本量', '干扰因子', '是否已解决'],
    ];

    anomalies.forEach(a => {
      anomalyData.push([
        ANOMALY_LABELS[a.type],
        a.severity === 'HIGH' ? '高' : a.severity === 'MEDIUM' ? '中' : '低',
        a.fromStatus ? STATUS_LABELS[a.fromStatus] : '-',
        a.toStatus ? STATUS_LABELS[a.toStatus] : '-',
        a.description,
        a.suggestion,
        a.sampleCount ?? '-',
        a.distortionFactor ? `${(a.distortionFactor * 100).toFixed(1)}%` : '-',
        a.isResolved ? '是' : '否',
      ]);
    });

    const ws3 = XLSX.utils.aoa_to_sheet(anomalyData);
    XLSX.utils.book_append_sheet(wb, ws3, '异常诊断');
  }

  if (contentType === 'FULL_REPORT') {
    const recordData = XLSX.utils.json_to_sheet(records.map(r => ({
      SKU: r.sku,
      商品名称: r.productName,
      品类: r.category,
      周次: r.weekNum,
      年份: r.year,
      销量: r.salesVolume,
      库存: r.inventory,
      周转天数: r.turnoverDays,
      是否促销: r.isPromotion ? '是' : '否',
      商品状态: STATUS_LABELS[r.status],
      确认状态: r.confirmationStatus === 'CONFIRMED' ? '已确认' : '临时备注',
      备注: r.notes || '',
    })));
    XLSX.utils.book_append_sheet(wb, recordData, '原始数据');
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);

  return {
    batchId,
    name: fileName,
    contentType,
    format: 'EXCEL',
    generatedAt: new Date(),
    generatedBy: '分析师',
    downloadUrl: url,
  };
}

export function exportToJSON(
  matrix: TransitionMatrix | null,
  forecast: ForecastResult[],
  anomalies: AnomalyRecord[],
  records: WeeklyRecord[],
  contentType: ContentType
): ReportBatch | null {
  if (!matrix) return null;

  const batchId = generateBatchId();
  const fileName = generateReportName(contentType, 'JSON', batchId);

  const data: Record<string, unknown> = {
    batchId,
    generatedAt: new Date().toISOString(),
    contentType,
  };

  if (contentType === 'FULL_REPORT' || contentType === 'MATRIX_ONLY') {
    data.transitionMatrix = {
      states: matrix.states,
      probabilities: matrix.probabilities,
      sampleCounts: matrix.sampleCounts,
      windowSize: matrix.windowSize,
      includePromo: matrix.includePromo,
    };
  }

  if (contentType === 'FULL_REPORT' || contentType === 'FORECAST_ONLY') {
    data.forecast = forecast;
  }

  if (contentType === 'FULL_REPORT' || contentType === 'ANOMALY_ONLY') {
    data.anomalies = anomalies;
  }

  if (contentType === 'FULL_REPORT') {
    data.rawRecords = records;
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);

  return {
    batchId,
    name: fileName,
    contentType,
    format: 'JSON',
    generatedAt: new Date(),
    generatedBy: '分析师',
    downloadUrl: url,
  };
}

export function exportToPDF(
  matrix: TransitionMatrix | null,
  forecast: ForecastResult[],
  anomalies: AnomalyRecord[],
  contentType: ContentType
): ReportBatch | null {
  if (!matrix) return null;

  const batchId = generateBatchId();
  const fileName = generateReportName(contentType, 'PDF', batchId);
  const rowHeight = 12;

  const doc = new jsPDF();
  let yPos = 20;

  doc.setFontSize(18);
  doc.text('库存周转马尔可夫链分析报告', 105, yPos, { align: 'center' });
  yPos += 15;

  doc.setFontSize(10);
  doc.text(`批次号: ${batchId}`, 14, yPos);
  doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, 14, yPos + 7);
  doc.text(`内容类型: ${CONTENT_TYPE_LABELS[contentType]}`, 14, yPos + 14);
  yPos += 25;

  if (contentType === 'FULL_REPORT' || contentType === 'MATRIX_ONLY') {
    doc.setFontSize(14);
    doc.text('一、转移概率矩阵', 14, yPos);
    yPos += 10;

    doc.setFontSize(9);
    const colWidth = 30;

    doc.setFillColor(240, 240, 240);
    doc.rect(14, yPos, colWidth * 6, rowHeight, 'F');
    doc.text('从\\到', 16, yPos + 8);
    PRODUCT_STATUSES.forEach((s, i) => {
      doc.text(STATUS_LABELS[s], 16 + colWidth * (i + 1), yPos + 8);
    });
    yPos += rowHeight;

    for (let i = 0; i < PRODUCT_STATUSES.length; i++) {
      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(14, yPos, colWidth * 6, rowHeight, 'F');
      }
      doc.text(STATUS_LABELS[PRODUCT_STATUSES[i]], 16, yPos + 8);
      for (let j = 0; j < PRODUCT_STATUSES.length; j++) {
        const prob = (matrix.probabilities[i][j] * 100).toFixed(1);
        doc.text(`${prob}%`, 16 + colWidth * (j + 1), yPos + 8);
      }
      yPos += rowHeight;
    }

    yPos += 10;
    doc.setFontSize(10);
    doc.text(`* 数据窗口: ${matrix.windowSize}周 | 包含促销数据: ${matrix.includePromo ? '是' : '否'}`, 14, yPos);
    yPos += 15;
  }

  if (contentType === 'FULL_REPORT' || contentType === 'FORECAST_ONLY') {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text('二、状态预测结果', 14, yPos);
    yPos += 10;

    doc.setFontSize(9);
    const lastForecast = forecast[forecast.length - 1];
    doc.text(`预测周期: ${forecast.length - 1}周`, 14, yPos);
    yPos += 8;

    const fColWidth = 32;
    doc.setFillColor(240, 240, 240);
    doc.rect(14, yPos, fColWidth * 3, rowHeight, 'F');
    doc.text('状态', 16, yPos + 8);
    doc.text('概率', 16 + fColWidth, yPos + 8);
    doc.text('95%置信区间', 16 + fColWidth * 2, yPos + 8);
    yPos += rowHeight;

    PRODUCT_STATUSES.forEach((s, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(14, yPos, fColWidth * 3, rowHeight, 'F');
      }
      const prob = (lastForecast.probabilities[s] * 100).toFixed(1);
      const lower = (lastForecast.confidenceInterval.lower[s] * 100).toFixed(1);
      const upper = (lastForecast.confidenceInterval.upper[s] * 100).toFixed(1);
      doc.text(STATUS_LABELS[s], 16, yPos + 8);
      doc.text(`${prob}%`, 16 + fColWidth, yPos + 8);
      doc.text(`[${lower}%, ${upper}%]`, 16 + fColWidth * 2, yPos + 8);
      yPos += rowHeight;
    });
    yPos += 10;
  }

  if (contentType === 'FULL_REPORT' || contentType === 'ANOMALY_ONLY') {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text('三、异常诊断结果', 14, yPos);
    yPos += 10;

    doc.setFontSize(9);
    const highCount = anomalies.filter(a => a.severity === 'HIGH' && !a.isResolved).length;
    const medCount = anomalies.filter(a => a.severity === 'MEDIUM' && !a.isResolved).length;
    doc.text(`待处理异常: 高风险 ${highCount} 项, 中风险 ${medCount} 项`, 14, yPos);
    yPos += 10;

    anomalies.slice(0, 5).forEach((a, i) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      const severityColor: [number, number, number] = a.severity === 'HIGH' ? [239, 68, 68] : a.severity === 'MEDIUM' ? [245, 158, 11] : [34, 197, 94];
      doc.setFillColor(severityColor[0], severityColor[1], severityColor[2]);
      doc.rect(14, yPos, 3, 20, 'F');

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`${ANOMALY_LABELS[a.type]} (${a.severity === 'HIGH' ? '高' : a.severity === 'MEDIUM' ? '中' : '低'})`, 20, yPos + 5);
      doc.setFontSize(8);
      const descLines = doc.splitTextToSize(a.description, 170);
      doc.text(descLines, 20, yPos + 12);
      yPos += 12 + descLines.length * 5;
      doc.text(`建议: ${a.suggestion}`, 20, yPos);
      yPos += 12;
    });
  }

  doc.save(fileName);

  return {
    batchId,
    name: fileName,
    contentType,
    format: 'PDF',
    generatedAt: new Date(),
    generatedBy: '分析师',
    downloadUrl: '',
  };
}

export function exportReport(
  format: ReportFormat,
  contentType: ContentType,
  matrix: TransitionMatrix | null,
  forecast: ForecastResult[],
  anomalies: AnomalyRecord[],
  records: WeeklyRecord[]
): ReportBatch | null {
  switch (format) {
    case 'EXCEL':
      return exportToExcel(matrix, forecast, anomalies, records, contentType);
    case 'JSON':
      return exportToJSON(matrix, forecast, anomalies, records, contentType);
    case 'PDF':
      return exportToPDF(matrix, forecast, anomalies, contentType);
    default:
      return null;
  }
}
