import { AuditReport, AuditResult } from './types';
import * as fs from 'fs';
import * as path from 'path';

export function exportToJSON(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}

export function exportToMarkdown(report: AuditReport): string {
  const lines: string[] = [];
  
  lines.push(`# 培训环境清单审核报告`);
  lines.push('');
  lines.push(`- **报告编号**: ${report.reportId}`);
  lines.push(`- **生成时间**: ${report.generatedAt}`);
  lines.push(`- **处理总数**: ${report.totalProcessed}`);
  lines.push(`- **拦截数量**: ${report.interceptedCount}`);
  lines.push(`- **通过数量**: ${report.approvedCount}`);
  lines.push('');
  
  lines.push(`## 处理摘要`);
  lines.push('');
  lines.push(`- **总处理时间**: ${report.summary.totalProcessingTime} ms`);
  lines.push(`- **平均处理时间**: ${report.summary.averageProcessingTime.toFixed(2)} ms`);
  lines.push('');
  
  if (report.summary.topInterceptionReasons.length > 0) {
    lines.push(`### 主要拦截原因`);
    lines.push('');
    lines.push('| 原因 | 次数 |');
    lines.push('|------|------|');
    for (const item of report.summary.topInterceptionReasons) {
      lines.push(`| ${item.reason} | ${item.count} |`);
    }
    lines.push('');
  }
  
  lines.push(`## 详细结果`);
  lines.push('');
  
  for (const result of report.results) {
    lines.push(`### ${result.submissionId} - ${result.submission.traineeName}`);
    lines.push('');
    lines.push(`- **部门**: ${result.submission.department}`);
    lines.push(`- **课程**: ${result.submission.courseName} (${result.submission.courseCode})`);
    lines.push(`- **状态变化**: ${result.beforeStatus} → ${result.afterStatus}`);
    lines.push(`- **处理时间**: ${result.processingTime} ms`);
    lines.push(`- **是否拦截**: ${result.isIntercepted ? '✅ 是' : '❌ 否'}`);
    lines.push('');
    
    if (result.isIntercepted && result.interceptionReasons.length > 0) {
      lines.push(`#### ❌ 拦截原因`);
      lines.push('');
      for (const reason of result.interceptionReasons) {
        const severityEmoji = reason.severity === 'high' ? '🔴' : reason.severity === 'medium' ? '🟡' : '🟢';
        lines.push(`${severityEmoji} **[${reason.code}] ${reason.description}**`);
        lines.push(`  - 类别: ${reason.category}`);
        lines.push(`  - 严重程度: ${reason.severity}`);
        lines.push(`  - 建议: ${reason.suggestion}`);
        lines.push('');
      }
    }
    
    lines.push(`#### 📋 下一步建议`);
    lines.push('');
    for (let i = 0; i < result.nextSteps.length; i++) {
      lines.push(`${i + 1}. ${result.nextSteps[i]}`);
    }
    lines.push('');
    
    if (result.candidateCleanupList.length > 0) {
      lines.push(`#### 🗑️ 清理/回滚候选清单`);
      lines.push('');
      lines.push('| ID | 类型 | 描述 | 原因 | 风险等级 |');
      lines.push('|----|------|------|------|----------|');
      for (const candidate of result.candidateCleanupList) {
        const riskEmoji = candidate.riskLevel === 'safe' ? '🟢' : candidate.riskLevel === 'caution' ? '🟡' : '🔴';
        lines.push(`| ${candidate.id} | ${candidate.type} | ${candidate.description} | ${candidate.reason} | ${riskEmoji} ${candidate.riskLevel} |`);
      }
      lines.push('');
    }
    
    if (result.reviewOpinions.length > 0) {
      lines.push(`#### 👁️ 复核意见追踪`);
      lines.push('');
      for (const opinion of result.reviewOpinions) {
        const opinionEmoji = opinion.opinion === 'agree' ? '✅' : opinion.opinion === 'disagree' ? '❌' : 'ℹ️';
        lines.push(`${opinionEmoji} **${opinion.reviewer}** (${opinion.timestamp})`);
        lines.push(`  - 意见: ${opinion.opinion}`);
        lines.push(`  - 评论: ${opinion.comments}`);
        lines.push(`  - 原始记录: ${opinion.originalRecordReference}`);
        lines.push('');
      }
    }
    
    lines.push('---');
    lines.push('');
  }
  
  return lines.join('\n');
}

export function saveToFile(content: string, filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function exportReport(report: AuditReport, format: 'json' | 'markdown', outputDir: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let content: string;
  let fileName: string;
  
  if (format === 'json') {
    content = exportToJSON(report);
    fileName = `audit-report-${timestamp}.json`;
  } else {
    content = exportToMarkdown(report);
    fileName = `audit-report-${timestamp}.md`;
  }
  
  const filePath = path.join(outputDir, fileName);
  saveToFile(content, filePath);
  return filePath;
}
