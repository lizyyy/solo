import { ValidationIssue } from '../types';
import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';

export async function exportIssues(issues: ValidationIssue[], outputPath: string): Promise<void> {
  if (issues.length === 0) {
    console.log('没有问题需要导出');
    return;
  }

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'severity', title: '严重程度' },
      { id: 'category', title: '类别' },
      { id: 'field', title: '字段' },
      { id: 'message', title: '消息' },
      { id: 'transactionId', title: '交易ID' },
      { id: 'templateName', title: '模板名称' },
      { id: 'printerModel', title: '打印机型号' },
      { id: 'lineNumber', title: '行号' }
    ],
    encoding: 'utf8'
  });

  const records = issues.map(issue => ({
    severity: issue.severity,
    category: issue.category,
    field: issue.field || '',
    message: issue.message,
    transactionId: issue.transactionId || '',
    templateName: issue.templateName || '',
    printerModel: issue.printerModel || '',
    lineNumber: issue.lineNumber || ''
  }));

  await csvWriter.writeRecords(records);
  console.log(`成功导出 ${issues.length} 个问题到: ${outputPath}`);
}

export function printIssuesSummary(issues: ValidationIssue[]): void {
  if (issues.length === 0) {
    console.log('\n✓ 验证通过，未发现任何问题\n');
    return;
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  console.log('\n' + '='.repeat(60));
  console.log('验证结果汇总');
  console.log('='.repeat(60));
  console.log(`  错误 (Error):   ${errorCount}`);
  console.log(`  警告 (Warning): ${warningCount}`);
  console.log(`  信息 (Info):    ${infoCount}`);
  console.log('='.repeat(60) + '\n');

  if (errorCount > 0) {
    console.log('\n错误详情:');
    console.log('-'.repeat(60));
    issues.filter(i => i.severity === 'error').forEach((issue, index) => {
      console.log(`\n[${index + 1}] ${issue.category}`);
      console.log(`    消息: ${issue.message}`);
      if (issue.templateName) console.log(`    模板: ${issue.templateName}`);
      if (issue.transactionId) console.log(`    交易: ${issue.transactionId}`);
      if (issue.printerModel) console.log(`    打印机: ${issue.printerModel}`);
      if (issue.field) console.log(`    字段: ${issue.field}`);
      if (issue.lineNumber) console.log(`    行号: ${issue.lineNumber}`);
    });
  }

  if (warningCount > 0) {
    console.log('\n警告详情:');
    console.log('-'.repeat(60));
    issues.filter(i => i.severity === 'warning').forEach((issue, index) => {
      console.log(`\n[${index + 1}] ${issue.category}`);
      console.log(`    消息: ${issue.message}`);
      if (issue.templateName) console.log(`    模板: ${issue.templateName}`);
      if (issue.transactionId) console.log(`    交易: ${issue.transactionId}`);
      if (issue.printerModel) console.log(`    打印机: ${issue.printerModel}`);
      if (issue.field) console.log(`    字段: ${issue.field}`);
      if (issue.lineNumber) console.log(`    行号: ${issue.lineNumber}`);
    });
  }
}