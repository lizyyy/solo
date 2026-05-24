import { jsPDF } from 'jspdf';
import { DriftReport } from '@/types';
import { PESTICIDE_INFO, WIND_SPEED_UNITS } from '@/data/constants';

export function exportReport(report: DriftReport) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  doc.setFontSize(20);
  doc.setTextColor(34, 139, 34);
  doc.text('果园喷药漂移预演报告', pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`生成时间: ${report.generatedAt}`, pageWidth / 2, y, { align: 'center' });
  y += 15;

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('场景信息', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`场景名称: ${report.sceneName}`, margin, y);
  y += 6;
  doc.text(`模拟时长: ${report.simulationTime.toFixed(1)} 秒`, margin, y);
  y += 10;

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('模拟参数', margin, y);
  y += 8;

  const pesticideInfo = PESTICIDE_INFO[report.params.pesticideType];
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`风速: ${(report.params.windSpeed * WIND_SPEED_UNITS.m_s.factor).toFixed(1)} m/s`, margin, y);
  doc.text(`风向: ${report.params.windDirection}°`, margin + 60, y);
  y += 6;
  doc.text(`药剂类型: ${pesticideInfo.name}`, margin, y);
  doc.text(`毒性等级: ${pesticideInfo.toxicity === 'high' ? '高' : pesticideInfo.toxicity === 'medium' ? '中' : '低'}`, margin + 60, y);
  y += 6;
  doc.text(`漂移风险: ${(pesticideInfo.driftRisk * 100).toFixed(0)}%`, margin, y);
  doc.text(`模拟速度: ${report.params.simulationSpeed.toFixed(1)}x`, margin + 60, y);
  y += 10;

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('评估结论', margin, y);
  y += 8;

  const conclusionColors: Record<string, [number, number, number]> = {
    safe: [34, 139, 34],
    warning: [255, 140, 0],
    unsafe: [220, 38, 38],
  };
  const conclusionLabels: Record<string, string> = {
    safe: '安全 - 可正常喷药',
    warning: '警告 - 需谨慎操作',
    unsafe: '危险 - 禁止喷药',
  };

  doc.setTextColor(...conclusionColors[report.conclusion]);
  doc.setFontSize(12);
  doc.text(conclusionLabels[report.conclusion], margin, y);
  y += 10;

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('统计数据', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`最大漂移距离: ${report.maxDriftDistance.toFixed(1)} m`, margin, y);
  y += 6;
  doc.text(`报警数量: ${report.alerts.length} 个`, margin, y);
  y += 6;
  if (report.affectedAreas.length > 0) {
    doc.text(`受影响区域: ${report.affectedAreas.join(', ')}`, margin, y);
  } else {
    doc.text('受影响区域: 无', margin, y);
  }
  y += 10;

  if (report.alerts.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('报警详情', margin, y);
    y += 8;

    doc.setFontSize(9);
    report.alerts.slice(0, 5).forEach((alert) => {
      const severityColor = alert.severity === 'danger' ? [220, 38, 38] as [number, number, number] : [255, 140, 0] as [number, number, number];
      doc.setTextColor(...severityColor);
      doc.text(`• [${alert.severity === 'danger' ? '危险' : '警告'}] ${alert.message}`, margin, y);
      y += 5;
    });

    if (report.alerts.length > 5) {
      doc.setTextColor(100);
      doc.text(`  ... 还有 ${report.alerts.length - 5} 条报警`, margin, y);
      y += 5;
    }
    y += 5;
  }

  y += 5;
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('建议措施', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(60);
  report.recommendations.forEach((rec, index) => {
    doc.text(`${index + 1}. ${rec}`, margin, y);
    y += 6;
  });

  y += 10;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('本报告基于模拟数据生成，仅供参考。实际喷药请结合现场气象条件。', pageWidth / 2, y, { align: 'center' });

  doc.save(`喷药漂移报告-${report.sceneId}-${Date.now()}.pdf`);
}