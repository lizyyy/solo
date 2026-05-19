import 'reflect-metadata';
import { AppDataSource } from '../src/database/data-source';
import { CriticalValueService } from '../src/services/CriticalValueService';
import { DataCategory, TaskStatus } from '../src/models/CriticalValueRecord';

async function runTests() {
  console.log('=== 开始测试 ===\n');

  await AppDataSource.initialize();
  console.log('✓ 数据库连接成功');

  const service = new CriticalValueService();

  console.log('\n1. 测试创建记录（正常数据）');
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

  console.log('\n2. 测试创建记录（待补充数据）');
  const pendingRecord = await service.createRecord({
    patientId: 'P002',
    patientName: '李四',
    department: '',
    testItem: '血钾',
    testValue: '3.2',
    referenceRange: '3.5-5.5',
    testTime: new Date('2024-01-15T10:00:00')
  }, '夜班组-张');
  console.log(`  ✓ 记录创建成功，ID: ${pendingRecord.id}`);
  console.log(`  ✓ 分类: ${pendingRecord.category}`);
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

  console.log('\n6. 测试统计数据');
  const stats = await service.getStatistics();
  console.log(`  ✓ 总记录数: ${stats.total}`);
  console.log(`  ✓ 按分类: 正常=${stats.byCategory.normal}, 待补充=${stats.byCategory.pendingSupplement}, 已拦截=${stats.byCategory.blocked}`);
  console.log(`  ✓ 按状态: 处理中=${stats.byStatus.processing}, 人工确认=${stats.byStatus.manualConfirmed}`);
  console.log(`  ✓ 有短信通知: ${stats.hasSmsNotification}`);
  console.log(`  ✓ 有电话回告: ${stats.hasPhoneCall}`);
  console.log(`  ✓ 有医生确认: ${stats.hasDoctorConfirmation}`);

  console.log('\n7. 测试导出数据');
  const exportBuffer = await service.exportRecords();
  console.log(`  ✓ 导出成功，数据大小: ${exportBuffer.length} 字节`);

  console.log('\n=== 测试完成 ===');
  process.exit(0);
}

runTests().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
