import jsPDF from 'jspdf';
import { ExportReport } from '../types';
import { useSimulationStore } from '../store/useSimulationStore';
import { getHeatmapStats } from './heatmap';

export function generateReport(): ExportReport {
  const state = useSimulationStore.getState();
  const heatmapStats = getHeatmapStats(state.heatmapData);
  
  return {
    timestamp: new Date().toISOString(),
    params: {
      greenhouse: state.greenhouse,
      plants: state.plants,
      robotPath: state.robotPath,
      light: state.light,
    },
    camera: state.camera,
    currentView: state.currentView,
    validation: state.validation,
    heatmapSummary: {
      avg: heatmapStats.avg,
      min: heatmapStats.min,
      max: heatmapStats.max,
    },
  };
}

export function exportJSON() {
  const report = generateReport();
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `greenhouse-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPDF() {
  const report = generateReport();
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.setTextColor(22, 101, 52);
  doc.text('温室冠层间距分析报告', 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`生成时间: ${new Date(report.timestamp).toLocaleString('zh-CN')}`, 105, 30, { align: 'center' });
  
  let y = 45;
  
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('1. 场景信息', 20, y);
  y += 10;
  
  doc.setFontSize(10);
  doc.text(`当前视角: ${getViewName(report.currentView)}`, 25, y);
  y += 7;
  doc.text(`相机位置: (${report.camera.position.map(v => v.toFixed(2)).join(', ')})`, 25, y);
  y += 7;
  doc.text(`时间轴: ${Math.floor(report.params.light.timeOfDay)}:${(report.params.light.timeOfDay % 1 * 60).toFixed(0).padStart(2, '0')}`, 25, y);
  y += 12;
  
  doc.setFontSize(14);
  doc.text('2. 温室参数', 20, y);
  y += 10;
  
  doc.setFontSize(10);
  doc.text(`温室尺寸: ${report.params.greenhouse.width}m × ${report.params.greenhouse.length}m × ${report.params.greenhouse.height}m`, 25, y);
  y += 12;
  
  doc.setFontSize(14);
  doc.text('3. 植株参数', 20, y);
  y += 10;
  
  doc.setFontSize(10);
  doc.text(`行距: ${report.params.plants.rowSpacing}cm`, 25, y);
  y += 7;
  doc.text(`株距: ${report.params.plants.plantSpacing}cm`, 25, y);
  y += 7;
  doc.text(`植株高度: ${report.params.plants.plantHeight}cm`, 25, y);
  y += 7;
  doc.text(`冠层直径: ${report.params.plants.canopyDiameter}cm`, 25, y);
  y += 7;
  doc.text(`总行数: ${report.params.plants.rowsCount}`, 25, y);
  y += 7;
  doc.text(`每行株数: ${report.params.plants.plantsPerRow}`, 25, y);
  y += 7;
  doc.text(`总株数: ${report.params.plants.rowsCount * report.params.plants.plantsPerRow}`, 25, y);
  y += 12;
  
  if (report.params.robotPath.enabled) {
    doc.setFontSize(14);
    doc.text('4. 机器人通道', 20, y);
    y += 10;
    
    doc.setFontSize(10);
    doc.text(`通道宽度: ${report.params.robotPath.width}cm`, 25, y);
    y += 7;
    doc.text(`通道位置: 第 ${report.params.robotPath.position}-${report.params.robotPath.position + 1} 行间`, 25, y);
    y += 12;
  }
  
  doc.setFontSize(14);
  doc.text('5. 校验结果', 20, y);
  y += 10;
  
  doc.setFontSize(10);
  doc.text(`光照覆盖率: ${report.validation.lightCoverage.toFixed(1)}%`, 25, y);
  y += 7;
  doc.text(`冠层遮挡: ${report.validation.canopyOverlap ? '存在' : '正常'}`, 25, y);
  y += 7;
  
  if (report.params.robotPath.enabled) {
    doc.text(`通道宽度校验: ${report.validation.pathWidthOk ? '合格' : '不足'}`, 25, y);
    y += 7;
    doc.text(`实际通道宽度: ${report.validation.actualPathWidth.toFixed(0)}cm`, 25, y);
    y += 7;
  }
  
  if (report.validation.warnings.length > 0) {
    y += 5;
    doc.setTextColor(239, 68, 68);
    doc.text('警告信息:', 25, y);
    y += 7;
    report.validation.warnings.forEach(warning => {
      doc.text(`- ${warning}`, 25, y);
      y += 7;
    });
    doc.setTextColor(0, 0, 0);
  }
  
  y += 10;
  doc.setFontSize(14);
  doc.text('6. 光照热力图统计', 20, y);
  y += 10;
  
  doc.setFontSize(10);
  doc.text(`平均光照: ${(report.heatmapSummary.avg * 100).toFixed(1)}%`, 25, y);
  y += 7;
  doc.text(`最高光照: ${(report.heatmapSummary.max * 100).toFixed(1)}%`, 25, y);
  y += 7;
  doc.text(`最低光照: ${(report.heatmapSummary.min * 100).toFixed(1)}%`, 25, y);
  
  doc.save(`greenhouse-report-${Date.now()}.pdf`);
}

function getViewName(view: string): string {
  const names: Record<string, string> = {
    overview: '总览视图',
    side: '侧视图',
    top: '俯视图',
    front: '正视图',
  };
  return names[view] || view;
}
