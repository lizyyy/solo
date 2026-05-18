const fs = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify/sync');

function ensureOutputDir(outputPath) {
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
}

function generateTimestamp() {
  const now = new Date();
  return now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
}

function recordsToCsv(records, fields) {
  return stringify(records, {
    header: true,
    columns: fields,
    quoted: true,
    encoding: 'utf-8'
  });
}

function writeCsvFile(filePath, records, fields) {
  const csv = recordsToCsv(records, fields);
  fs.writeFileSync(filePath, csv, 'utf-8');
}

function generateReports(parseResult, validateResult, outputPath, options = {}) {
  const { overwrite = false, preview = false } = options;
  
  ensureOutputDir(outputPath);
  
  const timestamp = generateTimestamp();
  const prefix = overwrite ? '' : `${timestamp}_`;
  
  const reportFiles = [];

  const normalRecords = validateResult.normal.map(r => ({
    装备编号: r['装备编号'],
    装备名称: r['装备名称'],
    所属套装: r['所属套装'],
    数量: r['数量'],
    状态: r['状态'],
    备注: r['备注']
  }));
  
  if (normalRecords.length > 0) {
    const fileName = `${prefix}正常清点结果.csv`;
    const filePath = path.join(outputPath, fileName);
    if (!preview) {
      writeCsvFile(filePath, normalRecords, ['装备编号', '装备名称', '所属套装', '数量', '状态', '备注']);
    }
    reportFiles.push({ type: 'normal', name: fileName, count: normalRecords.length });
  }

  const issues = validateResult.issues;
  
  if (issues.crossSetItems.length > 0) {
    const crossSetRecords = issues.crossSetItems.flatMap(item => 
      item.records.map(r => ({
        装备编号: item.equipmentId,
        装备名称: item.equipmentName,
        所属套装: r['所属套装'],
        数量: r['数量'],
        状态: r['状态'],
        备注: r['备注'],
        涉及套装: item.sets.join(' | ')
      }))
    );
    const fileName = `${prefix}同配件跨套装_待复核.csv`;
    const filePath = path.join(outputPath, fileName);
    if (!preview) {
      writeCsvFile(filePath, crossSetRecords, ['装备编号', '装备名称', '所属套装', '数量', '状态', '备注', '涉及套装']);
    }
    reportFiles.push({ type: 'crossSet', name: fileName, count: crossSetRecords.length });
  }

  if (issues.handwrittenNotes.length > 0) {
    const handwrittenRecords = issues.handwrittenNotes.map(r => ({
      装备编号: r['装备编号'],
      装备名称: r['装备名称'],
      所属套装: r['所属套装'],
      数量: r['数量'],
      状态: r['状态'],
      备注: r['备注']
    }));
    const fileName = `${prefix}备注手写_待复核.csv`;
    const filePath = path.join(outputPath, fileName);
    if (!preview) {
      writeCsvFile(filePath, handwrittenRecords, ['装备编号', '装备名称', '所属套装', '数量', '状态', '备注']);
    }
    reportFiles.push({ type: 'handwritten', name: fileName, count: handwrittenRecords.length });
  }

  if (issues.duplicateRecords.length > 0) {
    const duplicateRecords = issues.duplicateRecords.flatMap(d => [
      {
        类型: '重复记录',
        装备编号: d.record['装备编号'],
        装备名称: d.record['装备名称'],
        所属套装: d.record['所属套装'],
        数量: d.record['数量'],
        状态: d.record['状态'],
        备注: d.record['备注'],
        原始行号: d.original.lineNumber
      }
    ]);
    const fileName = `${prefix}重复记录_待复核.csv`;
    const filePath = path.join(outputPath, fileName);
    if (!preview) {
      writeCsvFile(filePath, duplicateRecords, ['类型', '装备编号', '装备名称', '所属套装', '数量', '状态', '备注', '原始行号']);
    }
    reportFiles.push({ type: 'duplicate', name: fileName, count: duplicateRecords.length });
  }

  if (parseResult.invalid.length > 0) {
    const fileName = `${prefix}解析失败_待修复.csv`;
    const filePath = path.join(outputPath, fileName);
    if (!preview) {
      writeCsvFile(filePath, parseResult.invalid, ['lineNumber', 'content', 'reason']);
    }
    reportFiles.push({ type: 'invalid', name: fileName, count: parseResult.invalid.length });
  }

  const summaryReport = generateSummaryReport(parseResult, validateResult, reportFiles);
  const summaryFileName = `${prefix}清点汇总报告.md`;
  const summaryFilePath = path.join(outputPath, summaryFileName);
  if (!preview) {
    fs.writeFileSync(summaryFilePath, summaryReport, 'utf-8');
  }
  reportFiles.push({ type: 'summary', name: summaryFileName, count: 1 });

  return {
    timestamp,
    outputPath,
    files: reportFiles,
    summary: summaryReport
  };
}

function generateSummaryReport(parseResult, validateResult, reportFiles) {
  const stats = validateResult.stats;
  const issues = validateResult.issues;

  let report = `# 露营装备租赁清点汇总报告\n\n`;
  report += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
  
  report += `## 一、清点统计\n\n`;
  report += `- 总记录数: ${stats.total}\n`;
  report += `- 正常记录: ${stats.normal}\n`;
  report += `- 问题记录: ${stats.total - stats.normal}\n\n`;

  report += `## 二、问题明细\n\n`;
  
  if (issues.crossSetItems.length > 0) {
    report += `### 同配件跨套装 (${issues.crossSetItems.length}项)\n\n`;
    issues.crossSetItems.forEach(item => {
      report += `- ${item.equipmentName} (${item.equipmentId}): 涉及套装 ${item.sets.join(', ')}\n`;
    });
    report += '\n';
  }

  if (issues.handwrittenNotes.length > 0) {
    report += `### 备注手写标记 (${issues.handwrittenNotes.length}条)\n\n`;
    issues.handwrittenNotes.forEach(r => {
      report += `- ${r['装备名称']} (${r['装备编号']}): ${r['备注']}\n`;
    });
    report += '\n';
  }

  if (issues.duplicateRecords.length > 0) {
    report += `### 重复记录 (${issues.duplicateRecords.length}条)\n\n`;
    issues.duplicateRecords.forEach(d => {
      report += `- ${d.record['装备名称']} (${d.record['装备编号']}): 与第${d.original.lineNumber}行重复\n`;
    });
    report += '\n';
  }

  if (issues.invalidStatus.length > 0) {
    report += `### 状态异常 (${issues.invalidStatus.length}条)\n\n`;
    issues.invalidStatus.forEach(r => {
      report += `- ${r['装备名称']} (${r['装备编号']}): 状态="${r['状态']}"\n`;
    });
    report += '\n';
  }

  if (issues.invalidQuantity.length > 0) {
    report += `### 数量异常 (${issues.invalidQuantity.length}条)\n\n`;
    issues.invalidQuantity.forEach(r => {
      report += `- ${r['装备名称']} (${r['装备编号']}): 数量="${r['数量']}"\n`;
    });
    report += '\n';
  }

  if (parseResult.invalid.length > 0) {
    report += `### 解析失败 (${parseResult.invalid.length}条)\n\n`;
    parseResult.invalid.slice(0, 10).forEach(item => {
      report += `- 第${item.lineNumber}行: ${item.reason}\n`;
    });
    if (parseResult.invalid.length > 10) {
      report += `- ... 还有 ${parseResult.invalid.length - 10} 条\n`;
    }
    report += '\n';
  }

  report += `## 三、生成文件列表\n\n`;
  reportFiles.forEach(f => {
    report += `- ${f.name} (${f.count}条)\n`;
  });
  report += '\n';

  report += `## 四、复核建议\n\n`;
  report += `1. 优先处理【同配件跨套装】：确认装备归属\n`;
  report += `2. 核对【备注手写】：确认手写备注内容是否有效\n`;
  report += `3. 清理【重复记录】：删除重复条目\n`;
  report += `4. 修复【解析失败】：修正CSV格式后重新运行\n`;

  return report;
}

function listReports(outputPath) {
  if (!fs.existsSync(outputPath)) {
    return [];
  }

  const files = fs.readdirSync(outputPath)
    .filter(f => f.endsWith('.csv') || f.endsWith('.md'))
    .map(f => {
      const filePath = path.join(outputPath, f);
      const stats = fs.statSync(filePath);
      return {
        name: f,
        path: filePath,
        size: stats.size,
        mtime: stats.mtime
      };
    })
    .sort((a, b) => b.mtime - a.mtime);

  return files;
}

module.exports = {
  generateReports,
  generateSummaryReport,
  listReports,
  generateTimestamp,
  ensureOutputDir
};
