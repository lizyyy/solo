import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { ReportSnapshot, BlindSpot, Vector3Tuple, Filters } from '@/types';

export async function captureScreenshot(selector: string = '#canvas-container'): Promise<string> {
  const element = document.querySelector(selector) as HTMLElement;
  if (!element) {
    return '';
  }
  
  const canvas = await html2canvas(element, {
    backgroundColor: '#0a0a1a',
    scale: 2,
    useCORS: true,
    logging: false,
  });
  
  return canvas.toDataURL('image/png');
}

export function generateReportSnapshot(
  cameraPosition: Vector3Tuple,
  cameraRotation: Vector3Tuple,
  filters: Filters,
  timelinePosition: number,
  blindSpots: BlindSpot[],
  visibleElements: string[],
  sceneName: string,
  screenshot?: string
): ReportSnapshot {
  const activeFilters = Object.entries(filters)
    .filter(([_, value]) => value)
    .map(([key]) => key);

  return {
    timestamp: new Date().toISOString(),
    cameraPosition,
    cameraRotation,
    activeFilters,
    timelinePosition,
    blindSpots,
    visibleElements,
    sceneName,
    screenshot,
  };
}

export async function exportPDFReport(
  snapshot: ReportSnapshot,
  filename: string = '导视盲区分析报告.pdf'
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  doc.setFillColor(10, 10, 26);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(0, 188, 212);
  doc.text('导视盲区分析报告', margin, margin + 10);

  doc.setFontSize(12);
  doc.setTextColor(150, 150, 150);
  doc.text(`生成时间: ${new Date(snapshot.timestamp).toLocaleString('zh-CN')}`, margin, margin + 20);
  doc.text(`场景: ${snapshot.sceneName}`, margin, margin + 28);

  if (snapshot.screenshot) {
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (imgWidth * 9) / 16;
    
    doc.addImage(
      snapshot.screenshot,
      'PNG',
      margin,
      margin + 40,
      imgWidth,
      imgHeight
    );

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `相机位置: (${snapshot.cameraPosition.map(v => v.toFixed(1)).join(', ')})`,
      margin,
      margin + 45 + imgHeight
    );
    doc.text(
      `时间轴位置: ${snapshot.timelinePosition.toFixed(1)}s | 激活筛选: ${snapshot.activeFilters.join(', ')}`,
      margin,
      margin + 52 + imgHeight
    );
  }

  if (snapshot.blindSpots.length > 0) {
    const startY = margin + 70 + (snapshot.screenshot ? 144 : 0);
    
    doc.setFontSize(16);
    doc.setTextColor(255, 152, 0);
    doc.text('发现的导视盲区', margin, startY);

    const severityLabels: Record<string, string> = {
      high: '高',
      medium: '中',
      low: '低',
    };

    const typeLabels: Record<string, string> = {
      occlusion: '遮挡盲区',
      missing_sign: '缺少导视',
      temporary_barrier: '临时围挡',
    };

    let yPos = startY + 10;
    snapshot.blindSpots.forEach((spot, index) => {
      if (yPos > pageHeight - margin) {
        doc.addPage();
        doc.setFillColor(10, 10, 26);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        yPos = margin + 10;
      }

      const severityColor = spot.severity === 'high' ? [244, 67, 54] :
                            spot.severity === 'medium' ? [255, 152, 0] : [76, 175, 80];
      
      doc.setFillColor(severityColor[0], severityColor[1], severityColor[2]);
      doc.roundedRect(margin, yPos, 5, 5, 1, 1, 'F');

      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(`${index + 1}. ${typeLabels[spot.type]}`, margin + 8, yPos + 4);
      
      doc.setFontSize(9);
      doc.setTextColor(200, 200, 200);
      doc.text(`严重程度: ${severityLabels[spot.severity]}`, margin + 8, yPos + 10);
      
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      const description = doc.splitTextToSize(spot.description, pageWidth - margin * 2 - 10);
      doc.text(description, margin + 8, yPos + 16);

      yPos += 12 + description.length * 4;
    });
  }

  doc.save(filename);
}

export function exportJSONReport(
  snapshot: ReportSnapshot,
  filename: string = '导视盲区分析数据.json'
): void {
  const dataStr = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
