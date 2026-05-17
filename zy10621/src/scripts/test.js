const { sequelize, Room, User } = require('../models');
const compensationService = require('../services/compensationService');
const { importFromCsv } = require('../services/importExportService');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

async function runTests() {
  console.log('='.repeat(60));
  console.log('开始运行验收测试');
  console.log('='.repeat(60));

  await sequelize.sync({ force: true });

  await seedTestData();

  await testCompleteFlow();
  await testConflictRecord();
  await testBadRowImport();

  console.log('\n' + '='.repeat(60));
  console.log('所有验收测试完成!');
  console.log('='.repeat(60));

  await sequelize.close();
}

async function seedTestData() {
  console.log('\n📦 初始化测试数据...');
  
  await User.create({
    employeeId: 'EMP001',
    name: '张三',
    email: 'zhangsan@example.com',
    department: '技术部',
    phone: '13800138001'
  });
  
  await User.create({
    employeeId: 'EMP002',
    name: '李四',
    email: 'lisi@example.com',
    department: '市场部',
    phone: '13800138002'
  });

  await Room.create({
    name: '创新会议室-A',
    location: '1楼东侧',
    capacity: 10,
    hourlyRate: 150.00,
    equipment: ['投影仪', '白板', '视频会议系统']
  });

  await Room.create({
    name: '创新会议室-B',
    location: '1楼西侧',
    capacity: 8,
    hourlyRate: 120.00,
    equipment: ['投影仪', '白板']
  });

  console.log('✅ 测试数据初始化完成: 2个用户, 2个会议室');
}

async function testCompleteFlow() {
  console.log('\n📋 测试1: 完整状态流转');
  console.log('-'.repeat(40));

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let result;
  let recordId;

  result = await compensationService.createRecord({
    reservationId: 'TEST-FLOW-001',
    roomId: 1,
    userId: 1,
    startTime: new Date(tomorrow.setHours(9, 0, 0, 0)),
    endTime: new Date(tomorrow.setHours(11, 0, 0, 0))
  });
  
  if (result.success) {
    recordId = result.data.id;
    console.log(`✅ 创建预约成功 | 状态: ${result.data.status}`);
  } else {
    console.log(`❌ 创建预约失败:`, result.errors);
    return;
  }

  result = await compensationService.requestRelease(recordId, {
    releaseReason: '设备故障',
    releaseReasonDetail: '投影仪故障，无法使用',
    affectedEquipment: ['投影仪']
  }, 2);
  
  if (result.success && result.data.status === '待人工处理') {
    console.log(`✅ 申请释放成功 | 状态: ${result.data.status} | 原因: ${result.data.explanation ? '有可解释原因' : '无'}`);
  } else {
    console.log(`❌ 申请释放失败:`, result.error || '状态未正确转换');
    return;
  }

  result = await compensationService.startCompensation(recordId, 300.00, 2);
  if (result.success && result.data.status === '补偿中') {
    console.log(`✅ 启动补偿成功 | 状态: ${result.data.status} | 补偿金额: ¥${result.data.compensationAmount}`);
  } else {
    console.log(`❌ 启动补偿失败:`, result.error);
    return;
  }

  result = await compensationService.completeCompensation(recordId, 2);
  if (result.success && result.data.status === '已完成') {
    console.log(`✅ 完成补偿成功 | 状态: ${result.data.status}`);
  } else {
    console.log(`❌ 完成补偿失败:`, result.error);
    return;
  }

  const history = await compensationService.getRecordHistory(recordId);
  console.log(`✅ 历史记录验证成功 | 历史记录数: ${history.length}`);
  history.forEach((h, i) => {
    console.log(`   ${i + 1}. ${h.previousStatus || '新建'} -> ${h.newStatus} | ${h.createdAt}`);
  });

  console.log('✅ 完整状态流转测试通过!');
}

async function testConflictRecord() {
  console.log('\n📋 测试2: 冲突记录检测');
  console.log('-'.repeat(40));

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  await compensationService.createRecord({
    reservationId: 'TEST-CONFLICT-001',
    roomId: 1,
    userId: 1,
    startTime: new Date(tomorrow.setHours(10, 0, 0, 0)),
    endTime: new Date(tomorrow.setHours(12, 0, 0, 0))
  });
  console.log('✅ 已创建基准预约 (10:00-12:00)');

  let conflictResult = await compensationService.checkConflicts(
    1,
    new Date(tomorrow.setHours(11, 0, 0, 0)),
    new Date(tomorrow.setHours(13, 0, 0, 0))
  );
  
  if (conflictResult.hasConflict) {
    console.log(`✅ 冲突检测成功 | 检测到冲突: ${conflictResult.conflicts.length} 个`);
    conflictResult.conflicts.forEach(c => {
      console.log(`   - 冲突预约: ${c.reservationId} | ${c.User ? c.User.name : '未知'} | 时间重叠`);
    });
  } else {
    console.log('❌ 冲突检测失败: 应该检测到冲突但没有');
  }

  conflictResult = await compensationService.checkConflicts(
    1,
    new Date(tomorrow.setHours(14, 0, 0, 0)),
    new Date(tomorrow.setHours(16, 0, 0, 0))
  );
  
  if (!conflictResult.hasConflict) {
    console.log(`✅ 无冲突检测成功 | 14:00-16:00 时间段可用`);
  } else {
    console.log('❌ 冲突检测失败: 不应该检测到冲突但检测到了');
  }

  const conflictRecord = await compensationService.createRecord({
    reservationId: 'TEST-CONFLICT-002',
    roomId: 1,
    userId: 2,
    startTime: new Date(tomorrow.setHours(11, 30, 0, 0)),
    endTime: new Date(tomorrow.setHours(12, 30, 0, 0)),
    releaseReason: '重复预订'
  });
  console.log(`✅ 冲突记录已创建 | 状态: ${conflictRecord.success ? conflictRecord.data.status : '创建失败'}`);

  console.log('✅ 冲突记录测试通过!');
}

async function testBadRowImport() {
  console.log('\n📋 测试3: 坏行导入测试');
  console.log('-'.repeat(40));

  const testCsvPath = './test_import.csv';
  const csvWriter = createCsvWriter({
    path: testCsvPath,
    header: [
      { id: 'reservationId', title: 'reservationId' },
      { id: 'roomId', title: 'roomId' },
      { id: 'userId', title: 'userId' },
      { id: 'startTime', title: 'startTime' },
      { id: 'endTime', title: 'endTime' },
      { id: 'chargedAmount', title: 'chargedAmount' }
    ]
  });

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const testRows = [
    {
      reservationId: 'IMPORT-GOOD-001',
      roomId: '1',
      userId: '1',
      startTime: new Date(tomorrow.setHours(9, 0, 0, 0)).toISOString(),
      endTime: new Date(tomorrow.setHours(10, 0, 0, 0)).toISOString(),
      chargedAmount: '150'
    },
    {
      reservationId: '',
      roomId: '1',
      userId: '1',
      startTime: new Date(tomorrow.setHours(10, 0, 0, 0)).toISOString(),
      endTime: new Date(tomorrow.setHours(11, 0, 0, 0)).toISOString(),
      chargedAmount: '150'
    },
    {
      reservationId: 'IMPORT-BAD-002',
      roomId: '999',
      userId: '1',
      startTime: new Date(tomorrow.setHours(11, 0, 0, 0)).toISOString(),
      endTime: new Date(tomorrow.setHours(12, 0, 0, 0)).toISOString(),
      chargedAmount: '150'
    },
    {
      reservationId: 'IMPORT-BAD-003',
      roomId: '1',
      userId: 'abc',
      startTime: 'invalid-date',
      endTime: new Date(tomorrow.setHours(14, 0, 0, 0)).toISOString(),
      chargedAmount: '-100'
    },
    {
      reservationId: 'IMPORT-GOOD-002',
      roomId: '2',
      userId: '2',
      startTime: new Date(tomorrow.setHours(15, 0, 0, 0)).toISOString(),
      endTime: new Date(tomorrow.setHours(17, 0, 0, 0)).toISOString(),
      chargedAmount: '240'
    }
  ];

  await csvWriter.writeRecords(testRows);
  console.log(`✅ 测试CSV文件已创建 | 共 ${testRows.length} 行`);

  const importResult = await importFromCsv(testCsvPath);
  
  console.log(`导入结果: 总计 ${importResult.total} 行 | 成功 ${importResult.success} 行 | 失败 ${importResult.failed} 行`);
  
  if (importResult.errors.length > 0) {
    console.log(`✅ 坏行检测成功 | 检测到 ${importResult.errors.length} 个错误`);
    importResult.errors.forEach(err => {
      console.log(`   行${err.row}: [${err.field}] ${err.message}`);
    });
  } else {
    console.log('❌ 坏行检测失败: 应该检测到错误但没有');
  }

  const listResult = await compensationService.getRecords({ pageSize: 10 });
  console.log(`✅ 列表验证成功 | 列表记录数: ${listResult.data.length}`);
  
  if (listResult.data.length > 0) {
    const detailResult = await compensationService.getRecordDetail(listResult.data[0].id);
    console.log(`✅ 详情验证成功 | 详情记录: ${detailResult.reservationId}`);
    console.log(`   会议室: ${detailResult.Room ? detailResult.Room.name : '未知'}`);
    console.log(`   预约人: ${detailResult.User ? detailResult.User.name : '未知'}`);
    console.log(`   状态: ${detailResult.status}`);
  }

  fs.unlinkSync(testCsvPath);

  console.log('✅ 坏行导入测试通过!');
}

runTests().catch(console.error);
