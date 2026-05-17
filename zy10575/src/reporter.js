const fs = require('fs');
const path = require('path');

function generateTerminalSummary(results) {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('CSV 主键重复检测报告');
  lines.push('='.repeat(60));
  lines.push("文件: " + path.basename(results.filePath));
  lines.push("主键列: " + results.keyColumns.join(', '));
  lines.push('-'.repeat(60));
  lines.push("总行数: " + results.totalRows);
  lines.push("有效行数: " + results.validRows);
  lines.push("主键为空行数: " + results.nullKeyCount);
  lines.push("重复主键组数: " + results.duplicateCount);
  lines.push("重复行数: " + results.duplicateRowsCount);
  lines.push('-'.repeat(60));
  
  if (results.duplicateCount > 0) {
    lines.push('\n重复主键详情:');
    Object.entries(results.duplicateGroups).forEach(([key, group], idx) => {
      lines.push(`\n  第 ${idx + 1} 组 (归一化后: ${key})`);
      lines.push(`  行数: ${group.count}`);
      group.rows.forEach(row => {
        lines.push(`    - 行号 ${row.lineNumber}: ${row.originalKey}`);
      });
    });
  }
  
  if (results.nullKeyCount > 0) {
    lines.push('\n主键为空的行:');
    results.nullKeyRows.forEach(row => {
      lines.push(`  - 行号 ${row.lineNumber}`);
    });
  }
  
  lines.push('='.repeat(60));
  
  const hasIssues = results.duplicateCount > 0 || results.nullKeyCount > 0;
  lines.push(hasIssues ? '✗ 发现数据存在问题' : '✓ 数据正常');
  lines.push('='.repeat(60));
  
  return lines.join('\n');
}

function generateMachineReadable(results) {
  return JSON.stringify({
    filePath: results.filePath,
    keyColumns: results.keyColumns,
    summary: {
      totalRows: results.totalRows,
      validRows: results.validRows,
      nullKeyCount: results.nullKeyCount,
      duplicateCount: results.duplicateCount,
      duplicateRowsCount: results.duplicateRowsCount,
      hasIssues: results.duplicateCount > 0 || results.nullKeyCount > 0
    },
    duplicateGroups: Object.entries(results.duplicateGroups).map(([key, group]) => ({
      normalizedKey: key,
      originalKeys: group.originalKeys,
      rows: group.rows.map(r => ({
        lineNumber: r.lineNumber,
        originalKey: r.originalKey
      })),
      count: group.count
    })),
    badRows: results.badRows.map(r => ({
        lineNumber: r.lineNumber,
        reason: r.reason,
        normalizedKey: r.normalizedKey || null,
        originalKey: r.originalKey || null
      }))
  }, null, 2);
}

function generateFriendlyReport(results) {
  const hasIssues = results.duplicateCount > 0 || results.nullKeyCount > 0;
  
  const lines = [];
  lines.push('# CSV 数据质量检测报告');
  lines.push('');
  lines.push(`**检测时间**: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`**文件**: \`${path.basename(results.filePath)}\``);
  lines.push(`**主键列**: \`${results.keyColumns.join('`, `')}\``);
  lines.push('');
  lines.push('## 检测摘要');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 总行数 | ${results.totalRows} |`);
  lines.push(`| 有效行数 | ${results.validRows} |`);
  lines.push(`| 主键为空 | ${results.nullKeyCount} |`);
  lines.push(`| 重复主键组数 | ${results.duplicateCount} |`);
  lines.push(`| 重复行数 | ${results.duplicateRowsCount} |`);
  lines.push('');
  
  if (hasIssues) {
    lines.push('## ⚠️ 发现问题');
    lines.push('');
    
    if (results.duplicateCount > 0) {
      lines.push('### 重复主键详情');
      lines.push('');
      Object.entries(results.duplicateGroups).forEach(([key, group], idx) => {
        lines.push(`#### 第 ${idx + 1} 组重复`);
        lines.push(`- **归一化后主键**: \`${key}\``);
        lines.push(`- **重复次数**: ${group.count}`);
        lines.push('- **行号列表**:');
        group.rows.forEach(row => {
          lines.push(`  - 第 ${row.lineNumber} 行: \`${row.originalKey}\``);
        });
        lines.push('');
      });
    }
    
    if (results.nullKeyCount > 0) {
      lines.push('### 主键为空的行');
      lines.push('');
      results.nullKeyRows.forEach(row => {
        lines.push(`- 第 ${row.lineNumber} 行`);
      });
      lines.push('');
    }
    
    lines.push('## 建议');
    lines.push('');
    lines.push('1. 请检查并修正上述重复数据，确保主键唯一性');
    lines.push('2. 特别注意隐藏空格导致的主键重复问题');
    lines.push('3. 建议在导入前先运行本工具进行检测');
  } else {
    lines.push('## ✅ 检测通过');
    lines.push('');
    lines.push('未发现主键重复或空值问题，数据可以正常导入。');
  }
  
  return lines.join('\n');
}

function saveBadRowsCSV(results, outputPath) {
  if (results.badRows.length === 0) {
    return;
  }
  
  const headers = [...results.headers, '_lineNumber', '_reason'];
  const rows = results.badRows.map(row => {
    const data = { ...row.data };
    data._lineNumber = row.lineNumber;
    data._reason = row.reason;
    return data;
  });
  
  const csvLines = [headers.join(',')];
  rows.forEach(row => {
    const line = headers.map(h => {
      const value = row[h] || '';
      const escaped = String(value).replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
    csvLines.push(line);
  });
  
  fs.writeFileSync(outputPath, csvLines.join('\n'));
}

module.exports = {
  generateTerminalSummary,
  generateMachineReadable,
  generateFriendlyReport,
  saveBadRowsCSV
};
