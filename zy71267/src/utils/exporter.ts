import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { AcousticDataset, DisplayParameter } from '../data/models/acoustic';
import type { Anomaly } from '../data/models/anomalies';
import { DISPLAY_PARAM_LABELS, DISPLAY_PARAM_UNITS } from '../data/models/acoustic';
import { ANOMALY_TYPE_LABELS, ANOMALY_SEVERITY_LABELS } from '../data/models/anomalies';

export async function captureScreenshot(elementId: string, filename: string): Promise<string> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Element not found');

  const canvas = await html2canvas(element, {
    backgroundColor: '#0a0e1a',
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const dataUrl = canvas.toDataURL('image/png');
  
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = dataUrl;
  link.click();

  return dataUrl;
}

export async function exportReport(
  dataset: AcousticDataset,
  anomalies: Anomaly[],
  displayParam: DisplayParameter,
  screenshotDataUrl?: string
): Promise<void> {
  const pdf = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPos = 20;

  pdf.setFillColor(10, 14, 26);
  pdf.rect(0, 0, pageWidth, 35, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('音乐厅混响声场分析报告', pageWidth / 2, yPos, { align: 'center' });

  yPos += 8;
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(dataset.reportSummary.projectName, pageWidth / 2, yPos, { align: 'center' });

  yPos += 8;
  pdf.text(`生成日期: ${dataset.reportSummary.date}`, pageWidth / 2, yPos, { align: 'center' });

  yPos += 20;

  pdf.setTextColor(30, 136, 229);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('一、项目概览', 20, yPos);

  yPos += 8;
  pdf.setTextColor(60, 60, 60);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  const hallInfo = [
    ['厅堂名称', dataset.hall.name],
    ['厅堂尺寸', `${dataset.hall.dimensions.width}m × ${dataset.hall.dimensions.height}m × ${dataset.hall.dimensions.depth}m`],
    ['座位总数', `${dataset.seats.length} 座`],
    ['声源数量', `${dataset.soundSources.length} 个`],
    ['反射路径', `${dataset.rayPaths.length} 条`],
  ];

  hallInfo.forEach(([label, value]) => {
    pdf.text(label, 25, yPos);
    pdf.text(String(value), 80, yPos);
    yPos += 6;
  });

  yPos += 10;
  pdf.setTextColor(30, 136, 229);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('二、声学参数统计', 20, yPos);

  yPos += 8;
  pdf.setTextColor(60, 60, 60);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  const stats = [
    ['平均混响时间 (RT60)', `${dataset.reportSummary.avgRT60.toFixed(2)} s`],
    ['平均声压级 (SPL)', `${dataset.reportSummary.avgSPL.toFixed(1)} dB`],
    ['平均清晰度 (C80)', `${dataset.reportSummary.avgClarity.toFixed(1)} dB`],
    ['当前显示参数', DISPLAY_PARAM_LABELS[displayParam]],
  ];

  stats.forEach(([label, value]) => {
    pdf.text(label, 25, yPos);
    pdf.text(String(value), 80, yPos);
    yPos += 6;
  });

  yPos += 10;
  pdf.setTextColor(30, 136, 229);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('三、数据异常检测', 20, yPos);

  yPos += 8;
  pdf.setTextColor(60, 60, 60);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  if (anomalies.length === 0) {
    pdf.setTextColor(76, 175, 80);
    pdf.text('✓ 未检测到数据异常，所有输入数据完整有效', 25, yPos);
    yPos += 8;
  } else {
    anomalies.forEach((anomaly, index) => {
      if (yPos > pageHeight - 30) {
        pdf.addPage();
        yPos = 20;
      }

      const severityColor = anomaly.severity === 'high' 
        ? [244, 67, 54] 
        : anomaly.severity === 'medium' 
          ? [255, 152, 0] 
          : [76, 175, 80];

      pdf.setTextColor(severityColor[0], severityColor[1], severityColor[2]);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${index + 1}. ${anomaly.title} (严重程度: ${ANOMALY_SEVERITY_LABELS[anomaly.severity]})`, 25, yPos);
      
      yPos += 5;
      pdf.setTextColor(60, 60, 60);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`   类型: ${ANOMALY_TYPE_LABELS[anomaly.type]}`, 25, yPos);
      
      yPos += 5;
      pdf.text(`   描述: ${anomaly.description}`, 25, yPos);
      
      yPos += 5;
      pdf.text(`   建议: ${anomaly.suggestion}`, 25, yPos);
      
      yPos += 8;
    });
  }

  yPos += 5;
  pdf.setTextColor(30, 136, 229);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('四、优化建议', 20, yPos);

  yPos += 8;
  pdf.setTextColor(60, 60, 60);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  dataset.reportSummary.recommendations.forEach((rec, index) => {
    if (yPos > pageHeight - 30) {
      pdf.addPage();
      yPos = 20;
    }
    pdf.text(`${index + 1}. ${rec}`, 25, yPos);
    yPos += 6;
  });

  if (screenshotDataUrl && yPos < pageHeight - 80) {
    yPos += 10;
    pdf.setTextColor(30, 136, 229);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('五、场景截图', 20, yPos);
    yPos += 8;
    
    try {
      const imgWidth = 170;
      const imgHeight = 100;
      pdf.addImage(
        screenshotDataUrl,
        'PNG',
        (pageWidth - imgWidth) / 2,
        yPos,
        imgWidth,
        imgHeight
      );
    } catch (e) {
      pdf.text('(截图嵌入失败)', 25, yPos);
    }
  }

  pdf.setFillColor(10, 14, 26);
  pdf.rect(0, pageHeight - 15, pageWidth, 15, 'F');
  pdf.setTextColor(150, 150, 150);
  pdf.setFontSize(8);
  pdf.text('音乐厅混响声场可视化系统 | 声学顾问专用工具', pageWidth / 2, pageHeight - 8, { align: 'center' });

  pdf.save(`${dataset.reportSummary.projectName}_声学分析报告.pdf`);
}

export function exportCSV(dataset: AcousticDataset, filename: string): void {
  const headers = ['座位ID', '排号', '座号', '区域', '混响时间(s)', '声压级(dB)', '清晰度(dB)', '定义度(%)'];
  
  const readingMap = new Map(dataset.acousticReadings.map((r) => [r.seatId, r]));
  
  const rows = dataset.seats.map((seat) => {
    const reading = readingMap.get(seat.id);
    return [
      seat.id,
      seat.row,
      seat.number,
      seat.area,
      reading?.reverberationTime.toFixed(3) || 'N/A',
      reading?.soundPressureLevel.toFixed(1) || 'N/A',
      reading?.clarity.toFixed(2) || 'N/A',
      reading?.definition.toFixed(1) || 'N/A',
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.download = `${filename}.csv`;
  link.href = url;
  link.click();
  
  URL.revokeObjectURL(url);
}

export function exportJSON(dataset: AcousticDataset, filename: string): void {
  const json = JSON.stringify(dataset, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.download = `${filename}.json`;
  link.href = url;
  link.click();
  
  URL.revokeObjectURL(url);
}
