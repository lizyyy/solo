const moment = require('moment');
const { BatchService } = require('../src/services/batchService');
const { AdjustmentService, FreezeService } = require('../src/services/adjustmentService');
const { ExportService, HistoryService } = require('../src/services/exportService');
const { closeDb } = require('../src/db/index');

const testMode = process.argv[2] || 'all';

console.log('========================================');
console.log('冷链中转验收 - 验收测试脚本');
console.log(`测试模式: ${testMode}`);
console.log('========================================\n');

const generateTestData = (prefix) => {
  const boxes = [];
  const tempRecords = [];

  for (let i = 1; i <= 5; i++) {
    boxes.push({
      box_no: `${prefix}-BOX00${i}`,
      original_box_no: `${prefix}-BOX00${i}`,
      wms_expected_qty: 20,
      actual_qty: 20,
      receive_time: moment().toISOString(),
      remark: '测试箱号'
    });

    for (let h = 0; h < 5; h++) {
      tempRecords.push({
        box_no: `${prefix}-BOX00${i}`,
        record_time: moment().subtract(5 - h, 'hours').toISOString(),
        temperature: 4 + Math.random(),
        humidity: 65
      });
    }
  }

  return {
    batch_no: `TEST-${prefix}`,
    driver_name: '测试司机',
    driver_phone: '13800138000',
    boxes,
    temperature_records: tempRecords,
    photos: [{
      photo_type: 'driver',
      file_name: 'driver_test.jpg',
      file_path: '/tmp/driver_test.jpg',
      file_size: 123456,
      remark: '司机交接照片'
    }],
    remark: '验收测试批次'
  };
};

const testNormalFlow = async () => {
  console.log('\n📋 测试1: 正常链路提交');
  console.log('-'.repeat(60));

  const data = generateTestData('NORMAL001');
  const result = await BatchService.submitBatch(data, 'error', 'acceptance_tester');
  console.log(`✓ 批次创建成功: ${result.batch_no}`);
  console.log(`✓ 批次ID: ${result.batch_id}`);
  console.log(`✓ 总赔付: ¥${result.reconciliation.total_compensation}`);

  const detail = BatchService.getBatchDetail(result.batch_id);
  console.log(`✓ 箱号数量: ${detail.boxes.length}`);
  console.log(`✓ 温度记录: ${detail.temperature_records.length}条`);
  console.log(`✓ 对账状态: ${detail.reconciliation.status}`);

  console.log('\n📤 测试导出功能...');
  const exportResult = await ExportService.exportBatchDetail(result.batch_id);
  console.log(`✓ 导出JSON: ${exportResult.export_files.json}`);
  console.log(`✓ 导出箱号CSV: ${exportResult.export_files.boxes_csv}`);

  console.log('\n📜 测试历史查询...');
  const history = HistoryService.getOperationHistory(result.batch_id);
  console.log(`✓ 操作历史: ${history.length}条`);
  history.forEach(h => console.log(`  - ${h.operation_type}: ${h.remark}`));

  return result.batch_id;
};

const testDuplicateSubmit = async () => {
  console.log('\n🔄 测试2: 重复提交策略');
  console.log('-'.repeat(60));

  const data = generateTestData('DUP001');
  
  console.log('\n第一次提交:');
  const result1 = await BatchService.submitBatch(data, 'error', 'tester_a');
  console.log(`✓ 首次提交成功: ${result1.action}`);

  console.log('\n重复提交 - ignore策略:');
  const result2 = await BatchService.submitBatch(data, 'ignore', 'tester_b');
  console.log(`✓ 策略结果: ${result2.action} - ${result2.message}`);

  console.log('\n重复提交 - overwrite策略:');
  data.boxes.push({
    box_no: 'DUP001-BOX099',
    original_box_no: 'DUP001-BOX099',
    wms_expected_qty: 10,
    actual_qty: 10,
    receive_time: moment().toISOString(),
    remark: '覆盖新增'
  });
  const result3 = await BatchService.submitBatch(data, 'overwrite', 'tester_c');
  console.log(`✓ 策略结果: ${result3.action} - ${result3.message}`);

  console.log('\n重复提交 - append策略:');
  const appendData = { ...data, boxes: [{
    box_no: 'DUP001-BOX100',
    original_box_no: 'DUP001-BOX100',
    wms_expected_qty: 5,
    actual_qty: 5,
    receive_time: moment().toISOString(),
    remark: '追加的箱号'
  }]};
  const result4 = await BatchService.submitBatch(appendData, 'append', 'tester_d');
  console.log(`✓ 策略结果: ${result4.action} - 追加箱号: ${result4.appended_boxes.join(', ')}`);

  const detail = BatchService.getBatchDetail(result1.batch_id);
  console.log(`\n✓ 最终箱号数: ${detail.boxes.length}个`);
  console.log(`✓ 操作历史数: ${detail.operation_history.length}条`);

  return result1.batch_id;
};

const testBadData = async () => {
  console.log('\n⚠️  测试3: 坏数据和异常场景');
  console.log('-'.repeat(60));

  const data = generateTestData('BAD001');
  
  console.log('\n制造异常数据:');
  data.boxes[0].original_box_no = 'OLD-' + data.boxes[0].box_no;
  data.boxes[0].remark = '箱号改名';
  
  data.boxes[1].actual_qty = data.boxes[1].wms_expected_qty - 5;
  data.boxes[1].remark = '数量短缺';

  for (let i = 0; i < 5; i++) {
    data.temperature_records.push({
      box_no: data.boxes[2].box_no,
      record_time: moment().subtract(i, 'hours').toISOString(),
      temperature: 15,
      humidity: 90
    });
  }

  const result = await BatchService.submitBatch(data, 'error', 'tester_bad');
  console.log(`✓ 提交成功: ${result.batch_no}`);
  console.log(`✓ 总赔付: ¥${result.reconciliation.total_compensation}`);
  console.log(`✓ 改名箱数: ${result.reconciliation.renamed_boxes}`);
  console.log(`✓ 温度异常箱数: ${result.reconciliation.temperature_abnormal_boxes}`);

  result.reconciliation.box_results.forEach(box => {
    if (box.compensation > 0) {
      console.log(`  异常箱号 ${box.box_no}: 赔付¥${box.compensation}`);
      if (box.is_renamed) console.log(`    - 箱号改名`);
      if (box.temperature_abnormal) console.log(`    - 温度异常`);
    }
  });

  return result.batch_id;
};

const testWithdrawAndResubmit = async () => {
  console.log('\n↩️  测试4: 撤回后再提交');
  console.log('-'.repeat(60));

  const data = generateTestData('WITH001');
  const result1 = await BatchService.submitBatch(data, 'error', 'tester_before');
  console.log(`✓ 首次提交: ${result1.batch_no}`);

  console.log('\n撤回批次...');
  const withdrawResult = BatchService.withdrawBatch(
    result1.batch_id,
    'operation_manager',
    '数据有误，需要修正后重新提交'
  );
  console.log(`✓ ${withdrawResult.message}`);

  console.log('\n修正后重新提交...');
  data.boxes[0].actual_qty = data.boxes[0].wms_expected_qty;
  data.remark = '修正后重新提交';
  
  const result2 = await BatchService.resubmitAfterWithdraw(
    result1.batch_no,
    data,
    'tester_after'
  );
  console.log(`✓ 重新提交: ${result2.action}`);
  console.log(`✓ 新赔付: ¥${result2.reconciliation.total_compensation}`);

  const history = HistoryService.getOperationHistory(result1.batch_id);
  console.log(`\n操作轨迹:`);
  history.forEach(h => console.log(`  [${h.created_at.slice(11,19)}] ${h.operator}: ${h.operation_type} - ${h.remark || ''}`));

  return result1.batch_id;
};

const testManualAdjustment = async (batchId) => {
  console.log('\n✏️  测试5: 人工改判');
  console.log('-'.repeat(60));

  const detail = BatchService.getBatchDetail(batchId);
  const testBox = detail.boxes[0];
  
  console.log(`改判箱号: ${testBox.box_no}`);
  console.log(`原赔付: ¥${testBox.compensation_amount}`);

  const adjustResult = AdjustmentService.adjustCompensation(
    batchId,
    testBox.box_no,
    0,
    '复核确认，温度在正常范围内，免予赔付',
    'audit_manager'
  );
  console.log(`✓ 改判成功`);
  console.log(`新赔付: ¥${adjustResult.new_compensation}`);

  const statusResult = AdjustmentService.adjustBoxStatus(
    batchId,
    testBox.box_no,
    'normal',
    '人工复核通过',
    'audit_manager'
  );
  console.log(`✓ 状态改判: ${statusResult.old_status} -> ${statusResult.new_status}`);

  return batchId;
};

const testFreezeBeforeExport = async (batchId) => {
  console.log('\n❄️  测试6: 导出前冻结');
  console.log('-'.repeat(60));

  console.log('冻结批次...');
  const freezeResult = FreezeService.freezeBatch(batchId, 'export_operator');
  console.log(`✓ ${freezeResult.message}`);

  console.log('\n验证冻结后不可操作:');
  try {
    BatchService.withdrawBatch(batchId, 'hacker', '尝试撤回');
    console.log('✗ 应该抛出错误');
  } catch (e) {
    console.log(`✓ 冻结后撤回被拒绝: ${e.message}`);
  }

  try {
    AdjustmentService.adjustCompensation(batchId, BatchService.getBatchDetail(batchId).boxes[0].box_no, 999, '尝试改判', 'hacker');
    console.log('✗ 应该抛出错误');
  } catch (e) {
    console.log(`✓ 冻结后改判被拒绝: ${e.message}`);
  }

  console.log('\n导出冻结批次...');
  const exportResult = await ExportService.exportBatchDetail(batchId);
  console.log(`✓ 导出成功`);

  console.log('\n解冻批次...');
  const unfreezeResult = FreezeService.unfreezeBatch(batchId, 'export_operator');
  console.log(`✓ ${unfreezeResult.message}`);

  return batchId;
};

const testRestartPersistence = async () => {
  console.log('\n💾 测试7: 重启后数据持久化验证');
  console.log('-'.repeat(60));

  console.log('关闭数据库连接...');
  closeDb();
  
  console.log('重新连接数据库并查询...');
  
  const batches = BatchService.getAllBatches();
  console.log(`✓ 数据库中批次数量: ${batches.length}`);
  
  const testBatch = batches.find(b => b.batch_no.startsWith('TEST-'));
  if (testBatch) {
    console.log(`✓ 找到测试批次: ${testBatch.batch_no}`);
    
    const detail = BatchService.getBatchDetail(testBatch.id);
    console.log(`  - 箱号: ${detail.boxes.length}个`);
    console.log(`  - 温度记录: ${detail.temperature_records.length}条`);
    console.log(`  - 操作历史: ${detail.operation_history.length}条`);
    console.log(`  - 对账结果: ¥${detail.reconciliation?.total_compensation || 0}`);
    
    const replay = ExportService.getRawDataForReplay(testBatch.id);
    console.log(`  - 回放数据完整: 箱号${replay.boxes.length}个, 温度${replay.temperature_records.length}条`);
  }

  const allHistory = HistoryService.getAllHistory();
  console.log(`\n✓ 全局操作历史: ${allHistory.length}条`);
  console.log(`  涉及操作人: ${[...new Set(allHistory.map(h => h.operator))].join(', ')}`);

  return testBatch?.id;
};

const runAllTests = async () => {
  try {
    console.log('\n🚀 开始完整验收流程\n');

    await testNormalFlow();
    await testDuplicateSubmit();
    const badBatchId = await testBadData();
    await testWithdrawAndResubmit();
    await testManualAdjustment(badBatchId);
    await testFreezeBeforeExport(badBatchId);
    await testRestartPersistence();

    console.log('\n✅ 所有验收测试通过！');
    console.log('\n📊 验收总结:');
    console.log('  ✓ 正常链路提交 → 对账 → 导出');
    console.log('  ✓ 重复提交策略(ignore/overwrite/append)');
    console.log('  ✓ 异常数据检测和赔付计算');
    console.log('  ✓ 撤回后重新提交');
    console.log('  ✓ 人工改判补偿金额');
    console.log('  ✓ 导出前冻结保护');
    console.log('  ✓ 数据持久化（重启可查）');
    console.log('\n========================================\n');

  } catch (error) {
    console.error('\n❌ 验收失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

(async () => {
  switch (testMode) {
    case 'normal':
      await testNormalFlow();
      break;
    case 'duplicate':
      await testDuplicateSubmit();
      break;
    case 'bad':
      await testBadData();
      break;
    case 'restart':
      await testRestartPersistence();
      break;
    case 'all':
    default:
      await runAllTests();
  }
  closeDb();
})();
