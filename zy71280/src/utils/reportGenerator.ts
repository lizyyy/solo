import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import type { OptimizationReport, AnomalyItem, CalculationPoint } from '../types/auction';
import { formatCurrency, formatPercent, formatDate, formatScenario, formatSeverity, formatAnomalyType } from './formatters';

export function exportToPDF(report: OptimizationReport): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 25;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('拍卖保留价优化报告', pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`生成时间：${formatDate(report.generatedAt)}`, margin, y);
  y += 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('一、拍品概述', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const item = report.itemSummary;
  doc.text(`拍品名称：${item.name}`, margin, y); y += 6;
  doc.text(`拍品类目：${item.category}`, margin, y); y += 6;
  doc.text(`估值金额：${formatCurrency(item.appraisedValue)}`, margin, y); y += 6;
  doc.text(`品相状态：${item.condition}`, margin, y); y += 6;
  if (item.appraiser) {
    doc.text(`估值机构：${item.appraiser}`, margin, y); y += 6;
  }
  if (item.provenance) {
    doc.text(`拍品来源：${item.provenance}`, margin, y); y += 6;
  }
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('二、最优保留价建议', margin, y);
  y += 8;

  doc.setFillColor(30, 58, 95);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, pageWidth - 2 * margin, 15, 'F');
  doc.setFontSize(16);
  doc.text(`建议保留价：${formatCurrency(report.optimalReservePrice)}`, pageWidth / 2, y + 10, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 25;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`建议区间：${formatCurrency(report.reservePriceRange[0])} - ${formatCurrency(report.reservePriceRange[1])}`, margin, y);
  y += 6;
  doc.text(`占估值比例：${formatPercent(report.optimalReservePrice / item.appraisedValue)}`, margin, y);
  y += 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('三、情景对比分析', margin, y);
  y += 10;

  const scenarios = [
    { key: 'conservative', label: '保守情景' },
    { key: 'neutral', label: '中性情景' },
    { key: 'optimistic', label: '乐观情景' },
  ];

  const colWidth = (pageWidth - 2 * margin) / 3;
  scenarios.forEach((s, i) => {
    const x = margin + i * colWidth;
    const point = report.scenarios[s.key as keyof typeof report.scenarios] as CalculationPoint;

    doc.setDrawColor(200, 200, 200);
    doc.rect(x, y, colWidth - 2, 40);

    doc.setFont('helvetica', 'bold');
    doc.text(s.label, x + colWidth / 2, y + 6, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`保留价：${formatCurrency(point.reservePrice)}`, x + 3, y + 14);
    doc.text(`期望收益：${formatCurrency(point.expectedRevenue)}`, x + 3, y + 20);
    doc.text(`期望佣金：${formatCurrency(point.expectedCommission)}`, x + 3, y + 26);
    doc.text(`流拍概率：${formatPercent(point.unsoldProbability)}`, x + 3, y + 32);
    doc.text(`置信度：${formatPercent(point.confidence)}`, x + 3, y + 38);
  });
  y += 55;

  if (report.anomalies.length > 0 && y > 250) {
    doc.addPage();
    y = 25;
  }

  if (report.anomalies.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('四、异常检测结果', margin, y);
    y += 10;

    report.anomalies.slice(0, 5).forEach((anomaly: AnomalyItem, index: number) => {
      if (y > 270) {
        doc.addPage();
        y = 25;
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. [${formatSeverity(anomaly.severity)}] ${anomaly.title}`, margin, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`类型：${formatAnomalyType(anomaly.type)}`, margin + 5, y); y += 5;
      doc.text(`描述：${anomaly.description}`, margin + 5, y); y += 5;
      doc.text(`判断依据：${anomaly.basis}`, margin + 5, y); y += 5;
      doc.text(`影响评估：${anomaly.impact}`, margin + 5, y); y += 5;
      doc.text(`修正建议：${anomaly.suggestion}`, margin + 5, y); y += 8;
    });

    if (report.anomalies.length > 5) {
      doc.text(`... 另有 ${report.anomalies.length - 5} 项异常，请查看完整报告`, margin, y);
      y += 8;
    }
    y += 10;
  }

  if (y > 230) {
    doc.addPage();
    y = 25;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('五、规则说明附录', margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const ruleLines = report.ruleNotes.split('\n').filter(l => l.trim());
  ruleLines.forEach((line: string) => {
    if (y > 280) {
      doc.addPage();
      y = 25;
    }
    doc.text(line, margin, y);
    y += 5;
  });

  doc.save(`拍卖保留价优化报告_${item.name}_${formatDate(report.generatedAt)}.pdf`);
}

export function exportToExcel(report: OptimizationReport): void {
  const wb = XLSX.utils.book_new();

  const summaryData = [
    ['拍品名称', report.itemSummary.name],
    ['拍品类目', report.itemSummary.category],
    ['估值金额', report.itemSummary.appraisedValue],
    ['品相状态', report.itemSummary.condition],
    ['估值机构', report.itemSummary.appraiser || ''],
    ['拍品来源', report.itemSummary.provenance || ''],
    ['建议保留价', report.optimalReservePrice],
    ['建议区间下限', report.reservePriceRange[0]],
    ['建议区间上限', report.reservePriceRange[1]],
    ['占估值比例', report.optimalReservePrice / report.itemSummary.appraisedValue],
    ['生成时间', report.generatedAt],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summarySheet, '拍品概述');

  const scenarioData = [
    ['情景', '保留价', '期望收益', '期望佣金', '流拍概率', '置信度'],
    ['保守', report.scenarios.conservative.reservePrice, report.scenarios.conservative.expectedRevenue, report.scenarios.conservative.expectedCommission, report.scenarios.conservative.unsoldProbability, report.scenarios.conservative.confidence],
    ['中性', report.scenarios.neutral.reservePrice, report.scenarios.neutral.expectedRevenue, report.scenarios.neutral.expectedCommission, report.scenarios.neutral.unsoldProbability, report.scenarios.neutral.confidence],
    ['乐观', report.scenarios.optimistic.reservePrice, report.scenarios.optimistic.expectedRevenue, report.scenarios.optimistic.expectedCommission, report.scenarios.optimistic.unsoldProbability, report.scenarios.optimistic.confidence],
  ];
  const scenarioSheet = XLSX.utils.aoa_to_sheet(scenarioData);
  XLSX.utils.book_append_sheet(wb, scenarioSheet, '情景对比');

  const anomalyData = [
    ['序号', '严重程度', '类型', '标题', '描述', '判断依据', '影响评估', '修正建议'],
    ...report.anomalies.map((a, i) => [
      i + 1, formatSeverity(a.severity), formatAnomalyType(a.type),
      a.title, a.description, a.basis, a.impact, a.suggestion
    ]),
  ];
  const anomalySheet = XLSX.utils.aoa_to_sheet(anomalyData);
  XLSX.utils.book_append_sheet(wb, anomalySheet, '异常检测');

  const params = report.parameterSnapshot;
  const paramData = [
    ['参数名称', '参数值', '说明'],
    ['风险容忍度', params.riskTolerance, '0=极度保守，1=极度激进'],
    ['流拍成本系数', params.unsoldCostCoefficient, '按估值比例'],
    ['买家活跃度权重', params.buyerWeight, '0-1'],
    ['保留价下限/估值', params.minReserveRatio, ''],
    ['保留价上限/估值', params.maxReserveRatio, ''],
    ['最大可接受流拍概率', params.maxUnsoldProbability, ''],
    ['最低佣金保障', params.minCommissionGuarantee, '元'],
    ...params.commissionTiers.map(t => [
      `佣金阶梯${t.tier}`, `${t.rate}%`, `${t.minAmount.toLocaleString()}-${t.maxAmount?.toLocaleString() || '无限'}元`
    ]),
  ];
  const paramSheet = XLSX.utils.aoa_to_sheet(paramData);
  XLSX.utils.book_append_sheet(wb, paramSheet, '参数配置');

  XLSX.writeFile(wb, `拍卖保留价优化报告_${report.itemSummary.name}_${formatDate(report.generatedAt)}.xlsx`);
}

export function exportToCSV(report: OptimizationReport): void {
  exportToExcel(report);
}
