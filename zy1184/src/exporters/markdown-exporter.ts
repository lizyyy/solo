import {
  AnalysisResult,
  SimulationResult,
  Issue,
  IssueType,
  IssueSeverity,
} from '../models';

interface ExportOptions {
  includeSql?: boolean;
  includeSuggestions?: boolean;
}

function getIssueTypeLabel(type: IssueType): string {
  const labels: Record<IssueType, string> = {
    N_PLUS_1: 'N+1 查询',
    DUPLICATE_QUERY: '重复查询',
    DEEP_PAGINATION: '深分页',
    MISSING_PRELOAD: '缺失预加载',
    UNUSED_FIELDS: '无用字段',
    LARGE_RESULT_SET: '大结果集',
    MISSING_INDEX: '缺失索引',
    SLOW_QUERY: '慢查询',
  };
  return labels[type] || type;
}

function getSeverityLabel(severity: IssueSeverity): string {
  const labels: Record<IssueSeverity, string> = {
    CRITICAL: '严重',
    HIGH: '高',
    MEDIUM: '中',
    LOW: '低',
  };
  return labels[severity] || severity;
}

function getSeverityEmoji(severity: IssueSeverity): string {
  const emojis: Record<IssueSeverity, string> = {
    CRITICAL: '🔴',
    HIGH: '🟠',
    MEDIUM: '🟡',
    LOW: '🟢',
  };
  return emojis[severity] || '⚪';
}

export function exportMarkdown(
  analysisResults: AnalysisResult[],
  simulationResults?: SimulationResult[],
  options: ExportOptions = {}
): string {
  const { includeSql = false, includeSuggestions = true } = options;

  let markdown = '';

  markdown += `# ORM 查询性能分析报告\n\n`;
  markdown += `> 生成时间: ${new Date().toISOString()}\n\n`;

  const totalRequests = analysisResults.length;
  const totalQueries = analysisResults.reduce(
    (sum, r) => sum + r.requestGroup.totalQueryCount,
    0
  );
  const totalIssues = analysisResults.reduce(
    (sum, r) => sum + r.issues.length,
    0
  );

  markdown += `## 📊 概览\n\n`;
  markdown += `| 指标 | 数值 |\n`;
  markdown += `|------|------|\n`;
  markdown += `| 请求数 | ${totalRequests} |\n`;
  markdown += `| 查询数 | ${totalQueries} |\n`;
  markdown += `| 发现问题 | ${totalIssues} |\n\n`;

  if (totalIssues > 0) {
    const issuesByType: Record<string, number> = {};
    const issuesBySeverity: Record<string, number> = {};

    for (const result of analysisResults) {
      for (const issue of result.issues) {
        issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
        issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1;
      }
    }

    markdown += `## 🔍 问题统计\n\n`;

    markdown += `### 按类型分类\n\n`;
    markdown += `| 类型 | 数量 |\n`;
    markdown += `|------|------|\n`;
    for (const [type, count] of Object.entries(issuesByType)) {
      markdown += `| ${getIssueTypeLabel(type as IssueType)} | ${count} |\n`;
    }
    markdown += '\n';

    markdown += `### 按严重程度分类\n\n`;
    markdown += `| 严重程度 | 数量 |\n`;
    markdown += `|----------|------|\n`;
    for (const [severity, count] of Object.entries(issuesBySeverity)) {
      markdown += `| ${getSeverityEmoji(severity as IssueSeverity)} ${getSeverityLabel(severity as IssueSeverity)} | ${count} |\n`;
    }
    markdown += '\n';

    markdown += `## 📋 问题详情\n\n`;

    const allIssues: Issue[] = [];
    for (const result of analysisResults) {
      allIssues.push(...result.issues);
    }

    const sortedIssues = allIssues.sort((a, b) => {
      const severityOrder: Record<IssueSeverity, number> = {
        CRITICAL: 4,
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
      };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    for (const [index, issue] of sortedIssues.entries()) {
      markdown += `### ${getSeverityEmoji(issue.severity)} [${index + 1}] ${issue.title}\n\n`;
      
      markdown += `- **类型**: ${getIssueTypeLabel(issue.type)}\n`;
      markdown += `- **严重程度**: ${getSeverityLabel(issue.severity)}\n`;
      markdown += `- **请求 ID**: ${issue.requestId}\n`;
      markdown += `- **描述**: ${issue.description}\n\n`;

      if (includeSql && issue.evidence.queries.length > 0) {
        markdown += `#### 相关 SQL\n\n`;
        markdown += '```sql\n';
        for (const sql of issue.evidence.queries.slice(0, 5)) {
          markdown += `${sql}\n\n`;
        }
        if (issue.evidence.queries.length > 5) {
          markdown += `... 还有 ${issue.evidence.queries.length - 5} 个查询\n`;
        }
        markdown += '```\n\n';
      }

      if (includeSuggestions) {
        markdown += `#### 💡 优化建议\n\n`;
        markdown += `**${issue.suggestion.title}**\n\n`;
        markdown += `${issue.suggestion.description}\n\n`;

        if (issue.suggestion.codeExample) {
          markdown += `**代码示例:**\n\n`;
          markdown += '```typescript\n';
          markdown += issue.suggestion.codeExample;
          markdown += '\n```\n\n';
        }

        markdown += `**预期改进:**\n\n`;
        if (issue.suggestion.expectedImprovement.queryCountReduction) {
          markdown += `- 查询次数减少: ${issue.suggestion.expectedImprovement.queryCountReduction} 次\n`;
        }
        if (issue.suggestion.expectedImprovement.durationReductionPercent) {
          markdown += `- 耗时减少: ${issue.suggestion.expectedImprovement.durationReductionPercent}%\n`;
        }
        if (issue.suggestion.expectedImprovement.dataTransferReductionPercent) {
          markdown += `- 数据传输减少: ${issue.suggestion.expectedImprovement.dataTransferReductionPercent}%\n`;
        }
        markdown += '\n';
      }

      markdown += `---\n\n`;
    }
  }

  if (simulationResults && simulationResults.length > 0) {
    markdown += `## 🎯 优化效果模拟\n\n`;

    let totalQueryReduction = 0;
    let totalDurationReduction = 0;
    let totalDataReduction = 0;

    for (const result of simulationResults) {
      totalQueryReduction += result.comparison.improvement.queryCountReduction;
      totalDurationReduction += result.comparison.improvement.durationReductionMs;
      totalDataReduction += result.comparison.improvement.dataTransferReductionBytes;
    }

    markdown += `### 总览\n\n`;
    markdown += `| 指标 | 优化前 | 优化后 | 提升 |\n`;
    markdown += `|------|--------|--------|------|\n`;

    const firstResult = simulationResults[0];
    const originalTotalQueries = simulationResults.reduce(
      (sum, r) => sum + r.comparison.original.totalQueries,
      0
    );
    const optimizedTotalQueries = simulationResults.reduce(
      (sum, r) => sum + r.comparison.optimized.totalQueries,
      0
    );
    const originalDuration = simulationResults.reduce(
      (sum, r) => sum + r.comparison.original.totalDurationMs,
      0
    );
    const optimizedDuration = simulationResults.reduce(
      (sum, r) => sum + r.comparison.optimized.totalDurationMs,
      0
    );

    markdown += `| 查询次数 | ${originalTotalQueries} | ${optimizedTotalQueries} | ${totalQueryReduction} 次 |\n`;
    markdown += `| 耗时 (ms) | ${originalDuration.toFixed(2)} | ${optimizedDuration.toFixed(2)} | ${totalDurationReduction.toFixed(2)}ms |\n`;
    markdown += `| 数据传输 (KB) | ${(simulationResults.reduce((sum, r) => sum + r.comparison.original.totalDataTransferBytes, 0) / 1024).toFixed(2)} | ${(simulationResults.reduce((sum, r) => sum + r.comparison.optimized.totalDataTransferBytes, 0) / 1024).toFixed(2)} | ${(totalDataReduction / 1024).toFixed(2)}KB |\n\n`;

    if (simulationResults[0].optimizations.length > 0) {
      markdown += `### 优化措施\n\n`;

      for (const result of simulationResults) {
        for (const opt of result.optimizations) {
          markdown += `#### ${opt.title}\n\n`;
          markdown += `${opt.description}\n\n`;
          
          markdown += `**效果:**\n`;
          if (opt.impact.queryCountChange < 0) {
            markdown += `- 查询次数减少: ${Math.abs(opt.impact.queryCountChange)} 次 (${opt.impact.queryCountChangePercent}%)\n`;
          }
          if (opt.impact.durationChangeMs < 0) {
            markdown += `- 耗时减少: ${Math.abs(opt.impact.durationChangeMs).toFixed(2)}ms (${opt.impact.durationChangePercent}%)\n`;
          }
          if (opt.impact.dataTransferChangeBytes < 0) {
            markdown += `- 数据传输减少: ${Math.abs(opt.impact.dataTransferChangeBytes)} bytes (${opt.impact.dataTransferChangePercent}%)\n`;
          }
          markdown += '\n';
        }
      }
    }
  }

  markdown += `## 📝 附录\n\n`;
  markdown += `### 请求详情\n\n`;

  for (const result of analysisResults) {
    const group = result.requestGroup;
    markdown += `#### 请求 ${group.requestId}\n\n`;
    
    if (group.apiLog) {
      markdown += `- **路径**: ${group.apiLog.path}\n`;
      markdown += `- **方法**: ${group.apiLog.method}\n`;
      markdown += `- **状态码**: ${group.apiLog.statusCode}\n`;
      markdown += `- **总耗时**: ${group.apiLog.duration}ms\n`;
    }
    
    markdown += `- **查询次数**: ${group.totalQueryCount}\n`;
    markdown += `- **查询总耗时**: ${group.totalQueryDuration}ms\n`;
    markdown += `- **问题数**: ${result.issues.length}\n\n`;

    if (includeSql) {
      markdown += `**涉及的表:**\n`;
      const tables = Object.keys(group.queryByTable);
      if (tables.length > 0) {
        markdown += tables.map(t => `- ${t}`).join('\n');
      } else {
        markdown += '无';
      }
      markdown += '\n\n';
    }
  }

  return markdown;
}
