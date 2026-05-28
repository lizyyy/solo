
import { GradingReport, ColorParams } from '../types';
import { formatDateTime } from './colorMath';
import { getGradeColor } from './scoring';
import jsPDF from 'jspdf';

const OPERATOR_NAME = 'Player';

const REPORT_KEY = 'color_challenge_reports';

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

export function getOperatorName(): string {
  return OPERATOR_NAME;
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
  pdf.text('Report', 148, 30, { align: 'center' });
  pdf.text(formatDateTime(report.timestamp), 148, 38, { align: 'center' });

  const gradeColor = getGradeColor(report.score.grade);
  const r = parseInt(gradeColor.slice(1, 3), 16);
  const g = parseInt(gradeColor.slice(3, 5), 16);
  const b = parseInt(gradeColor.slice(5, 7), 16);

  pdf.setTextColor(r, g, b);
  pdf.setFontSize(48);
  pdf.setFont('helvetica', 'bold');
  pdf.text(report.score.grade, 40, 60);

  pdf.setTextColor(200, 200, 200);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Overall Score', 40, 75);
  pdf.text(report.score.overall + '/100', 40, 85);

  pdf.text('Brightness', 100, 65);
  pdf.text(String(report.score.brightness), 100, 75);

  pdf.text('Color', 100, 90);
  pdf.text(String(report.score.color), 100, 100);

  pdf.text('Detail', 100, 115);
  pdf.text(String(report.score.detail), 100, 125);

  pdf.setTextColor(0, 212, 255);
  pdf.setFontSize(14);
  pdf.text('Parameters', 180, 55);

  pdf.setTextColor(200, 200, 200);
  pdf.setFontSize(11);
  pdf.text('Exposure: ' + report.finalParams.exposure.toFixed(2), 180, 65);
  pdf.text('Temperature: ' + report.finalParams.temperature + 'K', 180, 75);
  pdf.text('LUT: ' + (report.finalParams.lutId || 'None'), 180, 85);
  pdf.text('LUT Intensity: ' + report.finalParams.lutIntensity + '%', 180, 95);

  if (report.score.issues.length > 0) {
    pdf.setTextColor(255, 107, 53);
    pdf.setFontSize(12);
    pdf.text('Issues Detected', 20, 140);

    pdf.setTextColor(200, 200, 200);
    pdf.setFontSize(10);
    report.score.issues.forEach((issue, index) => {
      pdf.text('* ' + issue.message, 20, 150 + index * 8);
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
