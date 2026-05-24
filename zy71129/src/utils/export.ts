
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { CollisionPoint, ModelElement } from '../types/model';

export interface ReportData {
  projectName: string;
  date: string;
  collisions: CollisionPoint[];
  elements: ModelElement[];
  statistics: {
    total: number;
    hard: number;
    soft: number;
    resolved: number;
    critical: number;
    major: number;
    minor: number;
  };
};

export async function exportToPDF(reportData: ReportData): Promise<void> {
  const doc = new jsPDF('l', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  doc.setFontSize(20);
  doc.setTextColor(22, 93, 255);
  doc.text('线缆桥架碰撞检查报告', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`项目: ${reportData.projectName}`, 20, 35);
  doc.text(`日期: ${reportData.date}`, 20, 42);
  doc.text(`导出时间: ${new Date().toLocaleString('zh-CN')}`, 20, 49);
  
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('统计摘要', 20, 65);
  
  const stats = reportData.statistics;
  const statY = 75;
  const statLabels = ['总碰撞数', '硬碰撞', '软碰撞', '严重', '主要', '次要', '已解决'];
  const statValues = [stats.total, stats.hard, stats.soft, stats.critical, stats.major, stats.minor, stats.resolved];
  
  statLabels.forEach((label, i) => {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(label, 20 + i * 35, statY);
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(String(statValues[i]), 20 + i * 35, statY + 8);
  });
  
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('碰撞详情', 20, 100);
  
  let yPos = 110;
  const collisionsPerPage = 8;
  let collisionCount = 0;
  
  reportData.collisions.forEach((collision, index) => {
    if (collisionCount >= collisionsPerPage) {
      doc.addPage();
      yPos = 20;
      collisionCount = 0;
    }
    
    const elementA = reportData.elements.find(e => e.id === collision.elementA);
    const elementB = reportData.elements.find(e => e.id === collision.elementB);
    
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`#${index + 1}`, 20, yPos);
    
    const typeColor = collision.type === 'hard' ? [255, 125, 0] : [255, 170, 0];
    doc.setTextColor(typeColor[0], typeColor[1], typeColor[2]);
    doc.text(collision.type === 'hard' ? '硬碰撞' : '软碰撞', 35, yPos);
    
    doc.setTextColor(0);
    doc.text(`构件A: ${elementA?.name || collision.elementA}`, 60, yPos);
    doc.text(`构件B: ${elementB?.name || collision.elementB}`, 130, yPos);
    
    const severityColors: Record<string, [number, number, number]> = {
      critical: [245, 63, 63],
      major: [255, 125, 0],
      minor: [255, 170, 0]
    };
    const sevColor = severityColors[collision.severity];
    doc.setTextColor(sevColor[0], sevColor[1], sevColor[2]);
    doc.text(
      collision.severity === 'critical' ? '严重' : collision.severity === 'major' ? '主要' : '次要',
      200,
      yPos
    );
    
    doc.setTextColor(100);
    doc.text(
      `位置: (${collision.position.x.toFixed(2)}, ${collision.position.y.toFixed(2)}, ${collision.position.z.toFixed(2)})`,
      20, yPos + 6
    );
    doc.text(
      `距离: ${collision.distance.toFixed(3)}m`,
      100, yPos + 6
    );
    doc.setTextColor(collision.resolved ? 0 : 150);
    doc.text(
      collision.resolved ? '已解决' : '待处理',
      150, yPos + 6
    );
    
    yPos += 18;
    collisionCount++;
  });
  
  doc.save(`碰撞检查报告_${new Date().toISOString().split('T')[0]}.pdf`);
}

export async function exportScreenshot(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      resolve();
    });
  });
}

export function exportCollisionList(collisions: CollisionPoint[], elements: ModelElement[]): string {
  let csv = '序号,碰撞类型,严重程度,构件A,构件B,位置X,位置Y,位置Z,距离(m),状态\n';
  
  collisions.forEach((c, i) => {
    const elA = elements.find(e => e.id === c.elementA);
    const elB = elements.find(e => e.id === c.elementB);
    csv += `${i + 1},${c.type === 'hard' ? '硬碰撞' : '软碰撞'},`;
    csv += `${c.severity === 'critical' ? '严重' : c.severity === 'major' ? '主要' : '次要'},`;
    csv += `${elA?.name || c.elementA},${elB?.name || c.elementB},`;
    csv += `${c.position.x.toFixed(2)},${c.position.y.toFixed(2)},${c.position.z.toFixed(2)},`;
    csv += `${c.distance.toFixed(3)},${c.resolved ? '已解决' : '待处理'}\n`;
  });
  
  return csv;
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
