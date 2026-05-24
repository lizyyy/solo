
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { AppState } from '../types';
import { sampleNames } from '../data/samples';

export interface ReportData {
  sampleName: string;
  blockCount: number;
  pierCount: number;
  errorCount: number;
  warningCount: number;
  timelineProgress: number;
  collisions: AppState['collisions'];
  blocks: AppState['sceneData']['blocks'];
}

export async function generateReport(
  sceneRef: HTMLDivElement | null,
  reportData: ReportData
): Promise<void> {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  
  doc.setFontSize(20);
  doc.setTextColor(22, 93, 255);
  doc.text('船厂分段吊装预排报告', 140, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, 140, 30, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(`样例名称: ${sampleNames[reportData.sampleName as keyof typeof sampleNames] || reportData.sampleName}`, 20, 45);
  doc.text(`吊装进度: ${(reportData.timelineProgress * 100).toFixed(1)}%`, 20, 55);
  
  doc.setFillColor(240, 245, 255);
  doc.roundedRect(20, 65, 100, 35, 3, 3, 'F');
  
  doc.setFontSize(12);
  doc.setTextColor(50);
  doc.text('统计信息', 25, 75);
  doc.setFontSize(10);
  doc.text(`分段数量: ${reportData.blockCount}`, 25, 85);
  doc.text(`支墩数量: ${reportData.pierCount}`, 25, 93);
  doc.text(`错误数量: ${reportData.errorCount}`, 75, 85);
  doc.text(`警告数量: ${reportData.warningCount}`, 75, 93);
  
  const statusColor = reportData.errorCount > 0 ? [245, 63, 63] as [number, number, number] : reportData.warningCount > 0 ? [255, 125, 0] as [number, number, number] : [0, 180, 42] as [number, number, number];
  doc.setFillColor(...statusColor);
  doc.roundedRect(130, 65, 60, 35, 3, 3, 'F');
  doc.setTextColor(255);
  doc.setFontSize(14);
  doc.text(
    reportData.errorCount > 0 ? '存在冲突' : reportData.warningCount > 0 ? '需注意' : '方案安全',
    160,
    85,
    { align: 'center' }
  );
  
  if (sceneRef) {
    try {
      const canvas = await html2canvas(sceneRef, {
        scale: 1,
        useCORS: true,
        backgroundColor: '#1a1a2e',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 160;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      doc.addImage(imgData, 'PNG', 20, 110, imgWidth, Math.min(imgHeight, 90));
    } catch (e) {
      console.error('截图失败:', e);
    }
  }
  
  doc.setFontSize(12);
  doc.setTextColor(50);
  doc.text('冲突检测详情', 20, 210);
  
  if (reportData.collisions.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(0, 180, 42);
    doc.text('✓ 未检测到任何冲突，吊装方案安全', 20, 220);
  } else {
    let yPos = 220;
    reportData.collisions.slice(0, 5).forEach((collision, index) => {
      doc.setFontSize(9);
      const isError = collision.severity === 'error';
      doc.setTextColor(isError ? 245 : 255, isError ? 63 : 125, isError ? 63 : 0);
      doc.text(`${isError ? '✕' : '⚠'} ${collision.message}`, 20, yPos + index * 8);
    });
    
    if (reportData.collisions.length > 5) {
      doc.setTextColor(100);
      doc.text(`... 还有 ${reportData.collisions.length - 5} 项冲突`, 20, yPos + 5 * 8);
    }
  }
  
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('本报告由船厂分段吊装预排系统自动生成', 140, 285, { align: 'center' });
  
  doc.save(`吊装预排报告_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function getReportData(state: AppState): ReportData {
  return {
    sampleName: state.currentSample,
    blockCount: state.sceneData.blocks.length,
    pierCount: state.sceneData.piers.length,
    errorCount: state.collisions.filter((c) => c.severity === 'error').length,
    warningCount: state.collisions.filter((c) => c.severity === 'warning').length,
    timelineProgress: state.timelineProgress,
    collisions: state.collisions,
    blocks: state.sceneData.blocks,
  };
}

