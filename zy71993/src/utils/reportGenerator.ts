import type { VerificationResult, VerificationIssue } from '@/types';
import { SEVERITY_LABEL, ISSUE_TYPE_LABEL } from '@/types';

export function generateReport(result: VerificationResult): string {
  const lines: string[] = [];

  lines.push(`# 本地备份核验报告`);
  lines.push('');
  lines.push(`**机器**: ${result.machineId}`);
  lines.push(`**核验时间**: ${new Date(result.timestamp).toLocaleString('zh-CN')}`);
  lines.push(`**总备份包**: ${result.summary.total} | 正常: ${result.summary.normal} | 异常: ${result.summary.total - result.summary.normal}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  const bySeverity = groupBySeverity(result.issues);

  lines.push(`## 🔴 必须研发介入 (${(bySeverity.dev_required || []).length})`);
  lines.push('');
  renderGroup(lines, bySeverity.dev_required || []);

  lines.push(`## 🟠 需补备份 (${(bySeverity.needs_backup || []).length})`);
  lines.push('');
  renderGroup(lines, bySeverity.needs_backup || []);

  lines.push(`## 🟡 可忽略 (${(bySeverity.ignorable || []).length})`);
  lines.push('');
  renderGroup(lines, bySeverity.ignorable || []);

  lines.push('---');
  lines.push('');
  lines.push(`_报告生成时间: ${new Date().toLocaleString('zh-CN')}_`);

  return lines.join('\n');
}

function groupBySeverity(issues: VerificationIssue[]): Record<string, VerificationIssue[]> {
  const groups: Record<string, VerificationIssue[]> = {
    dev_required: [],
    needs_backup: [],
    ignorable: [],
  };
  for (const issue of issues) {
    groups[issue.severity]?.push(issue);
  }
  return groups;
}

function renderGroup(lines: string[], issues: VerificationIssue[]): void {
  if (issues.length === 0) {
    lines.push('_无_');
    lines.push('');
    return;
  }

  for (const issue of issues) {
    lines.push(`### [${ISSUE_TYPE_LABEL[issue.type]}] ${issue.description}`);
    lines.push(`- **路径**: \`${issue.path}\``);
    if (issue.detail.expectedChecksum && issue.detail.actualChecksum) {
      lines.push(`- **期望校验值**: \`${issue.detail.expectedChecksum}\``);
      lines.push(`- **实际校验值**: \`${issue.detail.actualChecksum}\``);
    }
    if (issue.detail.duplicateTimestamps) {
      lines.push(`- **重复时间点**: ${issue.detail.duplicateTimestamps.join(', ')}`);
    }
    if (issue.detail.rollbackTimestamp) {
      lines.push(`- **回滚时间**: ${issue.detail.rollbackTimestamp}`);
    }
    if (issue.relatedLogSnippet) {
      lines.push('- **相关日志**:');
      lines.push('```');
      lines.push(issue.relatedLogSnippet);
      lines.push('```');
    }
    lines.push('');
  }
}
