import jsPDF from 'jspdf';
import {
  ReportSnapshot,
  ReportStatistics,
  ComponentStat,
  CameraState,
  FilterCondition,
} from '../types';
import { useSceneStore } from '../store/useSceneStore';
import { useTimeStore } from '../store/useTimeStore';

const monthNames = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];

export function generateStatistics(): ReportStatistics {
  const { components, filter, getFilteredComponents, selectedComponents } = useSceneStore.getState();
  const filteredComponents = getFilteredComponents();

  const targetComponents = selectedComponents.length > 0
    ? filteredComponents.filter((c) => selectedComponents.includes(c.id))
    : filteredComponents;

  const componentStats: ComponentStat[] = targetComponents.map((c) => ({
    id: c.id,
    name: c.name,
    group: c.group,
    shadowRate: c.shadowStats.shadowRate,
    shadowHours: c.shadowStats.shadowHours,
  }));

  const shadowRates = targetComponents.map((c) => c.shadowStats.shadowRate);
  const totalShadowHours = targetComponents.reduce(
    (sum, c) => sum + c.shadowStats.shadowHours,
    0
  );

  return {
    totalComponents: components.length,
    filteredComponents: targetComponents.length,
    averageShadowRate: shadowRates.length > 0
      ? shadowRates.reduce((a, b) => a + b, 0) / shadowRates.length
      : 0,
    maxShadowRate: shadowRates.length > 0 ? Math.max(...shadowRates) : 0,
    minShadowRate: shadowRates.length > 0 ? Math.min(...shadowRates) : 0,
    totalShadowHours,
    componentStats,
  };
}

export function createReportSnapshot(
  sceneImage: string | null
): ReportSnapshot {
  const timeState = useTimeStore.getState();
  const sceneState = useSceneStore.getState();

  return {
    time: {
      month: timeState.month,
      day: timeState.day,
      hour: timeState.hour,
    },
    camera: sceneState.camera,
    filter: sceneState.filter,
    selectedComponents: sceneState.selectedComponents,
    statistics: generateStatistics(),
    sceneImage: sceneImage || undefined,
    timestamp: new Date().toISOString(),
  };
}

export async function exportPDFReport(
  sceneImage: string | null,
  onProgress?: (message: string) => void
): Promise<Blob> {
  onProgress?.('正在生成报告...');

  const snapshot = createReportSnapshot(sceneImage);
  const doc = new jsPDF('p', 'mm', 'a4');

  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, 210, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('光伏阴影分析报告', 105, 20, { align: 'center' });

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  const reportDate = new Date(snapshot.timestamp);
  doc.text(`生成时间: ${reportDate.toLocaleString('zh-CN')}`, 15, 42);
  doc.text(`分析时间: ${monthNames[snapshot.time.month - 1]} ${snapshot.time.day}日 ${Math.floor(snapshot.time.hour).toString().padStart(2, '0')}:${Math.floor((snapshot.time.hour % 1) * 60).toString().padStart(2, '0')}`, 15, 50);

  if (snapshot.sceneImage) {
    onProgress?.('正在添加场景截图...');
    try {
      doc.addImage(snapshot.sceneImage, 'PNG', 15, 58, 180, 100);
    } catch (e) {
      console.error('Failed to add image to PDF:', e);
    }
  }

  let yPos = 165;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 118, 110);
  doc.text('统计摘要', 15, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);

  const stats = snapshot.statistics;
  doc.text(`组件总数: ${stats.totalComponents}`, 15, yPos);
  doc.text(`筛选后组件: ${stats.filteredComponents}`, 80, yPos);
  doc.text(`平均遮挡率: ${stats.averageShadowRate.toFixed(1)}%`, 15, yPos + 6);
  doc.text(`最高遮挡率: ${stats.maxShadowRate.toFixed(1)}%`, 80, yPos + 6);
  doc.text(`最低遮挡率: ${stats.minShadowRate.toFixed(1)}%`, 145, yPos + 6);
  doc.text(`总遮挡时长: ${stats.totalShadowHours.toFixed(1)} 小时`, 15, yPos + 12);

  yPos += 22;

  if (snapshot.filter.groups.length > 0 ||
      snapshot.filter.shadowRateMin > 0 ||
      snapshot.filter.shadowRateMax < 100) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 118, 110);
    doc.text('筛选条件', 15, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);

    if (snapshot.filter.groups.length > 0) {
      doc.text(`分组筛选: ${snapshot.filter.groups.join(', ')}`, 15, yPos);
      yPos += 6;
    }
    doc.text(`遮挡率范围: ${snapshot.filter.shadowRateMin}% - ${snapshot.filter.shadowRateMax}%`, 15, yPos);
    yPos += 12;
  }

  if (snapshot.selectedComponents.length > 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 118, 110);
    doc.text(`选中组件 (${snapshot.selectedComponents.length}个)`, 15, yPos);
    yPos += 8;
  } else {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 118, 110);
    doc.text(`组件详情 (${stats.componentStats.length}个)`, 15, yPos);
    yPos += 8;
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('组件名称', 15, yPos);
  doc.text('分组', 70, yPos);
  doc.text('遮挡率', 110, yPos);
  doc.text('遮挡时长', 150, yPos);
  yPos += 4;

  doc.setDrawColor(200, 200, 200);
  doc.line(15, yPos, 195, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'normal');
  const displayStats = stats.componentStats.slice(0, 15);
  displayStats.forEach((stat, index) => {
    const rateColor = stat.shadowRate < 25
      ? [34, 197, 94]
      : stat.shadowRate < 50
      ? [234, 179, 8]
      : [239, 68, 68];

    doc.setTextColor(60, 60, 60);
    doc.text(stat.name, 15, yPos + index * 6);
    doc.text(stat.group, 70, yPos + index * 6);
    doc.setTextColor(rateColor[0], rateColor[1], rateColor[2]);
    doc.text(`${stat.shadowRate.toFixed(1)}%`, 110, yPos + index * 6);
    doc.setTextColor(60, 60, 60);
    doc.text(`${stat.shadowHours.toFixed(1)}h`, 150, yPos + index * 6);
  });

  if (stats.componentStats.length > 15) {
    doc.setTextColor(150, 150, 150);
    doc.text(`... 还有 ${stats.componentStats.length - 15} 个组件`, 15, yPos + 15 * 6);
  }

  yPos += Math.min(displayStats.length, 15) * 6 + 15;

  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text('相机位置:', 15, yPos);
  doc.text(
    `(${snapshot.camera.position.x.toFixed(1)}, ${snapshot.camera.position.y.toFixed(1)}, ${snapshot.camera.position.z.toFixed(1)})`,
    45,
    yPos
  );

  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(15, 118, 110);
  doc.rect(0, 282, 210, 15, 'F');
  doc.text('院落光伏阴影分析系统', 105, 291, { align: 'center' });

  onProgress?.('报告生成完成！');

  return doc.output('blob');
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
