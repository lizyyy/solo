const fs = require('fs');
const path = require('path');

function generateTerminalSummary(result, options = {}) {
  const lines = [];
  const { showPreview = true, showBadRecords = true } = options;

  lines.push('');
  lines.push('='.repeat(60));
  lines.push('📊 CSV 修复报告');
  lines.push('='.repeat(60));
  lines.push('');

  lines.push(`📁 输入文件: ${result.fileName}`);
  lines.push(`📍 完整路径: ${result.inputFile}`);
  lines.push(`✅ 处理状态: ${result.success ? '成功' : '失败'}`);
  lines.push(`🚪 退出码: ${result.exitCode}`);
  lines.push('');

  lines.push('--- 🔍 检测结果 ---');
  lines.push(`📝 编码格式: ${result.encoding?.detected || '未知'} ${result.encoding?.hasBOM ? '(含BOM)' : ''}`);
  lines.push(`🔢 编码置信度: ${((result.encoding?.candidates?.[0]?.confidence || 0) * 100).toFixed(1)}%`);
  lines.push(`📏 分隔符: ${formatDelimiter(result.delimiter)}`);
  lines.push('');

  lines.push('--- 📈 统计信息 ---');
  lines.push(`📄 总行数: ${result.statistics.totalLines}`);
  lines.push(`✅ 正常记录: ${result.statistics.goodRecords}`);
  lines.push(`❌ 坏记录: ${result.statistics.badRecords}`);
  if (result.statistics.badRecords > 0) {
    lines.push(`  └─ 坏记录率: ${((result.statistics.badRecords / (result.statistics.goodRecords + result.statistics.badRecords)) * 100).toFixed(1)}%`);
  }
  lines.push(`🏷️  表头数量: ${result.headers.length}`);
  lines.push('');

  if (result.warnings.length > 0) {
    lines.push('--- ⚠️  警告信息 ---');
    for (const warning of result.warnings) {
      lines.push(`  ⚠️  ${warning.message}`);
      if (warning.duplicates) {
        for (const dup of warning.duplicates) {
          lines.push(`     └─ "${dup.header}" 出现在列 ${dup.firstIndex + 1} 和 ${dup.secondIndex + 1}`);
        }
      }
    }
    lines.push('');
  }

  if (result.issues.length > 0) {
    lines.push('--- ❌ 严重问题 ---');
    for (const issue of result.issues) {
      lines.push(`  ❌ [${issue.severity}] ${issue.message}`);
    }
    lines.push('');
  }

  if (showPreview && result.preview.length > 0) {
    lines.push('--- 📋 数据预览 (前5条) ---');
    lines.push('');
    const headers = result.headers.length > 0 ? result.headers : Object.keys(result.preview[0]).filter(k => k !== '_lineNumber');
    lines.push(headers.join(' | '));
    lines.push('-'.repeat(headers.length * 15));
    for (const record of result.preview) {
      const values = headers.map(h => truncate(String(record[h] || ''), 15));
      lines.push(values.join(' | '));
    }
    lines.push('');
  }

  if (showBadRecords && result.badRecords.length > 0) {
    lines.push('--- ❌ 坏记录详情 ---');
    lines.push('');
    const displayCount = Math.min(result.badRecords.length, 10);
    for (let i = 0; i < displayCount; i++) {
      const bad = result.badRecords[i];
      lines.push(`  🔴 行号 ${bad.lineNumber}${bad.lineNumbers.length > 1 ? ` (跨${bad.lineNumbers.length}行)` : ''}:`);
      lines.push(`     类型: ${bad.type}`);
      lines.push(`     原因: ${bad.message}`);
      lines.push(`     期望列数: ${bad.expectedColumns}, 实际列数: ${bad.columnCount}`);
      lines.push(`     内容: ${truncate(bad.columns.join(' | '), 80)}`);
      lines.push('');
    }
    if (result.badRecords.length > 10) {
      lines.push(`  ... 还有 ${result.badRecords.length - 10} 条坏记录，请查看完整报告`);
      lines.push('');
    }
  }

  lines.push('='.repeat(60));
  lines.push('');

  return lines.join('\n');
}

function generateJSONReport(result, options = {}) {
  const report = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    summary: {
      fileName: result.fileName,
      inputFile: result.inputFile,
      success: result.success,
      exitCode: result.exitCode
    },
    detection: {
      encoding: result.encoding?.detected,
      hasBOM: result.encoding?.hasBOM,
      encodingConfidence: result.encoding?.candidates?.[0]?.confidence || 0,
      encodingCandidates: result.encoding?.candidates || [],
      delimiter: result.delimiter
    },
    statistics: {
      ...result.statistics,
      headerCount: result.headers.length
    },
    headers: {
      original: result.originalHeaders,
      final: result.headers
    },
    warnings: result.warnings,
    issues: result.issues,
    badRecords: result.badRecords.map(bad => ({
      lineNumber: bad.lineNumber,
      lineNumbers: bad.lineNumbers,
      type: bad.type,
      message: bad.message,
      columnCount: bad.columnCount,
      expectedColumns: bad.expectedColumns,
      columns: bad.columns
    })),
    preview: result.preview
  };

  return JSON.stringify(report, null, 2);
}

function generateMarkdownReport(result, options = {}) {
  const lines = [];
  const timestamp = new Date().toLocaleString('zh-CN');

  lines.push('# CSV 修复报告');
  lines.push('');
  lines.push(`> 生成时间: ${timestamp}`);
  lines.push('');

  lines.push('## 📁 文件信息');
  lines.push('');
  lines.push('| 项目 | 值 |');
  lines.push('|------|-----|');
  lines.push(`| 文件名 | ${result.fileName} |`);
  lines.push(`| 完整路径 | ${result.inputFile} |`);
  lines.push(`| 处理状态 | ${result.success ? '✅ 成功' : '❌ 失败'} |`);
  lines.push(`| 退出码 | ${result.exitCode} |`);
  lines.push('');

  lines.push('## 🔍 检测结果');
  lines.push('');
  lines.push('| 项目 | 值 |');
  lines.push('|------|-----|');
  lines.push(`| 编码格式 | ${result.encoding?.detected || '未知'} ${result.encoding?.hasBOM ? '(含BOM)' : ''} |`);
  lines.push(`| 编码置信度 | ${((result.encoding?.candidates?.[0]?.confidence || 0) * 100).toFixed(1)}% |`);
  lines.push(`| 分隔符 | ${formatDelimiter(result.delimiter)} |`);
  lines.push('');

  if (result.encoding?.candidates?.length > 0) {
    lines.push('### 编码候选列表');
    lines.push('');
    lines.push('| 编码 | 置信度 |');
    lines.push('|------|--------|');
    for (const candidate of result.encoding.candidates.slice(0, 5)) {
      lines.push(`| ${candidate.encoding} | ${(candidate.confidence * 100).toFixed(1)}% |`);
    }
    lines.push('');
  }

  lines.push('## 📈 统计信息');
  lines.push('');
  lines.push('| 项目 | 值 |');
  lines.push('|------|-----|');
  lines.push(`| 总行数 | ${result.statistics.totalLines} |`);
  lines.push(`| 正常记录 | ${result.statistics.goodRecords} |`);
  lines.push(`| 坏记录 | ${result.statistics.badRecords} |`);
  lines.push(`| 坏记录率 | ${result.statistics.goodRecords + result.statistics.badRecords > 0 ? ((result.statistics.badRecords / (result.statistics.goodRecords + result.statistics.badRecords)) * 100).toFixed(1) : 0}% |`);
  lines.push(`| 表头数量 | ${result.headers.length} |`);
  lines.push('');

  lines.push('## 🏷️ 表头信息');
  lines.push('');
  if (result.originalHeaders.join(',') !== result.headers.join(',')) {
    lines.push('### 原始表头');
    lines.push('');
    lines.push(result.originalHeaders.map((h, i) => `${i + 1}. ${h}`).join('  \n'));
    lines.push('');
    lines.push('### 处理后表头');
    lines.push('');
  }
  lines.push(result.headers.map((h, i) => `${i + 1}. ${h}`).join('  \n'));
  lines.push('');

  if (result.warnings.length > 0) {
    lines.push('## ⚠️ 警告信息');
    lines.push('');
    for (const warning of result.warnings) {
      lines.push(`- **${warning.type}**: ${warning.message}`);
      if (warning.duplicates) {
        for (const dup of warning.duplicates) {
          lines.push(`  - 重复表头 "${dup.header}" 出现在列 ${dup.firstIndex + 1} 和 ${dup.secondIndex + 1}`);
        }
      }
    }
    lines.push('');
  }

  if (result.issues.length > 0) {
    lines.push('## ❌ 严重问题');
    lines.push('');
    for (const issue of result.issues) {
      lines.push(`- [${issue.severity.toUpperCase()}] **${issue.type}**: ${issue.message}`);
    }
    lines.push('');
  }

  if (result.preview.length > 0) {
    lines.push('## 📋 数据预览');
    lines.push('');
    const headers = result.headers.length > 0 ? result.headers : Object.keys(result.preview[0]).filter(k => k !== '_lineNumber');
    lines.push('| ' + headers.join(' | ') + ' |');
    lines.push('|' + headers.map(() => '---').join('|') + '|');
    for (const record of result.preview.slice(0, 20)) {
      const values = headers.map(h => escapeMarkdown(String(record[h] || '')));
      lines.push('| ' + values.join(' | ') + ' |');
    }
    lines.push('');
  }

  if (result.badRecords.length > 0) {
    lines.push('## ❌ 坏记录详情');
    lines.push('');
    lines.push(`共发现 **${result.badRecords.length}** 条坏记录：`);
    lines.push('');
    lines.push('| 行号 | 类型 | 原因 | 期望列数 | 实际列数 |');
    lines.push('|------|------|------|----------|----------|');
    for (const bad of result.badRecords) {
      const lineDisplay = bad.lineNumbers.length > 1 ? `${bad.lineNumber} (跨${bad.lineNumbers.length}行)` : bad.lineNumber;
      lines.push(`| ${lineDisplay} | ${bad.type} | ${escapeMarkdown(bad.message)} | ${bad.expectedColumns} | ${bad.columnCount} |`);
    }
    lines.push('');

    lines.push('### 坏记录原始内容');
    lines.push('');
    for (const bad of result.badRecords) {
      lines.push(`#### 行 ${bad.lineNumber}`);
      lines.push('');
      lines.push('```');
      lines.push(bad.columns.join('\n'));
      lines.push('```');
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('*本报告由 CSV Fixer CLI 自动生成*');

  return lines.join('\n');
}

function formatDelimiter(delimiter) {
  if (delimiter === '\t') return '\\\\t (制表符)';
  if (delimiter === ',') return ', (逗号)';
  if (delimiter === ';') return '; (分号)';
  if (delimiter === '|') return '| (竖线)';
  if (delimiter === '^') return '^ (脱字符)';
  if (delimiter === '\u0001') return 'SOH (ASCII 0x01)';
  return delimiter;
}

function truncate(str, len) {
  if (str.length <= len) return str;
  return str.slice(0, len - 3) + '...';
}

function escapeMarkdown(str) {
  return str.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function writeReports(result, outputDir, baseName, options = {}) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputs = [];

  if (options.json !== false) {
    const jsonPath = path.join(outputDir, `${baseName}.report.json`);
    fs.writeFileSync(jsonPath, generateJSONReport(result, options));
    outputs.push({ type: 'json', path: jsonPath });
  }

  if (options.markdown !== false) {
    const mdPath = path.join(outputDir, `${baseName}.report.md`);
    fs.writeFileSync(mdPath, generateMarkdownReport(result, options));
    outputs.push({ type: 'markdown', path: mdPath });
  }

  if (options.csv !== false && result.success) {
    const { generateFixedCSV } = require('./csv-fixer');
    const csvContent = generateFixedCSV(result, options);
    const csvPath = path.join(outputDir, `${baseName}.fixed.csv`);
    fs.writeFileSync(csvPath, csvContent, 'utf-8');
    outputs.push({ type: 'csv', path: csvPath });
  }

  if (options.badRecords !== false && result.badRecords.length > 0) {
    const badRecordsPath = path.join(outputDir, `${baseName}.bad-records.csv`);
    const badContent = generateBadRecordsCSV(result);
    fs.writeFileSync(badRecordsPath, badContent, 'utf-8');
    outputs.push({ type: 'bad-records', path: badRecordsPath });
  }

  return outputs;
}

function generateBadRecordsCSV(result) {
  const lines = ['line_number,type,message,expected_columns,actual_columns,raw_content'];
  for (const bad of result.badRecords) {
    const rawContent = (bad.rawContent || '').replace(/"/g, '""');
    lines.push(`${bad.lineNumber},"${bad.type}","${bad.message.replace(/"/g, '""')}",${bad.expectedColumns},${bad.columnCount},"${rawContent}"`);
  }
  return lines.join('\n');
}

module.exports = {
  generateTerminalSummary,
  generateJSONReport,
  generateMarkdownReport,
  writeReports
};
