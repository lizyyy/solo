const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');

async function writeResults(results, outputDir, overwrite) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log('📝 写入汇总报告...');
  writeSummary(results.summary, outputDir);
  
  console.log('📝 写入归因详情...');
  writeAttribution(results.attribution, outputDir);
  
  console.log('📝 写入特殊情况报告...');
  writeSpecialCases(results.specialCases, outputDir);
  
  console.log('📝 写入门禁命中日志...');
  writeMatchedLogs(results.matchedLogs, outputDir);
}

function writeSummary(summary, outputDir) {
  const filePath = path.join(outputDir, 'summary.json');
  fs.writeFileSync(filePath, JSON.stringify(summary, null, 2));
  
  const markdown = generateSummaryMarkdown(summary);
  const mdFilePath = path.join(outputDir, 'SUMMARY.md');
  fs.writeFileSync(mdFilePath, markdown);
}

function generateSummaryMarkdown(summary) {
  return `# 网关访问日志限流命中归因报告

## 处理概览

- **处理时间**: ${summary.processingTime}
- **总日志数**: ${summary.totalLogs}
- **限流命中数**: ${summary.rateLimitHits}
- **命中率**: ${summary.hitRate}
- **受影响租户**: ${summary.affectedTenants}
- **受影响接口**: ${summary.affectedApis}

## TOP 5 限流命中

| 租户ID | 接口路径 | 命中次数 |
|--------|----------|----------|
${summary.topHits.map(t => `| ${t.tenantId} | ${t.apiPath} | ${t.totalHits} |`).join('\n')}

## 特殊情况检测

| 异常类型 | 是否检测到 | 数量 |
|----------|------------|------|
| 时钟漂移 | ${summary.specialCases.clockDrift.detected ? '✅ 是' : '❌ 否'} | ${summary.specialCases.clockDrift.count} |
| 网关重试 | ${summary.specialCases.gatewayRetries.detected ? '✅ 是' : '❌ 否'} | ${summary.specialCases.gatewayRetries.count} |
| 规则版本不一致 | ${summary.specialCases.ruleVersionMismatch.detected ? '✅ 是' : '❌ 否'} | ${summary.specialCases.ruleVersionMismatch.count} |

---
*由网关访问日志限流命中归因 CLI 生成*
`;
}

function writeAttribution(attribution, outputDir) {
  const jsonPath = path.join(outputDir, 'attribution.json');
  fs.writeFileSync(jsonPath, JSON.stringify(attribution, null, 2));
  
  const csvData = attribution.map(item => ({
    tenantId: item.tenantId,
    apiPath: item.apiPath,
    totalHits: item.totalHits,
    firstHit: item.timeRange?.firstHit || '',
    lastHit: item.timeRange?.lastHit || '',
    durationMs: item.timeRange?.durationMs || 0,
    hitRules: item.hitRules.map(r => `${r.ruleName}(${r.hitCount})`).join('; ')
  }));
  
  const csvParser = new Parser();
  const csv = csvParser.parse(csvData);
  const csvPath = path.join(outputDir, 'attribution.csv');
  fs.writeFileSync(csvPath, csv);
  
  const markdown = generateAttributionMarkdown(attribution);
  const mdPath = path.join(outputDir, 'ATTRIBUTION.md');
  fs.writeFileSync(mdPath, markdown);
}

function generateAttributionMarkdown(attribution) {
  let markdown = '# 限流归因详情\n\n';
  markdown += `共 ${attribution.length} 组 (租户+接口) 限流记录\n\n`;
  
  for (const item of attribution) {
    markdown += `## ${item.tenantId} - ${item.apiPath}\n\n`;
    markdown += `- **总命中次数**: ${item.totalHits}\n`;
    markdown += `- **首次命中**: ${item.timeRange?.firstHit || 'N/A'}\n`;
    markdown += `- **最后命中**: ${item.timeRange?.lastHit || 'N/A'}\n`;
    markdown += `- **持续时间**: ${(item.timeRange?.durationMs || 0) / 1000} 秒\n\n`;
    
    markdown += '### 命中规则详情\n\n';
    markdown += '| 规则ID | 规则名称 | 版本 | 限制类型 | 命中次数 | 原因 |\n';
    markdown += '|--------|----------|------|----------|----------|------|\n';
    
    for (const rule of item.hitRules) {
      markdown += `| ${rule.ruleId} | ${rule.ruleName} | ${rule.ruleVersion} | ${rule.limitType} | ${rule.hitCount} | ${rule.reasons.join('; ')} |\n`;
    }
    
    markdown += '\n---\n\n';
  }
  
  return markdown;
}

function writeSpecialCases(specialCases, outputDir) {
  const jsonPath = path.join(outputDir, 'special-cases.json');
  fs.writeFileSync(jsonPath, JSON.stringify(specialCases, null, 2));
  
  const markdown = generateSpecialCasesMarkdown(specialCases);
  const mdPath = path.join(outputDir, 'SPECIAL-CASES.md');
  fs.writeFileSync(mdPath, markdown);
}

function generateSpecialCasesMarkdown(specialCases) {
  let markdown = '# 特殊情况检测报告\n\n';
  
  markdown += '## 时钟漂移检测\n\n';
  if (specialCases.clockDrift.detected) {
    markdown += `⚠️ **检测到 ${specialCases.clockDrift.count} 处时钟漂移**\n\n`;
    markdown += '| 序号 | 请求ID | 前一个时间戳 | 当前时间戳 | 漂移量(ms) | 严重程度 |\n';
    markdown += '|------|--------|--------------|------------|------------|----------|\n';
    
    for (const c of specialCases.clockDrift.cases) {
      markdown += `| ${c.index} | ${c.requestId} | ${c.previousTimestamp} | ${c.currentTimestamp} | ${c.driftMs} | ${c.severity === 'high' ? '🔴 高' : '🟡 中'} |\n`;
    }
  } else {
    markdown += '✅ 未检测到时钟漂移\n\n';
  }
  
  markdown += '## 网关重试检测\n\n';
  if (specialCases.gatewayRetries.detected) {
    markdown += `⚠️ **检测到 ${specialCases.gatewayRetries.count} 次网关重试**\n\n`;
    markdown += '| 请求ID | 重试次数 | 总尝试次数 | 租户ID | 接口路径 | 状态码序列 |\n';
    markdown += '|--------|----------|------------|--------|----------|------------|\n';
    
    for (const c of specialCases.gatewayRetries.cases) {
      markdown += `| ${c.requestId} | ${c.retryCount} | ${c.totalAttempts} | ${c.tenantId} | ${c.apiPath} | ${c.statusCodes.join(' → ')} |\n`;
    }
  } else {
    markdown += '✅ 未检测到网关重试\n\n';
  }
  
  markdown += '## 规则版本不一致检测\n\n';
  if (specialCases.ruleVersionMismatch.detected) {
    markdown += `⚠️ **检测到 ${specialCases.ruleVersionMismatch.count} 个规则版本不一致**\n\n`;
    markdown += '| 规则ID | 期望版本 | 实际版本 | 版本不匹配 | 多版本共存 |\n';
    markdown += '|--------|----------|----------|------------|------------|\n';
    
    for (const c of specialCases.ruleVersionMismatch.cases) {
      markdown += `| ${c.ruleId} | ${c.expectedVersion || 'N/A'} | ${c.actualVersions.join(', ')} | ${c.isMismatch ? '❌ 是' : '否'} | ${c.hasMultipleVersions ? '❌ 是' : '否'} |\n`;
    }
  } else {
    markdown += '✅ 未检测到规则版本不一致\n\n';
  }
  
  return markdown;
}

function writeMatchedLogs(matchedLogs, outputDir) {
  const simplifiedLogs = matchedLogs.map(log => ({
    timestamp: log.timestamp || log.requestTime,
    requestId: log.requestId || log.traceId,
    tenantId: log.tenantId || log.tenant_id,
    apiPath: log.apiPath || log.path,
    statusCode: log.statusCode,
    primaryRuleName: log.primaryRule?.ruleName,
    primaryRuleReason: log.primaryRule?.matchReason
  }));
  
  const jsonPath = path.join(outputDir, 'rate-limit-hits.json');
  fs.writeFileSync(jsonPath, JSON.stringify(simplifiedLogs, null, 2));
  
  const csvParser = new Parser();
  const csv = csvParser.parse(simplifiedLogs);
  const csvPath = path.join(outputDir, 'rate-limit-hits.csv');
  fs.writeFileSync(csvPath, csv);
}

module.exports = {
  writeResults
};
