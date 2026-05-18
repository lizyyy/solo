import fs from 'fs/promises';
import path from 'path';
import { stringify } from 'csv-stringify/sync';

export async function generateReports(outputDir, results) {
  const {
    analysis,
    summary,
    validationErrors,
    parseErrors,
    fileResults,
    allRecords
  } = results;

  await fs.mkdir(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().slice(0, 10);

  await generateSummaryReport(outputDir, timestamp, summary, fileResults);
  await generateFalseTransferReport(outputDir, timestamp, analysis.falseTransfers);
  await generateMissedTransferReport(outputDir, timestamp, analysis.missedTransfers);
  await generateExceptionReport(outputDir, timestamp, validationErrors, parseErrors);
  await generateDetailedReport(outputDir, timestamp, allRecords);

  return {
    summaryFile: path.join(outputDir, `统计汇总_${timestamp}.csv`),
    falseTransferFile: path.join(outputDir, `误转明细_${timestamp}.csv`),
    missedTransferFile: path.join(outputDir, `漏转明细_${timestamp}.csv`),
    exceptionFile: path.join(outputDir, `异常报告_${timestamp}.csv`),
    detailedFile: path.join(outputDir, `完整统计_${timestamp}.csv`)
  };
}

async function generateSummaryReport(outputDir, timestamp, summary, fileResults) {
  const rows = [
    ['客服会话导出机器人转人工统计 - 汇总报告'],
    ['生成时间', new Date().toLocaleString('zh-CN')],
    [''],
    ['一、处理文件列表'],
    ['文件名', '记录数', '异常数']
  ];

  for (const file of fileResults) {
    rows.push([file.fileName, file.recordCount, file.errorCount]);
  }

  rows.push(
    [''],
    ['二、总体统计'],
    ['指标', '数值'],
    ['总会话数', summary.totals.总会话数],
    ['误转数', summary.totals.误转数],
    ['漏转数', summary.totals.漏转数],
    ['正常处理数', summary.totals.正常处理数],
    ['误转率', summary.rates.误转率],
    ['漏转率', summary.rates.漏转率],
    [''],
    ['三、误转原因分布'],
    ['误转原因', '数量']
  );

  for (const [reason, count] of Object.entries(summary.falseTransferBreakdown)) {
    rows.push([reason, count]);
  }

  rows.push(
    [''],
    ['四、漏转原因分布'],
    ['漏转原因', '数量']
  );

  for (const [reason, count] of Object.entries(summary.missedTransferBreakdown)) {
    rows.push([reason, count]);
  }

  if (Object.keys(summary.errorSummary).length > 0) {
    rows.push(
      [''],
      ['五、异常统计'],
      ['异常类型', '数量']
    );

    for (const [type, count] of Object.entries(summary.errorSummary)) {
      rows.push([type, count]);
    }
  }

  const csv = stringify(rows);
  await fs.writeFile(path.join(outputDir, `统计汇总_${timestamp}.csv`), csv, 'utf-8');
}

async function generateFalseTransferReport(outputDir, timestamp, records) {
  const rows = [
    ['客服会话导出机器人转人工统计 - 误转明细'],
    ['会话ID', '开始时间', '用户ID', '机器人处理结果', '转人工时间', '转人工原因', '客服ID', '会话标签', '误转判定原因', '来源文件', '行号']
  ];

  for (const record of records) {
    rows.push([
      record.data['会话ID'],
      record.data['开始时间'],
      record.data['用户ID'],
      record.data['机器人处理结果'],
      record.data['转人工时间'],
      record.data['转人工原因'],
      record.data['客服ID'],
      record.data['会话标签'],
      record.analysis.reason,
      record.sourceFile,
      record.rowNumber
    ]);
  }

  const csv = stringify(rows);
  await fs.writeFile(path.join(outputDir, `误转明细_${timestamp}.csv`), csv, 'utf-8');
}

async function generateMissedTransferReport(outputDir, timestamp, records) {
  const rows = [
    ['客服会话导出机器人转人工统计 - 漏转明细'],
    ['会话ID', '开始时间', '用户ID', '机器人处理结果', '会话标签', '漏转判定原因', '来源文件', '行号']
  ];

  for (const record of records) {
    rows.push([
      record.data['会话ID'],
      record.data['开始时间'],
      record.data['用户ID'],
      record.data['机器人处理结果'],
      record.data['会话标签'],
      record.analysis.reason,
      record.sourceFile,
      record.rowNumber
    ]);
  }

  const csv = stringify(rows);
  await fs.writeFile(path.join(outputDir, `漏转明细_${timestamp}.csv`), csv, 'utf-8');
}

async function generateExceptionReport(outputDir, timestamp, validationErrors, parseErrors) {
  const rows = [
    ['客服会话导出机器人转人工统计 - 异常报告'],
    ['生成时间', new Date().toLocaleString('zh-CN')],
    [''],
    ['异常类型', '严重程度', '会话ID', '关联字段', '原因说明', '来源文件', '行号']
  ];

  for (const err of parseErrors) {
    rows.push([
      err.type,
      err.severity || 'fatal',
      '',
      '',
      err.reason,
      err.file || '',
      ''
    ]);
  }

  for (const err of validationErrors) {
    rows.push([
      err.type,
      err.severity || 'warning',
      err.sessionId || '',
      err.field || '',
      err.reason || err.context || '',
      err.file || '',
      err.row || ''
    ]);
  }

  const csv = stringify(rows);
  await fs.writeFile(path.join(outputDir, `异常报告_${timestamp}.csv`), csv, 'utf-8');
}

async function generateDetailedReport(outputDir, timestamp, records) {
  const rows = [
    ['客服会话导出机器人转人工统计 - 完整明细'],
    ['会话ID', '开始时间', '结束时间', '用户ID', '机器人处理结果', '是否转人工', '转人工时间', '转人工原因', '客服ID', '会话标签', '分析结果', '判定原因', '异常标记', '来源文件', '行号']
  ];

  for (const record of records) {
    const flags = [];
    if (record.hasDuplicateTransfers) flags.push('多次转接');
    if (record.missingTag) flags.push('标签缺失');

    rows.push([
      record.data['会话ID'],
      record.data['开始时间'],
      record.data['结束时间'],
      record.data['用户ID'],
      record.data['机器人处理结果'],
      record.data['是否转人工'],
      record.data['转人工时间'],
      record.data['转人工原因'],
      record.data['客服ID'],
      record.data['会话标签'],
      record.analysis.type,
      record.analysis.reason || '-',
      flags.join('; ') || '-',
      record.sourceFile,
      record.rowNumber
    ]);
  }

  const csv = stringify(rows);
  await fs.writeFile(path.join(outputDir, `完整统计_${timestamp}.csv`), csv, 'utf-8');
}

export function printConsoleSummary(summary, reportFiles) {
  console.log('\n' + '='.repeat(60));
  console.log('    客服会话导出机器人转人工统计 - 运行报告');
  console.log('='.repeat(60));
  console.log('\n【总体统计】');
  console.log(`  总会话数: ${summary.totals.总会话数}`);
  console.log(`  误转数: ${summary.totals.误转数} (${summary.rates.误转率})`);
  console.log(`  漏转数: ${summary.totals.漏转数} (${summary.rates.漏转率})`);
  console.log(`  正常处理数: ${summary.totals.正常处理数}`);

  console.log('\n【误转原因分布】');
  for (const [reason, count] of Object.entries(summary.falseTransferBreakdown)) {
    console.log(`  ${reason}: ${count}`);
  }

  console.log('\n【漏转原因分布】');
  for (const [reason, count] of Object.entries(summary.missedTransferBreakdown)) {
    console.log(`  ${reason}: ${count}`);
  }

  if (Object.keys(summary.errorSummary).length > 0) {
    console.log('\n【异常统计】');
    for (const [type, count] of Object.entries(summary.errorSummary)) {
      console.log(`  ${type}: ${count}`);
    }
  }

  console.log('\n【输出文件】');
  for (const [name, file] of Object.entries(reportFiles)) {
    console.log(`  ${name}: ${file}`);
  }

  console.log('\n' + '='.repeat(60) + '\n');
}