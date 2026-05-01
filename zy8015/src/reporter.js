const fs = require('fs');
const path = require('path');

class Reporter {
  constructor(options = {}) {
    this.options = {
      outputFormat: options.outputFormat || 'markdown',
      includeRawData: options.includeRawData === true,
      ...options
    };
  }

  generateReport(data) {
    const { trace, timeline, schema, plan, drift } = data;

    if (this.options.outputFormat === 'json') {
      return this.generateJSONReport(data);
    }

    return this.generateMarkdownReport(data);
  }

  generateJSONReport(data) {
    const { trace, timeline, schema, plan, drift } = data;

    const report = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      summary: this.buildSummary(data),
      trace: this.simplifyTrace(trace),
      timeline: this.simplifyTimeline(timeline),
      schema: this.simplifySchema(schema),
      plan: this.simplifyPlan(plan),
      drift: this.simplifyDrift(drift)
    };

    return JSON.stringify(report, null, 2);
  }

  generateMarkdownReport(data) {
    const { trace, timeline, schema, plan, drift } = data;

    let markdown = `# MCP 工具调用回放分析报告

> 生成时间: ${new Date().toISOString()}

---

## 概览

${this.renderSummary(data)}

---

## 1. 轨迹分析

${this.renderTraceSummary(trace)}

### 1.1 调用统计

${this.renderCallStatistics(timeline?.statistics)}

### 1.2 时间线

${this.renderTimeline(timeline)}

---

## 2. 重试分析

${this.renderRetries(timeline?.retries)}

---

## 3. 非幂等风险分析

${this.renderNonIdempotentRisks(timeline?.nonIdempotentRisks)}

---

## 4. Schema 兼容性分析

${this.renderSchemaDrift(drift)}

### 4.1 参数验证问题

${this.renderParameterIssues(plan)}

---

## 5. 回放计划

${this.renderReplayPlan(plan)}

---

## 6. 建议与行动项

${this.renderRecommendations(data)}

---

## 附录

`;

    if (this.options.includeRawData) {
      markdown += `### A. 原始数据摘要

\`\`\`json
${JSON.stringify(this.buildSummary(data), null, 2)}
\`\`\`
`;
    }

    return markdown;
  }

  buildSummary(data) {
    const { trace, timeline, plan, drift } = data;

    return {
      totalCalls: trace?.toolCalls || 0,
      successfulCalls: timeline?.statistics?.successful || 0,
      failedCalls: timeline?.statistics?.failed || 0,
      successRate: timeline?.statistics?.successRate || '0%',
      retries: timeline?.retries?.length || 0,
      nonIdempotentRisks: timeline?.nonIdempotentRisks?.length || 0,
      schemaDrift: drift ? {
        hasBreakingChanges: drift.hasBreakingChanges,
        hasNonBreakingChanges: drift.hasNonBreakingChanges,
        totalChanges: (drift.added?.length || 0) + (drift.removed?.length || 0) + (drift.modified?.length || 0)
      } : null,
      plannedCalls: plan?.summary?.plannedCalls || 0,
      skippedCalls: plan?.summary?.skippedCalls || 0
    };
  }

  simplifyTrace(trace) {
    if (!trace) return null;
    return {
      filePath: trace.filePath,
      totalEntries: trace.totalEntries,
      toolCalls: trace.toolCalls,
      errors: trace.errors,
      uniqueToolCallIds: trace.uniqueToolCallIds,
      metadata: trace.metadata
    };
  }

  simplifyTimeline(timeline) {
    if (!timeline) return null;
    return {
      statistics: timeline.statistics,
      retries: timeline.retries?.map(r => ({
        tool_call_id: r.tool_call_id,
        tool_name: r.current?.tool_name,
        type: r.type,
        reason: r.reason
      })),
      nonIdempotentRisks: timeline.nonIdempotentRisks?.map(r => ({
        type: r.type,
        tool_name: r.tool_name,
        riskLevel: r.risk,
        description: r.description
      }))
    };
  }

  simplifySchema(schema) {
    if (!schema) return null;
    return {
      filePath: schema.filePath,
      version: schema.version,
      toolCount: Object.keys(schema.tools || {}).length,
      tools: Object.keys(schema.tools || {})
    };
  }

  simplifyPlan(plan) {
    if (!plan) return null;
    return {
      version: plan.version,
      generatedAt: plan.generatedAt,
      summary: plan.summary,
      steps: plan.steps?.map(s => ({
        index: s.index,
        tool_name: s.tool_name,
        tool_call_id: s.tool_call_id,
        shouldSkip: s.shouldSkip,
        skipReason: s.skipReason,
        expectedSuccess: s.expectedSuccess
      })),
      warnings: plan.warnings,
      risks: plan.risks?.map(r => ({
        type: r.type,
        tool_name: r.tool_name,
        riskLevel: r.riskLevel,
        description: r.description,
        recommendations: r.recommendations
      }))
    };
  }

  simplifyDrift(drift) {
    if (!drift) return null;
    return {
      hasBreakingChanges: drift.hasBreakingChanges,
      hasNonBreakingChanges: drift.hasNonBreakingChanges,
      added: drift.added?.length || 0,
      removed: drift.removed?.length || 0,
      modified: drift.modified?.length || 0,
      details: {
        added: drift.added,
        removed: drift.removed,
        modified: drift.modified
      }
    };
  }

  renderSummary(data) {
    const summary = this.buildSummary(data);
    const hasIssues = summary.failedCalls > 0 || summary.retries > 0 || 
                     summary.nonIdempotentRisks > 0 || 
                     (summary.schemaDrift?.hasBreakingChanges);

    let statusEmoji = '✅';
    let statusText = '正常';
    if (hasIssues) {
      statusEmoji = '⚠️';
      statusText = '存在问题需要关注';
    }

    return `### 状态: ${statusEmoji} ${statusText}

| 指标 | 值 |
|------|-----|
| 总调用数 | ${summary.totalCalls} |
| 成功调用 | ${summary.successfulCalls} |
| 失败调用 | ${summary.failedCalls} |
| 成功率 | ${summary.successRate} |
| 重试次数 | ${summary.retries} |
| 非幂等风险 | ${summary.nonIdempotentRisks} |
| 计划执行调用 | ${summary.plannedCalls} |
| 跳过调用 | ${summary.skippedCalls} |

`;
  }

  renderTraceSummary(trace) {
    if (!trace) return '无轨迹数据';

    return `
**文件**: \`${trace.filePath}\`

- 总条目数: ${trace.totalEntries}
- 工具调用数: ${trace.toolCalls}
- 错误数: ${trace.errors}
- 唯一 tool_call_id 数: ${trace.uniqueToolCallIds}

${trace.metadata.startTime ? `- 开始时间: ${trace.metadata.startTime.toISOString()}` : ''}
${trace.metadata.endTime ? `- 结束时间: ${trace.metadata.endTime.toISOString()}` : ''}
${trace.metadata.duration_ms ? `- 持续时间: ${trace.metadata.duration_ms}ms` : ''}
`;
  }

  renderCallStatistics(stats) {
    if (!stats) return '无统计数据';

    let table = `| 工具 | 总数 | 成功 | 失败 | 成功率 | 平均耗时 |
|------|------|------|------|--------|----------|
`;

    for (const [toolName, toolStats] of Object.entries(stats.toolStats || {})) {
      table += `| ${toolName} | ${toolStats.total} | ${toolStats.successful} | ${toolStats.failed} | ${toolStats.successRate} | ${toolStats.avgDurationMs || 'N/A'}ms |\n`;
    }

    return table;
  }

  renderTimeline(timeline) {
    if (!timeline || !timeline.timeline) return '无时间线数据';

    const events = timeline.timeline.slice(0, 20);

    let markdown = `### 最近 ${events.length} 个事件（按时间排序）

| 序号 | 时间 | 工具 | 状态 | 耗时 |
|------|------|------|------|------|
`;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const statusEmoji = event.success ? '✅' : '❌';
      const time = event.timestampISO || 'N/A';
      const duration = event.duration_ms ? `${event.duration_ms}ms` : 'N/A';

      markdown += `| ${i + 1} | ${time} | ${event.tool_name || 'N/A'} | ${statusEmoji} | ${duration} |\n`;
    }

    if (timeline.timeline.length > 20) {
      markdown += `\n... 还有 ${timeline.timeline.length - 20} 个事件\n`;
    }

    return markdown;
  }

  renderRetries(retries) {
    if (!retries || retries.length === 0) {
      return '未检测到重试调用。';
    }

    let markdown = `检测到 ${retries.length} 次重试调用。

### 重试详情

| 序号 | tool_call_id | 工具 | 重试类型 | 说明 |
|------|--------------|------|----------|------|
`;

    for (let i = 0; i < retries.length; i++) {
      const retry = retries[i];
      const typeEmoji = retry.type === 'successful_retry' ? '✅' :
                        retry.type === 'failed_retry' ? '❌' :
                        retry.type === 'non_idempotent_retry' ? '⚠️' : '🔄';

      markdown += `| ${i + 1} | ${retry.tool_call_id || 'N/A'} | ${retry.current?.tool_name || 'N/A'} | ${typeEmoji} ${retry.type} | ${retry.reason || 'N/A'} |\n`;
    }

    return markdown;
  }

  renderNonIdempotentRisks(risks) {
    if (!risks || risks.length === 0) {
      return '未检测到非幂等风险。';
    }

    let markdown = `检测到 ${risks.length} 个非幂等风险。

### 风险详情

| 序号 | 风险等级 | 工具 | 类型 | 描述 |
|------|----------|------|------|------|
`;

    for (let i = 0; i < risks.length; i++) {
      const risk = risks[i];
      const levelEmoji = risk.risk === '高' ? '🔴' : risk.risk === '中' ? '🟡' : '🟢';

      markdown += `| ${i + 1} | ${levelEmoji} ${risk.risk} | ${risk.tool_name} | ${risk.type} | ${risk.description} |\n`;
    }

    markdown += `

### 建议

`;

    const uniqueRisks = [...new Set(risks.map(r => r.type))];
    for (const riskType of uniqueRisks) {
      const risk = risks.find(r => r.type === riskType);
      if (risk) {
        markdown += `**${riskType}**:

`;
        if (Array.isArray(risk.recommendations)) {
          for (const rec of risk.recommendations) {
            markdown += `- ${rec}\n`;
          }
        }
        markdown += '\n';
      }
    }

    return markdown;
  }

  renderSchemaDrift(drift) {
    if (!drift) {
      return '无 Schema 漂移数据（未提供新旧 Schema 对比）。';
    }

    const hasChanges = drift.hasBreakingChanges || drift.hasNonBreakingChanges;
    
    if (!hasChanges) {
      return '未检测到 Schema 变化。新旧 Schema 完全兼容。';
    }

    let markdown = `
${drift.hasBreakingChanges ? '🔴 **检测到破坏性变更！**' : ''}
${drift.hasNonBreakingChanges ? '🟡 **检测到非破坏性变更**' : ''}

### 变更摘要

| 变更类型 | 数量 |
|----------|------|
| 新增 | ${drift.added?.length || 0} |
| 移除 | ${drift.removed?.length || 0} |
| 修改 | ${drift.modified?.length || 0} |

`;

    if (drift.removed?.length > 0) {
      markdown += `### 已移除的工具/参数

`;
      for (const item of drift.removed) {
        const isBreaking = item.severity === 'breaking';
        markdown += `${isBreaking ? '🔴' : '🟡'} **${item.tool || item.tool_name}**: ${item.message}\n\n`;
      }
    }

    if (drift.added?.length > 0) {
      markdown += `### 新增的工具/参数

`;
      for (const item of drift.added) {
        markdown += `🟢 **${item.tool || item.tool_name}**: ${item.message}\n\n`;
      }
    }

    if (drift.modified?.length > 0) {
      markdown += `### 修改的工具/参数

`;
      for (const item of drift.modified) {
        const isBreaking = item.severity === 'breaking';
        markdown += `${isBreaking ? '🔴' : '🟡'} **${item.tool || item.tool_name}**${item.parameter ? ` (参数: ${item.parameter})` : ''}: ${item.message}\n\n`;
      }
    }

    return markdown;
  }

  renderParameterIssues(plan) {
    if (!plan || !plan.validation?.parameterIssues?.length) {
      return '未检测到参数验证问题。';
    }

    const issues = plan.validation.parameterIssues;

    let markdown = `检测到 ${issues.length} 个参数验证问题。

| 序号 | 工具 | tool_call_id | 问题 | 严重程度 |
|------|------|--------------|------|----------|
`;

    let index = 1;
    for (const issue of issues) {
      for (const paramIssue of issue.issues) {
        const severityEmoji = paramIssue.severity === 'error' ? '🔴' : '🟡';
        markdown += `| ${index} | ${issue.tool_name} | ${issue.tool_call_id || 'N/A'} | ${paramIssue.message} | ${severityEmoji} ${paramIssue.severity} |\n`;
        index++;
      }
    }

    return markdown;
  }

  renderReplayPlan(plan) {
    if (!plan) return '无回放计划数据。';

    const canExecute = plan.steps.every(s => !s.shouldSkip || s.skipType !== 'validation_failure');

    let markdown = `
### 执行状态: ${canExecute ? '✅ 可执行' : '❌ 存在阻塞问题'}

| 指标 | 值 |
|------|-----|
| 总调用数 | ${plan.summary.totalCalls} |
| 计划执行 | ${plan.summary.plannedCalls} |
| 跳过 | ${plan.summary.skippedCalls} |

`;

    if (plan.warnings?.length > 0) {
      markdown += `### 警告

`;
      for (const warning of plan.warnings) {
        markdown += `⚠️ **${warning.tool_name}** (${warning.tool_call_id || 'N/A'}): ${warning.reason}\n\n`;
      }
    }

    const stepsToShow = plan.steps.slice(0, 15);
    markdown += `### 执行计划（前 ${stepsToShow.length} 步）

| 序号 | 状态 | 工具 | tool_call_id | 预期结果 |
|------|------|------|--------------|----------|
`;

    for (const step of stepsToShow) {
      const status = step.shouldSkip ? '⏭️ 跳过' : (step.expectedSuccess ? '✅ 成功' : '❌ 失败');
      const expectedResult = step.expectedSuccess ? '成功' : '失败';
      markdown += `| ${step.index + 1} | ${status} | ${step.tool_name} | ${step.tool_call_id || 'N/A'} | ${expectedResult} |\n`;
    }

    if (plan.steps.length > 15) {
      markdown += `\n... 还有 ${plan.steps.length - 15} 个步骤\n`;
    }

    return markdown;
  }

  renderRecommendations(data) {
    const { timeline, drift, plan } = data;
    const recommendations = [];

    if (timeline?.retries?.length > 0) {
      const failedRetries = timeline.retries.filter(r => r.type === 'failed_retry');
      if (failedRetries.length > 0) {
        recommendations.push({
          priority: '高',
          category: '重试',
          text: `${failedRetries.length} 次重试仍然失败，建议检查工具稳定性和错误处理逻辑`
        });
      }
    }

    if (timeline?.nonIdempotentRisks?.length > 0) {
      const highRisks = timeline.nonIdempotentRisks.filter(r => r.risk === '高');
      if (highRisks.length > 0) {
        recommendations.push({
          priority: '高',
          category: '非幂等',
          text: `${highRisks.length} 个高风险非幂等操作，回放前建议备份数据或使用 dry-run 模式`
        });
      }
    }

    if (drift?.hasBreakingChanges) {
      recommendations.push({
        priority: '高',
        category: 'Schema',
        text: '检测到破坏性 Schema 变更，回放可能失败，建议更新调用代码'
      });
    }

    if (plan?.validation?.parameterIssues?.length > 0) {
      const errors = plan.validation.parameterIssues.flatMap(i => 
        i.issues.filter(p => p.severity === 'error')
      );
      if (errors.length > 0) {
        recommendations.push({
          priority: '高',
          category: '参数',
          text: `${errors.length} 个参数验证错误，需要修复后才能回放`
        });
      }
    }

    if (recommendations.length === 0) {
      return `✅ 未发现需要立即关注的问题。轨迹可以安全回放（注意非幂等操作）。

建议：
1. 在回放前保存系统状态快照
2. 先执行 dry-run 验证计划
3. 从低风险调用开始逐步执行
`;
    }

    let markdown = `### 优先级排序建议

`;

    const highPriority = recommendations.filter(r => r.priority === '高');
    const mediumPriority = recommendations.filter(r => r.priority === '中');
    const lowPriority = recommendations.filter(r => r.priority === '低');

    if (highPriority.length > 0) {
      markdown += `#### 🔴 高优先级

`;
      for (const rec of highPriority) {
        markdown += `- **[${rec.category}]** ${rec.text}\n`;
      }
      markdown += '\n';
    }

    if (mediumPriority.length > 0) {
      markdown += `#### 🟡 中优先级

`;
      for (const rec of mediumPriority) {
        markdown += `- **[${rec.category}]** ${rec.text}\n`;
      }
      markdown += '\n';
    }

    if (lowPriority.length > 0) {
      markdown += `#### 🟢 低优先级

`;
      for (const rec of lowPriority) {
        markdown += `- **[${rec.category}]** ${rec.text}\n`;
      }
      markdown += '\n';
    }

    return markdown;
  }

  saveReport(report, outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, report, 'utf-8');
    return outputPath;
  }
}

module.exports = Reporter;
