import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { ReportData, Boundary } from '@/types';
import { getMaterialById } from '@/data/materials';
import { formatVolume, formatWeight } from './volume';

export async function captureScreenshot(elementId: string): Promise<string> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn('Element not found for screenshot:', elementId);
    return '';
  }

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#1D2129',
      scale: 2,
      useCORS: true,
      allowTaint: true,
    });
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Failed to capture screenshot:', error);
    return '';
  }
}

export function generateReportData(
  batchName: string,
  batchId: string,
  boundaries: Boundary[],
  screenshot?: string
): ReportData {
  let totalVolume = 0;
  let totalWeight = 0;

  const boundaryReports = boundaries.map(b => {
    const material = getMaterialById(b.materialId);
    const weight = (b.volume || 0) * (material?.density || 1);
    totalVolume += b.volume || 0;
    totalWeight += weight;

    return {
      name: b.name,
      volume: b.volume || 0,
      weight,
      material: material?.name || '未知',
      baseHeight: b.baseHeight,
    };
  });

  return {
    id: 'report-' + Date.now(),
    batchId,
    batchName,
    generatedAt: new Date(),
    totalVolume,
    totalWeight,
    boundaries: boundaryReports,
    screenshot,
  };
}

export async function exportToPDF(report: ReportData): Promise<void> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('料场堆体体积盘点报告', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`生成时间: ${report.generatedAt.toLocaleString('zh-CN')}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;
  doc.text(`盘点批次: ${report.batchName}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  if (report.screenshot) {
    try {
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = 80;
      doc.addImage(report.screenshot, 'PNG', margin, yPos, imgWidth, imgHeight);
      yPos += imgHeight + 10;
    } catch {
      console.warn('Failed to add screenshot to PDF');
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('汇总统计', margin, yPos);
  yPos += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`总体积: ${formatVolume(report.totalVolume)}`, margin, yPos);
  doc.text(`总重量: ${formatWeight(report.totalWeight)}`, margin + 80, yPos);
  yPos += 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('料堆明细', margin, yPos);
  yPos += 10;

  const tableY = yPos;
  const colWidths = [40, 30, 30, 35, 25];
  const colX = [margin, margin + colWidths[0], margin + colWidths[0] + colWidths[1], margin + colWidths[0] + colWidths[1] + colWidths[2], margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('料堆名称', colX[0], tableY);
  doc.text('物料类型', colX[1], tableY);
  doc.text('体积(m³)', colX[2], tableY);
  doc.text('重量(吨)', colX[3], tableY);
  doc.text('基准高(m)', colX[4], tableY);

  doc.setLineWidth(0.5);
  doc.line(margin, tableY + 3, pageWidth - margin, tableY + 3);
  yPos = tableY + 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  report.boundaries.forEach((b) => {
    if (yPos > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }

    doc.text(b.name, colX[0], yPos);
    doc.text(b.material, colX[1], yPos);
    doc.text(b.volume.toFixed(2), colX[2], yPos);
    doc.text(b.weight.toFixed(2), colX[3], yPos);
    doc.text(b.baseHeight.toFixed(1), colX[4], yPos);
    yPos += 7;
  });

  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('合计', colX[0], yPos);
  doc.text(report.totalVolume.toFixed(2), colX[2], yPos);
  doc.text(report.totalWeight.toFixed(2), colX[3], yPos);

  const fileName = `盘点报告_${report.batchName}_${report.generatedAt.toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

export function exportToJSON(report: ReportData): void {
  const jsonStr = JSON.stringify(report, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `盘点报告_${report.batchName}_${report.generatedAt.toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportBoundaryToGeoJSON(boundary: Boundary): void {
  const geojson = {
    type: 'Feature',
    properties: {
      name: boundary.name,
      materialId: boundary.materialId,
      baseHeight: boundary.baseHeight,
      volume: boundary.volume,
      weight: boundary.weight,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        boundary.vertices.map(v => [v.x, v.z]),
      ],
    },
  };

  const jsonStr = JSON.stringify(geojson, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${boundary.name}.geojson`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToImage(dataUrl: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${fileName}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
