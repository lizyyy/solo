import { jsPDF } from 'jspdf';
import { RouteReport, Route, FilterState, CameraState } from '../types';

export const generateRouteReport = async (
  route: Route,
  cameraState: CameraState,
  filters: FilterState,
  timelinePosition: number,
  screenshot?: string
): Promise<Blob> => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let currentY = margin;

  doc.setFontSize(20);
  doc.setTextColor(22, 93, 255);
  doc.text('校园无障碍路线报告', pageWidth / 2, currentY, { align: 'center' });
  currentY += 15;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, margin, currentY);
  currentY += 8;
  doc.text(`数据版本: v1.0.0`, margin, currentY);
  currentY += 10;

  doc.setDrawColor(200);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 10;

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('一、路线概览', margin, currentY);
  currentY += 10;

  doc.setFontSize(11);
  const startPoint = route.startPoint.replace('start-', '');
  const endPoint = route.endPoint.replace('end-', '');
  doc.text(`起点: ${startPoint}`, margin + 5, currentY);
  currentY += 7;
  doc.text(`终点: ${endPoint}`, margin + 5, currentY);
  currentY += 7;
  doc.text(`总距离: ${route.totalDistance.toFixed(1)} 米`, margin + 5, currentY);
  currentY += 7;
  doc.text(`预计时间: ${route.estimatedTime} 分钟`, margin + 5, currentY);
  currentY += 7;
  doc.text(`最大坡度: ${route.validation.maxSlope.toFixed(1)}%`, margin + 5, currentY);
  currentY += 7;
  doc.text(`途经电梯: ${route.validation.elevatorCount} 个`, margin + 5, currentY);
  currentY += 10;

  if (route.validation.errors.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(245, 63, 63);
    doc.text('⚠️ 路线存在以下问题:', margin, currentY);
    currentY += 8;
    doc.setFontSize(10);
    route.validation.errors.forEach((error, i) => {
      doc.text(`${i + 1}. ${error}`, margin + 5, currentY);
      currentY += 6;
    });
    currentY += 5;
  }

  if (route.validation.warnings.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(255, 125, 0);
    doc.text('⚠️ 注意事项:', margin, currentY);
    currentY += 8;
    doc.setFontSize(10);
    route.validation.warnings.forEach((warning, i) => {
      doc.text(`${i + 1}. ${warning}`, margin + 5, currentY);
      currentY += 6;
    });
    currentY += 5;
  }

  if (currentY > pageHeight - 80) {
    doc.addPage();
    currentY = margin;
  }

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('二、路线详情', margin, currentY);
  currentY += 10;

  doc.setFontSize(10);
  route.waypoints.forEach((wp, i) => {
    if (currentY > pageHeight - 30) {
      doc.addPage();
      currentY = margin;
    }
    const typeLabel = wp.type === 'ramp' ? '坡道' : wp.type === 'elevator' ? '电梯' : wp.type === 'entrance' ? '出入口' : '途经点';
    doc.text(
      `${i + 1}. [${typeLabel}] (${wp.position.x.toFixed(1)}, ${wp.position.z.toFixed(1)})`,
      margin + 5,
      currentY
    );
    currentY += 5;
  });
  currentY += 10;

  if (currentY > pageHeight - 60) {
    doc.addPage();
    currentY = margin;
  }

  doc.setFontSize(14);
  doc.text('三、筛选条件', margin, currentY);
  currentY += 10;

  doc.setFontSize(10);
  doc.text(`最大坡度限制: ${filters.maxSlope}%`, margin + 5, currentY);
  currentY += 6;
  doc.text(`避让施工区域: ${filters.avoidConstruction ? '是' : '否'}`, margin + 5, currentY);
  currentY += 6;
  doc.text(`优先使用电梯: ${filters.preferElevator ? '是' : '否'}`, margin + 5, currentY);
  currentY += 10;

  doc.setFontSize(14);
  doc.text('四、当前状态', margin, currentY);
  currentY += 10;

  doc.setFontSize(10);
  doc.text(`时间轴位置: ${(timelinePosition * 100).toFixed(0)}%`, margin + 5, currentY);
  currentY += 6;
  doc.text(
    `相机位置: (${cameraState.position.x.toFixed(1)}, ${cameraState.position.y.toFixed(1)}, ${cameraState.position.z.toFixed(1)})`,
    margin + 5,
    currentY
  );
  currentY += 6;
  doc.text(
    `观察目标: (${cameraState.target.x.toFixed(1)}, ${cameraState.target.y.toFixed(1)}, ${cameraState.target.z.toFixed(1)})`,
    margin + 5,
    currentY
  );

  if (screenshot && currentY < pageHeight - 70) {
    currentY += 10;
    doc.setFontSize(14);
    doc.text('五、场景截图', margin, currentY);
    currentY += 10;
    
    try {
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = 60;
      doc.addImage(screenshot, 'JPEG', margin, currentY, imgWidth, imgHeight);
    } catch (e) {
      console.error('Failed to add screenshot to PDF:', e);
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('此报告由校园无障碍路线规划系统自动生成', pageWidth / 2, pageHeight - 10, {
    align: 'center',
  });

  return doc.output('blob');
};

export const downloadReport = async (
  route: Route,
  cameraState: CameraState,
  filters: FilterState,
  timelinePosition: number,
  screenshot?: string
): Promise<void> => {
  const blob = await generateRouteReport(route, cameraState, filters, timelinePosition, screenshot);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `无障碍路线报告_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const createReportSnapshot = (
  route: Route,
  cameraState: CameraState,
  filters: FilterState,
  timelinePosition: number
): RouteReport => {
  return {
    id: Math.random().toString(36).substring(2, 11),
    exportTime: new Date().toISOString(),
    route: JSON.parse(JSON.stringify(route)),
    cameraState: { ...cameraState },
    filters: { ...filters },
    timelinePosition,
  };
};

export const calculateDataHash = (data: unknown): string => {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};
