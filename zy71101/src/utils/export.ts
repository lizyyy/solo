import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Mission, AppState, unitConversion } from '@/types';

export interface ReportData {
  mission: Mission;
  appState: Pick<AppState, 'currentTime' | 'cameraView' | 'filters' | 'alerts'>;
  cameraPosition: string;
  screenshot?: string;
}

export const generateReport = async (data: ReportData): Promise<void> => {
  const { mission, appState, cameraPosition, screenshot } = data;
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPos = 20;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text('无人机禁飞走廊规划报告', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  pdf.setDrawColor(0, 182, 212);
  pdf.setLineWidth(0.5);
  pdf.line(20, yPos, pageWidth - 20, yPos);
  yPos += 10;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('任务信息', 20, yPos);
  yPos += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.text(`任务名称: ${mission.name}`, 25, yPos);
  yPos += 6;
  pdf.text(`任务描述: ${mission.description}`, 25, yPos);
  yPos += 6;
  pdf.text(`创建时间: ${new Date(mission.createdAt).toLocaleString('zh-CN')}`, 25, yPos);
  yPos += 6;
  pdf.text(`航线数量: ${mission.flightPaths.length}`, 25, yPos);
  yPos += 6;
  pdf.text(`航点总数: ${mission.flightPaths.reduce((acc, fp) => acc + fp.waypoints.length, 0)}`, 25, yPos);
  yPos += 10;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('当前状态', 20, yPos);
  yPos += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.text(`回放时间: ${appState.currentTime.toFixed(1)}s`, 25, yPos);
  yPos += 6;
  pdf.text(`当前视角: ${cameraPosition}`, 25, yPos);
  yPos += 6;
  pdf.text(`视角模式: ${appState.cameraView === 'orbit' ? '环绕视角' : appState.cameraView === 'firstPerson' ? '第一人称' : '俯视视角'}`, 25, yPos);
  yPos += 10;

  const totalDistance = mission.batteryCurve[mission.batteryCurve.length - 1]?.distance || 0;
  const finalBattery = mission.batteryCurve[mission.batteryCurve.length - 1]?.percentage || 0;
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('任务统计', 20, yPos);
  yPos += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.text(`总飞行距离: ${totalDistance.toFixed(1)}m`, 25, yPos);
  yPos += 6;
  pdf.text(`剩余电量: ${finalBattery.toFixed(1)}%`, 25, yPos);
  yPos += 6;
  pdf.text(`告警数量: ${appState.alerts.length}`, 25, yPos);
  yPos += 10;

  if (appState.alerts.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(239, 68, 68);
    pdf.text('告警信息', 20, yPos);
    pdf.setTextColor(0, 0, 0);
    yPos += 8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    appState.alerts.slice(0, 5).forEach((alert, index) => {
      if (yPos > pageHeight - 30) {
        pdf.addPage();
        yPos = 20;
      }
      const severity = alert.severity === 'danger' ? '[严重]' : '[警告]';
      pdf.text(`${severity} ${alert.message}`, 25, yPos);
      yPos += 5;
    });
    yPos += 5;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('航点详情', 20, yPos);
  yPos += 8;

  const waypoints = mission.flightPaths[0]?.waypoints || [];
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  waypoints.slice(0, Math.min(waypoints.length, 6)).forEach((wp, index) => {
    if (yPos > pageHeight - 30) {
      pdf.addPage();
      yPos = 20;
    }
    const heightInMeters = unitConversion.toMeters(wp.position.y, wp.position.unit);
    pdf.text(
      `航点${index + 1}: (${wp.position.x.toFixed(1)}, ${heightInMeters.toFixed(1)}m, ${wp.position.z.toFixed(1)})`,
      25,
      yPos
    );
    yPos += 5;
  });

  if (screenshot) {
    if (yPos + 80 > pageHeight - 20) {
      pdf.addPage();
      yPos = 20;
    }
    yPos += 10;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('场景快照', 20, yPos);
    yPos += 8;
    
    try {
      const imgWidth = 170;
      const imgHeight = 100;
      pdf.addImage(screenshot, 'PNG', 20, yPos, imgWidth, imgHeight);
    } catch (e) {
      console.error('Failed to add screenshot to PDF:', e);
    }
  }

  pdf.save(`flight-plan-${mission.id}-${Date.now()}.pdf`);
};

export const captureScreenshot = async (elementId: string): Promise<string | null> => {
  const element = document.getElementById(elementId);
  if (!element) return null;

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#0F172A',
      scale: 1,
      useCORS: true
    });
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Failed to capture screenshot:', e);
    return null;
  }
};

export const exportMissionAsJSON = (mission: Mission): void => {
  const dataStr = JSON.stringify(mission, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mission-${mission.id}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
