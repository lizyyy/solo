import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type {
  ReviewReport,
  ExportOptions,
  StopAnalysis,
  RiskEvent,
  DecisionLog,
  Recommendation,
} from '../../types';

const i18n = {
  zh: {
    reportTitle: '巡演复盘报告',
    executionSummary: '执行摘要',
    tourName: '巡演名称',
    bandName: '乐队名称',
    tourDuration: '巡演时长',
    totalStops: '总站数',
    completedStops: '完成站数',
    initialBudget: '初始预算',
    finalCashFlow: '最终现金流',
    netProfit: '净利润',
    riskLevel: '风险等级',
    low: '低',
    medium: '中',
    high: '高',
    financialOverview: '财务总览',
    totalRevenue: '总收入',
    totalExpense: '总支出',
    profitMargin: '利润率',
    revenueBreakdown: '收入构成',
    expenseBreakdown: '支出构成',
    category: '类别',
    amount: '金额',
    percentage: '占比',
    stopAnalysis: '站点分析',
    city: '城市',
    venue: '场地',
    date: '日期',
    attendanceRate: '上座率',
    profitPerAttendee: '人均利润',
    merchConversionRate: '周边转化率',
    performanceRating: '表现评级',
    excellent: '优秀',
    good: '良好',
    average: '一般',
    poor: '较差',
    revenue: '收入',
    expense: '支出',
    profit: '利润',
    riskAnalysis: '风险分析',
    totalRisks: '风险总数',
    risksByType: '风险类型分布',
    risksBySeverity: '风险严重程度分布',
    highRiskEvents: '高风险事件',
    type: '类型',
    severity: '严重程度',
    description: '描述',
    impact: '影响',
    critical: '严重',
    warning: '警告',
    decisionAnalysis: '决策分析',
    totalDecisions: '决策总数',
    decisionsByType: '决策类型分布',
    decisionsByRiskLevel: '决策风险分布',
    averageImpact: '平均影响',
    bestDecisions: '最佳决策',
    worstDecisions: '最差决策',
    recommendations: '改进建议',
    priority: '优先级',
    recCategory: '类别',
    recommendationTitle: '标题',
    actionableSteps: '执行步骤',
    expectedImpact: '预期效果',
    box_office: '票房',
    inventory: '库存',
    route: '路线',
    cashflow: '现金流',
    route_decision: '路线决策',
    pricing: '定价',
    marketing: '营销',
    risk_mitigation: '风险缓解',
    conservative: '保守',
    balanced: '平衡',
    aggressive: '激进',
    financial: '财务',
    inventoryCategory: '库存',
    risk_management: '风险管理',
    generatedAt: '生成时间',
    success: '成功',
    failure: '失败',
  },
  en: {
    reportTitle: 'Tour Review Report',
    executionSummary: 'Execution Summary',
    tourName: 'Tour Name',
    bandName: 'Band Name',
    tourDuration: 'Tour Duration',
    totalStops: 'Total Stops',
    completedStops: 'Completed Stops',
    initialBudget: 'Initial Budget',
    finalCashFlow: 'Final Cash Flow',
    netProfit: 'Net Profit',
    riskLevel: 'Risk Level',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    financialOverview: 'Financial Overview',
    totalRevenue: 'Total Revenue',
    totalExpense: 'Total Expense',
    profitMargin: 'Profit Margin',
    revenueBreakdown: 'Revenue Breakdown',
    expenseBreakdown: 'Expense Breakdown',
    category: 'Category',
    amount: 'Amount',
    percentage: 'Percentage',
    stopAnalysis: 'Stop Analysis',
    city: 'City',
    venue: 'Venue',
    date: 'Date',
    attendanceRate: 'Attendance Rate',
    profitPerAttendee: 'Profit Per Attendee',
    merchConversionRate: 'Merch Conversion Rate',
    performanceRating: 'Performance Rating',
    excellent: 'Excellent',
    good: 'Good',
    average: 'Average',
    poor: 'Poor',
    revenue: 'Revenue',
    expense: 'Expense',
    profit: 'Profit',
    riskAnalysis: 'Risk Analysis',
    totalRisks: 'Total Risks',
    risksByType: 'Risks by Type',
    risksBySeverity: 'Risks by Severity',
    highRiskEvents: 'High Risk Events',
    type: 'Type',
    severity: 'Severity',
    description: 'Description',
    impact: 'Impact',
    critical: 'Critical',
    warning: 'Warning',
    decisionAnalysis: 'Decision Analysis',
    totalDecisions: 'Total Decisions',
    decisionsByType: 'Decisions by Type',
    decisionsByRiskLevel: 'Decisions by Risk Level',
    averageImpact: 'Average Impact',
    bestDecisions: 'Best Decisions',
    worstDecisions: 'Worst Decisions',
    recommendations: 'Recommendations',
    priority: 'Priority',
    recCategory: 'Category',
    recommendationTitle: 'Title',
    actionableSteps: 'Actionable Steps',
    expectedImpact: 'Expected Impact',
    box_office: 'Box Office',
    inventory: 'Inventory',
    route: 'Route',
    cashflow: 'Cash Flow',
    route_decision: 'Route Decision',
    pricing: 'Pricing',
    marketing: 'Marketing',
    risk_mitigation: 'Risk Mitigation',
    conservative: 'Conservative',
    balanced: 'Balanced',
    aggressive: 'Aggressive',
    financial: 'Financial',
    inventoryCategory: 'Inventory',
    risk_management: 'Risk Management',
    generatedAt: 'Generated At',
    success: 'Success',
    failure: 'Failure',
  },
};

type Language = 'zh' | 'en';

function t(key: string, lang: Language): string {
  const translations = i18n[lang];
  return (translations as Record<string, string>)[key] || key;
}

function formatCurrency(amount: number, lang: Language): string {
  const currencySymbol = lang === 'zh' ? '¥' : '$';
  return `${currencySymbol}${amount.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDate(dateStr: string, lang: Language): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US');
}

async function exportToPDF(
  report: ReviewReport,
  options: ExportOptions
): Promise<void> {
  const lang = options.language;
  const doc = new jsPDF();
  let yPos = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  doc.setFontSize(20);
  doc.text(t('reportTitle', lang), pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  doc.setFontSize(10);
  doc.text(
    `${t('generatedAt', lang)}: ${formatDate(report.generatedAt, lang)}`,
    pageWidth / 2,
    yPos,
    { align: 'center' }
  );
  yPos += 15;

  yPos = addExecutionSummaryToPDF(doc, report, lang, yPos, margin);
  yPos = addFinancialOverviewToPDF(doc, report, lang, yPos, margin);
  yPos = addStopAnalysisToPDF(doc, report, lang, yPos, margin);
  yPos = addRiskAnalysisToPDF(doc, report, lang, yPos, margin);
  yPos = addDecisionAnalysisToPDF(doc, report, lang, yPos, margin);
  yPos = addRecommendationsToPDF(doc, report, lang, yPos, margin);

  if (options.includeAlternativePaths && report.alternativePaths.length > 0) {
    yPos = addAlternativePathsToPDF(doc, report, lang, yPos, margin);
  }

  const fileName = `${report.executionSummary.tourName}_复盘报告.pdf`;
  doc.save(fileName);
}

function addExecutionSummaryToPDF(
  doc: jsPDF,
  report: ReviewReport,
  lang: Language,
  yPos: number,
  margin: number
): number {
  const summary = report.executionSummary;

  doc.setFontSize(14);
  doc.text(t('executionSummary', lang), margin, yPos);
  yPos += 8;

  const summaryData = [
    [t('tourName', lang), summary.tourName],
    [t('bandName', lang), summary.bandName || '-'],
    [t('tourDuration', lang), summary.tourDuration],
    [t('totalStops', lang), summary.totalStops.toString()],
    [t('completedStops', lang), summary.completedStops.toString()],
    [t('initialBudget', lang), formatCurrency(summary.initialBudget, lang)],
    [t('finalCashFlow', lang), formatCurrency(summary.finalCashFlow, lang)],
    [t('netProfit', lang), formatCurrency(summary.netProfit, lang)],
    [t('riskLevel', lang), t(summary.riskLevel, lang)],
  ];

  autoTable(doc, {
    startY: yPos,
    margin,
    body: summaryData,
    theme: 'grid',
    styles: { fontSize: 10 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
    },
  });

  return (doc as any).lastAutoTable.finalY + 15;
}

function addFinancialOverviewToPDF(
  doc: jsPDF,
  report: ReviewReport,
  lang: Language,
  yPos: number,
  margin: number
): number {
  const financial = report.financialOverview;

  doc.setFontSize(14);
  doc.text(t('financialOverview', lang), margin, yPos);
  yPos += 8;

  const summaryData = [
    [t('totalRevenue', lang), formatCurrency(financial.totalRevenue, lang)],
    [t('totalExpense', lang), formatCurrency(financial.totalExpense, lang)],
    [t('netProfit', lang), formatCurrency(financial.netProfit, lang)],
    [t('profitMargin', lang), formatPercentage(financial.profitMargin)],
  ];

  autoTable(doc, {
    startY: yPos,
    margin,
    body: summaryData,
    theme: 'grid',
    styles: { fontSize: 10 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
    },
  });
  yPos = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.text(t('revenueBreakdown', lang), margin, yPos);
  yPos += 6;

  const revenueData = [
    [t('category', lang), t('amount', lang), t('percentage', lang)],
    ...financial.revenueBreakdown.map((item) => [
      item.category,
      formatCurrency(item.amount, lang),
      formatPercentage(item.percentage),
    ]),
  ];

  autoTable(doc, {
    startY: yPos,
    margin,
    head: [revenueData[0]],
    body: revenueData.slice(1),
    theme: 'grid',
    styles: { fontSize: 10 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.text(t('expenseBreakdown', lang), margin, yPos);
  yPos += 6;

  const expenseData = [
    [t('category', lang), t('amount', lang), t('percentage', lang)],
    ...financial.expenseBreakdown.map((item) => [
      item.category,
      formatCurrency(item.amount, lang),
      formatPercentage(item.percentage),
    ]),
  ];

  autoTable(doc, {
    startY: yPos,
    margin,
    head: [expenseData[0]],
    body: expenseData.slice(1),
    theme: 'grid',
    styles: { fontSize: 10 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  const stopFinancialsTitle = lang === 'zh' ? '各站财务明细' : 'Per Stop Financials';
  doc.text(stopFinancialsTitle, margin, yPos);
  yPos += 6;

  const perStopData = [
    [t('city', lang), t('revenue', lang), t('expense', lang), t('profit', lang)],
    ...financial.perStopFinancials.map((item) => [
      item.city,
      formatCurrency(item.revenue, lang),
      formatCurrency(item.expense, lang),
      formatCurrency(item.profit, lang),
    ]),
  ];

  autoTable(doc, {
    startY: yPos,
    margin,
    head: [perStopData[0]],
    body: perStopData.slice(1),
    theme: 'grid',
    styles: { fontSize: 10 },
  });

  return (doc as any).lastAutoTable.finalY + 15;
}

function addStopAnalysisToPDF(
  doc: jsPDF,
  report: ReviewReport,
  lang: Language,
  yPos: number,
  margin: number
): number {
  doc.setFontSize(14);
  doc.text(t('stopAnalysis', lang), margin, yPos);
  yPos += 8;

  const stopData = [
    [
      t('city', lang),
      t('date', lang),
      t('attendanceRate', lang),
      t('merchConversionRate', lang),
      t('profit', lang),
      t('performanceRating', lang),
    ],
    ...report.stopAnalysis.map((item: StopAnalysis) => [
      item.stop.city,
      formatDate(item.stop.date, lang),
      formatPercentage(item.attendanceRate),
      formatPercentage(item.merchConversionRate),
      formatCurrency(item.result.netProfit, lang),
      t(item.performanceRating, lang),
    ]),
  ];

  autoTable(doc, {
    startY: yPos,
    margin,
    head: [stopData[0]],
    body: stopData.slice(1),
    theme: 'grid',
    styles: { fontSize: 9 },
  });

  return (doc as any).lastAutoTable.finalY + 15;
}

function addRiskAnalysisToPDF(
  doc: jsPDF,
  report: ReviewReport,
  lang: Language,
  yPos: number,
  margin: number
): number {
  const risk = report.riskAnalysis;

  doc.setFontSize(14);
  doc.text(t('riskAnalysis', lang), margin, yPos);
  yPos += 8;

  const summaryData = [
    [t('totalRisks', lang), risk.totalRisks.toString()],
  ];

  autoTable(doc, {
    startY: yPos,
    margin,
    body: summaryData,
    theme: 'grid',
    styles: { fontSize: 10 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
    },
  });
  yPos = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.text(t('risksByType', lang), margin, yPos);
  yPos += 6;

  const typeData = [
    [t('type', lang), t('count', lang) || '数量'],
    ...Object.entries(risk.risksByType).map(([type, count]) => [
      t(type, lang),
      count.toString(),
    ]),
  ];

  autoTable(doc, {
    startY: yPos,
    margin,
    head: [typeData[0]],
    body: typeData.slice(1),
    theme: 'grid',
    styles: { fontSize: 10 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 10;

  if (risk.highRiskEvents.length > 0) {
    doc.setFontSize(12);
    doc.text(t('highRiskEvents', lang), margin, yPos);
    yPos += 6;

    const highRiskData = [
      [t('type', lang), t('severity', lang), t('description', lang), t('impact', lang)],
      ...risk.highRiskEvents.map((event: RiskEvent) => [
        t(event.type, lang),
        t(event.severity, lang),
        event.description,
        formatCurrency(event.impact, lang),
      ]),
    ];

    autoTable(doc, {
      startY: yPos,
      margin,
      head: [highRiskData[0]],
      body: highRiskData.slice(1),
      theme: 'grid',
      styles: { fontSize: 9 },
      columnStyles: {
        2: { cellWidth: 'auto' },
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  return yPos + 5;
}

function addDecisionAnalysisToPDF(
  doc: jsPDF,
  report: ReviewReport,
  lang: Language,
  yPos: number,
  margin: number
): number {
  const decision = report.decisionAnalysis;

  doc.setFontSize(14);
  doc.text(t('decisionAnalysis', lang), margin, yPos);
  yPos += 8;

  const summaryData = [
    [t('totalDecisions', lang), decision.totalDecisions.toString()],
    [t('averageImpact', lang), formatCurrency(decision.averageImpact, lang)],
  ];

  autoTable(doc, {
    startY: yPos,
    margin,
    body: summaryData,
    theme: 'grid',
    styles: { fontSize: 10 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
    },
  });
  yPos = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.text(t('decisionsByType', lang), margin, yPos);
  yPos += 6;

  const typeData = [
    [t('type', lang), t('count', lang) || '数量'],
    ...Object.entries(decision.decisionsByType).map(([type, count]) => [
      t(type, lang),
      count.toString(),
    ]),
  ];

  autoTable(doc, {
    startY: yPos,
    margin,
    head: [typeData[0]],
    body: typeData.slice(1),
    theme: 'grid',
    styles: { fontSize: 10 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 10;

  if (decision.bestDecisions.length > 0) {
    doc.setFontSize(12);
    doc.text(t('bestDecisions', lang), margin, yPos);
    yPos += 6;

    const bestData = [
      [t('description', lang), t('impact', lang)],
      ...decision.bestDecisions.map((d: DecisionLog) => [
        d.description,
        formatCurrency(d.outcome.actualImpact, lang),
      ]),
    ];

    autoTable(doc, {
      startY: yPos,
      margin,
      head: [bestData[0]],
      body: bestData.slice(1),
      theme: 'grid',
      styles: { fontSize: 10 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  if (decision.worstDecisions.length > 0) {
    doc.setFontSize(12);
    doc.text(t('worstDecisions', lang), margin, yPos);
    yPos += 6;

    const worstData = [
      [t('description', lang), t('impact', lang)],
      ...decision.worstDecisions.map((d: DecisionLog) => [
        d.description,
        formatCurrency(d.outcome.actualImpact, lang),
      ]),
    ];

    autoTable(doc, {
      startY: yPos,
      margin,
      head: [worstData[0]],
      body: worstData.slice(1),
      theme: 'grid',
      styles: { fontSize: 10 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  return yPos + 5;
}

function addRecommendationsToPDF(
  doc: jsPDF,
  report: ReviewReport,
  lang: Language,
  yPos: number,
  margin: number
): number {
  if (report.recommendations.length === 0) return yPos;

  doc.setFontSize(14);
  doc.text(t('recommendations', lang), margin, yPos);
  yPos += 8;

  const recData = [
    [t('priority', lang), t('recommendationTitle', lang), t('description', lang), t('expectedImpact', lang)],
    ...report.recommendations.map((rec: Recommendation) => [
      t(rec.priority, lang),
      rec.title,
      rec.description,
      rec.expectedImpact,
    ]),
  ];

  autoTable(doc, {
    startY: yPos,
    margin,
    head: [recData[0]],
    body: recData.slice(1),
    theme: 'grid',
    styles: { fontSize: 9 },
    columnStyles: {
      2: { cellWidth: 'auto' },
    },
  });

  return (doc as any).lastAutoTable.finalY + 15;
}

function addAlternativePathsToPDF(
  doc: jsPDF,
  report: ReviewReport,
  lang: Language,
  yPos: number,
  margin: number
): number {
  const title = lang === 'zh' ? '替代路径分析' : 'Alternative Path Analysis';
  doc.setFontSize(14);
  doc.text(title, margin, yPos);
  yPos += 8;

  const altData = [
    [
      lang === 'zh' ? '替代选项' : 'Alternative',
      lang === 'zh' ? '模拟净利润' : 'Simulated Profit',
      lang === 'zh' ? '是否成功' : 'Success',
    ],
    ...report.alternativePaths.map((alt) => [
      alt.alternativeOptionName,
      formatCurrency(alt.simulatedResult.netProfit, lang),
      alt.simulatedResult.isSuccess ? t('success', lang) : t('failure', lang),
    ]),
  ];

  autoTable(doc, {
    startY: yPos,
    margin,
    head: [altData[0]],
    body: altData.slice(1),
    theme: 'grid',
    styles: { fontSize: 10 },
  });

  return (doc as any).lastAutoTable.finalY + 15;
}

async function exportToExcel(
  report: ReviewReport,
  options: ExportOptions
): Promise<void> {
  const lang = options.language;
  const wb = XLSX.utils.book_new();

  addExecutionSummaryToExcel(wb, report, lang);
  addFinancialOverviewToExcel(wb, report, lang);
  addStopAnalysisToExcel(wb, report, lang);
  addRiskAnalysisToExcel(wb, report, lang);
  addDecisionAnalysisToExcel(wb, report, lang);
  addRecommendationsToExcel(wb, report, lang);

  if (options.includeAlternativePaths && report.alternativePaths.length > 0) {
    addAlternativePathsToExcel(wb, report, lang);
  }

  if (options.includeRawData) {
    addRawDataToExcel(wb, report, lang);
  }

  const fileName = `${report.executionSummary.tourName}_复盘报告.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function addExecutionSummaryToExcel(
  wb: XLSX.WorkBook,
  report: ReviewReport,
  lang: Language
): void {
  const summary = report.executionSummary;
  const data = [
    [t('tourName', lang), summary.tourName],
    [t('bandName', lang), summary.bandName || '-'],
    [t('tourDuration', lang), summary.tourDuration],
    [t('totalStops', lang), summary.totalStops],
    [t('completedStops', lang), summary.completedStops],
    [t('initialBudget', lang), summary.initialBudget],
    [t('finalCashFlow', lang), summary.finalCashFlow],
    [t('netProfit', lang), summary.netProfit],
    [t('riskLevel', lang), t(summary.riskLevel, lang)],
    [t('generatedAt', lang), report.generatedAt],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, t('executionSummary', lang));
}

function addFinancialOverviewToExcel(
  wb: XLSX.WorkBook,
  report: ReviewReport,
  lang: Language
): void {
  const financial = report.financialOverview;

  const summaryData = [
    [t('financialOverview', lang), ''],
    [t('totalRevenue', lang), financial.totalRevenue],
    [t('totalExpense', lang), financial.totalExpense],
    [t('netProfit', lang), financial.netProfit],
    [t('profitMargin', lang), financial.profitMargin],
    [],
    [t('revenueBreakdown', lang), '', ''],
    [t('category', lang), t('amount', lang), t('percentage', lang)],
    ...financial.revenueBreakdown.map((item) => [item.category, item.amount, item.percentage]),
    [],
    [t('expenseBreakdown', lang), '', ''],
    [t('category', lang), t('amount', lang), t('percentage', lang)],
    ...financial.expenseBreakdown.map((item) => [item.category, item.amount, item.percentage]),
    [],
    [lang === 'zh' ? '各站财务明细' : 'Per Stop Financials', '', '', '', ''],
    [t('city', lang), t('revenue', lang), t('expense', lang), t('profit', lang)],
    ...financial.perStopFinancials.map((item) => [
      item.city,
      item.revenue,
      item.expense,
      item.profit,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, ws, t('financialOverview', lang));
}

function addStopAnalysisToExcel(
  wb: XLSX.WorkBook,
  report: ReviewReport,
  lang: Language
): void {
  const data = [
    [
      t('city', lang),
      t('venue', lang),
      t('date', lang),
      t('attendanceRate', lang),
      t('profitPerAttendee', lang),
      t('merchConversionRate', lang),
      t('revenue', lang),
      t('expense', lang),
      t('profit', lang),
      t('performanceRating', lang),
      lang === 'zh' ? '关键洞察' : 'Key Insights',
    ],
    ...report.stopAnalysis.map((item: StopAnalysis) => [
      item.stop.city,
      item.stop.venue,
      item.stop.date,
      item.attendanceRate,
      item.profitPerAttendee,
      item.merchConversionRate,
      item.result.totalRevenue,
      item.result.totalExpense,
      item.result.netProfit,
      t(item.performanceRating, lang),
      item.keyInsights.join('; '),
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, t('stopAnalysis', lang));
}

function addRiskAnalysisToExcel(
  wb: XLSX.WorkBook,
  report: ReviewReport,
  lang: Language
): void {
  const risk = report.riskAnalysis;

  const data: (string | number)[][] = [
    [t('riskAnalysis', lang)],
    [t('totalRisks', lang), risk.totalRisks],
    [],
    [t('risksByType', lang), ''],
    [t('type', lang), t('count', lang) || '数量'],
    ...Object.entries(risk.risksByType).map(([type, count]) => [t(type, lang), count]),
    [],
    [t('risksBySeverity', lang), ''],
    [t('severity', lang), t('count', lang) || '数量'],
    ...Object.entries(risk.risksBySeverity).map(([severity, count]) => [
      t(severity, lang),
      count,
    ]),
    [],
    [t('highRiskEvents', lang)],
    [t('type', lang), t('severity', lang), t('description', lang), t('impact', lang)],
    ...risk.highRiskEvents.map((event: RiskEvent) => [
      t(event.type, lang),
      t(event.severity, lang),
      event.description,
      event.impact,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, t('riskAnalysis', lang));
}

function addDecisionAnalysisToExcel(
  wb: XLSX.WorkBook,
  report: ReviewReport,
  lang: Language
): void {
  const decision = report.decisionAnalysis;

  const data: (string | number)[][] = [
    [t('decisionAnalysis', lang)],
    [t('totalDecisions', lang), decision.totalDecisions],
    [t('averageImpact', lang), decision.averageImpact],
    [],
    [t('decisionsByType', lang), ''],
    [t('type', lang), t('count', lang) || '数量'],
    ...Object.entries(decision.decisionsByType).map(([type, count]) => [t(type, lang), count]),
    [],
    [t('decisionsByRiskLevel', lang), ''],
    [t('riskLevel', lang), t('count', lang) || '数量'],
    ...Object.entries(decision.decisionsByRiskLevel).map(([level, count]) => [
      t(level, lang),
      count,
    ]),
    [],
    [t('bestDecisions', lang)],
    [t('description', lang), t('impact', lang)],
    ...decision.bestDecisions.map((d: DecisionLog) => [d.description, d.outcome.actualImpact]),
    [],
    [t('worstDecisions', lang)],
    [t('description', lang), t('impact', lang)],
    ...decision.worstDecisions.map((d: DecisionLog) => [d.description, d.outcome.actualImpact]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, t('decisionAnalysis', lang));
}

function addRecommendationsToExcel(
  wb: XLSX.WorkBook,
  report: ReviewReport,
  lang: Language
): void {
  const data = [
    [
      t('priority', lang),
      t('recCategory', lang),
      t('recommendationTitle', lang),
      t('description', lang),
      t('actionableSteps', lang),
      t('expectedImpact', lang),
    ],
    ...report.recommendations.map((rec: Recommendation) => [
      t(rec.priority, lang),
      t(rec.category, lang),
      rec.title,
      rec.description,
      rec.actionableSteps.join('; '),
      rec.expectedImpact,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, t('recommendations', lang));
}

function addAlternativePathsToExcel(
  wb: XLSX.WorkBook,
  report: ReviewReport,
  lang: Language
): void {
  const data = [
    [
      lang === 'zh' ? '决策点ID' : 'Decision Point ID',
      lang === 'zh' ? '站点ID' : 'Stop ID',
      lang === 'zh' ? '替代选项' : 'Alternative Option',
      lang === 'zh' ? '模拟最终现金流' : 'Simulated Final Cash Flow',
      lang === 'zh' ? '模拟净利润' : 'Simulated Net Profit',
      lang === 'zh' ? '是否成功' : 'Success',
    ],
    ...report.alternativePaths.map((alt) => [
      alt.decisionPointId,
      alt.stopId,
      alt.alternativeOptionName,
      alt.simulatedResult.finalCashFlow,
      alt.simulatedResult.netProfit,
      alt.simulatedResult.isSuccess ? t('success', lang) : t('failure', lang),
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const sheetName = lang === 'zh' ? '替代路径' : 'Alternative Paths';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
}

function addRawDataToExcel(
  wb: XLSX.WorkBook,
  report: ReviewReport,
  lang: Language
): void {
  const riskData = [
    [
      lang === 'zh' ? '风险ID' : 'Risk ID',
      lang === 'zh' ? '类型' : 'Type',
      lang === 'zh' ? '严重程度' : 'Severity',
      lang === 'zh' ? '描述' : 'Description',
      lang === 'zh' ? '影响' : 'Impact',
      lang === 'zh' ? '触发时间' : 'Triggered At',
      lang === 'zh' ? '解决时间' : 'Resolved At',
    ],
    ...report.riskAnalysis.highRiskEvents.map((event: RiskEvent) => [
      event.id,
      event.type,
      event.severity,
      event.description,
      event.impact,
      event.triggeredAt,
      event.resolvedAt || '',
    ]),
  ];

  const riskWs = XLSX.utils.aoa_to_sheet(riskData);
  XLSX.utils.book_append_sheet(wb, riskWs, lang === 'zh' ? '风险原始数据' : 'Raw Risk Data');
}

export { exportToPDF, exportToExcel };
