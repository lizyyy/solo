import jsPDF from 'jspdf';
import type { Solution, Network, ImpactAnalysis } from '@/types';
import { performImpactAnalysis } from './networkAnalyzer';

export interface ReportData {
  solutionName: string;
  scenarioName: string;
  generatedAt: string;
  valveActions: Array<{
    valveId: string;
    fromStatus: string;
    toStatus: string;
    timestamp: string;
  }>;
  impactAnalysis: ImpactAnalysis;
  summary: {
    totalValvesClosed: number;
    totalAffectedZones: number;
    totalAffectedCustomers: number;
    hasConflict: boolean;
  };
}

export function generateReportData(
  solution: Solution,
  scenarioName: string
): ReportData {
  return {
    solutionName: solution.name,
    scenarioName,
    generatedAt: new Date(solution.createdAt).toLocaleString('zh-CN'),
    valveActions: solution.valveActions.map((action) => ({
      valveId: action.valveId,
      fromStatus: action.fromStatus === 'open' ? '开启' : '关闭',
      toStatus: action.toStatus === 'open' ? '开启' : '关闭',
      timestamp: new Date(action.timestamp).toLocaleString('zh-CN'),
    })),
    impactAnalysis: solution.impactAnalysis,
    summary: {
      totalValvesClosed: solution.valveActions.filter((a) => a.toStatus === 'closed').length,
      totalAffectedZones: solution.impactAnalysis.affectedZoneIds.length,
      totalAffectedCustomers: solution.impactAnalysis.affectedCustomerCount,
      hasConflict: solution.impactAnalysis.hasConflict,
    },
  };
}

export function generateJSONReport(
  solution: Solution,
  scenarioName: string
): string {
  const reportData = generateReportData(solution, scenarioName);
  return JSON.stringify(reportData, null, 2);
}

export function downloadJSONReport(
  solution: Solution,
  scenarioName: string
): void {
  const json = generateJSONReport(solution, scenarioName);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `隔离报告_${solution.name}_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generatePDFReport(
  solution: Solution,
  scenarioName: string,
  network: Network
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('管网阀门隔离演练报告', pageWidth / 2, y, { align: 'center' });
  y += 15;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, margin, y);
  y += 8;
  doc.text(`场景: ${scenarioName}`, margin, y);
  y += 8;
  doc.text(`方案名称: ${solution.name}`, margin, y);
  y += 15;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('一、方案摘要', margin, y);
  y += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const summaryItems = [
    `关闭阀门数量: ${solution.valveActions.filter((a) => a.toStatus === 'closed').length} 个`,
    `受影响片区: ${solution.impactAnalysis.affectedZoneIds.length} 个`,
    `受影响用户: ${solution.impactAnalysis.affectedCustomerCount} 户`,
    `隔离管线: ${solution.impactAnalysis.isolatedPipes.length} 条`,
    `隔离节点: ${solution.impactAnalysis.isolatedNodes.length} 个`,
    `存在冲突: ${solution.impactAnalysis.hasConflict ? '是' : '否'}`,
  ];

  summaryItems.forEach((item) => {
    doc.text(`• ${item}`, margin + 5, y);
    y += 7;
  });
  y += 8;

  if (solution.impactAnalysis.hasConflict) {
    doc.setFontSize(12);
    doc.setTextColor(255, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('警告: 检测到以下冲突', margin, y);
    y += 8;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    solution.impactAnalysis.conflictDetails.forEach((detail) => {
      doc.text(`  ${detail}`, margin + 5, y);
      y += 7;
    });
    y += 8;
  }

  if (y > 250) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('二、阀门操作记录', margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  solution.valveActions.forEach((action, index) => {
    const actionText = `${index + 1}. 阀门 ${action.valveId}: ${action.fromStatus === 'open' ? '开启' : '关闭'} → ${action.toStatus === 'open' ? '开启' : '关闭'}`;
    doc.text(actionText, margin + 5, y);
    y += 6;
    if (y > 270) {
      doc.addPage();
      y = margin;
    }
  });
  y += 8;

  if (y > 240) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('三、受影响片区详情', margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  solution.impactAnalysis.affectedZoneIds.forEach((zoneId) => {
    const zone = network.customerZones.find((z) => z.id === zoneId);
    if (zone) {
      doc.text(`• ${zone.name}: ${zone.customerCount} 户 (${zone.type === 'residential' ? '住宅区' : zone.type === 'commercial' ? '商业区' : '工业区'})`, margin + 5, y);
      y += 7;
    }
  });

  doc.save(`隔离报告_${solution.name}_${Date.now()}.pdf`);
}

export function validateSolution(network: Network): {
  isValid: boolean;
  issues: string[];
  impactAnalysis: ImpactAnalysis;
} {
  const impactAnalysis = performImpactAnalysis(network);
  const issues: string[] = [];

  if (impactAnalysis.hasConflict) {
    issues.push(...impactAnalysis.conflictDetails);
  }

  if (impactAnalysis.affectedCustomerCount === 0 && network.repairPoints.length > 0) {
    issues.push('警告: 未隔离任何区域，请确认阀门操作是否正确');
  }

  const closedValves = network.valves.filter((v) => v.status === 'closed');
  if (closedValves.length === 0 && network.repairPoints.length > 0) {
    issues.push('提示: 尚未关闭任何阀门');
  }

  return {
    isValid: !impactAnalysis.hasConflict,
    issues,
    impactAnalysis,
  };
}
