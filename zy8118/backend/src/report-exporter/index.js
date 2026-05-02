export class ReportExporter {
  static generateJSONReport(analysisResult) {
    const {
      specInfo,
      requestResponsePairs,
      issues,
      versionConflicts,
      missingOperationIds,
      unmatchedRequests,
      summary
    } = analysisResult;

    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        specInfo: specInfo ? {
          title: specInfo.title,
          version: specInfo.version,
          description: specInfo.description
        } : null
      },
      summary: {
        totalRequests: summary.totalRequests,
        matchedRequests: summary.matchedRequests,
        unmatchedRequests: summary.unmatchedRequests,
        totalIssues: summary.totalIssues,
        issuesBySeverity: {
          error: summary.errorCount,
          warning: summary.warningCount,
          info: summary.infoCount
        },
        issuesByRule: summary.issuesByRule || {}
      },
      issues: issues.map((issue) => ({
        ...issue,
        operation: issue.operation ? {
          operationId: issue.operation.operationId,
          path: issue.operation.path,
          method: issue.operation.method
        } : null,
        requestResponsePair: issue.pairId !== undefined ? {
          pairId: issue.pairId
        } : null
      })),
      versionConflicts: versionConflicts || [],
      missingOperationIds: missingOperationIds || [],
      unmatchedRequests: unmatchedRequests?.map((ur) => ({
        ...ur,
        request: {
          method: ur.request.method,
          url: ur.request.url,
          body: ur.request.body
        }
      })) || [],
      requestResponsePairs: requestResponsePairs?.map((pair) => ({
        id: pair.id,
        request: {
          method: pair.request.method,
          url: pair.request.url
        },
        response: pair.response ? {
          status: pair.response.status
        } : null,
        matchedOperation: pair.matchedOperation ? {
          operationId: pair.matchedOperation.operationId,
          path: pair.matchedOperation.path,
          method: pair.matchedOperation.method
        } : null,
        issues: pair.issues?.map((i) => ({
          ruleId: i.ruleId,
          ruleName: i.ruleName,
          severity: i.severity,
          path: i.path,
          message: i.message
        })) || []
      })) || []
    };
  }

  static generateMarkdownReport(analysisResult) {
    const report = this.generateJSONReport(analysisResult);
    const { metadata, summary, issues, versionConflicts, missingOperationIds, unmatchedRequests } = report;

    let md = `# OpenAPI 合约漂移报告\n\n`;
    
    md += `## 概览\n\n`;
    md += `| 项目 | 数值 |\n|------|------|\n`;
    md += `| 生成时间 | ${metadata.generatedAt} |\n`;
    md += `| 总请求数 | ${summary.totalRequests} |\n`;
    md += `| 匹配成功 | ${summary.matchedRequests} |\n`;
    md += `| 未匹配 | ${summary.unmatchedRequests} |\n`;
    md += `| 总问题数 | ${summary.totalIssues} |\n`;
    md += `| 错误数 | ${summary.issuesBySeverity.error} |\n`;
    md += `| 警告数 | ${summary.issuesBySeverity.warning} |\n`;
    md += `| 信息数 | ${summary.issuesBySeverity.info} |\n\n`;

    if (issues.length > 0) {
      md += `## 问题详情\n\n`;
      
      const errors = issues.filter((i) => i.severity === 'error');
      const warnings = issues.filter((i) => i.severity === 'warning');
      const infos = issues.filter((i) => i.severity === 'info');

      if (errors.length > 0) {
        md += `### 错误 (${errors.length})\n\n`;
        errors.forEach((issue, index) => {
          md += `#### ${index + 1}. ${issue.ruleName}\n\n`;
          md += `- **路径**: \`${issue.path}\`\n`;
          md += `- **消息**: ${issue.message}\n`;
          if (issue.expected !== null && issue.expected !== undefined) {
            md += `- **期望**: \`${this.formatValue(issue.expected)}\`\n`;
          }
          if (issue.actual !== null && issue.actual !== undefined) {
            md += `- **实际**: \`${this.formatValue(issue.actual)}\`\n`;
          }
          if (issue.operation) {
            md += `- **接口**: \`${issue.operation.method} ${issue.operation.path}\` (\`${issue.operation.operationId}\`)\n`;
          }
          md += `\n`;
        });
      }

      if (warnings.length > 0) {
        md += `### 警告 (${warnings.length})\n\n`;
        warnings.forEach((issue, index) => {
          md += `#### ${index + 1}. ${issue.ruleName}\n\n`;
          md += `- **路径**: \`${issue.path}\`\n`;
          md += `- **消息**: ${issue.message}\n`;
          if (issue.expected !== null && issue.expected !== undefined) {
            md += `- **期望**: \`${this.formatValue(issue.expected)}\`\n`;
          }
          if (issue.actual !== null && issue.actual !== undefined) {
            md += `- **实际**: \`${this.formatValue(issue.actual)}\`\n`;
          }
          if (issue.operation) {
            md += `- **接口**: \`${issue.operation.method} ${issue.operation.path}\`\n`;
          }
          md += `\n`;
        });
      }

      if (infos.length > 0) {
        md += `### 信息 (${infos.length})\n\n`;
        infos.forEach((issue, index) => {
          md += `#### ${index + 1}. ${issue.ruleName}\n\n`;
          md += `- **路径**: \`${issue.path}\`\n`;
          md += `- **消息**: ${issue.message}\n`;
          if (issue.expected !== null && issue.expected !== undefined) {
            md += `- **期望**: \`${this.formatValue(issue.expected)}\`\n`;
          }
          if (issue.actual !== null && issue.actual !== undefined) {
            md += `- **实际**: \`${this.formatValue(issue.actual)}\`\n`;
          }
          md += `\n`;
        });
      }
    }

    if (versionConflicts.length > 0) {
      md += `## 版本路径冲突 (${versionConflicts.length})\n\n`;
      versionConflicts.forEach((conflict, index) => {
        md += `### ${index + 1}. ${conflict.basePath}\n\n`;
        md += `- **方法**: \`${conflict.method}\`\n`;
        md += `- **当前版本**: \`${conflict.currentVersion || '无'}\` (${conflict.currentPath})\n`;
        md += `- **新版本**: \`${conflict.newerVersion}\` (${conflict.newerPath})\n`;
        md += `- **最新版本**: \`${conflict.latestVersion}\` (${conflict.latestPath})\n\n`;
      });
    }

    if (missingOperationIds.length > 0) {
      md += `## 缺失 operationId (${missingOperationIds.length})\n\n`;
      md += `以下操作没有显式定义 operationId，已自动生成:\n\n`;
      missingOperationIds.forEach((item, index) => {
        md += `${index + 1}. **\`${item.method} ${item.path}\`**\n`;
        md += `   - 自动生成: \`${item.operationId}\`\n`;
        md += `   - 建议命名: \`${item.recommendedId}\`\n\n`;
      });
    }

    if (unmatchedRequests.length > 0) {
      md += `## 未匹配的请求 (${unmatchedRequests.length})\n\n`;
      md += `以下请求无法与 OpenAPI 合约中的任何操作匹配:\n\n`;
      unmatchedRequests.forEach((item, index) => {
        md += `### ${index + 1}. ${item.request.method} ${item.request.url}\n\n`;
        if (item.suggestions && item.suggestions.length > 0) {
          md += `**建议匹配:**\n`;
          item.suggestions.forEach((sug, sIndex) => {
            md += `${sIndex + 1}. \`${sug.operation.method} ${sug.operation.path}\` (相似度: ${(sug.similarity * 100).toFixed(0)}%)\n`;
          });
        }
        md += `\n`;
      });
    }

    md += `---\n\n`;
    md += `*报告生成时间: ${new Date().toLocaleString()}*\n`;

    return md;
  }

  static formatValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) {
      return `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  static exportToJSON(analysisResult, outputPath) {
    const report = this.generateJSONReport(analysisResult);
    return JSON.stringify(report, null, 2);
  }

  static exportToMarkdown(analysisResult) {
    return this.generateMarkdownReport(analysisResult);
  }
}
