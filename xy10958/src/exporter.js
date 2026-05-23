const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const XLSX = require('xlsx');
const { VALID_SIZES } = require('./constants');

function ensureOutputDir(outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
}

function printTerminalSummary(result) {
  const { data, badRows, mergedData, duplicates, summary } = result;

  console.log('\n' + '='.repeat(60));
  console.log('📊 校服尺码统计摘要');
  console.log('='.repeat(60));
  
  console.log(`\n📋 总记录数: ${data.length}`);
  console.log(`✅ 有效记录数: ${mergedData.length}`);
  console.log(`⚠️  异常/坏行数: ${badRows.length}`);
  console.log(`🔄 重复记录数: ${duplicates.length}`);

  console.log('\n📈 各尺码总数:');
  Object.entries(summary.bySize).forEach(([size, count]) => {
    console.log(`   ${size.padEnd(6)}: ${count}套`);
  });

  console.log('\n🏫 各班级统计:');
  Object.entries(summary.byClass).forEach(([className, data]) => {
    console.log(`   ${className.padEnd(10)}: ${data.total}人`);
  });

  if (badRows.length > 0) {
    console.log('\n❌ 坏行详情 (原始行号):');
    badRows.forEach(bad => {
      console.log(`   第${bad.row}行: ${bad.errors.join(', ')}`);
    });
  }

  if (duplicates.length > 0) {
    console.log('\n🔄 重复记录 (已合并):');
    duplicates.forEach(dup => {
      console.log(`   ${dup.name} (${dup.className}) - 原始行: ${dup.originalRows.join(', ')}`);
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

async function exportMachineReadable(result, outputDir) {
  const outputPath = path.join(outputDir, 'statistics.json');
  
  const exportData = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalRecords: result.data.length,
      validRecords: result.mergedData.length,
      badRecords: result.badRows.length,
      duplicateRecords: result.duplicates.length,
      bySize: result.summary.bySize,
      byClass: result.summary.byClass,
    },
    classSizeMatrix: result.summary.matrix,
    students: result.mergedData.map(r => ({
      name: r.name,
      className: r.className,
      size: r.size,
      originalSize: r.originalSize,
      supplement: r.supplement,
      remark: r.remark,
      originalRow: r.originalRow,
    })),
    badRows: result.badRows,
    duplicates: result.duplicates,
  };

  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf8');
  return outputPath;
}

async function exportCSVReport(result, outputDir) {
  const outputPath = path.join(outputDir, 'class-size-summary.csv');
  
  const allSizes = Object.keys(result.summary.bySize).sort((a, b) => {
    const aNum = parseInt(a);
    const bNum = parseInt(b);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    if (!isNaN(aNum)) return -1;
    if (!isNaN(bNum)) return 1;
    return a.localeCompare(b);
  });
  
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'className', title: '班级' },
      ...allSizes.map(s => ({ id: s, title: s })),
      { id: 'total', title: '合计' },
    ],
  });

  const records = Object.entries(result.summary.matrix).map(([className, sizes]) => {
    const row = { className };
    allSizes.forEach(s => {
      row[s] = sizes[s] || 0;
    });
    row.total = result.summary.byClass[className].total;
    return row;
  });

  const totalRow = { className: '总计' };
  allSizes.forEach(s => {
    totalRow[s] = result.summary.bySize[s] || 0;
  });
  totalRow.total = Object.values(result.summary.bySize).reduce((a, b) => a + b, 0);
  records.push(totalRow);

  await csvWriter.writeRecords(records);
  return outputPath;
}

async function exportStudentList(result, outputDir) {
  const outputPath = path.join(outputDir, 'student-size-list.csv');
  
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'originalRow', title: '原始行号' },
      { id: 'className', title: '班级' },
      { id: 'name', title: '姓名' },
      { id: 'size', title: '标准化尺码' },
      { id: 'originalSize', title: '原始尺码' },
      { id: 'supplement', title: '增补' },
      { id: 'remark', title: '备注' },
    ],
  });

  const records = result.mergedData.map(r => ({
    originalRow: r.originalRow,
    className: r.className,
    name: r.name,
    size: r.size,
    originalSize: r.originalSize,
    supplement: r.supplement,
    remark: r.remark,
  }));

  await csvWriter.writeRecords(records);
  return outputPath;
}

async function exportBadRows(result, outputDir) {
  if (result.badRows.length === 0) return null;
  
  const outputPath = path.join(outputDir, 'bad-rows.csv');
  
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'originalRow', title: '原始行号' },
      { id: 'name', title: '姓名' },
      { id: 'className', title: '班级' },
      { id: 'size', title: '尺码' },
      { id: 'errors', title: '错误信息' },
    ],
  });

  const records = result.badRows.map(r => ({
    originalRow: r.row,
    name: r.data.name || '',
    className: r.data.className || '',
    size: r.data.size || '',
    errors: r.errors.join('; '),
  }));

  await csvWriter.writeRecords(records);
  return outputPath;
}

function exportFriendlyReport(result, outputDir) {
  const outputPath = path.join(outputDir, '校服订购报告.txt');
  
  const allSizes = Object.keys(result.summary.bySize).sort((a, b) => {
    const aNum = parseInt(a);
    const bNum = parseInt(b);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    if (!isNaN(aNum)) return -1;
    if (!isNaN(bNum)) return 1;
    return a.localeCompare(b);
  });
  const totalStudents = Object.values(result.summary.bySize).reduce((a, b) => a + b, 0);
  
  let report = '';
  report += '╔' + '═'.repeat(58) + '╗\n';
  report += '║' + ' '.repeat(15) + '校服订购汇总报告' + ' '.repeat(25) + '║\n';
  report += '╚' + '═'.repeat(58) + '╝\n\n';
  
  report += `生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
  report += `统计范围: ${Object.keys(result.summary.byClass).length}个班级，共${totalStudents}名学生\n\n`;
  
  report += '━'.repeat(60) + '\n';
  report += '【一、各尺码汇总】\n';
  report += '━'.repeat(60) + '\n';
  
  allSizes.forEach(size => {
    const count = result.summary.bySize[size] || 0;
    const percentage = ((count / totalStudents) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / totalStudents * 30));
    report += `${size.padEnd(6)} ${String(count).padStart(3)}套 ${percentage.padStart(5)}% ${bar}\n`;
  });
  
  report += '\n' + '━'.repeat(60) + '\n';
  report += '【二、各班级尺码分布】\n';
  report += '━'.repeat(60) + '\n';
  
  Object.entries(result.summary.byClass).forEach(([className, classData]) => {
    report += `\n■ ${className} (${classData.total}人)\n`;
    Object.entries(classData.sizes).forEach(([size, count]) => {
      report += `  ${size}: ${count}套  `;
    });
    report += '\n';
  });
  
  if (result.duplicates.length > 0) {
    report += '\n' + '━'.repeat(60) + '\n';
    report += '【三、特殊说明 - 重复记录】\n';
    report += '━'.repeat(60) + '\n';
    result.duplicates.forEach(dup => {
      report += `• ${dup.name} (${dup.className}) - 发现${dup.originalRows.length}条记录，已合并\n`;
      if (dup.sizes[0] !== dup.sizes[1]) {
        report += `  注意：尺码存在差异 ${dup.sizes.join(' / ')}\n`;
      }
    });
  }
  
  if (result.badRows.length > 0) {
    report += '\n' + '━'.repeat(60) + '\n';
    report += '【四、异常数据清单】\n';
    report += '━'.repeat(60) + '\n';
    result.badRows.forEach(bad => {
      report += `• 第${bad.row}行: ${bad.errors.join(', ')}\n`;
    });
  }
  
  report += '\n' + '═'.repeat(60) + '\n';
  report += '报告结束\n';
  
  fs.writeFileSync(outputPath, report, 'utf8');
  return outputPath;
}

async function exportAll(result, outputDir) {
  outputDir = ensureOutputDir(outputDir);
  
  const outputs = [];
  
  outputs.push({ type: 'JSON数据', path: await exportMachineReadable(result, outputDir) });
  outputs.push({ type: '班级尺码汇总CSV', path: await exportCSVReport(result, outputDir) });
  outputs.push({ type: '学生清单CSV', path: await exportStudentList(result, outputDir) });
  
  const badRowsPath = await exportBadRows(result, outputDir);
  if (badRowsPath) {
    outputs.push({ type: '异常行记录', path: badRowsPath });
  }
  
  outputs.push({ type: '友好格式报告', path: exportFriendlyReport(result, outputDir) });
  
  return { outputDir, outputs };
}

function printExportResult(exportResult) {
  console.log('📁 输出文件已生成:');
  exportResult.outputs.forEach(output => {
    console.log(`   ✅ ${output.type}`);
    console.log(`      ${output.path}`);
  });
  console.log(`\n📂 输出目录: ${exportResult.outputDir}`);
}

module.exports = {
  ensureOutputDir,
  printTerminalSummary,
  exportMachineReadable,
  exportCSVReport,
  exportStudentList,
  exportBadRows,
  exportFriendlyReport,
  exportAll,
  printExportResult,
};
