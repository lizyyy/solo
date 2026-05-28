import jsPDF from 'jspdf';
import { CalibrationRecord, CalibrationError } from '../types/calibration';
import { GeneratedReport } from './reportService';
import { formatDate } from '../utils/formatters';

export interface ExportOptions {
  includeScreenshots?: boolean;
  includeErrors?: boolean;
  includeRecommendations?: boolean;
  pageSize?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeScreenshots: true,
  includeErrors: true,
  includeRecommendations: true,
  pageSize: 'a4',
  orientation: 'portrait',
};

export interface ExportResult {
  success: boolean;
  blob?: Blob;
  url?: string;
  error?: string;
  fallbackHtml?: string;
}

export const exportToPDF = async (
  report: GeneratedReport,
  records: CalibrationRecord[],
  options: ExportOptions = {}
): Promise<ExportResult> => {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  try {
    const doc = new jsPDF({
      orientation: mergedOptions.orientation,
      unit: 'mm',
      format: mergedOptions.pageSize,
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text(report.title, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(report.subtitle, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;

    doc.setFontSize(10);
    doc.text(
      `生成时间: ${formatDate(report.generatedAt)}`,
      pageWidth / 2,
      yPosition,
      { align: 'center' }
    );
    yPosition += 15;

    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(1);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    for (const section of report.sections) {
      if (yPosition > pageHeight - margin - 20) {
        doc.addPage();
        yPosition = margin;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(44, 24, 16);
      doc.text(section.title, margin, yPosition);
      yPosition += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);

      if (section.type === 'image' && mergedOptions.includeScreenshots) {
        try {
          if (section.content && section.content.startsWith('data:image/')) {
            const imgWidth = pageWidth - margin * 2;
            const imgHeight = (imgWidth * 3) / 4;

            if (yPosition + imgHeight > pageHeight - margin) {
              doc.addPage();
              yPosition = margin;
            }

            doc.addImage(
              section.content,
              'PNG',
              margin,
              yPosition,
              imgWidth,
              imgHeight
            );
            yPosition += imgHeight + 5;
          }
        } catch (imgError) {
          doc.setTextColor(200, 0, 0);
          doc.text('[截图嵌入失败，请参考原始记录]', margin, yPosition);
          yPosition += 8;
          doc.setTextColor(0, 0, 0);
        }
      } else if (section.type === 'image') {
        doc.setTextColor(150, 150, 150);
        doc.text('[截图已排除]', margin, yPosition);
        yPosition += 8;
        doc.setTextColor(0, 0, 0);
      } else {
        const lines = doc.splitTextToSize(
          section.content,
          pageWidth - margin * 2
        );

        for (const line of lines) {
          if (yPosition > pageHeight - margin - 10) {
            doc.addPage();
            yPosition = margin;
          }

          let textLine = line;
          if (line.includes('[严重]') || line.includes('[危险]')) {
            doc.setTextColor(196, 30, 58);
          } else if (line.includes('[警告]')) {
            doc.setTextColor(245, 158, 11);
          } else if (line.includes('[提示]')) {
            doc.setTextColor(59, 130, 246);
          }

          doc.text(textLine, margin, yPosition);
          doc.setTextColor(0, 0, 0);
          yPosition += 6;
        }
      }

      yPosition += 5;
    }

    if (report.hasErrors) {
      doc.setPage(doc.getNumberOfPages());
      const lastY = doc.internal.pageSize.getHeight() - 30;

      doc.setFillColor(196, 30, 58);
      doc.rect(margin, lastY, pageWidth - margin * 2, 15, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(
        '⚠ 注意：本报告包含严重问题记录，请务必参照调校建议修正参数',
        pageWidth / 2,
        lastY + 10,
        { align: 'center' }
      );
    }

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);

    return {
      success: true,
      blob,
      url,
    };
  } catch (error) {
    console.error('PDF export failed:', error);
    const fallbackHtml = generateFallbackHtml(report, records, mergedOptions);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'PDF导出失败',
      fallbackHtml,
    };
  }
};

export const exportToHTML = (
  report: GeneratedReport,
  records: CalibrationRecord[],
  options: ExportOptions = {}
): string => {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const css = `
    <style>
      body {
        font-family: 'Georgia', serif;
        max-width: 800px;
        margin: 0 auto;
        padding: 40px 20px;
        background: #f5f0e6;
        color: #2C1810;
      }
      h1 {
        text-align: center;
        color: #2C1810;
        border-bottom: 3px solid #D4AF37;
        padding-bottom: 15px;
        margin-bottom: 30px;
      }
      h2 {
        color: #D4AF37;
        margin-top: 30px;
        border-left: 4px solid #D4AF37;
        padding-left: 15px;
      }
      .subtitle {
        text-align: center;
        color: #666;
        margin-bottom: 10px;
      }
      .timestamp {
        text-align: center;
        color: #999;
        font-size: 14px;
        margin-bottom: 30px;
      }
      .section {
        background: white;
        padding: 20px;
        margin-bottom: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      .error-high {
        background: #ffebee;
        border-left: 4px solid #C41E3A;
        padding: 10px;
        margin: 10px 0;
        color: #C41E3A;
      }
      .error-medium {
        background: #fff8e1;
        border-left: 4px solid #F59E0B;
        padding: 10px;
        margin: 10px 0;
        color: #92400e;
      }
      img {
        max-width: 100%;
        height: auto;
        border: 2px solid #D4AF37;
        border-radius: 4px;
        margin: 10px 0;
      }
      .disclaimer {
        background: #f5f5f5;
        padding: 15px;
        border-radius: 4px;
        font-size: 12px;
        color: #666;
        margin-top: 30px;
      }
      .warning-banner {
        background: #C41E3A;
        color: white;
        padding: 15px;
        text-align: center;
        font-weight: bold;
        margin-top: 20px;
        border-radius: 4px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 15px 0;
      }
      td, th {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
      }
      th {
        background: #D4AF37;
        color: white;
      }
    </style>
  `;

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${report.title}</title>${css}</head><body>`;
  html += `<h1>${report.title}</h1>`;
  html += `<p class="subtitle">${report.subtitle}</p>`;
  html += `<p class="timestamp">生成时间: ${formatDate(report.generatedAt)}</p>`;

  for (const section of report.sections) {
    if (section.type === 'image' && !mergedOptions.includeScreenshots) continue;

    html += `<div class="section">`;
    html += `<h2>${section.title}</h2>`;

    if (section.type === 'image' && section.content) {
      html += `<img src="${section.content}" alt="校准截图"/>`;
    } else {
      let content = section.content;
      content = content.replace(
        /\[严重\](.*?)(?=\n|$)/g,
        '<div class="error-high">[严重]$1</div>'
      );
      content = content.replace(
        /\[危险\](.*?)(?=\n|$)/g,
        '<div class="error-high">[危险]$1</div>'
      );
      content = content.replace(
        /\[警告\](.*?)(?=\n|$)/g,
        '<div class="error-medium">[警告]$1</div>'
      );
      content = content.replace(/\n/g, '<br/>');
      html += `<p>${content}</p>`;
    }

    html += `</div>`;
  }

  if (report.hasErrors) {
    html += `<div class="warning-banner">⚠ 注意：本报告包含严重问题记录，请务必参照调校建议修正参数</div>`;
  }

  html += `</body></html>`;

  return html;
};

const generateFallbackHtml = (
  report: GeneratedReport,
  records: CalibrationRecord[],
  options: ExportOptions
): string => {
  return exportToHTML(report, records, options);
};

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadHTML = (html: string, filename: string): void => {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, filename);
};

export const downloadJSON = (data: unknown, filename: string): void => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, filename);
};

export const getErrorRecords = (
  records: CalibrationRecord[]
): CalibrationRecord[] => {
  return records.filter(
    (r) => r.errors.length > 0 || r.antiSkatingDirection === 'reverse'
  );
};

export const getSummaryStats = (records: CalibrationRecord[]) => {
  if (records.length === 0) return null;

  const pressures = records.map((r) => r.stylusPressure);
  const wears = records.map((r) => r.wearLevel);
  const torques = records.map((r) => r.torque);
  const errors = records.flatMap((r) => r.errors);

  return {
    count: records.length,
    avgPressure: pressures.reduce((a, b) => a + b, 0) / pressures.length,
    minPressure: Math.min(...pressures),
    maxPressure: Math.max(...pressures),
    avgWear: wears.reduce((a, b) => a + b, 0) / wears.length,
    maxWear: Math.max(...wears),
    avgTorque: torques.reduce((a, b) => a + b, 0) / torques.length,
    totalErrors: errors.length,
    highErrors: errors.filter((e: CalibrationError) => e.severity === 'high')
      .length,
    hasDirectionError: records.some(
      (r) => r.antiSkatingDirection === 'reverse'
    ),
  };
};
