const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

function generateReports(aggregatedResults, outputDir, runId, validationResults) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPrefix = `资产借还台账逾期催还名单_${runId || timestamp}`;

  const reports = {
    reminderReport: generateReminderReport(aggregatedResults.reminderList),
    exceptionReport: generateExceptionReport(aggregatedResults, validationResults),
    summaryReport: generateSummaryReport(aggregatedResults, validationResults)
  };

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const reminderPath = path.join(outputDir, `${reportPrefix}_催还名单.xlsx`);
  const exceptionPath = path.join(outputDir, `${reportPrefix}_异常报告.xlsx`);
  const summaryPath = path.join(outputDir, `${reportPrefix}_汇总报告.txt`);

  writeExcel(reminderPath, [
    { name: '逾期催还名单', data: reports.reminderReport }
  ]);

  writeExcel(exceptionPath, [
    { name: '文件异常', data: reports.exceptionReport.fileErrors },
    { name: '数据错误', data: reports.exceptionReport.dataErrors },
    { name: '重复记录', data: reports.exceptionReport.duplicateRecords },
    { name: '特殊情况', data: reports.exceptionReport.specialCases }
  ]);

  fs.writeFileSync(summaryPath, reports.summaryReport, 'utf8');

  return {
    reminderReport: reminderPath,
    exceptionReport: exceptionPath,
    summaryReport: summaryPath,
    stats: {
      reminderCount: aggregatedResults.reminderList.length,
      errorCount: aggregatedResults.errors.length,
      specialCaseCount: aggregatedResults.specialCases.length
    }
  };
}

function generateReminderReport(reminderList) {
  if (reminderList.length === 0) {
    return [];
  }

  return reminderList.map((item, index) => ({
    '序号': index + 1,
    '资产编号': item.资产编号,
    '资产名称': item.资产名称,
    '借用人工号': item.借用人工号,
    '借用人姓名': item.借用人姓名,
    '借用部门': item.借用部门,
    '借用日期': item.借用日期,
    '应归还日期': item.应归还日期,
    '逾期天数': item.逾期天数,
    '逾期状态': item.逾期状态,
    '资产状态': item.资产状态,
    '来源文件': item.来源文件
  }));
}

function generateExceptionReport(aggregatedResults, validationResults) {
  return {
    fileErrors: aggregatedResults.errors.map((err, idx) => ({
      '序号': idx + 1,
      '错误类型': err.type,
      '错误信息': err.message,
      '严重程度': err.severity,
      '相关文件': err.fileName || '-'
    })),

    dataErrors: aggregatedResults.specialCases
      .filter(sc => sc.requiresAttention)
      .map((sc, idx) => ({
        '序号': idx + 1,
        '异常类型': sc.type,
        '资产编号': sc.assetId,
        '资产名称': sc.assetName,
        '借用人姓名': sc.employeeName,
        '借用人工号': sc.employeeId,
        '异常信息': sc.message,
        '来源文件': sc.sourceFile
      })),

    duplicateRecords: (validationResults?.duplicateRecords || []).map((dr, idx) => ({
      '序号': idx + 1,
      '资产编号': dr.record['资产编号'],
      '资产名称': dr.record['资产名称'],
      '重复行号': dr.rowNumber,
      '来源文件': dr.sourceFile,
      '说明': dr.message
    })),

    specialCases: aggregatedResults.specialCases
      .filter(sc => sc.shouldExclude)
      .map((sc, idx) => ({
        '序号': idx + 1,
        '处理类型': '跳过催还',
        '资产编号': sc.assetId,
        '资产名称': sc.assetName,
        '借用人姓名': sc.employeeName,
        '原因': sc.message,
        '来源文件': sc.sourceFile
      }))
  };
}

function generateSummaryReport(aggregatedResults, validationResults) {
  const summary = aggregatedResults.summary;
  const lines = [];

  lines.push('='.repeat(60));
  lines.push('        资产借还台账逾期催还名单 - 汇总报告');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push('');

  lines.push('【统计概览】');
  lines.push('-' .repeat(40));
  lines.push(`有效记录总数: ${summary.totalRecords}`);
  lines.push(`需催还记录数: ${summary.overdueCount + summary.dueTodayCount}`);
  lines.push(`  - 已逾期: ${summary.overdueCount} 条`);
  lines.push(`  - 今日到期: ${summary.dueTodayCount} 条`);
  lines.push(`  - 即将到期(3天内): ${summary.dueSoonCount} 条`);
  lines.push('');

  lines.push('【部门分布统计】');
  lines.push('-' .repeat(40));
  Object.entries(summary.byDepartment).forEach(([dept, count]) => {
    lines.push(`  ${dept}: ${count} 条`);
  });
  if (Object.keys(summary.byDepartment).length === 0) {
    lines.push('  无');
  }
  lines.push('');

  lines.push('【员工借用统计 Top 10】');
  lines.push('-' .repeat(40));
  const sortedEmployees = Object.entries(summary.byEmployee)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  if (sortedEmployees.length > 0) {
    sortedEmployees.forEach(([emp, count], idx) => {
      lines.push(`  ${idx + 1}. ${emp}: ${count} 条`);
    });
  } else {
    lines.push('  无');
  }
  lines.push('');

  lines.push('【特殊情况说明】');
  lines.push('-' .repeat(40));
  const repairCount = aggregatedResults.specialCases.filter(sc => sc.type === 'ASSET_UNDER_REPAIR').length;
  const resignedCount = aggregatedResults.specialCases.filter(sc => sc.type === 'EMPLOYEE_RESIGNED').length;
  const transferCount = aggregatedResults.specialCases.filter(sc => sc.type === 'DEPARTMENT_TRANSFER').length;
  
  lines.push(`  - 资产维修中（已跳过催还）: ${repairCount} 条`);
  lines.push(`  - 员工离职（需特殊处理）: ${resignedCount} 条`);
  lines.push(`  - 部门转移（需核实去向）: ${transferCount} 条`);
  if (validationResults?.duplicateRecords?.length > 0) {
    lines.push(`  - 重复资产编号: ${validationResults.duplicateRecords.length} 条`);
  }
  lines.push('');

  lines.push('【异常统计】');
  lines.push('-' .repeat(40));
  lines.push(`  文件错误: ${aggregatedResults.errors.length} 个`);
  if (validationResults?.invalidRecords?.length > 0) {
    lines.push(`  无效记录: ${validationResults.invalidRecords.length} 条`);
  }
  lines.push('');

  lines.push('='.repeat(60));
  lines.push('报告结束');
  lines.push('='.repeat(60));

  return lines.join('\n');
}

function writeExcel(filePath, sheets) {
  const workbook = xlsx.utils.book_new();
  
  sheets.forEach(sheet => {
    const worksheet = xlsx.utils.json_to_sheet(sheet.data);
    xlsx.utils.book_append_sheet(workbook, worksheet, sheet.name);
  });

  xlsx.writeFile(workbook, filePath);
}

module.exports = {
  generateReports
};
