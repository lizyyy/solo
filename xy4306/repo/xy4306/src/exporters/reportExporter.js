const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { ISSUE_TYPES, ISSUE_SEVERITY, ISSUE_DESCRIPTIONS, CONFIG } = require('../config/constants');

class ReportExporter {
  constructor(outputDir) {
    this.outputDir = outputDir;
    this.reportsDir = path.join(outputDir, CONFIG.OUTPUT.REPORTS_FOLDER);
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  generateConsolidatedReport(consolidatedReport, analysisResults) {
    const reportContent = this.buildConsolidatedMarkdown(consolidatedReport, analysisResults);
    const filename = 'report_summary.md';
    const filepath = path.join(this.reportsDir, filename);
    
    fs.writeFileSync(filepath, reportContent, 'utf-8');
    
    return {
      filename,
      filepath
    };
  }

  generateBatchReport(analysisResult) {
    const { vehicle, batch } = analysisResult;
    const reportContent = this.buildBatchMarkdown(analysisResult);
    const filename = `report_${vehicle}_${batch}.md`;
    const filepath = path.join(this.reportsDir, filename);
    
    fs.writeFileSync(filepath, reportContent, 'utf-8');
    
    return {
      filename,
      filepath,
      vehicle,
      batch
    };
  }

  buildConsolidatedMarkdown(consolidatedReport, analysisResults) {
    const { overallStatus, totalBatches, totalIssues, issueBreakdown, generatedAtStr } = consolidatedReport;
    
    const statusEmoji = {
      normal: '✅',
      attention: '⚠️',
      warning: '🔶',
      critical: '🔴'
    };
    
    const statusText = {
      normal: '正常',
      attention: '需关注',
      warning: '警告',
      critical: '严重'
    };

    let markdown = `# 冷链温度复盘报告

## 总览

| 项目 | 值 |
|------|-----|
| 生成时间 | ${generatedAtStr} |
| 整体状态 | ${statusEmoji[overallStatus]} ${statusText[overallStatus]} |
| 分析批次 | ${totalBatches} |
| 检测问题数 | ${totalIssues} |

## 问题分布

| 严重程度 | 数量 |
|----------|------|
| 🔴 严重 | ${issueBreakdown.critical} |
| 🔶 高 | ${issueBreakdown.high} |
| 🔵 中 | ${issueBreakdown.medium} |
| 🟢 低 | ${issueBreakdown.low} |

`;

    if (totalIssues > 0) {
      markdown += `
## 所有问题列表

`;
      
      const sortedIssues = [...consolidatedReport.allIssues];
      for (const issue of sortedIssues) {
        const severityEmoji = {
          critical: '🔴',
          high: '🔶',
          medium: '🔵',
          low: '🟢'
        };
        
        markdown += `### ${severityEmoji[issue.severity]} ${ISSUE_DESCRIPTIONS[issue.type] || issue.type} (${issue.id})

- **车辆**: ${issue.vehicle}
- **批次**: ${issue.batch}
- **时间**: ${issue.startTimeStr || issue.timeStr || 'N/A'}${issue.endTimeStr && issue.startTimeStr !== issue.endTimeStr ? ` ~ ${issue.endTimeStr}` : ''}
- **持续时间**: ${issue.durationFormatted || 'N/A'}
- **描述**: ${issue.description}

`;
      }
    }

    markdown += `
## 各批次详情

`;

    for (const [key, result] of Object.entries(analysisResults)) {
      const { vehicle, batch, statistics, issues } = result;
      
      markdown += `### ${vehicle} - 批次 ${batch}

#### 统计摘要

| 指标 | 值 |
|------|-----|
| 记录数 | ${statistics.totalRecords} |
| 时间范围 | ${statistics.timeRange?.startStr || 'N/A'} ~ ${statistics.timeRange?.endStr || 'N/A'} |
| 平均温度 | ${statistics.temperature?.avg?.toFixed(1) || 'N/A'}°C |
| 最高温度 | ${statistics.temperature?.max?.toFixed(1) || 'N/A'}°C |
| 最低温度 | ${statistics.temperature?.min?.toFixed(1) || 'N/A'}°C |
| 开门事件 | ${statistics.doorEvents?.total || 0} 次 (超时: ${statistics.doorEvents?.exceeded || 0} 次) |
| 检测问题 | ${statistics.issues?.total || 0} 个 |

`;

      if (issues.length > 0) {
        markdown += `#### 检测到的问题

| 问题类型 | 严重程度 | 时间 | 描述 |
|----------|----------|------|------|
`;
        for (const issue of issues) {
          const severityText = {
            critical: '严重',
            high: '高',
            medium: '中',
            low: '低'
          };
          const timeDisplay = issue.startTimeStr || issue.timeStr || 'N/A';
          markdown += `| ${ISSUE_DESCRIPTIONS[issue.type] || issue.type} | ${severityText[issue.severity]} | ${timeDisplay} | ${issue.description} |\n`;
        }
        markdown += '\n';
      }
    }

    markdown += `
---

*报告由冷链温度复盘器自动生成*
`;

    return markdown;
  }

  buildBatchMarkdown(analysisResult) {
    const { vehicle, batch, statistics, issues, temperatures, doorEvents, notes } = analysisResult;

    let markdown = `# 冷链温度复盘报告 - ${vehicle} / 批次 ${batch}

## 基本信息

| 项目 | 值 |
|------|-----|
| 车辆 | ${vehicle} |
| 批次 | ${batch} |
| 生成时间 | ${dayjs().format('YYYY-MM-DD HH:mm:ss')} |

## 统计摘要

### 温度统计

| 指标 | 值 |
|------|-----|
| 总记录数 | ${statistics.totalRecords} |
| 时间范围 | ${statistics.timeRange?.startStr || 'N/A'} ~ ${statistics.timeRange?.endStr || 'N/A'} |
| 持续时长 | ${statistics.timeRange?.durationFormatted || 'N/A'} |
| 最低温度 | ${statistics.temperature?.min?.toFixed(1) || 'N/A'}°C |
| 最高温度 | ${statistics.temperature?.max?.toFixed(1) || 'N/A'}°C |
| 平均温度 | ${statistics.temperature?.avg?.toFixed(1) || 'N/A'}°C |
| 中位数 | ${statistics.temperature?.median?.toFixed(1) || 'N/A'}°C |
| 标准差 | ${statistics.temperature?.stdDev?.toFixed(2) || 'N/A'}°C |

### 温度分布

| 状态 | 记录数 | 占比 |
|------|--------|------|
| ✅ 正常 (${CONFIG.TEMPERATURE.THRESHOLD.MIN}~${CONFIG.TEMPERATURE.THRESHOLD.SAFE_MAX}°C) | ${statistics.distribution?.safe?.count || 0} | ${(statistics.distribution?.safe?.percentage || 0).toFixed(1)}% |
| ⚠️ 超安全阈值 (${CONFIG.TEMPERATURE.THRESHOLD.SAFE_MAX}~${CONFIG.TEMPERATURE.THRESHOLD.DANGER_MAX}°C) | ${statistics.distribution?.overSafe?.count || 0} | ${(statistics.distribution?.overSafe?.percentage || 0).toFixed(1)}% |
| 🔴 超危险阈值 (>${CONFIG.TEMPERATURE.THRESHOLD.DANGER_MAX}°C) | ${statistics.distribution?.overDanger?.count || 0} | ${(statistics.distribution?.overDanger?.percentage || 0).toFixed(1)}% |
| ⬇️ 超低温 (<${CONFIG.TEMPERATURE.THRESHOLD.MIN}°C) | ${statistics.distribution?.underSafe?.count || 0} | ${(statistics.distribution?.underSafe?.percentage || 0).toFixed(1)}% |

### 开门事件统计

| 指标 | 值 |
|------|-----|
| 总开门次数 | ${statistics.doorEvents?.total || 0} |
| 超时开门次数 | ${statistics.doorEvents?.exceeded || 0} |

### 备注统计

| 指标 | 值 |
|------|-----|
| 总备注数 | ${statistics.notes?.total || 0} |
| 关联异常的备注 | ${statistics.notes?.anomalyRelated || 0} |

`;

    if (issues.length > 0) {
      markdown += `## 检测到的问题

`;
      
      const criticalIssues = issues.filter(i => i.severity === ISSUE_SEVERITY.CRITICAL);
      const highIssues = issues.filter(i => i.severity === ISSUE_SEVERITY.HIGH);
      const mediumIssues = issues.filter(i => i.severity === ISSUE_SEVERITY.MEDIUM);
      const lowIssues = issues.filter(i => i.severity === ISSUE_SEVERITY.LOW);

      if (criticalIssues.length > 0) {
        markdown += `### 🔴 严重问题 (${criticalIssues.length})

`;
        for (const issue of criticalIssues) {
          markdown += this.formatIssueMarkdown(issue);
        }
      }

      if (highIssues.length > 0) {
        markdown += `### 🔶 高优先级问题 (${highIssues.length})

`;
        for (const issue of highIssues) {
          markdown += this.formatIssueMarkdown(issue);
        }
      }

      if (mediumIssues.length > 0) {
        markdown += `### 🔵 中优先级问题 (${mediumIssues.length})

`;
        for (const issue of mediumIssues) {
          markdown += this.formatIssueMarkdown(issue);
        }
      }

      if (lowIssues.length > 0) {
        markdown += `### 🟢 低优先级问题 (${lowIssues.length})

`;
        for (const issue of lowIssues) {
          markdown += this.formatIssueMarkdown(issue);
        }
      }
    } else {
      markdown += `## 问题检测结果

✅ **未检测到任何异常问题**

`;
    }

    if (doorEvents && doorEvents.length > 0) {
      markdown += `## 开门事件详情

| 序号 | 开门时间 | 关门时间 | 持续时间 | 是否超时 |
|------|----------|----------|----------|----------|
`;
      doorEvents.forEach((event, index) => {
        const exceeded = event.isExceeded ? '⚠️ 是' : '否';
        markdown += `| ${index + 1} | ${event.openTimeStr} | ${event.closeTimeStr} | ${event.durationFormatted} | ${exceeded} |\n`;
      });
      markdown += '\n';
    }

    if (notes && notes.length > 0) {
      markdown += `## 人工备注

| 序号 | 时间 | 内容 | 关联异常 |
|------|------|------|----------|
`;
      notes.forEach((note, index) => {
        const anomalyRelated = note.isAnomalyRelated ? '⚠️ 是' : '否';
        const timeStr = note.time || 'N/A';
        const content = note.content?.replace(/\|/g, '\\|') || '';
        markdown += `| ${index + 1} | ${timeStr} | ${content} | ${anomalyRelated} |\n`;
      });
      markdown += '\n';
    }

    markdown += `
---

*报告由冷链温度复盘器自动生成*

*相关图表请查看 charts 目录*
`;

    return markdown;
  }

  formatIssueMarkdown(issue) {
    let markdown = `#### ${ISSUE_DESCRIPTIONS[issue.type] || issue.type} (${issue.id})

| 属性 | 值 |
|------|-----|
| 时间 | ${issue.startTimeStr || issue.timeStr || 'N/A'} |
`;

    if (issue.endTimeStr && issue.startTimeStr !== issue.endTimeStr) {
      markdown += `| 结束时间 | ${issue.endTimeStr} |\n`;
    }

    if (issue.durationFormatted) {
      markdown += `| 持续时间 | ${issue.durationFormatted} |\n`;
    }

    if (issue.maxTemperature !== undefined) {
      markdown += `| 最高温度 | ${issue.maxTemperature.toFixed(1)}°C |\n`;
    }

    if (issue.avgTemperature !== undefined) {
      markdown += `| 平均温度 | ${issue.avgTemperature.toFixed(1)}°C |\n`;
    }

    if (issue.isDoorRelated) {
      markdown += `| 关联开门 | 是 |\n`;
    }

    if (issue.isExplainable) {
      markdown += `| 可解释性 | 是 (开门/备注可解释) |\n`;
    }

    if (issue.relatedNote) {
      markdown += `| 关联备注 | ${issue.relatedNote.content} |\n`;
    }

    markdown += `| 描述 | ${issue.description} |

`;

    return markdown;
  }
}

module.exports = ReportExporter;
