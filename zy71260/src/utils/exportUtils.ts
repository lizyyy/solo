import jsPDF from 'jspdf';
import type { Mode, Chord, ModulationPath, DataSource, AudioSample } from '../types';
import { getModeName, getChordFunctionName, getModulationTypeName, getQualityName } from './musicTheory';

export const exportToJSON = (data: {
  modes: Mode[];
  chords: Chord[];
  modulationPaths: ModulationPath[];
  audioSamples: AudioSample[];
  dataSources: DataSource[];
  selectedModeId?: string | null;
  selectedChordId?: string | null;
}): void => {
  const jsonData = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `harmony-space-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const generateReportPDF = (data: {
  modes: Mode[];
  chords: Chord[];
  modulationPaths: ModulationPath[];
  dataSources: DataSource[];
  selectedMode?: Mode | null;
  qualityStats: {
    normal: number;
    borderline: number;
    error: number;
  };
}): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('音乐理论 - 3D和声空间报告', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`生成日期: ${new Date().toLocaleDateString('zh-CN')}`, 20, yPos);
  yPos += 10;
  doc.text(`调式总数: ${data.modes.length}`, 20, yPos);
  yPos += 7;
  doc.text(`和弦总数: ${data.chords.length}`, 20, yPos);
  yPos += 7;
  doc.text(`转调路径总数: ${data.modulationPaths.length}`, 20, yPos);
  yPos += 15;

  doc.setFont('helvetica', 'bold');
  doc.text('数据质量统计', 20, yPos);
  yPos += 10;
  doc.setFont('helvetica', 'normal');
  doc.text(`正常数据: ${data.qualityStats.normal}`, 25, yPos);
  yPos += 7;
  doc.text(`临界数据: ${data.qualityStats.borderline}`, 25, yPos);
  yPos += 7;
  doc.text(`错误数据: ${data.qualityStats.error}`, 25, yPos);
  yPos += 15;

  if (data.selectedMode) {
    doc.setFont('helvetica', 'bold');
    doc.text('当前选中调式', 20, yPos);
    yPos += 10;
    doc.setFont('helvetica', 'normal');
    doc.text(`名称: ${getModeName(data.selectedMode.rootNote, data.selectedMode.type)}`, 25, yPos);
    yPos += 7;
    doc.text(`数据质量: ${getQualityName(data.selectedMode.quality)}`, 25, yPos);
    yPos += 7;
    doc.text(`五度圈位置: ${data.selectedMode.fifthsPosition}`, 25, yPos);
    yPos += 7;
    doc.text(`调式亮度: ${data.selectedMode.brightness}`, 25, yPos);
    yPos += 15;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('调式列表', 20, yPos);
  yPos += 10;
  doc.setFont('helvetica', 'normal');

  data.modes.slice(0, 8).forEach((mode) => {
    if (yPos > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
    }
    doc.text(
      `${getModeName(mode.rootNote, mode.type)} - ${getQualityName(mode.quality)}`,
      25,
      yPos
    );
    yPos += 7;
  });

  if (data.modes.length > 8) {
    doc.text(`... 还有 ${data.modes.length - 8} 个调式`, 25, yPos);
  }

  doc.save(`harmony-space-report-${new Date().toISOString().split('T')[0]}.pdf`);
};

export const downloadLearningReport = (
  learningHistory: { modeId: string; timestamp: number }[],
  modes: Mode[]
): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('学习进度报告', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`学习时间: ${new Date().toLocaleDateString('zh-CN')}`, 20, yPos);
  yPos += 10;
  doc.text(`已学习调式数量: ${new Set(learningHistory.map((h) => h.modeId)).size}`, 20, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'bold');
  doc.text('学习轨迹', 20, yPos);
  yPos += 10;
  doc.setFont('helvetica', 'normal');

  learningHistory.slice(0, 15).forEach((history, index) => {
    const mode = modes.find((m) => m.id === history.modeId);
    if (mode) {
      doc.text(
        `${index + 1}. ${getModeName(mode.rootNote, mode.type)} - ${new Date(history.timestamp).toLocaleTimeString('zh-CN')}`,
        25,
        yPos
      );
      yPos += 7;
    }
  });

  doc.save(`learning-report-${new Date().toISOString().split('T')[0]}.pdf`);
};
