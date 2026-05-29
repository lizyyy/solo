import type { StudentWork, Anomaly, ScreeningReport, PortfolioScore, FilterCriteria } from '../types';
import { generateRecommendation } from './scoring';

export function generateScreeningReport(
  allWorks: StudentWork[],
  selectedWorks: StudentWork[],
  criteria: FilterCriteria,
  score: PortfolioScore,
  anomalies: Anomaly[]
): ScreeningReport {
  return {
    summary: {
      totalWorks: allWorks.length,
      selectedWorks: selectedWorks.length,
      overallScore: score.overall,
      anomalyCount: anomalies.length,
      recommendation: generateRecommendation(score, anomalies.length, selectedWorks.length)
    },
    details: selectedWorks,
    anomalies,
    exportedAt: new Date().toISOString()
  };
}

export function generateHumanReadableSummary(report: ScreeningReport, criteria: FilterCriteria): string {
  const date = new Date(report.exportedAt).toLocaleString('zh-CN');
  
  const lines: string[] = [];
  lines.push('='.repeat(60));
  lines.push('课程作品集筛选报告');
  lines.push('='.repeat(60));
  lines.push(`导出时间：${date}`);
  lines.push('');
  lines.push('【筛选条件】');
  if (criteria.tags.length > 0) lines.push(`  主题标签：${criteria.tags.join('、')}`);
  if (criteria.mediums.length > 0) lines.push(`  创作媒介：${criteria.mediums.join('、')}`);
  lines.push(`  最低完成度：${criteria.minCompletion} 星`);
  if (criteria.applicationDirection) lines.push(`  申请方向：${criteria.applicationDirection}`);
  lines.push('');
  lines.push('【统计概览】');
  lines.push(`  作品总数：${report.summary.totalWorks} 件`);
  lines.push(`  入选作品：${report.summary.selectedWorks} 件`);
  lines.push(`  综合评分：${report.summary.overallScore} / 100`);
  lines.push(`  异常数量：${report.summary.anomalyCount} 项`);
  lines.push('');
  lines.push('【评估建议】');
  lines.push(`  ${report.summary.recommendation}`);
  lines.push('');

  if (report.details.length > 0) {
    lines.push('【入选作品清单】');
    report.details.forEach((work, index) => {
      const completionStars = '★'.repeat(work.completion) + '☆'.repeat(5 - work.completion);
      const copyrightStatus = work.copyright.hasClearance ? '✓' : '✗ 缺版权';
      lines.push(`  ${index + 1}. ${work.title}`);
      lines.push(`     学生：${work.studentName} | 完成度：${completionStars} | 版权：${copyrightStatus}`);
      lines.push(`     主题：${work.tags.join('、')}`);
      lines.push(`     媒介：${work.mediums.join('、')}`);
      if (work.applicationDirection.length > 0) {
        lines.push(`     适配方向：${work.applicationDirection.join('、')}`);
      }
      lines.push('');
    });
  }

  if (report.anomalies.length > 0) {
    lines.push('【异常清单】');
    report.anomalies.forEach((anomaly, index) => {
      const severityText = anomaly.severity === 'critical' ? '【严重】' : '【警告】';
      lines.push(`  ${index + 1}. ${severityText} ${anomaly.description}`);
      const relatedTitles = anomaly.relatedWorkIds
        .map(id => report.details.find(w => w.id === id)?.title || id)
        .join('、');
      lines.push(`     关联作品：${relatedTitles}`);
      lines.push('');
    });
  }

  lines.push('='.repeat(60));
  lines.push('报告结束');
  lines.push('='.repeat(60));

  return lines.join('\n');
}

export function generateStructuredData(report: ScreeningReport): string {
  const structured = {
    metadata: {
      exportedAt: report.exportedAt,
      version: '1.0'
    },
    summary: report.summary,
    works: report.details.map(work => ({
      id: work.id,
      title: work.title,
      studentName: work.studentName,
      tags: work.tags,
      mediums: work.mediums,
      completion: work.completion,
      applicationDirection: work.applicationDirection,
      copyright: work.copyright,
      thumbnail: work.thumbnail,
      sourceMaterialCount: work.sourceMaterials.length
    })),
    anomalies: report.anomalies.map(a => ({
      type: a.type,
      severity: a.severity,
      description: a.description,
      relatedWorkIds: a.relatedWorkIds
    }))
  };

  return JSON.stringify(structured, null, 2);
}

export function generateCSV(works: StudentWork[]): string {
  const headers = ['ID', '标题', '学生姓名', '主题标签', '创作媒介', '完成度', '适配方向', '版权状态', '版权说明'];
  const rows = works.map(work => [
    work.id,
    `"${work.title.replace(/"/g, '""')}"`,
    work.studentName,
    `"${work.tags.join('; ')}"`,
    `"${work.mediums.join('; ')}"`,
    work.completion,
    `"${work.applicationDirection.join('; ')}"`,
    work.copyright.hasClearance ? '已授权' : '待确认',
    `"${(work.copyright.notes || work.copyright.source).replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportReportAsText(report: ScreeningReport, criteria: FilterCriteria): void {
  const content = generateHumanReadableSummary(report, criteria);
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadFile(content, `作品集筛选报告_${timestamp}.txt`, 'text/plain;charset=utf-8');
}

export function exportReportAsJSON(report: ScreeningReport): void {
  const content = generateStructuredData(report);
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadFile(content, `作品集筛选数据_${timestamp}.json`, 'application/json;charset=utf-8');
}

export function exportReportAsCSV(works: StudentWork[]): void {
  const content = generateCSV(works);
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadFile(content, `作品集明细_${timestamp}.csv`, 'text/csv;charset=utf-8');
}
