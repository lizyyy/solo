#!/usr/bin/env node

import { mockRecorderService } from '../services/recorder';
import { exportService } from '../services/export';
import { validSearchKeywordReports, invalidSearchKeywordReports, conflictTestRecords, mixedBatchRecords } from './data';
import { auditStore } from '../store';

function printHeader(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function printResult(result: any) {
  console.log(JSON.stringify(result, null, 2));
}

async function runTests() {
  printHeader('测试1: 提交有效记录');
  const validResult = mockRecorderService.submitRecord(validSearchKeywordReports[0], '测试员A');
  printResult(validResult);

  printHeader('测试2: 提交无效记录 - 下载链接失效');
  const invalidUrlResult = mockRecorderService.submitRecord(invalidSearchKeywordReports[1], '测试员A');
  printResult(invalidUrlResult);

  printHeader('测试3: 重复提交 - 复用旧结论');
  const reuseResult = mockRecorderService.submitRecord(validSearchKeywordReports[0], '测试员A');
  printResult(reuseResult);

  printHeader('测试4: 冲突检测 - 相同内容不同下载链接');
  const conflictResult = mockRecorderService.submitRecord(conflictTestRecords[0], '测试员B');
  printResult(conflictResult);

  printHeader('测试5: 批量提交混合记录');
  const batchResult = mockRecorderService.submitBatch(mixedBatchRecords, '测试员A');
  printResult(batchResult);

  printHeader('测试6: 查询所有失败记录');
  const failedRecords = mockRecorderService.getAllFailedRecords();
  console.log(`失败记录总数: ${failedRecords.records.length}`);
  console.log('按失败类型分组:');
  for (const [type, records] of Object.entries(failedRecords.groupedByFailure)) {
    console.log(`  ${type}: ${records.length} 条`);
  }

  printHeader('测试7: 按失败类型查询 - download_url_invalid');
  const urlInvalidRecords = mockRecorderService.queryByFailureType('download_url_invalid');
  console.log(`下载链接失效的记录数: ${urlInvalidRecords.length}`);

  printHeader('测试8: 导出失败记录为CSV');
  const exportResult = exportService.exportFailedRecords({ format: 'csv' }, '测试员A');
  printResult(exportResult);

  printHeader('测试9: 查看待确认审计记录');
  const pendingConfirmations = auditStore.getPendingConfirmations();
  console.log(`待确认记录数: ${pendingConfirmations.length}`);

  if (pendingConfirmations.length > 0) {
    printHeader('测试10: 确认审计记录');
    const confirmResult = auditStore.confirm(pendingConfirmations[0].id, '审核主管');
    console.log('确认结果:', confirmResult);
  }

  printHeader('测试11: 提交多字段错误的记录');
  const multiErrorResult = mockRecorderService.submitRecord(invalidSearchKeywordReports[8], '测试员A');
  printResult(multiErrorResult);

  printHeader('测试完成');
  console.log('\n命令返回码说明:');
  console.log('  0 - 成功');
  console.log('  1 - 验证失败 (字段错误)');
  console.log('  2 - 冲突检测');
  console.log('  3 - 复用旧结论');
  console.log('');
  console.log('错误体包含字段定位:');
  console.log('  error.details.fieldErrors - 具体字段错误列表');
  console.log('  每个错误包含: field, value, message, failureType');
}

runTests().catch(console.error);
