import { returnBucketService } from './service';
import { exportService } from './export';
import {
  sampleNormalRecord,
  sampleRejectedRecord,
  sampleSupplementRecord,
  sampleDuplicateBucketRecord,
  sampleBatchRecords,
  initSampleData
} from './sampleData';
import { ReturnBucketStatus, MaterialType } from './types';

async function runTests() {
  console.log('============================================');
  console.log('  水站配送队桶装水退桶 API - 功能测试');
  console.log('============================================\n');

  initSampleData();

  console.log('📋 测试1: 单条记录处理（正常状态）');
  console.log('--------------------------------------------');
  const normalResult = returnBucketService.createSingleRecord({
    ...sampleNormalRecord,
    bucketNumber: 'WT-TEST-NORMAL-001'
  });
  console.log(`状态: ${normalResult.record.status}`);
  console.log(`校验结果: ${normalResult.validation.valid ? '通过' : '不通过'}`);
  console.log(`消息: ${normalResult.validation.message}`);
  console.log('');

  console.log('📋 测试2: 单条记录处理（台账不一致，驳回状态）');
  console.log('--------------------------------------------');
  const rejectedResult = returnBucketService.createSingleRecord(sampleRejectedRecord);
  console.log(`状态: ${rejectedResult.record.status}`);
  console.log(`校验结果: ${rejectedResult.validation.valid ? '通过' : '不通过'}`);
  console.log(`台账一致: ${rejectedResult.validation.ledgerConsistent ? '是' : '否'}`);
  console.log(`不一致原因: ${rejectedResult.validation.ledgerInconsistencyReason}`);
  console.log(`需要补充材料: ${rejectedResult.validation.requiredMaterials.join(', ')}`);
  console.log('');

  console.log('📋 测试3: 单条记录处理（有破损，补录状态）');
  console.log('--------------------------------------------');
  const supplementResult = returnBucketService.createSingleRecord(sampleSupplementRecord);
  console.log(`状态: ${supplementResult.record.status}`);
  console.log(`校验结果: ${supplementResult.validation.valid ? '通过' : '不通过'}`);
  console.log(`是否破损: ${sampleSupplementRecord.hasDamage ? '是' : '否'}`);
  console.log(`破损说明: ${sampleSupplementRecord.damageDescription}`);
  console.log(`需要补充材料: ${supplementResult.validation.requiredMaterials.join(', ')}`);
  console.log('');

  console.log('📋 测试4: 桶编号重复检测');
  console.log('--------------------------------------------');
  const duplicateResult = returnBucketService.createSingleRecord(sampleDuplicateBucketRecord);
  console.log(`状态: ${duplicateResult.record.status}`);
  console.log(`校验结果: ${duplicateResult.validation.valid ? '通过' : '不通过'}`);
  console.log(`发现重复桶: ${duplicateResult.validation.hasDuplicateBucket ? '是' : '否'}`);
  if (duplicateResult.validation.duplicateBucketInfo) {
    console.log(`桶编号: ${duplicateResult.validation.duplicateBucketInfo.bucketNumber}`);
    console.log(`原有地址: ${duplicateResult.validation.duplicateBucketInfo.existingAddress}`);
    console.log(`新地址: ${duplicateResult.validation.duplicateBucketInfo.newAddress}`);
  }
  console.log(`需要补充材料: ${duplicateResult.validation.requiredMaterials.join(', ')}`);
  console.log('');

  console.log('📋 测试5: 批量补录处理');
  console.log('--------------------------------------------');
  const batchResult = returnBucketService.batchCreateRecords(
    sampleBatchRecords.map((r, i) => ({ ...r, bucketNumber: `WT-BATCH-${String(i + 1).padStart(3, '0')}` })),
    'BATCH-2024-05-001'
  );
  console.log(`总记录数: ${sampleBatchRecords.length}`);
  console.log(`成功处理: ${batchResult.successful.length} 条`);
  console.log(`处理失败: ${batchResult.failed.length} 条`);
  if (batchResult.failed.length > 0) {
    console.log('失败记录原因:');
    batchResult.failed.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.reason}`);
    });
  }
  console.log('');

  console.log('📋 测试6: 状态更新（标记为已完成）');
  console.log('--------------------------------------------');
  const testRecord = returnBucketService.createSingleRecord({
    ...sampleNormalRecord,
    bucketNumber: 'WT-TEST-COMPLETE-001'
  });
  const updatedRecord = returnBucketService.updateRecordStatus(
    testRecord.record.id,
    ReturnBucketStatus.COMPLETED,
    'OP001',
    '测试管理员',
    undefined,
    '测试完成'
  );
  console.log(`原状态: ${testRecord.record.status}`);
  console.log(`新状态: ${updatedRecord?.status}`);
  console.log(`接收日期: ${updatedRecord?.receiveDate}`);
  console.log('');

  console.log('📋 测试7: 导出功能（查询导出数据）');
  console.log('--------------------------------------------');
  const exportData = exportService.getExportData({});
  console.log(`总记录数: ${exportData.summary.total}`);
  console.log('按状态统计:');
  Object.entries(exportData.summary.byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count} 条`);
  });
  console.log(`关键业务列数: ${exportData.columns.length} 列`);
  console.log('关键业务列:');
  exportData.columns.slice(0, 10).forEach(col => {
    console.log(`  ${col.title} (${col.id})`);
  });
  if (exportData.columns.length > 10) {
    console.log(`  ... 还有 ${exportData.columns.length - 10} 列`);
  }
  console.log('');

  console.log('📋 测试8: 导出CSV文件');
  console.log('--------------------------------------------');
  try {
    const csvPath = await exportService.exportToCsv({});
    console.log(`CSV文件导出成功: ${csvPath}`);
  } catch (error: any) {
    console.log(`CSV导出失败: ${error.message}`);
  }
  console.log('');

  console.log('📋 测试9: 查询所有记录');
  console.log('--------------------------------------------');
  const allRecords = returnBucketService.getAllRecords();
  console.log(`总记录数: ${allRecords.length}`);
  console.log('各记录状态:');
  allRecords.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.bucketNumber} - ${r.status}${r.supplementMaterials.length > 0 ? ` (需补: ${r.supplementMaterials.length}项)` : ''}`);
  });
  console.log('');

  console.log('============================================');
  console.log('  测试完成!');
  console.log('============================================');
  console.log('');
  console.log('💡 API使用说明:');
  console.log('  POST /api/return-bucket/single   - 单条人工处理');
  console.log('  POST /api/return-bucket/batch    - 批量补录');
  console.log('  POST /api/return-bucket/validate - 预校验');
  console.log('  GET  /api/return-bucket/          - 查询所有记录');
  console.log('  GET  /api/return-bucket/export/data  - 导出数据查询');
  console.log('  POST /api/return-bucket/export/csv   - 导出CSV文件');
  console.log('');
  console.log('📊 材料类型说明:');
  Object.values(MaterialType).forEach(m => {
    console.log(`  - ${m}`);
  });
}

runTests().catch(console.error);
