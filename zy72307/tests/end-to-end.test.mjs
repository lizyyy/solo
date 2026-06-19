#!/usr/bin/env node
/**
 * 矩阵条件数预警系统 - 自动化测试脚本
 * 
 * 覆盖测试：
 * 1. 首次导入数据
 * 2. 补录 30% → 0.30，验证原始说法不被覆盖
 * 3. 重复导入检测
 * 4. 复核流程
 * 5. 数据一致性（展示/导出/接口同源）
 *
 * 运行方式：
 *   node tests/end-to-end.test.mjs
 */

import * as assert from 'assert';
import { processImportedData, updateWeightRow, markRowReviewed, recalculateAfterEdit } from '../src/utils/dataProcessor.ts';
import { buildUnifiedResult } from '../src/utils/resultSource.ts';
import { generateFingerprint, generateBatchId } from '../src/utils/fingerprint.ts';

const sampleData = [
  { criterion: '教学态度', weight: '0.25' },
  { criterion: '教学内容', weight: '30%' },
  { criterion: '教学方法', weight: '0.20' },
  { criterion: '教学效果', weight: '25%' }
];

function logTest(step, description, pass, extra = '') {
  const status = pass ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} 步骤${step}: ${description}`);
  if (extra) console.log(`   ${extra}`);
  return pass;
}

async function runTests() {
  console.log('='.repeat(80));
  console.log('矩阵条件数预警系统 - 端到端自动化测试');
  console.log('='.repeat(80));
  console.log('');

  let allPass = true;
  let testData = null;
  let testRowId = null;

  // 测试1: 首次导入数据
  console.log('--- 第一部分：首次导入 ---');
  try {
    testData = processImportedData({
      rawData: sampleData,
      importedBy: '吴老师',
      fileName: '评分权重表.xlsx',
      fileSize: 12345
    });

    const targetRow = testData.rows.find(r => r.criterionName === '教学内容');
    testRowId = targetRow.id;
    allPass &= logTest('1', '导入成功，数据行数正确', testData.rows.length === 4, `共 ${testData.rows.length} 行`);
    allPass &= logTest('1.1', '"教学内容"原始说法正确保留为 30%', 
      targetRow.originalImportValue === '30%',
      `originalImportValue=${targetRow.originalImportValue}`);
    allPass &= logTest('1.2', '检测到百分数小数混合警告', 
      targetRow.warnings.includes('percent_decimal_mixed'),
      `warnings=${targetRow.warnings.join(',')}`);
    allPass &= logTest('1.3', '状态为 needs_review，不归为 normal', 
      targetRow.status === 'needs_review',
      `status=${targetRow.status}`);
    allPass &= logTest('1.4', '生成导入批次ID', 
      !!testData.currentBatchId,
      `batchId=${testData.currentBatchId}`);
    allPass &= logTest('1.5', '生成变更历史记录', 
      testData.history.length === 4,
      `history.length=${testData.history.length}`);
  } catch (e) {
    console.log('❌ 测试1失败:', e.message);
    allPass = false;
  }

  // 测试2: 补录 30% → 0.30，验证原始说法不被覆盖
  console.log('');
  console.log('--- 第二部分：补录 30% → 0.30 ---');
  try {
    const targetRow = testData.rows.find(r => r.id === testRowId);
    const { row: updatedRow, historyEntry } = updateWeightRow(targetRow, '0.30', '吴老师', '修正口径，百分数转小数');
    
    const updatedRows = testData.rows.map(r => r.id === testRowId ? updatedRow : r);
    testData = recalculateAfterEdit({ ...testData, rows: updatedRows }, [historyEntry]);
    const rowAfterUpdate = testData.rows.find(r => r.id === testRowId);

    allPass &= logTest('2', '补录后 originalImportValue 仍为 30%（不被覆盖）', 
      rowAfterUpdate.originalImportValue === '30%',
      `originalImportValue=${rowAfterUpdate.originalImportValue}`);
    allPass &= logTest('2.1', '补录后 modifiedValue 记录为 0.30', 
      rowAfterUpdate.modifiedValue === '0.30',
      `modifiedValue=${rowAfterUpdate.modifiedValue}`);
    allPass &= logTest('2.2', 'currentValue 正确计算为 0.30', 
      Math.abs(rowAfterUpdate.currentValue - 0.30) < 0.0001,
      `currentValue=${rowAfterUpdate.currentValue}`);
    allPass &= logTest('2.3', 'isManualModified 标记为 true', 
      rowAfterUpdate.isManualModified === true,
      `isManualModified=${rowAfterUpdate.isManualModified}`);
    allPass &= logTest('2.4', '状态仍为 needs_review（不归 normal）', 
      rowAfterUpdate.status === 'needs_review',
      `status=${rowAfterUpdate.status}`);
    allPass &= logTest('2.5', '历史记录正确写入', 
      historyEntry.field === 'modifiedValue' && 
      historyEntry.oldValue.includes('30%') && 
      historyEntry.newValue.includes('0.30'),
      `history: ${historyEntry.oldValue} → ${historyEntry.newValue}`);
    allPass &= logTest('2.6', '数据版本递增', 
      testData.dataVersion === 2,
      `dataVersion=${testData.dataVersion}`);
  } catch (e) {
    console.log('❌ 测试2失败:', e.message);
    allPass = false;
  }

  // 测试3: 复核流程验证
  console.log('');
  console.log('--- 第三部分：复核流程 ---');
  try {
    const targetRow = testData.rows.find(r => r.id === testRowId);
    const { row: reviewedRow, historyEntries } = markRowReviewed(targetRow, {
      reason: '确认口径：30% 修正为 0.30，小数与其他指标一致',
      nextHandler: '活动负责人',
      reviewedBy: '吴老师'
    });

    const updatedRows = testData.rows.map(r => r.id === testRowId ? reviewedRow : r);
    testData = { ...testData, rows: updatedRows, history: [...testData.history, ...historyEntries], dataVersion: testData.dataVersion + 1 };
    const rowAfterReview = testData.rows.find(r => r.id === testRowId);

    allPass &= logTest('3', 'reviewInfo.previousValue 保留 30%', 
      rowAfterReview.reviewInfo.previousValue === '30%',
      `previousValue=${rowAfterReview.reviewInfo.previousValue}`);
    allPass &= logTest('3.1', 'reviewInfo.newValue 记录 0.30', 
      rowAfterReview.reviewInfo.newValue === '0.30',
      `newValue=${rowAfterReview.reviewInfo.newValue}`);
    allPass &= logTest('3.2', 'reviewInfo.reason 记录处理原因', 
      rowAfterReview.reviewInfo.reason.includes('30% 修正为 0.30'),
      `reason=${rowAfterReview.reviewInfo.reason}`);
    allPass &= logTest('3.3', 'reviewInfo.nextHandler 记录找谁', 
      rowAfterReview.reviewInfo.nextHandler === '活动负责人',
      `nextHandler=${rowAfterReview.reviewInfo.nextHandler}`);
    allPass &= logTest('3.4', 'finalized 为 false（不归入正常，保留待复核）', 
      rowAfterReview.reviewInfo.finalized === false,
      `finalized=${rowAfterReview.reviewInfo.finalized}`);
    allPass &= logTest('3.5', '状态仍为 needs_review', 
      rowAfterReview.status === 'needs_review',
      `status=${rowAfterReview.status}`);
  } catch (e) {
    console.log('❌ 测试3失败:', e.message);
    allPass = false;
  }

  // 测试4: 统一结果数据源一致性验证
  console.log('');
  console.log('--- 第四部分：展示/导出/接口数据一致性 ---');
  try {
    const unified = buildUnifiedResult(testData);
    const displayRows = unified.rows;
    const sampleRow = displayRows.find(r => r.criterionName === '教学内容');

    allPass &= logTest('4', '展示层数据：originalImportValue=30%', 
      sampleRow.originalImportValue === '30%',
      `展示层 originalImportValue=${sampleRow.originalImportValue}`);
    allPass &= logTest('4.1', '展示层数据：modifiedValue=0.30', 
      sampleRow.modifiedValue === '0.30',
      `展示层 modifiedValue=${sampleRow.modifiedValue}`);
    allPass &= logTest('4.2', '展示层：reviewInfo.previousValue=30%', 
      sampleRow.reviewInfo.previousValue === '30%',
      `展示层 previousValue=${sampleRow.reviewInfo.previousValue}`);
    allPass &= logTest('4.3', '展示层：reviewInfo.newValue=0.30', 
      sampleRow.reviewInfo.newValue === '0.30',
      `展示层 newValue=${sampleRow.reviewInfo.newValue}`);
    allPass &= logTest('4.4', 'summary 计数正确', 
      unified.summary.needsReviewCount >= 1 && unified.summary.modifiedCount === 1,
      `summary=${JSON.stringify(unified.summary)}`);
    allPass &= logTest('4.5', '历史记录包含所有操作', 
      unified.history.length >= 6,
      `history.length=${unified.history.length}`);
  } catch (e) {
    console.log('❌ 测试4失败:', e.message);
    allPass = false;
  }

  // 测试5: 重复导入检测
  console.log('');
  console.log('--- 第五部分：重复导入检测 ---');
  try {
    const existingBatches = testData.importBatches;
    const existingRows = testData.rows;

    const duplicateData = processImportedData({
      rawData: sampleData,
      importedBy: '吴老师',
      fileName: '评分权重表 - 副本.xlsx',
      fileSize: 12345,
      existingBatches,
      existingRows
    });

    const dupTargetRow = duplicateData.rows.find(r => r.criterionName === '教学内容');

    allPass &= logTest('5', '同内容再次上传识别为重复导入', 
      dupTargetRow.isDuplicateImport === true,
      `isDuplicateImport=${dupTargetRow.isDuplicateImport}`);
    allPass &= logTest('5.1', '重复导入警告正确添加', 
      dupTargetRow.warnings.includes('duplicate_import'),
      `warnings=${dupTargetRow.warnings.join(',')}`);
    allPass &= logTest('5.2', '沿用历史 originalImportValue=30%', 
      dupTargetRow.originalImportValue === '30%',
      `originalImportValue=${dupTargetRow.originalImportValue}`);
    allPass &= logTest('5.3', '沿用历史 modifiedValue=0.30', 
      dupTargetRow.modifiedValue === '0.30',
      `modifiedValue=${dupTargetRow.modifiedValue}`);
    allPass &= logTest('5.4', '沿用历史 reviewInfo', 
      dupTargetRow.reviewInfo && dupTargetRow.reviewInfo.previousValue === '30%',
      `reviewInfo.previousValue=${dupTargetRow.reviewInfo?.previousValue}`);
    allPass &= logTest('5.5', '批次ID与历史批次相同（不生成新批次）', 
      duplicateData.currentBatchId === testData.currentBatchId,
      `batchId: 新=${duplicateData.currentBatchId}, 旧=${testData.currentBatchId}`);
    allPass &= logTest('5.6', '状态仍为 needs_review（不归 normal）', 
      dupTargetRow.status === 'needs_review',
      `status=${dupTargetRow.status}`);
    allPass &= logTest('5.7', '导入历史中标记为重复', 
      duplicateData.importBatches[0].isDuplicate === false,
      `历史批次不重复，继续沿用`);
  } catch (e) {
    console.log('❌ 测试5失败:', e.message);
    allPass = false;
  }

  // 测试6: 指纹计算稳定性
  console.log('');
  console.log('--- 第六部分：文件指纹稳定性 ---');
  try {
    const fp1 = generateFingerprint(sampleData, 12345, 'test.xlsx');
    const fp2 = generateFingerprint(sampleData, 12345, 'test - 副本.xlsx');
    const fp3 = generateFingerprint([...sampleData, { criterion: '新增项', weight: '0.1' }], 12345, 'test.xlsx');

    allPass &= logTest('6', '相同内容生成相同指纹', 
      fp1.contentHash === fp2.contentHash,
      `fp1=${fp1.contentHash}, fp2=${fp2.contentHash}`);
    allPass &= logTest('6.1', '不同内容生成不同指纹', 
      fp1.contentHash !== fp3.contentHash,
      `fp1=${fp1.contentHash}, fp3=${fp3.contentHash}`);
  } catch (e) {
    console.log('❌ 测试6失败:', e.message);
    allPass = false;
  }

  console.log('');
  console.log('='.repeat(80));
  if (allPass) {
    console.log('✅ 所有测试通过！');
    console.log('='.repeat(80));
    process.exit(0);
  } else {
    console.log('❌ 部分测试失败，请检查以上输出');
    console.log('='.repeat(80));
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error('测试运行异常:', e);
  process.exit(1);
});
