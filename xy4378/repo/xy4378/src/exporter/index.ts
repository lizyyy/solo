import * as fs from 'fs';
import * as path from 'path';
import { Issue, IssueStatus, IssueType, Severity } from '../types';
import { getIssueTypeLabel, getSeverityLabel } from '../utils';

export interface ExportOptions {
  includeResolved?: boolean;
  includeIgnored?: boolean;
  includeFalsePositives?: boolean;
}

export class Exporter {
  private filterIssues(issues: Issue[], options: ExportOptions = {}): Issue[] {
    return issues.filter(issue => {
      if (!options.includeResolved && issue.status === 'resolved') {
        return false;
      }
      if (!options.includeIgnored && issue.status === 'ignored') {
        return false;
      }
      if (!options.includeFalsePositives && issue.falsePositive) {
        return false;
      }
      return true;
    });
  }

  exportToMarkdown(
    issues: Issue[],
    outputPath: string,
    options: ExportOptions = {},
    projectInfo?: {
      projectName?: string;
      scanDate?: string;
      locales?: string[];
      totalKeys?: number;
    }
  ): void {
    const filteredIssues = this.filterIssues(issues, options);
    
    const stats = this.calculateStats(filteredIssues);
    const groupedByType = this.groupByType(filteredIssues);
    const groupedBySeverity = this.groupBySeverity(filteredIssues);

    let markdown = `# i18n 文案体检报告\n\n`;
    
    if (projectInfo) {
      markdown += `## 扫描信息\n\n`;
      if (projectInfo.projectName) {
        markdown += `- **项目**: ${projectInfo.projectName}\n`;
      }
      if (projectInfo.scanDate) {
        markdown += `- **扫描时间**: ${projectInfo.scanDate}\n`;
      }
      if (projectInfo.locales) {
        markdown += `- **扫描语言**: ${projectInfo.locales.join(', ')}\n`;
      }
      if (projectInfo.totalKeys !== undefined) {
        markdown += `- **总 Key 数**: ${projectInfo.totalKeys}\n`;
      }
      markdown += `\n`;
    }

    markdown += `## 问题统计\n\n`;
    markdown += `- **总问题数**: ${stats.total}\n`;
    markdown += `- **严重**: ${stats.bySeverity.critical}\n`;
    markdown += `- **高**: ${stats.bySeverity.high}\n`;
    markdown += `- **中**: ${stats.bySeverity.medium}\n`;
    markdown += `- **低**: ${stats.bySeverity.low}\n\n`;

    markdown += `## 问题分布\n\n`;

    for (const [severity, sevIssues] of Object.entries(groupedBySeverity)) {
      if (sevIssues.length === 0) continue;
      
      const severityLabel = getSeverityLabel(severity);
      markdown += `### ${severityLabel} (${sevIssues.length})\n\n`;

      for (const [type, typeIssues] of Object.entries(this.groupByType(sevIssues))) {
        if (typeIssues.length === 0) continue;
        
        const typeLabel = getIssueTypeLabel(type);
        markdown += `#### ${typeLabel} (${typeIssues.length})\n\n`;

        for (const issue of typeIssues) {
          markdown += `**${issue.key || 'N/A'}**\n\n`;
          markdown += `- 状态: ${issue.status}\n`;
          markdown += `- 信息: ${issue.message}\n`;
          
          if (issue.locale) {
            markdown += `- 语言: ${issue.locale.toUpperCase()}\n`;
          }
          
          if (issue.sourceFile) {
            markdown += `- 位置: ${issue.sourceFile}`;
            if (issue.line) {
              markdown += `:${issue.line}`;
            }
            markdown += `\n`;
          }

          if (issue.placeholderInfo) {
            markdown += `- 期望占位符: ${issue.placeholderInfo.expected.join(', ')}\n`;
            markdown += `- 实际占位符: ${issue.placeholderInfo.actual.join(', ')}\n`;
          }

          if (issue.pluralInfo) {
            markdown += `- 期望复数形式: ${issue.pluralInfo.expectedForms.join(', ')}\n`;
            markdown += `- 实际复数形式: ${issue.pluralInfo.actualForms.join(', ')}\n`;
          }

          if (issue.notes) {
            markdown += `- 备注: ${issue.notes}\n`;
          }

          if (issue.fixSuggestion) {
            markdown += `- 修复建议: ${issue.fixSuggestion}\n`;
          }

          if (issue.falsePositive) {
            markdown += `- ⚠️ 标记为误报\n`;
          }

          markdown += `\n`;
        }
      }
    }

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, markdown, 'utf-8');
    console.log(`Markdown 报告已导出到: ${outputPath}`);
  }

  exportToJson(
    issues: Issue[],
    outputPath: string,
    options: ExportOptions = {}
  ): void {
    const filteredIssues = this.filterIssues(issues, options);
    
    const exportData = {
      exportDate: new Date().toISOString(),
      totalIssues: filteredIssues.length,
      issues: filteredIssues.map(issue => ({
        id: issue.id,
        type: issue.type,
        severity: issue.severity,
        key: issue.key,
        message: issue.message,
        locale: issue.locale,
        sourceFile: issue.sourceFile,
        line: issue.line,
        column: issue.column,
        status: issue.status,
        falsePositive: issue.falsePositive,
        notes: issue.notes,
        fixSuggestion: issue.fixSuggestion,
        placeholderInfo: issue.placeholderInfo,
        pluralInfo: issue.pluralInfo,
      })),
    };

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
    console.log(`JSON 报告已导出到: ${outputPath}`);
  }

  exportPatchDraft(
    issues: Issue[],
    outputPath: string,
    options: ExportOptions = {}
  ): void {
    const filteredIssues = this.filterIssues(issues, {
      ...options,
      includeFalsePositives: false,
    });

    let patchContent = `# i18n 修复补丁草稿\n`;
    patchContent += `# 生成时间: ${new Date().toISOString()}\n\n`;

    const localeIssues: Record<string, Issue[]> = {};
    const hardcodedIssues: Issue[] = [];

    for (const issue of filteredIssues) {
      if (issue.type === 'hardcoded_chinese') {
        hardcodedIssues.push(issue);
      } else if (issue.locale) {
        if (!localeIssues[issue.locale]) {
          localeIssues[issue.locale] = [];
        }
        localeIssues[issue.locale].push(issue);
      }
    }

    for (const [locale, localeIssueList] of Object.entries(localeIssues)) {
      patchContent += `## ${locale.toUpperCase()} 语言包\n\n`;
      patchContent += `### 需要添加/修复的 Key\n\n`;

      const groupedByKey: Record<string, Issue[]> = {};
      for (const issue of localeIssueList) {
        if (issue.key) {
          if (!groupedByKey[issue.key]) {
            groupedByKey[issue.key] = [];
          }
          groupedByKey[issue.key].push(issue);
        }
      }

      for (const [key, keyIssues] of Object.entries(groupedByKey)) {
        patchContent += `#### ${key}\n\n`;
        
        for (const issue of keyIssues) {
          patchContent += `- **${getIssueTypeLabel(issue.type)}**: ${issue.message}\n`;
          
          if (issue.fixSuggestion) {
            patchContent += `  修复建议: ${issue.fixSuggestion}\n`;
          }
          
          if (issue.placeholderInfo) {
            patchContent += `  期望占位符: ${issue.placeholderInfo.expected.join(', ')}\n`;
            patchContent += `  实际占位符: ${issue.placeholderInfo.actual.join(', ')}\n`;
          }
          
          if (issue.pluralInfo) {
            patchContent += `  期望复数形式: ${issue.pluralInfo.expectedForms.join(', ')}\n`;
            patchContent += `  实际复数形式: ${issue.pluralInfo.actualForms.join(', ')}\n`;
          }
        }
        patchContent += `\n`;
      }
    }

    if (hardcodedIssues.length > 0) {
      patchContent += `## 硬编码中文\n\n`;
      patchContent += `以下位置发现硬编码中文，请提取到语言包中：\n\n`;

      const groupedByFile: Record<string, Issue[]> = {};
      for (const issue of hardcodedIssues) {
        if (issue.sourceFile) {
          if (!groupedByFile[issue.sourceFile]) {
            groupedByFile[issue.sourceFile] = [];
          }
          groupedByFile[issue.sourceFile].push(issue);
        }
      }

      for (const [file, fileIssues] of Object.entries(groupedByFile)) {
        patchContent += `### ${file}\n\n`;
        
        for (const issue of fileIssues) {
          patchContent += `- 行 ${issue.line || 'N/A'}: "${issue.message}"\n`;
          
          if (issue.context) {
            patchContent += `\`\`\`\n${issue.context}\n\`\`\`\n`;
          }
          patchContent += `\n`;
        }
      }
    }

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, patchContent, 'utf-8');
    console.log(`补丁草稿已导出到: ${outputPath}`);
  }

  private calculateStats(issues: Issue[]) {
    const stats = {
      total: issues.length,
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0 } as Record<Severity, number>,
      byType: {} as Record<IssueType, number>,
      byStatus: { open: 0, acknowledged: 0, resolved: 0, ignored: 0 } as Record<IssueStatus, number>,
    };

    for (const issue of issues) {
      if (stats.bySeverity[issue.severity] !== undefined) {
        stats.bySeverity[issue.severity]++;
      }
      stats.byType[issue.type] = (stats.byType[issue.type] || 0) + 1;
      if (stats.byStatus[issue.status] !== undefined) {
        stats.byStatus[issue.status]++;
      }
    }

    return stats;
  }

  private groupByType(issues: Issue[]): Record<IssueType, Issue[]> {
    const grouped: Record<string, Issue[]> = {};
    for (const issue of issues) {
      if (!grouped[issue.type]) {
        grouped[issue.type] = [];
      }
      grouped[issue.type].push(issue);
    }
    return grouped as Record<IssueType, Issue[]>;
  }

  private groupBySeverity(issues: Issue[]): Record<Severity, Issue[]> {
    const grouped: Record<string, Issue[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };
    for (const issue of issues) {
      if (grouped[issue.severity]) {
        grouped[issue.severity].push(issue);
      }
    }
    return grouped as Record<Severity, Issue[]>;
  }
}
