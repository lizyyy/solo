const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const { writeFile } = require('./output');

function collectSlowSamples(results, slowThreshold, maxSamples) {
  const allSlowSamples = [];
  
  results.forEach(group => {
    const slowRecords = group.records
      .filter(r => r.latency >= slowThreshold)
      .sort((a, b) => b.latency - a.latency)
      .slice(0, maxSamples);
    
    slowRecords.forEach(record => {
      allSlowSamples.push({
        path: group.path,
        tenant: group.tenant,
        statusCode: group.statusCode,
        latency: record.latency,
        requestId: record.requestId,
        sourceFile: record.sourceFile,
        lineNumber: record.lineNumber,
        hasDuplicates: record.duplicateSources && record.duplicateSources.length > 0,
        duplicateCount: (record.duplicateSources || []).length
      });
    });
  });
  
  return allSlowSamples.sort((a, b) => b.latency - a.latency);
}

function generateTerminalSummary(results, context) {
  const lines = [];
  
  lines.push('='.repeat(80));
  lines.push('接口耗时分位分析报告 - 终端摘要');
  lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`运行标识: ${context.timestamp}`);
  lines.push('='.repeat(80));
  lines.push('');
  
  lines.push('📊 统计概览');
  lines.push('----------------------------------------');
  const totalRequests = results.reduce((sum, r) => sum + r.stats.count, 0);
  lines.push(`总请求数: ${totalRequests}`);
  lines.push(`分位组数: ${results.length}`);
  lines.push(`坏行数: ${context.badLines.length}`);
  lines.push(`重复请求数: ${context.deduplicationStats.duplicateCount}`);
  lines.push('');
  
  lines.push('🔍 去重口径说明');
  lines.push('----------------------------------------');
  lines.push(context.deduplicationStats.policy);
  lines.push('');
  
  lines.push('🔥 Top 10 按请求数排序的分组');
  lines.push('----------------------------------------');
  lines.push('');
  
  const topByCount = results.slice(0, 10);
  topByCount.forEach((group, idx) => {
    lines.push(`${idx + 1}. 路径: ${group.path}`);
    lines.push(`    租户: ${group.tenant || '(空)'}`);
    lines.push(`    状态码: ${group.statusCode}`);
    lines.push(`    请求数: ${group.stats.count}`);
    lines.push(`    平均耗时: ${group.stats.avg.toFixed(2)}ms`);
    lines.push(`    P50: ${group.stats.p50?.toFixed(2)}ms | P90: ${group.stats.p90?.toFixed(2)}ms | P99: ${group.stats.p99?.toFixed(2)}ms`);
    lines.push('');
  });
  
  lines.push('⚠️  慢请求阈值分布');
  lines.push('----------------------------------------');
  const slowThreshold = context.slowThreshold;
  let slowCount = 0;
  
  results.forEach(group => {
    slowCount += group.records.filter(r => r.latency >= slowThreshold).length;
  });
  
  lines.push(`慢请求阈值: ${slowThreshold}ms`);
  lines.push(`慢请求总数: ${slowCount}`);
  lines.push(`慢请求占比: ${((slowCount / totalRequests) * 100).toFixed(2)}%`);
  lines.push('');
  
  if (context.badLines.length > 0) {
    lines.push('❌ 坏行统计');
    lines.push('----------------------------------------');
    const errorTypes = {};
    context.badLines.forEach(line => {
      errorTypes[line.error] = (errorTypes[line.error] || 0) + 1;
    });
    Object.entries(errorTypes).forEach(([error, count]) => {
      lines.push(`  ${error}: ${count} 条`);
    });
    lines.push('');
  }
  
  return lines.join('\n');
}

function generateMachineReadable(results, context) {
  return JSON.stringify({
    meta: {
      generatedAt: new Date().toISOString(),
      timestamp: context.timestamp,
      options: context.options,
      slowThreshold: context.slowThreshold
    },
    deduplication: {
      policy: context.deduplicationStats.policy,
      originalCount: context.deduplicationStats.originalCount,
      dedupedCount: context.deduplicationStats.dedupedCount,
      duplicateCount: context.deduplicationStats.duplicateCount
    },
    badLines: {
      count: context.badLines.length,
      samples: context.badLines.slice(0, 100)
    },
    results: results.map(r => ({
      path: r.path,
      tenant: r.tenant,
      statusCode: r.statusCode,
      stats: r.stats,
      slowSamples: r.records
        .filter(rec => rec.latency >= context.slowThreshold)
        .sort((a, b) => b.latency - a.latency)
        .slice(0, context.errorSamples)
        .map(rec => ({
          latency: rec.latency,
          requestId: rec.requestId,
          sourceFile: rec.sourceFile,
          lineNumber: rec.lineNumber,
          hasDuplicates: rec.duplicateSources && rec.duplicateSources.length > 0,
          duplicateSources: rec.duplicateSources
        }))
    }))
  }, null, 2);
}

function generateFriendlyReport(results, context) {
  const lines = [];
  
  lines.push('# 接口耗时分位分析报告');
  lines.push('');
  lines.push(`> 生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`> 运行标识: ${context.timestamp}`);
  lines.push('');
  
  lines.push('## 📊 统计概览');
  lines.push('');
  
  const totalRequests = results.reduce((sum, r) => sum + r.stats.count, 0);
  const slowThreshold = context.slowThreshold;
  let slowCount = 0;
  results.forEach(group => {
    slowCount += group.records.filter(r => r.latency >= slowThreshold).length;
  });
  
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 总请求数 | ${totalRequests} |`);
  lines.push(`| 分组数量 | ${results.length} |`);
  lines.push(`| 去重前请求数 | ${context.deduplicationStats.originalCount} |`);
  lines.push(`| 去重后请求数 | ${context.deduplicationStats.dedupedCount} |`);
  lines.push(`| 重复请求数 | ${context.deduplicationStats.duplicateCount} |`);
  lines.push(`| 慢请求数 (≥${slowThreshold}ms) | ${slowCount} |`);
  lines.push(`| 慢请求占比 | ${((slowCount / totalRequests) * 100).toFixed(2)}% |`);
  lines.push(`| 坏行数 | ${context.badLines.length} |`);
  lines.push('');
  
  lines.push('## 🔍 去重口径说明');
  lines.push('');
  lines.push(context.deduplicationStats.policy.split('\n').map(l => `- ${l}`).join('\n'));
  lines.push('');
  
  lines.push('## 🔥 按 P99 耗时排序的 Top 10 分组');
  lines.push('');
  
  const sortedByP99 = [...results].sort((a, b) => (b.stats.p99 || 0) - (a.stats.p99 || 0)).slice(0, 10);
  
  lines.push('| # | 路径 | 租户 | 状态码 | 请求数 | P50(ms) | P90(ms) | P95(ms) | P99(ms) | 平均(ms) |');
  lines.push('|---|------|------|--------|--------|---------|---------|---------|---------|----------|');
  
  sortedByP99.forEach((group, idx) => {
    lines.push(`| ${idx + 1} | ${group.path} | ${group.tenant || '-'} | ${group.statusCode} | ${group.stats.count} | ${group.stats.p50?.toFixed(1) || '-'} | ${group.stats.p90?.toFixed(1) || '-'} | ${group.stats.p95?.toFixed(1) || '-'} | ${group.stats.p99?.toFixed(1) || '-'} | ${group.stats.avg.toFixed(1)} |`);
  });
  lines.push('');
  
  lines.push('## 📈 按请求数排序的 Top 10 分组');
  lines.push('');
  
  lines.push('| # | 路径 | 租户 | 状态码 | 请求数 | P50(ms) | P90(ms) | P95(ms) | P99(ms) | 平均(ms) |');
  lines.push('|---|------|------|--------|--------|---------|---------|---------|---------|----------|');
  
  results.slice(0, 10).forEach((group, idx) => {
    lines.push(`| ${idx + 1} | ${group.path} | ${group.tenant || '-'} | ${group.statusCode} | ${group.stats.count} | ${group.stats.p50?.toFixed(1) || '-'} | ${group.stats.p90?.toFixed(1) || '-'} | ${group.stats.p95?.toFixed(1) || '-'} | ${group.stats.p99?.toFixed(1) || '-'} | ${group.stats.avg.toFixed(1)} |`);
  });
  lines.push('');
  
  lines.push('## ⚠️  状态码异常分组');
  lines.push('');
  
  const errorGroups = results.filter(r => r.statusCode >= 400 || r.statusCode === 0);
  if (errorGroups.length > 0) {
    lines.push('| 路径 | 租户 | 状态码 | 请求数 | P50(ms) | P99(ms) |');
    lines.push('|------|------|--------|--------|---------|---------|');
    
    errorGroups.forEach(group => {
      lines.push(`| ${group.path} | ${group.tenant || '-'} | ${group.statusCode} | ${group.stats.count} | ${group.stats.p50?.toFixed(1) || '-'} | ${group.stats.p99?.toFixed(1) || '-'} |`);
    });
  } else {
    lines.push('暂无状态码异常分组。');
  }
  lines.push('');
  
  lines.push('## 📋 完整分组列表');
  lines.push('');
  
  lines.push('| 路径 | 租户 | 状态码 | 请求数 | P50(ms) | P90(ms) | P95(ms) | P99(ms) | 平均(ms) | 最大(ms) |');
  lines.push('|------|------|--------|--------|---------|---------|---------|---------|----------|----------|');
  
  results.forEach(group => {
    lines.push(`| ${group.path} | ${group.tenant || '-'} | ${group.statusCode} | ${group.stats.count} | ${group.stats.p50?.toFixed(1) || '-'} | ${group.stats.p90?.toFixed(1) || '-'} | ${group.stats.p95?.toFixed(1) || '-'} | ${group.stats.p99?.toFixed(1) || '-'} | ${group.stats.avg.toFixed(1)} | ${group.stats.max.toFixed(1)} |`);
  });
  lines.push('');
  
  lines.push('---');
  lines.push('*本报告由 `latency-percentile-cli` 自动生成*');
  
  return lines.join('\n');
}

async function generateBadLinesCsv(badLines, outputDir) {
  if (badLines.length === 0) return;
  
  const csvWriter = createObjectCsvWriter({
    path: path.join(outputDir, 'bad_lines.csv'),
    header: [
      { id: 'filename', title: '文件名' },
      { id: 'lineNumber', title: '行号' },
      { id: 'error', title: '错误原因' },
      { id: 'raw', title: '原始内容' }
    ]
  });
  
  await csvWriter.writeRecords(badLines);
}

async function generateSlowSamplesCsv(slowSamples, outputDir) {
  if (slowSamples.length === 0) return;
  
  const csvWriter = createObjectCsvWriter({
    path: path.join(outputDir, 'slow_samples.csv'),
    header: [
      { id: 'path', title: '路径' },
      { id: 'tenant', title: '租户' },
      { id: 'statusCode', title: '状态码' },
      { id: 'latency', title: '耗时(ms)' },
      { id: 'requestId', title: '请求ID' },
      { id: 'sourceFile', title: '源文件' },
      { id: 'lineNumber', title: '行号' },
      { id: 'hasDuplicates', title: '有重复' },
      { id: 'duplicateCount', title: '重复次数' }
    ]
  });
  
  await csvWriter.writeRecords(slowSamples);
}

async function generateReports(results, context) {
  const { outputDir, badLines, deduplicationStats } = context;
  
  const slowSamples = collectSlowSamples(results, context.slowThreshold, context.errorSamples);
  
  const terminalSummary = generateTerminalSummary(results, context);
  writeFile(path.join(outputDir, 'summary.txt'), terminalSummary);
  
  const machineReadable = generateMachineReadable(results, context);
  writeFile(path.join(outputDir, 'results.json'), machineReadable);
  
  const friendlyReport = generateFriendlyReport(results, context);
  writeFile(path.join(outputDir, 'report.md'), friendlyReport);
  
  await generateBadLinesCsv(badLines, outputDir);
  await generateSlowSamplesCsv(slowSamples, outputDir);
  
  console.log(terminalSummary);
}

module.exports = {
  generateReports,
  collectSlowSamples,
  generateTerminalSummary,
  generateMachineReadable,
  generateFriendlyReport
};
