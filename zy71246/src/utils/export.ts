import type { MissionReport } from '../types/mission';

export function exportMissionReport(report: MissionReport): string {
  const dataStr = JSON.stringify(report, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `mission-report-${report.missionId}.json`;
  link.click();
  
  URL.revokeObjectURL(url);
  
  return url;
}

export function exportMissionReportAsText(report: MissionReport): string {
  const lines: string[] = [];
  
  lines.push('='.repeat(60));
  lines.push('航天测控任务报告');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`任务名称: ${report.missionName}`);
  lines.push(`任务ID: ${report.missionId}`);
  lines.push(`开始时间: ${new Date(report.startTime).toLocaleString('zh-CN')}`);
  lines.push(`结束时间: ${new Date(report.endTime).toLocaleString('zh-CN')}`);
  lines.push(`最终得分: ${report.finalScore} / ${report.maxScore}`);
  lines.push(`任务评级: ${report.grade}`);
  lines.push('');
  
  lines.push('-'.repeat(60));
  lines.push('一、得分明细');
  lines.push('-'.repeat(60));
  lines.push('');
  
  report.scoreDetails.forEach(detail => {
    lines.push(`【${detail.category}】 ${detail.earnedScore} / ${detail.maxScore}分`);
    lines.push(`  ${detail.description}`);
    detail.breakdown.forEach(item => {
      lines.push(`    • ${item.label}: ${item.value} / ${item.maxValue}`);
    });
    lines.push('');
  });
  
  lines.push('-'.repeat(60));
  lines.push('二、事件汇总');
  lines.push('-'.repeat(60));
  lines.push('');
  lines.push(`总事件数: ${report.eventSummary.totalEvents}`);
  lines.push('');
  lines.push('错误统计:');
  Object.entries(report.eventSummary.errorsByType).forEach(([type, count]) => {
    lines.push(`  • ${type}: ${count}次`);
  });
  lines.push('');
  
  if (report.eventSummary.criticalErrors.length > 0) {
    lines.push('严重错误:');
    report.eventSummary.criticalErrors.forEach(err => {
      lines.push(`  ! ${err}`);
    });
    lines.push('');
  }
  
  lines.push('-'.repeat(60));
  lines.push('三、性能指标');
  lines.push('-'.repeat(60));
  lines.push('');
  lines.push(`数据下载成功率: ${report.performanceMetrics.dataDownloadRate.toFixed(1)}%`);
  lines.push(`指令发送成功率: ${report.performanceMetrics.commandSuccessRate.toFixed(1)}%`);
  lines.push(`窗口利用率: ${report.performanceMetrics.windowUtilization.toFixed(1)}%`);
  lines.push(`资源效率: ${report.performanceMetrics.resourceEfficiency.toFixed(1)}%`);
  lines.push('');
  
  lines.push('-'.repeat(60));
  lines.push('四、改进建议');
  lines.push('-'.repeat(60));
  lines.push('');
  report.recommendations.forEach((rec, index) => {
    lines.push(`${index + 1}. ${rec}`);
  });
  lines.push('');
  
  lines.push('-'.repeat(60));
  lines.push('五、事件时间线');
  lines.push('-'.repeat(60));
  lines.push('');
  
  report.timelineData.forEach(event => {
    const time = new Date(event.timestamp).toLocaleTimeString('zh-CN');
    const severityIcon = {
      info: 'ℹ',
      warning: '⚠',
      error: '✗',
      critical: '✖',
    }[event.severity];
    lines.push(`${time} ${severityIcon} ${event.message}`);
  });
  
  lines.push('');
  lines.push('='.repeat(60));
  lines.push('报告结束');
  lines.push('='.repeat(60));
  
  const text = lines.join('\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `mission-report-${report.missionId}.txt`;
  link.click();
  
  URL.revokeObjectURL(url);
  
  return text;
}

export function loadSavedReports(): MissionReport[] {
  try {
    const saved = localStorage.getItem('mission-reports');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveReport(report: MissionReport): void {
  const reports = loadSavedReports();
  reports.unshift(report);
  const recentReports = reports.slice(0, 10);
  localStorage.setItem('mission-reports', JSON.stringify(recentReports));
}

export function loadReport(reportId: string): MissionReport | null {
  const reports = loadSavedReports();
  return reports.find(r => r.reportId === reportId) || null;
}

export function generateReportShareLink(report: MissionReport): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/report/${report.reportId}`;
}
