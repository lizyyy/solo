'use strict';

const fs = require('fs');
const path = require('path');

async function generateReports(result, options) {
  generateMachineReadable(result, options);
  generateHumanReadableReport(result, options);
}

function generateMachineReadable(result, options) {
  const filePath = path.join(result.reportDir, `${options.fileName}-result.json`);
  const data = {
    meta: {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      inputFile: result.inputFile,
      outputFile: result.outputFile,
      badRowsFile: result.badRowsFile
    },
    summary: {
      success: result.success,
      detectedEncoding: result.detectedEncoding,
      totalRows: result.totalRows,
      successRows: result.successRows,
      badRows: result.badRows,
      duplicateRows: result.duplicateRows,
      successRate: result.totalRows > 0 
        ? ((result.successRows / result.totalRows) * 100).toFixed(2) + '%'
        : '0%',
      durationMs: result.duration
    },
    columns: {
      original: result.originalColumns,
      normalized: result.normalizedColumns,
      mapping: result.columnMapping
    },
    badRows: result.badRowsList.slice(0, 100),
    duplicateRows: result.duplicateRowsList.slice(0, 100),
    error: result.error || null
  };

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  
  if (!options.quiet) {
    console.log(`📄 机器可读结果: ${filePath}`);
  }
}

function generateHumanReadableReport(result, options) {
  const filePath = path.join(result.reportDir, `${options.fileName}-report.md`);
  
  const lines = [];
  
  lines.push('# CSV 转 NDJSON 转换报告');
  lines.push('');
  lines.push(`**生成时间**: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`**输入文件**: \`${result.inputFile}\``);
  lines.push(`**输出文件**: \`${result.outputFile}\``);
  lines.push(`**坏行文件**: \`${result.badRowsFile}\``);
  lines.push('');

  lines.push('## 📊 转换摘要');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 探测编码 | ${result.detectedEncoding} |`);
  lines.push(`| 总行数 | ${result.totalRows} |`);
  lines.push(`| 成功行数 | ${result.successRows} |`);
  lines.push(`| 坏行数 | ${result.badRows} |`);
  lines.push(`| 重复行数 | ${result.duplicateRows} |`);
  lines.push(`| 成功率 | ${result.totalRows > 0 ? ((result.successRows / result.totalRows) * 100).toFixed(2) : 0}% |`);
  lines.push(`| 耗时 | ${result.duration}ms |`);
  lines.push(`| 状态 | ${result.success ? '✅ 成功' : '❌ 失败'} |`);
  lines.push('');

  lines.push('## 📋 列名映射');
  lines.push('');
  lines.push('| 原始列名 | 归一化列名 |');
  lines.push('|----------|------------|');
  
  for (const [original, normalized] of Object.entries(result.columnMapping)) {
    lines.push(`| \`${original}\` | \`${normalized}\` |`);
  }
  lines.push('');

  if (result.badRows > 0) {
    lines.push('## ❌ 坏行详情');
    lines.push('');
    lines.push(`共检测到 **${result.badRows}** 行坏数据，完整列表请查看坏行文件。`);
    lines.push('');
    lines.push('### 坏行样本（前10条）');
    lines.push('');
    lines.push('| 行号 | 错误信息 | 样本数据 |');
    lines.push('|------|----------|----------|');
    
    const samples = result.badRowsList.slice(0, 10);
    for (const badRow of samples) {
      const sampleData = JSON.stringify(badRow.rawContent).substring(0, 100);
      lines.push(`| ${badRow.lineNumber} | ${badRow.error} | \`${sampleData}...\` |`);
    }
    lines.push('');
  }

  if (result.duplicateRows > 0) {
    lines.push('## ⚠️ 重复行详情');
    lines.push('');
    lines.push(`共检测到 **${result.duplicateRows}** 行重复数据。`);
    lines.push('');
    lines.push('### 重复行样本（前10条）');
    lines.push('');
    lines.push('| 行号 | 样本数据 |');
    lines.push('|------|----------|');
    
    const samples = result.duplicateRowsList.slice(0, 10);
    for (const dupRow of samples) {
      const sampleData = JSON.stringify(dupRow.data).substring(0, 100);
      lines.push(`| ${dupRow.lineNumber} | \`${sampleData}...\` |`);
    }
    lines.push('');
  }

  if (result.error) {
    lines.push('## 🚨 致命错误');
    lines.push('');
    lines.push('```');
    lines.push(result.error);
    lines.push('```');
    lines.push('');
  }

  lines.push('## 📁 文件位置');
  lines.push('');
  lines.push('- NDJSON 输出:');
  lines.push(`  \`${result.outputFile}\``);
  lines.push('- 坏行记录 (CSV):');
  lines.push(`  \`${result.badRowsFile}\``);
  lines.push('- 机器可读结果 (JSON):');
  lines.push(`  \`${path.join(result.reportDir, `${options.fileName}-result.json`)}\``);
  lines.push('');

  lines.push('---');
  lines.push('*此报告由 csv2ndjson CLI 工具自动生成*');

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  
  if (!options.quiet) {
    console.log(`📑 同事可读报告: ${filePath}`);
  }
}

module.exports = { generateReports };
