import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { AnalysisRecord, BatchInfo } from '../types';
import { getQualityName, getStatusName } from './anomalyDetector';

export function generateBatchFileName(batchId: string): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  return `光伏阴影分析报告_批次${batchId}_${dateStr}_${timeStr}.pdf`;
}

export async function generateReport(
  batchInfo: BatchInfo,
  records: AnalysisRecord[],
  elementId?: string
): Promise<void> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = margin;

  addHeader(doc, batchInfo, pageWidth, margin);
  yPos += 25;

  addOverview(doc, records, pageWidth, margin, yPos);
  yPos += 35;

  if (elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      try {
        const canvas = await html2canvas(element, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (yPos + imgHeight > 280) {
          doc.addPage();
          yPos = margin;
        }

        doc.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 10;
      } catch (e) {
        console.error('Failed to capture element:', e);
      }
    }
  }

  if (yPos > 200) {
    doc.addPage();
    yPos = margin;
  }

  addRecordsTable(doc, records, pageWidth, margin, yPos);
  yPos += 40;

  const anomalies = records.filter((r) => r.quality !== 'normal');
  if (anomalies.length > 0) {
    doc.addPage();
    addAnomalyList(doc, anomalies, pageWidth, margin);
  }

  addFooter(doc, batchInfo, pageWidth);

  const fileName = generateBatchFileName(batchInfo.id);
  doc.save(fileName);
}

function addHeader(
  doc: jsPDF,
  batchInfo: BatchInfo,
  pageWidth: number,
  margin: number
): void {
  doc.setFontSize(20);
  doc.setTextColor(22, 93, 255);
  doc.text('光伏阴影损失估算报告', margin, margin + 8);

  doc.setFontSize(10);
  doc.setTextColor(134, 144, 156);
  doc.text(`批次号: ${batchInfo.id}`, margin, margin + 14);
  doc.text(`批次名称: ${batchInfo.name}`, margin, margin + 20);
  doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, margin, margin + 26);

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(40);
  doc.text('光伏分析', pageWidth - margin - 30, margin + 15, { align: 'right' });

  doc.setDrawColor(22, 93, 255);
  doc.setLineWidth(0.5);
  doc.line(margin, margin + 30, pageWidth - margin, margin + 30);
}

function addOverview(
  doc: jsPDF,
  records: AnalysisRecord[],
  pageWidth: number,
  margin: number,
  yPos: number
): void {
  const totalPower = records.reduce((sum, r) => sum + r.totalPower, 0);
  const totalLoss = records.reduce((sum, r) => sum + r.totalLoss, 0);
  const lossRate = totalPower + totalLoss > 0 
    ? (totalLoss / (totalPower + totalLoss) * 100).toFixed(1) 
    : '0';
  const anomalyCount = records.filter((r) => r.quality !== 'normal').length;

  doc.setFontSize(14);
  doc.setTextColor(29, 33, 41);
  doc.text('数据概览', margin, yPos);

  const colWidth = (pageWidth - margin * 2) / 4;

  doc.setFillColor(232, 243, 255);
  doc.roundedRect(margin, yPos + 5, colWidth - 3, 20, 2, 2, 'F');
  doc.setTextColor(22, 93, 255);
  doc.setFontSize(16);
  doc.text(`${totalPower.toFixed(1)} W`, margin + colWidth / 2, yPos + 17, {
    align: 'center',
  });
  doc.setFontSize(9);
  doc.setTextColor(78, 89, 105);
  doc.text('总功率', margin + colWidth / 2, yPos + 23, { align: 'center' });

  doc.setFillColor(232, 255, 234);
  doc.roundedRect(margin + colWidth, yPos + 5, colWidth - 3, 20, 2, 2, 'F');
  doc.setTextColor(0, 180, 42);
  doc.setFontSize(16);
  doc.text(`${totalLoss.toFixed(1)} W`, margin + colWidth * 1.5, yPos + 17, {
    align: 'center',
  });
  doc.setFontSize(9);
  doc.setTextColor(78, 89, 105);
  doc.text('总损失', margin + colWidth * 1.5, yPos + 23, { align: 'center' });

  doc.setFillColor(255, 247, 232);
  doc.roundedRect(margin + colWidth * 2, yPos + 5, colWidth - 3, 20, 2, 2, 'F');
  doc.setTextColor(255, 125, 0);
  doc.setFontSize(16);
  doc.text(
    `${lossRate}%`,
    margin + colWidth * 2.5,
    yPos + 17,
    { align: 'center' }
  );
  doc.setFontSize(9);
  doc.setTextColor(78, 89, 105);
  doc.text('损失率', margin + colWidth * 2.5, yPos + 23, { align: 'center' });

  doc.setFillColor(255, 236, 232);
  doc.roundedRect(margin + colWidth * 3, yPos + 5, colWidth - 3, 20, 2, 2, 'F');
  doc.setTextColor(245, 63, 63);
  doc.setFontSize(16);
  doc.text(`${anomalyCount}`, margin + colWidth * 3.5, yPos + 17, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(78, 89, 105);
  doc.text('异常数', margin + colWidth * 3.5, yPos + 23, { align: 'center' });

  doc.setTextColor(29, 33, 41);
}

function addRecordsTable(
  doc: jsPDF,
  records: AnalysisRecord[],
  pageWidth: number,
  margin: number,
  yPos: number
): void {
  doc.setFontSize(12);
  doc.setTextColor(29, 33, 41);
  doc.text('数据明细', margin, yPos);

  const headers = ['时间', '状态', '质量', '功率(W)', '损失(W)', '备注'];
  const colWidths = [35, 25, 25, 25, 25, 40];
  let xPos = margin;

  doc.setFillColor(247, 248, 250);
  doc.setFontSize(9);
  headers.forEach((header, i) => {
    doc.text(header, xPos + 2, yPos + 10);
    xPos += colWidths[i];
  });

  doc.setDrawColor(229, 230, 235);
  doc.line(margin, yPos + 13, pageWidth - margin, yPos + 13);

  let tableY = yPos + 18;
  records.slice(0, 15).forEach((record, index) => {
    xPos = margin;
    const time = new Date(record.timestamp);
    const timeStr = time.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (index % 2 === 0) {
      doc.setFillColor(250, 251, 252);
      doc.rect(margin, tableY - 5, pageWidth - margin * 2, 8, 'F');
    }

    doc.setTextColor(78, 89, 105);
    doc.text(timeStr, xPos + 2, tableY);
    xPos += colWidths[0];

    const statusColor = getStatusColorRGB(record.status);
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.text(getStatusName(record.status), xPos + 2, tableY);
    xPos += colWidths[1];

    const qualityColor = getQualityColorRGB(record.quality);
    doc.setTextColor(qualityColor[0], qualityColor[1], qualityColor[2]);
    doc.text(getQualityName(record.quality), xPos + 2, tableY);
    xPos += colWidths[2];

    doc.setTextColor(29, 33, 41);
    doc.text(record.totalPower.toFixed(1), xPos + 2, tableY);
    xPos += colWidths[3];

    doc.setTextColor(245, 63, 63);
    doc.text(record.totalLoss.toFixed(1), xPos + 2, tableY);
    xPos += colWidths[4];

    doc.setTextColor(134, 144, 156);
    doc.text(record.remarks || '-', xPos + 2, tableY);

    tableY += 8;
  });
}

function addAnomalyList(
  doc: jsPDF,
  anomalies: AnalysisRecord[],
  pageWidth: number,
  margin: number
): void {
  let yPos = margin;

  doc.setFontSize(14);
  doc.setTextColor(245, 63, 63);
  doc.text('异常清单', margin, yPos);
  yPos += 8;

  doc.setFontSize(9);
  anomalies.forEach((record) => {
    if (yPos > 260) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFillColor(255, 236, 232);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 20, 2, 2, 'F');

    doc.setTextColor(245, 63, 63);
    doc.text(
      `记录 ${record.id} - ${new Date(record.timestamp).toLocaleString('zh-CN')}`,
      margin + 5,
      yPos + 7
    );

    doc.setTextColor(134, 144, 156);
    doc.text(`异常标记: ${record.anomalyFlags.join(', ')}`, margin + 5, yPos + 14);

    yPos += 25;
  });
}

function addFooter(doc: jsPDF, batchInfo: BatchInfo, pageWidth: number): void {
  const pageCount = doc.internal.pages.length;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(134, 144, 156);
    doc.text(
      `第 ${i} 页 / 共 ${pageCount} 页`,
      pageWidth / 2,
      285,
      { align: 'center' }
    );
    doc.text('光伏阴影损失估算系统', 15, 285);
  }
}

function getStatusColorRGB(status: string): [number, number, number] {
  const colors: Record<string, [number, number, number]> = {
    normal: [0, 180, 42],
    supplement: [22, 93, 255],
    withdrawn: [134, 144, 156],
    duplicate: [255, 125, 0],
  };
  return colors[status] || [78, 89, 105];
}

function getQualityColorRGB(quality: string): [number, number, number] {
  const colors: Record<string, [number, number, number]> = {
    normal: [0, 180, 42],
    pending: [255, 125, 0],
    anomaly: [245, 63, 63],
  };
  return colors[quality] || [78, 89, 105];
}
