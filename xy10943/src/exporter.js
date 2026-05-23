const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');

async function exportResults(data, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  const jsonPath = path.join(outputDir, `audit-result-${timestamp}.json`);
  await fs.promises.writeFile(jsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(chalk.green(`✓ 机器可读结果已导出: ${jsonPath}`));
  
  const reportPath = path.join(outputDir, `audit-report-${timestamp}.md`);
  const markdown = generateMarkdownReport(data, timestamp);
  await fs.promises.writeFile(reportPath, markdown, 'utf8');
  console.log(chalk.green(`✓ 归档报告已导出: ${reportPath}`));
  
  if (data.invalidFiles.length > 0) {
    const invalidPath = path.join(outputDir, `invalid-files-${timestamp}.txt`);
    const invalidContent = data.invalidFiles.map(f => 
      `文件: ${f.path}\n原因: ${f.parsed.error}\n原始文件名: ${f.name}\n`
    ).join('\n' + '='.repeat(60) + '\n\n');
    await fs.promises.writeFile(invalidPath, invalidContent, 'utf8');
    console.log(chalk.yellow(`⚠ 异常样本已保留: ${invalidPath}`));
  }
  
  return { jsonPath, reportPath };
}

function generateMarkdownReport(data, timestamp) {
  const lines = [];
  
  lines.push('# 售后照片清点归档报告');
  lines.push('');
  lines.push(`**生成时间**: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`**扫描文件总数**: ${data.validFiles.length + data.invalidFiles.length}`);
  lines.push(`**有效解析文件**: ${data.validFiles.length}`);
  lines.push(`**无法解析文件**: ${data.invalidFiles.length}`);
  lines.push('');
  
  lines.push('## 一、工单完整性统计');
  lines.push('');
  lines.push(`- **总工单数量**: ${data.missingPhotos.totalWorkOrders}`);
  lines.push(`- **完整工单数量**: ${data.missingPhotos.completeWorkOrders} (${((data.missingPhotos.completeWorkOrders / data.missingPhotos.totalWorkOrders) * 100).toFixed(1)}%)`);
  lines.push(`- **缺失照片工单**: ${data.missingPhotos.incompleteWorkOrders}`);
  lines.push('');
  
  if (data.missingPhotos.incompleteWorkOrders > 0) {
    lines.push('### 缺失照片明细');
    lines.push('');
    lines.push('| 客户编号 | 工单号 | 缺失类型 | 已有类型 |');
    lines.push('|---------|--------|---------|---------|');
    
    for (const item of data.missingPhotos.missingItems) {
      lines.push(`| ${item.customerId} | ${item.workOrderId} | ${item.missingTypes.join(', ')} | ${item.presentTypes.join(', ')} |`);
    }
    lines.push('');
  }
  
  lines.push('## 二、重复文件统计');
  lines.push('');
  lines.push(`- **重复文件总数**: ${data.duplicates.totalDuplicates}`);
  lines.push(`- **重复文件组数**: ${data.duplicates.duplicateGroups.length}`);
  lines.push('');
  
  if (data.duplicates.duplicateGroups.length > 0) {
    lines.push('### 重复文件明细');
    lines.push('');
    
    for (let i = 0; i < data.duplicates.duplicateGroups.length; i++) {
      const group = data.duplicates.duplicateGroups[i];
      lines.push(`#### ${i + 1}. 客户 ${group.customerId} - 工单 ${group.workOrderId} - ${group.photoType}`);
      lines.push('');
      lines.push(`- **重复数量**: ${group.count} 个文件`);
      lines.push('- **文件列表**:');
      lines.push('');
      for (const file of group.files) {
        lines.push(`  - \`${file.path}\``);
        lines.push(`    - 大小: ${formatFileSize(file.size)}`);
        lines.push(`    - 修改时间: ${new Date(file.mtime).toLocaleString('zh-CN')}`);
      }
      lines.push('');
    }
  }
  
  if (data.invalidFiles.length > 0) {
    lines.push('## 三、无法解析的文件');
    lines.push('');
    lines.push('| 文件路径 | 解析错误 |');
    lines.push('|---------|---------|');
    
    for (const file of data.invalidFiles) {
      const relativePath = file.path.replace(/\\/g, '\\\\');
      lines.push(`| \`${relativePath}\` | ${file.parsed.error} |`);
    }
    lines.push('');
  }
  
  lines.push('## 四、按客户统计');
  lines.push('');
  
  const customerStats = {};
  for (const file of data.validFiles) {
    const cid = file.parsed.customerId;
    if (!customerStats[cid]) {
      customerStats[cid] = { workOrders: new Set(), photoCount: 0 };
    }
    customerStats[cid].workOrders.add(`${file.parsed.customerId}-${file.parsed.workOrderId}`);
    customerStats[cid].photoCount++;
  }
  
  lines.push('| 客户编号 | 工单数 | 照片数 |');
  lines.push('|---------|--------|--------|');
  
  for (const [cid, stats] of Object.entries(customerStats).sort()) {
    lines.push(`| ${cid} | ${stats.workOrders.size} | ${stats.photoCount} |`);
  }
  lines.push('');
  
  lines.push('---');
  lines.push('*本报告由售后照片清点工具自动生成*');
  
  return lines.join('\n');
}

function printSummary(data) {
  console.log(chalk.bold('\n' + '='.repeat(60)));
  console.log(chalk.bold('                清点结果摘要'));
  console.log(chalk.bold('='.repeat(60) + '\n'));
  
  const statsTable = new Table({
    head: [chalk.cyan('统计项'), chalk.cyan('数值')],
    colWidths: [30, 25]
  });
  
  statsTable.push(
    ['扫描文件总数', data.validFiles.length + data.invalidFiles.length],
    ['有效解析文件', chalk.green(data.validFiles.length.toString())],
    ['无法解析文件', data.invalidFiles.length > 0 ? chalk.yellow(data.invalidFiles.length.toString()) : data.invalidFiles.length.toString()],
    ['工单总数', data.missingPhotos.totalWorkOrders.toString()],
    ['完整工单', chalk.green(data.missingPhotos.completeWorkOrders.toString())],
    ['缺失照片工单', data.missingPhotos.incompleteWorkOrders > 0 ? chalk.red(data.missingPhotos.incompleteWorkOrders.toString()) : data.missingPhotos.incompleteWorkOrders.toString()],
    ['重复文件数', data.duplicates.totalDuplicates > 0 ? chalk.yellow(data.duplicates.totalDuplicates.toString()) : data.duplicates.totalDuplicates.toString()]
  );
  
  console.log(statsTable.toString());
  
  if (data.missingPhotos.incompleteWorkOrders > 0) {
    console.log(chalk.bold.red('\n⚠ 缺失照片工单明细:\n'));
    
    const missingTable = new Table({
      head: [chalk.cyan('客户'), chalk.cyan('工单号'), chalk.cyan('缺失类型')],
      colWidths: [12, 15, 28]
    });
    
    for (const item of data.missingPhotos.missingItems) {
      missingTable.push([
        item.customerId,
        item.workOrderId,
        chalk.red(item.missingTypes.join(', '))
      ]);
    }
    
    console.log(missingTable.toString());
  }
  
  if (data.duplicates.duplicateGroups.length > 0) {
    console.log(chalk.bold.yellow('\n⚠ 重复文件明细 (前5组):\n'));
    
    const dupTable = new Table({
      head: [chalk.cyan('客户'), chalk.cyan('工单号'), chalk.cyan('类型'), chalk.cyan('重复数')],
      colWidths: [12, 15, 12, 10]
    });
    
    const showGroups = data.duplicates.duplicateGroups.slice(0, 5);
    for (const group of showGroups) {
      dupTable.push([
        group.customerId,
        group.workOrderId,
        group.photoType,
        chalk.yellow(group.count.toString())
      ]);
    }
    
    console.log(dupTable.toString());
    
    if (data.duplicates.duplicateGroups.length > 5) {
      console.log(chalk.gray(`  ... 还有 ${data.duplicates.duplicateGroups.length - 5} 组重复文件\n`));
    }
  }
  
  if (data.invalidFiles.length > 0) {
    console.log(chalk.bold.yellow('\n⚠ 无法解析的文件 (前5个):\n'));
    const showFiles = data.invalidFiles.slice(0, 5);
    for (const file of showFiles) {
      console.log(chalk.yellow(`  - ${file.name}`));
      console.log(chalk.gray(`    ${file.parsed.error}`));
    }
    if (data.invalidFiles.length > 5) {
      console.log(chalk.gray(`  ... 还有 ${data.invalidFiles.length - 5} 个文件\n`));
    }
  }
  
  const completeRate = ((data.missingPhotos.completeWorkOrders / data.missingPhotos.totalWorkOrders) * 100).toFixed(1);
  
  console.log(chalk.bold('\n' + '-'.repeat(60)));
  if (completeRate === '100.0') {
    console.log(chalk.green.bold(`  ✓ 照片完整性: ${completeRate}% - 全部完整！`));
  } else if (parseFloat(completeRate) >= 80) {
    console.log(chalk.yellow.bold(`  ⚠ 照片完整性: ${completeRate}% - 基本良好`));
  } else {
    console.log(chalk.red.bold(`  ✗ 照片完整性: ${completeRate}% - 需要补充！`));
  }
  console.log(chalk.bold('-'.repeat(60) + '\n'));
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

module.exports = {
  exportResults,
  printSummary,
  generateMarkdownReport
};
