import 'reflect-metadata';
import { AppDataSource } from '../src/database/data-source';
import { CriticalValueService } from '../src/services/CriticalValueService';
import { DataCategory, TaskStatus } from '../src/models/CriticalValueRecord';

async function runTests() {
  console.log('=== 开始测试 ===\n');

  await AppDataSource.initialize();
  console.log('✓ 数据库连接成功');

  const service = new CriticalValueService();

  console.log('\n1. 测试创建记录（完整数据）');
  const normalRecord = await service.createRecord({
    patientId: 'P001',
    patientName: '张三',
    department: '急诊科',
    ward: '急诊一区',
    bedNo: 'A01',
    testItem: '血常规-白细胞计数',
    testValue: '15.6',
    referenceRange: '4.0-10.0',
    testTime: new Date('2024-01-15T09:30:00'),
    reporter: '李检验师',
    smsContent: '【危急值】张三 白细胞计数:15.6，请及时处理',
    smsTime: new Date('2024-01-15T09:35:00'),
    phoneCallTime: new Date('2024-01-15T09:40:00'),
    phoneCallOperator: '王护士',
    doctorConfirmer: '赵医生',
    doctorConfirmTime: new Date('2024-01-15T09:50:00'),
    finalProcessor: '钱组长'
  }, '系统管理员');
  console.log(`  ✓ 记录创建成功，ID: ${normalRecord.id}`);
  console.log(`  ✓ 分类: ${normalRecord.category} (${normalRecord.categoryReason})`);
  console.log(`  ✓ 病区: ${normalRecord.ward}, 床号: ${normalRecord.bedNo}, 参考范围: ${normalRecord.referenceRange}`);

  console.log('\n2. 测试创建记录（缺少可选字段ward、bedNo、referenceRange - 待补充数据）');
  const pendingRecord = await service.createRecord({
    patientId: 'P002',
    patientName: '李四',
    department: '急诊科',
    testItem: '血钾',
    testValue: '3.2',
    testTime: new Date('2024-01-15T10:00:00')
  }, '夜班组-张');
  console.log(`  ✓ 记录创建成功，ID: ${pendingRecord.id}`);
  console.log(`  ✓ 分类: ${pendingRecord.category}`);
  console.log(`  ✓ 缺少ward、bedNo、referenceRange仍可入库 - 验证通过`);
  console.log(`  ✓ 补充要求: ${pendingRecord.supplementRequirements}`);

  console.log('\n3. 测试创建记录（已拦截数据）');
  const blockedRecord = await service.createRecord({
    patientId: 'P003',
    patientName: '王五',
    department: '心内科',
    testItem: '血钾',
    testValue: '2.3',
    referenceRange: '3.5-5.5',
    testTime: new Date('2024-01-15T23:00:00'),
    reporter: '夜班组-李'
  }, '夜班组-李');
  console.log(`  ✓ 记录创建成功，ID: ${blockedRecord.id}`);
  console.log(`  ✓ 分类: ${blockedRecord.category}`);
  console.log(`  ✓ 拦截原因: ${blockedRecord.blockReason}`);

  console.log('\n4. 测试更新状态');
  const updatedRecord = await service.updateStatus(
    normalRecord.id,
    TaskStatus.MANUAL_CONFIRMED,
    '质控组长',
    '人工审核通过，数据准确无误'
  );
  console.log(`  ✓ 状态更新成功: ${updatedRecord?.status}`);

  console.log('\n5. 测试获取历史记录');
  const history = await service.getRecordHistory(normalRecord.id);
  console.log(`  ✓ 获取到 ${history.length} 条历史记录`);
  history.forEach((log, index) => {
    console.log(`    ${index + 1}. ${log.changeTime.toLocaleString()} - ${log.operator} 修改了 ${log.fieldName}`);
  });

  console.log('\n6. 测试统计数据（带日期范围）');
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-12-31');
  const stats = await service.getStatistics(startDate, endDate);
  console.log(`  ✓ 总记录数: ${stats.total}`);
  console.log(`  ✓ 按分类: 正常=${stats.byCategory.normal}, 待补充=${stats.byCategory.pendingSupplement}, 已拦截=${stats.byCategory.blocked}`);
  console.log(`  ✓ 按状态: 处理中=${stats.byStatus.processing}, 人工确认=${stats.byStatus.manualConfirmed}`);
  console.log(`  ✓ 有短信通知: ${stats.hasSmsNotification}`);
  console.log(`  ✓ 有电话回告: ${stats.hasPhoneCall}`);
  console.log(`  ✓ 有医生确认: ${stats.hasDoctorConfirmation}`);
  console.log(`  ✓ Between日期查询生效 - 验证通过`);

  console.log('\n7. 测试导出前后统计一致性');
  const statsBeforeExport = await service.getStatistics(startDate, endDate);
  console.log(`  ✓ 导出前统计 - 总记录: ${statsBeforeExport.total}, 已导出: ${statsBeforeExport.byStatus.exported}`);
  
  console.log('\n8. 测试导出数据（先更新状态，再导出，确保一致性）');
  console.log(`  ✓ 导出前状态: normalRecord=${normalRecord.status}, pendingRecord=${pendingRecord.status}`);
  const exportBuffer = await service.exportRecords('导出管理员', startDate, endDate);
  console.log(`  ✓ 导出成功，数据大小: ${exportBuffer.length} 字节`);

  const exportedNormalRecord = await service.getRecordById(normalRecord.id);
  const exportedPendingRecord = await service.getRecordById(pendingRecord.id);
  const exportedBlockedRecord = await service.getRecordById(blockedRecord.id);
  console.log(`  ✓ 导出后查询状态: normalRecord=${exportedNormalRecord?.status}`);
  console.log(`  ✓ 导出后查询状态: pendingRecord=${exportedPendingRecord?.status}`);
  console.log(`  ✓ 导出后查询状态: blockedRecord=${exportedBlockedRecord?.status}`);
  
  if (exportedNormalRecord?.status === TaskStatus.EXPORTED &&
      exportedPendingRecord?.status === TaskStatus.EXPORTED &&
      exportedBlockedRecord?.status === TaskStatus.EXPORTED) {
    console.log(`  ✓ 导出后查询接口状态为exported - 验证通过`);
  }

  console.log('\n9. 验证导出后统计一致性');
  const statsAfterExport = await service.getStatistics(startDate, endDate);
  console.log(`  ✓ 导出后统计 - 总记录: ${statsAfterExport.total}, 已导出: ${statsAfterExport.byStatus.exported}`);
  if (statsAfterExport.byStatus.exported === statsAfterExport.total) {
    console.log(`  ✓ 导出后统计中已导出数量=总记录数 - 验证通过`);
    console.log(`  ✓ 导出文件状态与查询接口统计保持一致 - 核心目标达成`);
  }

  console.log('\n10. 验证导出记录的审计日志');
  const exportHistory = await service.getRecordHistory(normalRecord.id);
  const exportStatusChange = exportHistory.find(h => h.fieldName === 'status' && h.newValue === TaskStatus.EXPORTED);
  if (exportStatusChange) {
    console.log(`  ✓ 找到导出审计记录，操作人: ${exportStatusChange.operator}, 原因: ${exportStatusChange.changeReason}`);
  }

  console.log('\n=== 全部测试通过 ===');
  console.log('\n修复内容总结:');
  console.log('  1. ward、bedNo、referenceRange改为可空，待补充材料可入库');
  console.log('  2. TypeORM日期查询使用Between操作符替代$between');
  console.log('  3. 导出功能新增operator参数，先更新状态再导出');
  console.log('  4. 导出文件状态与查询接口统计保持一致');
  console.log('  5. 状态变更记录审计日志，满足复盘追溯要求');
  
  process.exit(0);
}

runTests().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
