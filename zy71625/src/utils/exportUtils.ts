import { jsPDF } from 'jspdf';
import Papa from 'papaparse';
import { RepairReport, STEPS, ERROR_TYPE_INFO, NOISE_TYPE_INFO, CLEANER_INFO } from '../types';

export const exportToPDF = (report: RepairReport): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('黑胶唱片修复报告', pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`会话ID: ${report.sessionId}`, margin, y);
  y += 6;
  doc.text(`导出时间: ${new Date(report.exportTime).toLocaleString('zh-CN')}`, margin, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('唱片信息', margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`唱片名称: ${report.recordInfo.title}`, margin + 5, y);
  y += 6;
  doc.text(`艺术家: ${report.recordInfo.artist}`, margin + 5, y);
  y += 6;
  doc.text(`品相: ${report.recordInfo.condition}`, margin + 5, y);
  y += 6;
  doc.text(`难度等级: ${report.recordInfo.difficulty}`, margin + 5, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('评分与错误统计', margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`最终音质评分: ${report.qualityScore.toFixed(1)} / 100`, margin + 5, y);
  y += 8;

  Object.entries(ERROR_TYPE_INFO).forEach(([key, info]) => {
    const countKey = key === 'scratch_misjudgment'
      ? 'scratchMisjudgment'
      : key === 'over_cleaning'
        ? 'overCleaning'
        : 'missingListeningRecord';
    const count = report.errorSummary[countKey as keyof typeof report.errorSummary];
    doc.text(`${info.name}: ${count}次`, margin + 5, y);
    y += 6;
  });

  y += 4;
  if (report.filterOptions.errorTypes.length > 0 || report.filterOptions.dataSources.length > 0) {
    doc.setFont('helvetica', 'italic');
    doc.text('* 以下内容已按筛选条件过滤', margin, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('修复步骤详情', margin, y);
  y += 8;

  report.steps.forEach((step, index) => {
    if (y > 250) {
      doc.addPage();
      y = margin;
    }

    const stepInfo = STEPS.find(s => s.type === step.type);
    const dataSourceLabel = step.dataSource === 'system' ? '[系统数据]' : '[人工备注]';
    const dataSourceColor = step.dataSource === 'system' ? '#2196F3' : '#FF9800';

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(
      parseInt(dataSourceColor.slice(1, 3), 16),
      parseInt(dataSourceColor.slice(3, 5), 16),
      parseInt(dataSourceColor.slice(5, 7), 16)
    );
    doc.text(`${index + 1}. ${stepInfo?.name || step.type} ${dataSourceLabel}`, margin, y);
    y += 6;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.text(`   时间: ${new Date(step.timestamp).toLocaleString('zh-CN')}`, margin + 5, y);
    y += 6;
    doc.text(`   结果: ${step.isCorrect ? '✓ 正确' : '✗ 错误'}`, margin + 5, y);
    y += 6;

    if (step.params.result?.errorDescription) {
      doc.setTextColor(192, 57, 43);
      doc.text(`   错误: ${step.params.result.errorDescription}`, margin + 5, y);
      y += 6;
      doc.setTextColor(0, 0, 0);
    }

    if (step.snapshot.qualityScore !== undefined) {
      doc.text(`   当时评分: ${step.snapshot.qualityScore.toFixed(1)}`, margin + 5, y);
      y += 6;
    }

    y += 4;
  });

  if (report.dataSourceMarks.length > 0) {
    if (y > 240) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('数据来源标注', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    report.dataSourceMarks.forEach(mark => {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }
      const color = mark.dataSource === 'system' ? '#2196F3' : '#FF9800';
      doc.setTextColor(
        parseInt(color.slice(1, 3), 16),
        parseInt(color.slice(3, 5), 16),
        parseInt(color.slice(5, 7), 16)
      );
      doc.text(`[${mark.dataSource === 'system' ? '系统' : '人工'}] ${mark.content}`, margin + 5, y);
      y += 6;
    });
  }

  doc.setTextColor(0, 0, 0);
  doc.save(`修复报告_${report.sessionId}_${Date.now()}.pdf`);
};

export const exportToCSV = (report: RepairReport): void => {
  const csvData = report.steps.map((step, index) => {
    const stepInfo = STEPS.find(s => s.type === step.type);
    const errorInfo = step.params.result?.errorType
      ? ERROR_TYPE_INFO[step.params.result.errorType]
      : null;

    return {
      序号: index + 1,
      步骤名称: stepInfo?.name || step.type,
      时间: new Date(step.timestamp).toLocaleString('zh-CN'),
      数据来源: step.dataSource === 'system' ? '系统数据' : '人工备注',
      操作结果: step.isCorrect ? '正确' : '错误',
      错误类型: errorInfo?.name || '',
      错误描述: step.params.result?.errorDescription || '',
      当时音质评分: step.snapshot.qualityScore?.toFixed(1) || '',
      当时顾客耐心: step.snapshot.customerPatience?.toFixed(1) || '',
      参数: JSON.stringify(step.params),
    };
  });

  const summaryRow = {
    序号: '统计',
    步骤名称: `最终评分: ${report.qualityScore.toFixed(1)}`,
    时间: '',
    数据来源: '',
    操作结果: '',
    错误类型: `划痕误判: ${report.errorSummary.scratchMisjudgment}, 清洗过度: ${report.errorSummary.overCleaning}, 试听漏记录: ${report.errorSummary.missingListeningRecord}`,
    错误描述: '',
    当时音质评分: '',
    当时顾客耐心: '',
    参数: '',
  };

  csvData.push(summaryRow as any);

  const csv = Papa.unparse(csvData);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `修复报告_${report.sessionId}_${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const getFilteredSteps = (
  steps: any[],
  filters: any
): any[] => {
  return steps.filter(step => {
    if (filters.timeRange) {
      const [start, end] = filters.timeRange;
      if (step.timestamp < start || step.timestamp > end) return false;
    }

    if (filters.errorTypes?.length > 0) {
      const stepErrorType = step.params.result?.errorType;
      if (!filters.errorTypes.includes(stepErrorType) && !step.isCorrect) return false;
    }

    if (filters.dataSources?.length > 0) {
      if (!filters.dataSources.includes(step.dataSource)) return false;
    }

    if (filters.stepTypes?.length > 0) {
      if (!filters.stepTypes.includes(step.type)) return false;
    }

    return true;
  });
};

export const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const formatDuration = (start: number, end: number): string => {
  const diff = Math.abs(end - start) / 1000;
  const minutes = Math.floor(diff / 60);
  const seconds = Math.floor(diff % 60);
  return `${minutes}分${seconds}秒`;
};

export const getQualityScoreColor = (score: number): string => {
  if (score >= 80) return '#27AE60';
  if (score >= 60) return '#F1C40F';
  if (score >= 40) return '#E67E22';
  return '#C0392B';
};

export const getPatienceColor = (patience: number): string => {
  if (patience >= 70) return '#27AE60';
  if (patience >= 40) return '#F1C40F';
  return '#C0392B';
};
