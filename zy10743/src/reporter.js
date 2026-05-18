const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

function generateReport(parseResult, validationResult, aggregationResult, options = {}) {
  const { outputDir = './output', fileNamePrefix = 'budget_recalc' } = options;
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  const summaryReport = generateSummaryReport(parseResult, validationResult, aggregationResult);
  const exceptionReport = generateExceptionReport(validationResult, aggregationResult);
  const detailReport = generateDetailReport(aggregationResult);
  
  const summaryPath = path.join(outputDir, `${fileNamePrefix}_汇总报告_${timestamp}.json`);
  const exceptionPath = path.join(outputDir, `${fileNamePrefix}_异常报告_${timestamp}.json`);
  const detailPath = path.join(outputDir, `${fileNamePrefix}_调拨明细_${timestamp}.csv`);
  
  fs.writeFileSync(summaryPath, JSON.stringify(summaryReport, null, 2));
  fs.writeFileSync(exceptionPath, JSON.stringify(exceptionReport, null, 2));
  fs.writeFileSync(detailPath, recordsToCSV(detailReport));
  
  return {
    summaryPath,
    exceptionPath,
    detailPath,
    summaryReport,
    exceptionReport,
    detailReport
  };
}

function generateSummaryReport(parseResult, validationResult, aggregationResult) {
  return {
    报告标题: '报销预算文件科目调拨复算汇总报告',
    复算批次: aggregationResult.runId,
    复算时间: aggregationResult.runTimestamp,
    解析统计: {
      文件类型: parseResult.metadata.fileType,
      总记录数: parseResult.metadata.recordCount,
      解析字段: parseResult.metadata.fields
    },
    校验统计: {
      校验通过: validationResult.summary.valid,
      校验错误: validationResult.summary.error,
      警告数量: validationResult.summary.warnings
    },
    汇总统计: {
      处理记录数: aggregationResult.statistics.processedRecords,
      跳过记录数: aggregationResult.statistics.skippedRecords,
      退款记录数: aggregationResult.statistics.refundRecords,
      总调拨金额: aggregationResult.statistics.totalTransferAmount,
      总退款金额: aggregationResult.statistics.totalRefundAmount
    },
    科目调拨汇总: aggregationResult.subjectChanges.map(s => ({
      预算科目: s.预算科目,
      原预算占用: formatAmount(s.原预算占用),
      调入金额: formatAmount(s.调入金额),
      调出金额: formatAmount(s.调出金额),
      冲销金额: formatAmount(s.冲销金额),
      调拨后占用: formatAmount(s.调拨后占用),
      净变动: formatAmount(s.净变动)
    })),
    部门调拨汇总: Object.entries(aggregationResult.departmentSummary).map(([dept, data]) => ({
      部门: dept,
      总调拨金额: formatAmount(data.总调拨金额),
      记录数: data.记录数
    }))
  };
}

function generateExceptionReport(validationResult, aggregationResult) {
  return {
    报告标题: '报销预算文件科目调拨复算异常报告',
    复算批次: aggregationResult.runId,
    复算时间: aggregationResult.runTimestamp,
    异常概览: {
      错误总数: validationResult.errors.length,
      警告总数: validationResult.warnings.length,
      跳过记录数: aggregationResult.skippedRecords.length
    },
    错误明细: validationResult.errors.map(e => ({
      错误类型: e.type,
      严重程度: e.severity,
      所在行: e.row,
      报销单号: e.报销单号,
      原预算科目: e.原预算科目,
      调拨后预算科目: e.调拨后预算科目,
      错误描述: e.message
    })),
    警告明细: validationResult.warnings.map(w => ({
      警告类型: w.type,
      严重程度: w.severity,
      所在行: w.row,
      报销单号: w.报销单号,
      原预算科目: w.原预算科目,
      调拨后预算科目: w.调拨后预算科目,
      警告描述: w.message
    })),
    跳过处理明细: aggregationResult.skippedRecords.map(r => ({
      所在行: r.rowNumber,
      报销单号: r.报销单号,
      申请人: r.申请人,
      部门: r.部门,
      原预算科目: r.原预算科目,
      调拨后预算科目: r.调拨后预算科目,
      报销金额: r.报销金额,
      跳过原因: r.skipReason
    }))
  };
}

function generateDetailReport(aggregationResult) {
  return aggregationResult.transferRecords.map(r => ({
    报销单号: r.报销单号,
    申请人: r.申请人,
    部门: r.部门,
    原预算科目: r.原预算科目,
    调拨后预算科目: r.调拨后预算科目,
    调拨金额: r.调拨金额,
    调拨类型: r.调拨类型,
    处理状态: r.处理状态,
    处理备注: r.处理备注
  }));
}

function formatAmount(amount) {
  return Number(amount).toFixed(2);
}

function recordsToCSV(records) {
  if (records.length === 0) return '';
  
  const headers = Object.keys(records[0]);
  const headerLine = headers.join(',');
  
  const dataLines = records.map(record => 
    headers.map(h => {
      const value = record[h] || '';
      return typeof value === 'string' && value.includes(',') 
        ? `"${value}"` 
        : value;
    }).join(',')
  );
  
  return [headerLine, ...dataLines].join('\n');
}

function printConsoleReport(summaryReport, exceptionReport) {
  console.log('\n');
  console.log(chalk.bold.blue('═══════════════════════════════════════════════════════════'));
  console.log(chalk.bold.blue('         报销预算文件科目调拨复算结果报告'));
  console.log(chalk.bold.blue('═══════════════════════════════════════════════════════════'));
  console.log('');
  
  console.log(chalk.bold.white('📊 复算基本信息:'));
  console.log(`   复算批次: ${summaryReport.复算批次}`);
  console.log(`   复算时间: ${summaryReport.复算时间}`);
  console.log('');
  
  console.log(chalk.bold.white('📈 处理统计:'));
  console.log(`   总记录数: ${summaryReport.解析统计.总记录数}`);
  console.log(`   ${chalk.green('✓ 校验通过:')} ${summaryReport.校验统计.校验通过}`);
  console.log(`   ${chalk.red('✗ 校验错误:')} ${summaryReport.校验统计.校验错误}`);
  console.log(`   ${chalk.yellow('⚠ 警告数量:')} ${summaryReport.校验统计.警告数量}`);
  console.log(`   ${chalk.cyan('→ 处理记录:')} ${summaryReport.汇总统计.处理记录数}`);
  console.log(`   ${chalk.gray('⊘ 跳过记录:')} ${summaryReport.汇总统计.跳过记录数}`);
  console.log(`   ${chalk.magenta('↺ 退款记录:')} ${summaryReport.汇总统计.退款记录数}`);
  console.log('');
  
  console.log(chalk.bold.white('💰 金额统计:'));
  console.log(`   总调拨金额: ¥${summaryReport.汇总统计.总调拨金额}`);
  console.log(`   总退款金额: ¥${summaryReport.汇总统计.总退款金额}`);
  console.log('');
  
  if (exceptionReport.错误明细.length > 0) {
    console.log(chalk.bold.red('❌ 错误明细:'));
    exceptionReport.错误明细.slice(0, 5).forEach(e => {
      console.log(`   [${e.所在行}行] ${e.报销单号}: ${e.错误描述}`);
    });
    if (exceptionReport.错误明细.length > 5) {
      console.log(`   ...还有 ${exceptionReport.错误明细.length - 5} 条错误`);
    }
    console.log('');
  }
  
  if (exceptionReport.警告明细.length > 0) {
    console.log(chalk.bold.yellow('⚠️ 警告明细:'));
    exceptionReport.警告明细.slice(0, 5).forEach(w => {
      console.log(`   [${w.所在行}行] ${w.报销单号}: ${w.警告描述}`);
    });
    if (exceptionReport.警告明细.length > 5) {
      console.log(`   ...还有 ${exceptionReport.警告明细.length - 5} 条警告`);
    }
    console.log('');
  }
  
  console.log(chalk.bold.white('📂 输出文件:'));
  console.log('   请查看 output 目录下的详细报告文件');
  console.log('');
  console.log(chalk.bold.blue('═══════════════════════════════════════════════════════════'));
  console.log('\n');
}

module.exports = {
  generateReport,
  printConsoleReport,
  recordsToCSV
};
