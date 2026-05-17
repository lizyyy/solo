import { queueService } from '../services/QueueService';
import { queueStore } from '../store/QueueStore';
import { QueueStatus } from '../types';

export function generateCompleteFlowSample() {
  console.log('=== 验收样例1：完整流转 ===\n');

  queueStore.clearAll();

  const record = queueService.createQueueRecord({
    visitor: { id: 'acc-v001', name: '验收用户-张三', phone: '13800138000', email: 'zhangsan@acceptance.com', businessObject: '订单咨询' },
    skillGroupId: 'acc-sg001',
    skillGroupName: '验收-客服一组',
    overflowTargetId: 'acc-sg002',
    overflowTargetName: '验收-客服二组',
    operatorId: 'acc-op001',
    operatorName: '验收-李主管'
  });

  console.log('1. 创建排队记录成功');
  console.log(`   记录ID: ${record.id}`);
  console.log(`   当前状态: ${record.status}`);
  console.log(`   记录状态: ${record.recordStatus}`);

  const overflowResult = queueService.processOverflow(
    record.id,
    'acc-op001',
    '验收-李主管'
  );

  console.log('\n2. 执行溢出处理');
  console.log(`   原记录状态: ${overflowResult.originalRecord?.status}`);
  console.log(`   占位记录ID: ${overflowResult.placeholderRecord?.id}`);
  console.log(`   占位记录技能组: ${overflowResult.placeholderRecord?.skillGroupName}`);
  console.log(`   是否溢出占位: ${overflowResult.placeholderRecord?.isOverflowPlaceholder}`);

  const connectedRecord = queueService.updateStatus(
    record.id,
    QueueStatus.CONNECTED,
    'acc-op002',
    '验收-王客服',
    '客户已成功接入，开始服务'
  );

  console.log('\n3. 客户接入完成');
  console.log(`   最终状态: ${connectedRecord?.status}`);
  console.log(`   记录状态: ${connectedRecord?.recordStatus}`);
  console.log(`   排队时长: ${connectedRecord?.queueDurationSeconds}秒`);
  console.log(`   接入时间: ${connectedRecord?.connectedTime?.toISOString()}`);

  const history = queueService.getStatusHistory(record.id);
  console.log('\n4. 状态历史追踪:');
  history.forEach((h, idx) => {
    console.log(`   ${idx + 1}. ${h.previousStatus || '无'} -> ${h.newStatus}`);
    console.log(`      操作人: ${h.operatorName || '系统'}`);
    console.log(`      原因: ${h.reason}`);
    console.log(`      时间: ${h.createdAt.toISOString()}`);
  });

  console.log('\n--- 列表查询验证 ---');
  const listResult = queueService.queryRecords({});
  console.log(`列表总记录数: ${listResult.total}`);
  console.log(`包含原记录: ${listResult.data.some(r => r.id === record.id)}`);
  console.log(`包含占位记录: ${listResult.data.some(r => r.id === overflowResult.placeholderRecord?.id)}`);

  console.log('\n--- 详情查询验证 ---');
  const detailRecord = queueService.getQueueRecord(record.id);
  console.log(`详情查询匹配: ${detailRecord?.id === record.id}`);
  console.log(`访客信息一致: ${detailRecord?.visitor.name === '验收用户-张三'}`);

  return { record, overflowResult, history };
}

export function generateConflictSample() {
  console.log('\n=== 验收样例2：冲突记录 ===\n');

  queueStore.clearAll();

  const firstRecord = queueService.createQueueRecord({
    visitor: { id: 'acc-v002', name: '验收用户-李四', businessObject: '投诉建议' },
    skillGroupId: 'acc-sg001',
    skillGroupName: '验收-客服一组',
    operatorId: 'acc-op001',
    operatorName: '验收-李主管'
  });

  console.log('1. 第一次创建排队记录');
  console.log(`   记录ID: ${firstRecord.id}`);
  console.log(`   记录状态: ${firstRecord.recordStatus}`);

  const secondRecord = queueService.createQueueRecord({
    visitor: { id: 'acc-v002', name: '验收用户-李四', businessObject: '投诉建议' },
    skillGroupId: 'acc-sg001',
    skillGroupName: '验收-客服一组',
    operatorId: 'acc-op001',
    operatorName: '验收-李主管'
  });

  console.log('\n2. 同一访客同一技能组重复提交');
  console.log(`   记录ID: ${secondRecord.id}`);
  console.log(`   记录状态: ${secondRecord.recordStatus} (标记为冲突)`);

  console.log('\n3. 冲突记录验证:');
  const conflictList = queueService.queryRecords({ recordStatus: 'conflict' as any });
  console.log(`   冲突记录数量: ${conflictList.total}`);
  console.log(`   冲突记录ID匹配: ${conflictList.data[0]?.id === secondRecord.id}`);

  console.log('\n4. 同一访客两条记录共存:');
  const visitorRecords = queueService.queryRecords({ visitorId: 'acc-v002' });
  console.log(`   访客总记录数: ${visitorRecords.total}`);
  visitorRecords.data.forEach((r, idx) => {
    console.log(`     ${idx + 1}. ${r.id} - ${r.recordStatus}`);
  });

  return { firstRecord, secondRecord };
}

export function generateImportBadRowsSample() {
  console.log('\n=== 验收样例3：导入坏行检测 ===\n');

  const importData = [
    { visitorId: 'import-v001', visitorName: '导入用户-张三', skillGroupId: 'import-sg001', skillGroupName: '导入-客服一组' },
    { visitorId: '', visitorName: '', skillGroupId: '', skillGroupName: '' },
    { visitorId: 'import-v003', skillGroupId: 'import-sg001', skillGroupName: '导入-客服一组' },
    { visitorId: 'import-v004', visitorName: '导入用户-赵六' },
    { visitorId: 'import-v005', visitorName: '导入用户-钱七', skillGroupId: 'import-sg002', skillGroupName: '导入-客服二组' }
  ];

  console.log('导入数据共 5 行:');
  importData.forEach((row, idx) => {
    console.log(`  ${idx + 1}. ${JSON.stringify(row)}`);
  });

  console.log('\n预期结果:');
  console.log('  第1行：有效（成功）');
  console.log('  第2行：无效（缺失必填字段）');
  console.log('  第3行：无效（缺失访客姓名）');
  console.log('  第4行：无效（缺失技能组信息）');
  console.log('  第5行：有效（成功）');

  const validationResults = importData.map((row, idx) => {
    const errors: string[] = [];
    if (!row.visitorId) errors.push('访客ID不能为空');
    if (!row.visitorName) errors.push('访客姓名不能为空');
    if (!row.skillGroupId) errors.push('技能组ID不能为空');
    if (!row.skillGroupName) errors.push('技能组名称不能为空');
    return {
      row: idx + 1,
      valid: errors.length === 0,
      errors,
      data: row
    };
  });

  console.log('\n实际验证结果:');
  validationResults.forEach(result => {
    const status = result.valid ? '✓ 有效' : '✗ 无效';
    console.log(`  第${result.row}行: ${status}`);
    if (result.errors.length > 0) {
      result.errors.forEach(err => console.log(`    - ${err}`));
    }
  });

  const successCount = validationResults.filter(r => r.valid).length;
  const failedCount = validationResults.filter(r => !r.valid).length;

  console.log(`\n统计: 成功 ${successCount} 行, 失败 ${failedCount} 行`);

  return validationResults;
}

export function runAllAcceptanceSamples() {
  console.log('========================================');
  console.log('  在线客服路由技能组溢出排队 - 验收样例');
  console.log('========================================\n');

  generateCompleteFlowSample();
  generateConflictSample();
  generateImportBadRowsSample();

  console.log('\n========================================');
  console.log('  所有验收样例执行完毕');
  console.log('========================================');
}

if (require.main === module) {
  runAllAcceptanceSamples();
}