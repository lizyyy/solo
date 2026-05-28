
import { GradingReport, ColorParams, HistoryEntry } from '../types';
import { formatDateTime } from './colorMath';
import { getGradeColor, getIssueName } from './scoring';
import jsPDF from 'jspdf';

const OPERATOR_KEY = 'color_challenge_operator';
const REPORT_KEY = 'color_challenge_reports';

export function getOperatorName(): string {
  const saved = localStorage.getItem(OPERATOR_KEY);
  return saved || '调色师';
}

export function setOperatorName(name: string): void {
  localStorage.setItem(OPERATOR_KEY, name);
}

export function saveReport(report: GradingReport): void {
  const reports = getReports();
  reports.push(report);
  localStorage.setItem(REPORT_KEY, JSON.stringify(reports));
}

export function getReports(): GradingReport[] {
  const data = localStorage.getItem(REPORT_KEY);
  return data ? JSON.parse(data) : [];
}

export function getReportsByLevel(levelId: string): GradingReport[] {
  return getReports().filter((r) => r.levelId === levelId);
}

export function deleteReport(reportId: string): void {
  const reports = getReports().filter((r) => r.id !== reportId);
  localStorage.setItem(REPORT_KEY, JSON.stringify(reports));
}

export function clearReports(): void {
  localStorage.removeItem(REPORT_KEY);
}

export async function exportReportAsPDF(report: GradingReport): Promise<void> {
  const pdf = new jsPDF('l', 'mm', 'a4');

  pdf.setFillColor(10, 10, 15);
  pdf.rect(0, 0, 297, 210, 'F');

  pdf.setTextColor(0, 212, 255);
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('COLOR GRADING CHALLENGE', 148, 20, { align: 'center' });

  pdf.setTextColor(200, 200, 200);
  pdf.setFontSize(12);
  pdf.text('调色分析报告', 148, 30, { align: 'center' });

  pdf.setFontSize(10);
  pdf.setTextColor(150, 150, 150);
  pdf.text('关卡: ' + report.levelName + ' | 操作者: ' + report.operator, 148, 38, { align: 'center' });
  pdf.text(formatDateTime(report.timestamp), 148, 45, { align: 'center' });

  const gradeColor = getGradeColor(report.score.grade);
  const r = parseInt(gradeColor.slice(1, 3), 16);
  const g = parseInt(gradeColor.slice(3, 5), 16);
  const b = parseInt(gradeColor.slice(5, 7), 16);

  pdf.setTextColor(r, g, b);
  pdf.setFontSize(48);
  pdf.setFont('helvetica', 'bold');
  pdf.text(report.score.grade, 25, 70);

  pdf.setTextColor(200, 200, 200);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.text('综合评分', 25, 85);
  pdf.text(report.score.overall + '/100', 25, 95);

  pdf.text('亮度', 85, 65);
  pdf.text(String(report.score.brightness), 85, 75);

  pdf.text('色彩', 85, 90);
  pdf.text(String(report.score.color), 85, 100);

  pdf.text('细节', 85, 115);
  pdf.text(String(report.score.detail), 85, 125);

  pdf.setTextColor(0, 212, 255);
  pdf.setFontSize(12);
  pdf.text('最终参数', 145, 60);

  pdf.setTextColor(200, 200, 200);
  pdf.setFontSize(10);
  pdf.text('曝光: ' + report.finalParams.exposure.toFixed(2), 145, 70);
  pdf.text('色温: ' + report.finalParams.temperature + 'K', 145, 78);
  pdf.text('LUT: ' + (report.finalParams.lutId || '无'), 145, 86);
  pdf.text('LUT强度: ' + report.finalParams.lutIntensity + '%', 145, 94);

  pdf.setTextColor(0, 212, 255);
  pdf.setFontSize(12);
  pdf.text('目标参数', 215, 60);

  pdf.setTextColor(150, 150, 150);
  pdf.setFontSize(10);
  pdf.text('曝光: ' + report.targetParams.exposure.toFixed(2), 215, 70);
  pdf.text('色温: ' + report.targetParams.temperature + 'K', 215, 78);
  pdf.text('LUT: ' + (report.targetParams.lutId || '无'), 215, 86);
  pdf.text('LUT强度: ' + report.targetParams.lutIntensity + '%', 215, 94);

  if (report.score.issues.length > 0) {
    pdf.setTextColor(255, 107, 53);
    pdf.setFontSize(12);
    pdf.text('检测到的问题', 25, 140);

    pdf.setTextColor(200, 200, 200);
    pdf.setFontSize(9);
    report.score.issues.forEach((issue, index) => {
      const severity = issue.severity === 'error' ? '[严重] ' : '[警告] ';
      pdf.text(severity + getIssueName(issue.type) + ': ' + issue.message, 25, 150 + index * 7);
    });
  }

  if (report.notes) {
    pdf.setTextColor(0, 212, 255);
    pdf.setFontSize(12);
    pdf.text('备注', 145, 140);

    pdf.setTextColor(200, 200, 200);
    pdf.setFontSize(9);
    const noteLines = pdf.splitTextToSize(report.notes, 80);
    pdf.text(noteLines, 145, 150);
  }

  if (report.manualCorrections && report.manualCorrections.length > 0) {
    pdf.setTextColor(168, 85, 247);
    pdf.setFontSize(12);
    pdf.text('人工更正记录', 25, 175);

    pdf.setTextColor(200, 200, 200);
    pdf.setFontSize(8);
    report.manualCorrections.slice(0, 3).forEach((entry, index) => {
      const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN');
      pdf.text(time + ' - ' + (entry.note || '参数调整'), 25, 183 + index * 6);
    });
  }

  pdf.save('color-grading-report-' + report.id.slice(0, 8) + '.pdf');
}

export async function captureComparisonScreenshot(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement
): Promise<string> {
  const width = sourceCanvas.width + targetCanvas.width;
  const height = Math.max(sourceCanvas.height, targetCanvas.height);

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const ctx = tempCanvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.drawImage(targetCanvas, sourceCanvas.width, 0);

    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();

    ctx.fillStyle = '#00d4ff';
    ctx.font = '14px monospace';
    ctx.fillText('参考画面', 10, 25);
    ctx.fillText('调色结果', sourceCanvas.width + 10, 25);
  }

  return tempCanvas.toDataURL('image/png');
}

export function downloadScreenshot(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export function formatParamsForDisplay(params: ColorParams): string {
  const parts = [];
  parts.push('曝光: ' + params.exposure.toFixed(2));
  parts.push('色温: ' + params.temperature + 'K');
  if (params.lutId && params.lutId !== 'none') {
    parts.push('LUT: ' + params.lutId + ' (' + params.lutIntensity + '%)');
  }
  return parts.join(' | ');
}

export function getManualCorrections(history: HistoryEntry[]): HistoryEntry[] {
  return history.filter((entry) => entry.isManualCorrection);
}
