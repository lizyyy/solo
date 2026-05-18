import fs from 'fs';
import path from 'path';
import { groupErrorsByType } from './validator.js';

export function generateReports(summary, parseResult, validateResult, matchResult, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  
  generateSummaryReport(summary, outputDir, timestamp);
  generateMatchResultsReport(matchResult.allResults, outputDir, timestamp);
  generateExceptionReport(parseResult, validateResult, outputDir, timestamp);

  return {
    summaryReport: path.join(outputDir, `无牌车匹配复核汇总报告_${timestamp}.json`),
    matchReport: path.join(outputDir, `无牌车匹配结果明细_${timestamp}.csv`),
    exceptionReport: path.join(outputDir, `异常报告_${timestamp}.csv`)
  };
}

function generateSummaryReport(summary, outputDir, timestamp) {
  const filePath = path.join(outputDir, `无牌车匹配复核汇总报告_${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(summary, null, 2), 'utf-8');
}

function generateMatchResultsReport(allResults, outputDir, timestamp) {
  const filePath = path.join(outputDir, `无牌车匹配结果明细_${timestamp}.csv`);
  
  const headers = [
    '无牌车流水号',
    '无牌车原始行号',
    '无牌车入场时间',
    '无牌车出场时间',
    '无牌车应收金额',
    '无牌车实收金额',
    '匹配状态',
    '匹配置信度',
    '匹配原因',
    '匹配到流水号',
    '匹配到车牌号',
    '匹配到原始行号',
    '匹配到应收金额',
    '匹配到实收金额',
    '金额差',
    '存在异常'
  ];

  const lines = [headers.join(',')];
  
  allResults.forEach(result => {
    const line = headers.map(h => {
      const value = result[h] ?? '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value;
    }).join(',');
    lines.push(line);
  });

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

function generateExceptionReport(parseResult, validateResult, outputDir, timestamp) {
  const filePath = path.join(outputDir, `异常报告_${timestamp}.csv`);
  
  const headers = [
    '异常类型',
    '流水号',
    '原始行号',
    '车牌号',
    '入场时间',
    '出场时间',
    '异常详情'
  ];

  const lines = [headers.join(',')];
  
  parseResult.parseErrors.forEach(error => {
    lines.push([
      error.type,
      error.lineNumber ? `第${error.lineNumber}行` : '',
      error.lineNumber || '',
      '',
      '',
      '',
      escapeCSV(error.message)
    ].join(','));
  });

  const groupedErrors = groupErrorsByType(validateResult.validationErrors);
  
  Object.keys(groupedErrors).forEach(errorType => {
    groupedErrors[errorType].forEach(error => {
      lines.push([
        errorType,
        error.流水号,
        error.原始行号,
        escapeCSV(error.车牌号 || ''),
        error.入场时间 || '',
        error.出场时间 || '',
        escapeCSV(error.message)
      ].join(','));
    });
  });

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

function escapeCSV(value) {
  if (!value) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function printConsoleSummary(summary) {
  console.log('\n' + '='.repeat(60));
  console.log('        停车场流水无牌车匹配复核 - 执行摘要');
  console.log('='.repeat(60));
  console.log(`报告生成时间: ${new Date(summary.生成时间).toLocaleString()}`);
  console.log('\n【文件统计】');
  console.log(`  总记录数: ${summary.文件统计.总记录数}`);
  console.log(`  解析错误数: ${summary.文件统计.解析错误数}`);
  console.log(`  有效记录数: ${summary.文件统计.有效记录数}`);
  console.log(`  异常记录数: ${summary.文件统计.异常记录数}`);
  console.log('\n【无牌车匹配统计】');
  console.log(`  无牌车总数: ${summary.无牌车匹配统计.无牌车总数}`);
  console.log(`  匹配成功数: ${summary.无牌车匹配统计.匹配成功数}`);
  console.log(`  匹配成功率: ${summary.无牌车匹配统计.匹配成功率}`);
  console.log(`  未匹配数: ${summary.无牌车匹配统计.未匹配数}`);
  console.log(`  匹配成功金额: ¥${summary.无牌车匹配统计.匹配成功金额}`);
  console.log(`  未匹配金额: ¥${summary.无牌车匹配统计.未匹配金额}`);
  console.log('\n【异常类型统计】');
  if (Object.keys(summary.异常类型统计).length === 0) {
    console.log('  无异常');
  } else {
    Object.entries(summary.异常类型统计).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} 条`);
    });
  }
  console.log('\n【金额统计】');
  console.log(`  总实收金额: ¥${summary.金额统计.总实收金额}`);
  console.log(`  无牌车实收金额: ¥${summary.金额统计.无牌车实收金额}`);
  console.log(`  无牌车金额占比: ${summary.金额统计.无牌车金额占比}`);
  console.log('='.repeat(60) + '\n');
}
