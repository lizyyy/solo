'use strict';

const fs = require('fs-extra');
const path = require('path');
const { RISK_LEVELS, RISK_WEIGHTS } = require('./patterns');

class ReportGenerator {
  constructor() {}

  _getSeverityEmoji(severity) {
    const emojis = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🔵'
    };
    return emojis[severity] || '⚪';
  }

  _getSeverityLabel(severity) {
    const labels = {
      critical: '严重',
      high: '高危',
      medium: '中危',
      low: '低危'
    };
    return labels[severity] || severity;
  }

  _formatDuration(ms) {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  }

  _formatCodeContext(context) {
    if (!context || context.length === 0) {
      return '';
    }

    let output = '```\n';
    for (const line of context) {
      const lineNum = String(line.lineNumber).padStart(3, ' ');
      const prefix = line.isIssue ? '>>> ' : '    ';
      output += `${prefix}${lineNum} | ${line.content}\n`;
    }
    output += '```\n';
    return output;
  }

  toMarkdown(results, options = {}) {
    const { metadata, stats, issues } = results;

    let markdown = `# SQL注入风险扫描报告

**扫描时间**: ${new Date(metadata.scanTime).toLocaleString('zh-CN')}  
**扫描耗时**: ${this._formatDuration(metadata.duration)}  
**代码目录**: \`${metadata.codeDirectory}\`  
${metadata.databasePath ? `**数据库文件**: \`${metadata.databasePath}\`  \n` : ''}
**最小风险级别**: ${this._getSeverityLabel(metadata.minRiskLevel)}  
**扫描器版本**: ${metadata.scannerVersion}

---

## 扫描摘要

| 指标 | 值 |
|------|-----|
| 扫描文件数 | ${stats.totalFiles} |
| 发现问题数 | ${stats.totalIssues} |
| 平均文件问题数 | ${stats.issuesPerFile.toFixed(2)} |
| 风险评分 | **${stats.riskScore}** |

### 风险分布

`;

    const severities = ['critical', 'high', 'medium', 'low'];
    for (const severity of severities) {
      const count = stats.bySeverity[severity] || 0;
      if (count > 0 || severities.includes(severity)) {
        const emoji = this._getSeverityEmoji(severity);
        const label = this._getSeverityLabel(severity);
        markdown += `${emoji} **${label}**: ${count} 个问题  \n`;
      }
    }

    if (Object.keys(stats.byType).length > 0) {
      markdown += `
### 问题类型分布

| 问题类型 | 数量 | 严重程度 |
|----------|------|----------|
`;
      for (const [id, typeInfo] of Object.entries(stats.byType)) {
        const emoji = this._getSeverityEmoji(typeInfo.severity);
        const label = this._getSeverityLabel(typeInfo.severity);
        markdown += `| ${typeInfo.name} | ${typeInfo.count} | ${emoji} ${label} |\n`;
      }
    }

    if (Object.keys(stats.byFile).length > 0) {
      markdown += `
### 问题文件分布

| 文件 | 问题数 |
|------|--------|
`;
      const sortedFiles = Object.entries(stats.byFile)
        .sort((a, b) => b[1] - a[1]);
      
      for (const [file, count] of sortedFiles.slice(0, 10)) {
        const relativePath = path.relative(metadata.codeDirectory, file);
        markdown += `| \`${relativePath}\` | ${count} |\n`;
      }
      
      if (sortedFiles.length > 10) {
        markdown += `| ... 还有 ${sortedFiles.length - 10} 个文件 | |\n`;
      }
    }

    if (issues.length > 0) {
      markdown += `
---

## 问题详情

`;

      const groupedBySeverity = {
        critical: [],
        high: [],
        medium: [],
        low: []
      };

      for (const issue of issues) {
        groupedBySeverity[issue.severity] = groupedBySeverity[issue.severity] || [];
        groupedBySeverity[issue.severity].push(issue);
      }

      for (const severity of ['critical', 'high', 'medium', 'low']) {
        const severityIssues = groupedBySeverity[severity];
        if (severityIssues.length === 0) continue;

        const emoji = this._getSeverityEmoji(severity);
        const label = this._getSeverityLabel(severity);

        markdown += `
### ${emoji} ${label}级别问题 (${severityIssues.length}个)

`;

        for (let i = 0; i < severityIssues.length; i++) {
          const issue = severityIssues[i];
          const relativePath = path.relative(metadata.codeDirectory, issue.filePath);

          markdown += `
#### ${i + 1}. ${issue.name}

**位置**: \`${relativePath}:${issue.lineNumber}\`  

**描述**: ${issue.description}  

`;

          if (issue.matchedText) {
            markdown += `**问题代码片段**:  
\`\`\`
${issue.matchedText}
\`\`\`

`;
          }

          if (issue.context) {
            markdown += `**上下文代码**:  
${this._formatCodeContext(issue.context)}
`;
          }

          if (issue.fileType) {
            markdown += `**文件类型**: ${issue.fileType}  \n`;
            if (issue.permissions) {
              markdown += `**当前权限**: \`${issue.permissions}\`  \n`;
            }
          }

          if (issue.fixSuggestion) {
            markdown += `
**修复建议**:  

${issue.fixSuggestion.replace(/\n/g, '\n> ')}

`;
          }

          if (issue.examples && issue.examples.length > 0) {
            markdown += `**类似坏代码示例**:  
`;
            for (const example of issue.examples) {
              markdown += `- \`${example}\`  \n`;
            }
            markdown += '\n';
          }

          markdown += '---\n';
        }
      }
    }

    markdown += `
## 安全建议

### 通用防护原则

1. **永远使用参数绑定**: 不要使用字符串拼接构建SQL语句
2. **使用ORM框架**: 如Sequelize、TypeORM、Prisma等，它们会自动处理参数化
3. **输入验证**: 对所有用户输入进行严格验证
4. **最小权限原则**: 数据库账号只授予必要的最小权限
5. **定期审计**: 在上线前和定期进行安全代码审查

### 快速修复检查清单

- [ ] 所有SQL查询是否使用参数绑定?
- [ ] 动态表名/列名是否使用白名单验证?
- [ ] 用户输入是否经过验证和转义?
- [ ] 数据库文件权限是否设置为 600?
- [ ] 备份文件是否加密并存储在安全位置?
- [ ] 是否有WAL/SHM文件需要处理?

---

*本报告由 sql-injection-scanner v${metadata.scannerVersion} 生成*  
*生成时间: ${new Date().toLocaleString('zh-CN')}*
`;

    return markdown;
  }

  toJSON(results) {
    const { metadata, stats, issues } = results;

    const simplifiedIssues = issues.map(issue => ({
      id: issue.id,
      name: issue.name,
      severity: issue.severity,
      description: issue.description,
      filePath: issue.filePath,
      lineNumber: issue.lineNumber,
      column: issue.column,
      matchedText: issue.matchedText,
      fixSuggestion: issue.fixSuggestion,
      fileType: issue.fileType || null,
      permissions: issue.permissions || null,
      context: issue.context ? issue.context.map(c => ({
        lineNumber: c.lineNumber,
        content: c.content,
        isIssue: c.isIssue
      })) : null
    }));

    const report = {
      metadata: {
        ...metadata,
        scanTime: metadata.scanTime,
        generatedAt: new Date().toISOString()
      },
      summary: {
        totalFiles: stats.totalFiles,
        totalIssues: stats.totalIssues,
        issuesPerFile: stats.issuesPerFile,
        riskScore: stats.riskScore,
        bySeverity: stats.bySeverity,
        byType: stats.byType,
        byFile: stats.byFile
      },
      issues: simplifiedIssues,
      filesScanned: results.filesScanned
    };

    return JSON.stringify(report, null, 2);
  }

  async saveReport(content, filename, outputDir = process.cwd()) {
    const outputPath = path.resolve(outputDir, filename);
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, content, 'utf-8');
    return outputPath;
  }
}

module.exports = ReportGenerator;
