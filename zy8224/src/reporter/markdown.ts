import * as fs from 'fs';
import * as path from 'path';
import { Report, Issue, IssueCategory, WorkflowSummary } from '../types';

export class MarkdownReporter {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async exportReport(report: Report): Promise<string> {
    await this.ensureOutputDir();
    
    const markdown = this.generateReport(report);
    const outputPath = path.join(this.outputDir, 'release_guard_report.md');
    
    await fs.promises.writeFile(outputPath, markdown, 'utf-8');
    return outputPath;
  }

  private generateReport(report: Report): string {
    const sections: string[] = [];

    sections.push(this.generateHeader(report));
    sections.push(this.generateSummary(report));
    sections.push(this.generateIssueBreakdown(report.issues));
    
    const groupedIssues = this.groupIssuesByCategory(report.issues);
    for (const [category, issues] of Object.entries(groupedIssues)) {
      if (issues.length > 0) {
        sections.push(this.generateCategorySection(category as IssueCategory, issues));
      }
    }

    sections.push(this.generateWorkflowSummary(report.workflows));
    sections.push(this.generateMetadata(report));

    return sections.join('\n\n---\n\n');
  }

  private generateHeader(report: Report): string {
    const generatedAt = report.generatedAt.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai'
    });

    return `# GitHub Actions 发布预检报告

> 生成时间: ${generatedAt}
> 
> 工具版本: ${report.metadata.toolVersion}
`;
  }

  private generateSummary(report: Report): string {
    const { summary } = report;
    const totalIssues = summary.criticalIssues + summary.highIssues + 
                        summary.mediumIssues + summary.lowIssues;

    const statusBadge = summary.criticalIssues > 0 
      ? '![Status: BLOCKED](https://img.shields.io/badge/Status-BLOCKED-red)'
      : summary.highIssues > 0 
        ? '![Status: CAUTION](https://img.shields.io/badge/Status-CAUTION-yellow)'
        : '![Status: OK](https://img.shields.io/badge/Status-OK-green)';

    return `## 执行摘要

${statusBadge}

| 指标 | 数值 |
|------|------|
| 扫描的工作流 | ${summary.totalWorkflows} |
| 检测的 Job 数量 | ${summary.totalJobs} |
| **发现的问题总数** | **${totalIssues}** |
| 🔴 Critical | ${summary.criticalIssues} |
| 🟠 High | ${summary.highIssues} |
| 🟡 Medium | ${summary.mediumIssues} |
| 🟢 Low | ${summary.lowIssues} |
`;
  }

  private generateIssueBreakdown(issues: Issue[]): string {
    const categoryCount: Record<string, number> = {};
    
    for (const issue of issues) {
      const category = this.getCategoryName(issue.category);
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    }

    if (Object.keys(categoryCount).length === 0) {
      return `## 问题分类统计

✅ 未发现任何问题。
`;
    }

    const tableRows = Object.entries(categoryCount)
      .map(([category, count]) => `| ${category} | ${count} |`)
      .join('\n');

    return `## 问题分类统计

| 类别 | 数量 |
|------|------|
${tableRows}
`;
  }

  private generateCategorySection(category: IssueCategory, issues: Issue[]): string {
    const categoryName = this.getCategoryName(category);
    const icon = this.getCategoryIcon(category);

    const sortedIssues = [...issues].sort((a, b) => {
      const severityOrder: Record<string, number> = {
        'critical': 0,
        'high': 1,
        'medium': 2,
        'low': 3
      };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    const issueDetails = sortedIssues.map(issue => {
      const severityIcon = this.getSeverityIcon(issue.severity);
      const location = this.formatLocation(issue);
      
      return `### ${severityIcon} ${issue.title}

**ID**: ${issue.id}  
**工作流**: ${issue.workflow}  
${issue.job ? `**Job**: ${issue.job}\n` : ''}${issue.step ? `**Step**: ${issue.step}\n` : ''}**严重程度**: ${issue.severity.toUpperCase()}  
${location}

**描述**:  
${issue.description}

${issue.remediation ? `**建议修复**:  
${issue.remediation}\n` : ''}`;
    }).join('\n\n---\n\n');

    return `## ${icon} ${categoryName} (${issues.length})

${issueDetails}
`;
  }

  private generateWorkflowSummary(workflows: WorkflowSummary[]): string {
    if (workflows.length === 0) {
      return `## 工作流概览

未扫描到任何工作流。
`;
    }

    const tableRows = workflows.map(wf => {
      const triggers = wf.triggerTypes.map(t => this.formatTriggerType(t)).join(', ');
      const workflowCallBadge = wf.hasWorkflowCall ? ' ✅' : '';
      const environments = wf.environments.length > 0 
        ? wf.environments.join(', ') 
        : '-';

      return `| ${wf.name} | \`${wf.filename}\` | ${wf.jobCount} | ${triggers} | ${environments} |${workflowCallBadge} |`;
    }).join('\n');

    return `## 工作流概览

| 工作流名称 | 文件名 | Job 数 | 触发类型 | 使用的环境 | Workflow Call |
|------------|--------|--------|----------|------------|---------------|
${tableRows}

> 注意: "Workflow Call" 列表示该工作流是可复用的 (workflow_call) 或使用了可复用工作流。
`;
  }

  private generateMetadata(report: Report): string {
    const configFiles = report.metadata.configFiles;
    const configList: string[] = [];

    if (configFiles.environments) {
      configList.push(`- 环境清单: \`${configFiles.environments}\``);
    }
    if (configFiles.secretWhitelist) {
      configList.push(`- Secret 白名单: \`${configFiles.secretWhitelist}\``);
    }
    if (configFiles.approvalRules) {
      configList.push(`- 审批规则: \`${configFiles.approvalRules}\``);
    }

    return `## 扫描元数据

**扫描目录**: \`${report.metadata.scanDirectory}\`

**使用的配置文件**:
${configList.length > 0 ? configList.join('\n') : '- 未使用配置文件 (使用默认规则)'}

---

*此报告由 gh-actions-guard 工具生成。*
`;
  }

  private groupIssuesByCategory(issues: Issue[]): Record<IssueCategory, Issue[]> {
    const grouped: Record<IssueCategory, Issue[]> = {
      'secret_exposure': [],
      'matrix_coverage': [],
      'concurrency_conflict': [],
      'artifact_expiration': [],
      'approval_missing': []
    };

    for (const issue of issues) {
      if (grouped[issue.category]) {
        grouped[issue.category].push(issue);
      }
    }

    return grouped;
  }

  private getCategoryName(category: IssueCategory): string {
    const names: Record<IssueCategory, string> = {
      'secret_exposure': 'Secret 暴露风险',
      'matrix_coverage': 'Matrix 覆盖问题',
      'concurrency_conflict': '并发组冲突',
      'artifact_expiration': 'Artifact 过期配置',
      'approval_missing': '审批规则缺失'
    };
    return names[category] || category;
  }

  private getCategoryIcon(category: IssueCategory): string {
    const icons: Record<IssueCategory, string> = {
      'secret_exposure': '🔐',
      'matrix_coverage': '🔢',
      'concurrency_conflict': '🔄',
      'artifact_expiration': '📦',
      'approval_missing': '✅'
    };
    return icons[category] || '📋';
  }

  private getSeverityIcon(severity: string): string {
    const icons: Record<string, string> = {
      'critical': '🔴',
      'high': '🟠',
      'medium': '🟡',
      'low': '🟢'
    };
    return icons[severity] || '⚪';
  }

  private formatTriggerType(trigger: string): string {
    const icons: Record<string, string> = {
      'push': '📤',
      'pull_request': '🔀',
      'workflow_dispatch': '🖱️',
      'schedule': '⏰',
      'workflow_call': '🔗',
      'repository_dispatch': '📡'
    };
    return `${icons[trigger] || ''} ${trigger}`;
  }

  private formatLocation(issue: Issue): string {
    if (issue.location?.line) {
      return `**位置**: 行 ${issue.location.line}`;
    }
    return '';
  }

  private async ensureOutputDir(): Promise<void> {
    try {
      await fs.promises.access(this.outputDir);
    } catch {
      await fs.promises.mkdir(this.outputDir, { recursive: true });
    }
  }
}
