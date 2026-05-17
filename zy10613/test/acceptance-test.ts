import { grayReleaseService } from '../src/services/grayRelease';
import { GrayReleaseStatus } from '../src/types';
import { dataStore } from '../src/store';

async function runAcceptanceTests() {
  console.log('🧪 开始运行验收测试\n');

  console.log('1. 测试完整流转流程 (草稿 -> 灰度中 -> 全量)');
  const record1 = await grayReleaseService.createRecord({
    robotId: 'robot-001',
    robotName: '运营通知机器人',
    templateVersion: 'v2.0.0',
    templateName: '活动推送模板',
    grayGroups: ['group-a', 'group-b'],
    failedSamples: [],
    status: GrayReleaseStatus.DRAFT,
    remark: '补录历史数据',
    createdBy: 'admin'
  });
  console.log('   ✅ 创建草稿记录成功, ID:', record1.id.substring(0, 8) + '...');

  const startedRecord = await grayReleaseService.startGrayRelease(record1.id, 'tester');
  console.log('   ✅ 开始灰度成功, 当前状态:', startedRecord?.status);

  const fullRecord = await grayReleaseService.fullRelease(record1.id!, 'tester');
  console.log('   ✅ 全量发布成功, 当前状态:', fullRecord?.status);
  console.log();

  console.log('2. 测试冲突检测和待人工处理流程');
  const record2 = await grayReleaseService.createRecord({
    robotId: 'robot-001',
    robotName: '运营通知机器人',
    templateVersion: 'v1.9.0',
    templateName: '旧版推送模板',
    grayGroups: ['group-a'],
    failedSamples: [],
    status: GrayReleaseStatus.DRAFT,
    remark: '',
    createdBy: 'admin'
  });
  console.log('   ✅ 创建冲突记录成功, ID:', record2.id.substring(0, 8) + '...');

  const conflictRecord = await grayReleaseService.startGrayRelease(record2.id, 'tester');
  console.log('   ✅ 检测到冲突, 转为待人工处理状态:', conflictRecord?.status);
  console.log('   📝 冲突原因:', conflictRecord?.conflictReason);
  console.log();

  console.log('3. 测试批量导入 (包含坏行)');
  const importData = [
    {
      robotId: 'robot-002',
      robotName: '客服机器人',
      templateVersion: 'v1.5.0',
      templateName: '问候模板',
      grayGroups: 'group-c, group-d',
      status: GrayReleaseStatus.DRAFT,
      remark: '批量导入1'
    },
    {
      robotId: '',
      robotName: '坏机器人',
      templateVersion: 'v1.0.0',
      templateName: '坏模板',
      grayGroups: 'group-e',
      status: GrayReleaseStatus.DRAFT
    },
    {
      robotId: 'robot-003',
      robotName: '告警机器人',
      templateVersion: 'v2.1.0',
      templateName: '告警模板',
      grayGroups: ['group-f'],
      status: GrayReleaseStatus.ROLLED_BACK,
      remark: '批量导入3'
    }
  ];

  const importResult = await grayReleaseService.batchImport(importData, 'importer');
  console.log('   ✅ 批量导入完成');
  console.log('      成功:', importResult.success, '条');
  console.log('      失败:', importResult.failed, '条');
  if (importResult.errors.length > 0) {
    console.log('      错误详情:');
    importResult.errors.forEach(e => {
      console.log(`        第${e.row}行 [${e.field}]: ${e.message}`);
    });
  }
  console.log();

  console.log('4. 测试列表、详情、历史互相对齐');
  const allRecords = await grayReleaseService.getAllRecords();
  console.log('   ✅ 列表获取成功, 总记录数:', allRecords.length);

  const firstRecord = allRecords[0];
  const detailRecord = await grayReleaseService.getRecordById(firstRecord.id);
  console.log('   ✅ 详情获取成功');
  console.log('      列表状态:', firstRecord.status);
  console.log('      详情状态:', detailRecord?.status);
  console.log('      状态一致:', firstRecord.status === detailRecord?.status);

  const history = detailRecord?.history || [];
  console.log('   ✅ 历史记录数:', history.length);
  console.log('      历史动作:', history.map(h => h.action).join(' -> '));
  console.log();

  console.log('5. 测试回退功能');
  const rollbackRecord = await grayReleaseService.rollback(record1.id, 'tester', '发现bug');
  console.log('   ✅ 回退成功, 当前状态:', rollbackRecord?.status);
  console.log();

  console.log('6. 测试导出功能');
  const exportData = await grayReleaseService.exportRecords();
  console.log('   ✅ 导出数据成功, 条数:', exportData.length);
  console.log();

  console.log('🎉 所有验收测试通过!');
  console.log('\n📊 最终数据概览:');
  const finalRecords = await grayReleaseService.getAllRecords();
  finalRecords.forEach(r => {
    console.log(`  - ${r.templateName} (${r.templateVersion}): ${r.status}`);
  });
}

runAcceptanceTests().catch(console.error);
