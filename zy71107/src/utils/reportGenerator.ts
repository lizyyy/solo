import { jsPDF } from 'jspdf';
import { ExhibitionHall, VisitorTrajectory, AnomalyReport, BatchData } from '../data/types';
import { getShowcaseStats } from './dataValidator';

export interface ReportData {
  hallData: ExhibitionHall;
  trajectories: VisitorTrajectory[];
  anomalies: AnomalyReport[];
  batches: BatchData[];
  generatedAt: Date;
}

export async function generatePDFReport(data: ReportData): Promise<void> {
  const { hallData, trajectories, anomalies, batches, generatedAt } = data;
  const showcaseStats = getShowcaseStats(trajectories, hallData.showcases);

  const doc = new jsPDF();
  let yPos = 20;

  doc.setFontSize(20);
  doc.setTextColor(0, 100, 150);
  doc.text('博物馆展厅参观动线复盘报告', 105, yPos, { align: 'center' });
  yPos += 15;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`生成时间: ${generatedAt.toLocaleString('zh-CN')}`, 105, yPos, { align: 'center' });
  yPos += 20;

  doc.setFontSize(14);
  doc.setTextColor(0, 100, 150);
  doc.text('一、展厅基本信息', 20, yPos);
  yPos += 10;

  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`展厅名称: ${hallData.name}`, 25, yPos);
  yPos += 7;
  doc.text(`展柜数量: ${hallData.showcases.length}`, 25, yPos);
  yPos += 7;
  doc.text(`观众总数: ${trajectories.length}`, 25, yPos);
  yPos += 7;
  doc.text(`批次数量: ${batches.length}`, 25, yPos);
  yPos += 15;

  doc.setFontSize(14);
  doc.setTextColor(0, 100, 150);
  doc.text('二、展柜统计数据', 20, yPos);
  yPos += 10;

  doc.setFontSize(9);
  doc.setTextColor(0);
  
  const sortedStats = [...showcaseStats].sort((a, b) => b.visitorCount - a.visitorCount);
  
  doc.setFillColor(240, 248, 255);
  doc.rect(25, yPos - 5, 160, 8, 'F');
  
  doc.setTextColor(0, 100, 150);
  doc.text('展柜编号', 30, yPos);
  doc.text('访客数', 75, yPos);
  doc.text('总停留(秒)', 110, yPos);
  doc.text('平均停留(秒)', 145, yPos);
  yPos += 10;

  doc.setTextColor(0);
  sortedStats.slice(0, 10).forEach((stat, index) => {
    const showcase = hallData.showcases.find((s) => s.id === stat.showcaseId);
    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(25, yPos - 5, 160, 7, 'F');
    }
    doc.text(showcase?.number || stat.showcaseId, 30, yPos);
    doc.text(String(stat.visitorCount), 75, yPos);
    doc.text(String(Math.round(stat.totalDuration / 1000)), 110, yPos);
    doc.text(String(Math.round(stat.avgDuration / 1000)), 145, yPos);
    yPos += 7;
  });

  yPos += 10;

  if (anomalies.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(200, 80, 0);
    doc.text('三、异常检测报告', 20, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`共检测到 ${anomalies.length} 个异常:`, 25, yPos);
    yPos += 10;

    anomalies.slice(0, 15).forEach((anomaly) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      const severityColor = anomaly.severity === 'high' ? [255, 0, 0] : anomaly.severity === 'medium' ? [255, 150, 0] : [200, 200, 0];
      doc.setTextColor(severityColor[0], severityColor[1], severityColor[2]);
      doc.text(`[${anomaly.severity.toUpperCase()}]`, 25, yPos);
      doc.setTextColor(0);
      doc.text(anomaly.message, 50, yPos);
      yPos += 7;
    });
  }

  yPos += 10;
  if (yPos > 260) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(14);
  doc.setTextColor(0, 100, 150);
  doc.text('四、数据一致性说明', 20, yPos);
  yPos += 10;

  doc.setFontSize(10);
  doc.setTextColor(0);
  
  const calcRate = (type: string): number => {
    if (trajectories.length === 0) return 100;
    const count = anomalies.filter(a => a.type === type).length;
    return Math.round((1 - count / trajectories.length) * 100);
  };
  
  const consistencyChecks = [
    `轨迹数据完整度: ${calcRate('trajectory_break')}%`,
    `展柜编号匹配率: ${calcRate('showcase_mismatch')}%`,
    `拥堵标记准确率: ${calcRate('congestion_confusion')}%`,
  ];

  consistencyChecks.forEach((check) => {
    doc.text(`• ${check}`, 25, yPos);
    yPos += 7;
  });

  doc.save(`museum-trajectory-report-${generatedAt.getTime()}.pdf`);
}

export function exportJSONReport(data: ReportData): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `museum-trajectory-data-${data.generatedAt.getTime()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
