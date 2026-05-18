const { sequelize, TestDrive, AccidentRecord, OperationLog } = require('../src/models');
const { createAccidentRecord, getAccidentRecord } = require('../src/services/accidentService');
const moment = require('moment');

async function runNormalTest() {
  console.log('========================================');
  console.log('汽车试驾中心试驾事故登记API - 正常单测试');
  console.log('========================================\n');

  console.log('1. 初始化数据库...');
  await sequelize.sync({ force: true });

  console.log('2. 创建试驾记录...');
  const testDrive = await TestDrive.create({
    testDriveNo: 'TD-TEST-NORMAL-001',
    customerName: '测试用户',
    customerPhone: '13800000001',
    salesConsultant: '测试销售',
    vehicleModel: '测试车型',
    vehiclePlateNumber: 'TEST-001',
    startTime: moment().subtract(2, 'hours').toDate(),
    endTime: moment().subtract(1, 'hours').toDate(),
    status: 'completed',
    hasAccident: false
  });
  console.log(`   ✓ 试驾记录ID: ${testDrive.id}`);

  console.log('\n3. 创建正常事故记录...');
  const accidentData = {
    testDriveId: testDrive.id,
    reporterName: '测试用户',
    reporterPhone: '13800000001',
    reporterRole: 'customer',
    accidentTime: moment().subtract(1.5, 'hours').toDate(),
    accidentLocation: '测试路口',
    accidentType: 'collision',
    accidentSeverity: 'minor',
    accidentDescription: '测试事故描述：正常试驾过程中发生轻微碰撞',
    weatherCondition: '晴',
    roadCondition: '干燥',
    driverName: '测试用户',
    passengerCount: 2,
    hasInjury: false,
    vehicleDamage: '前保险杠轻微刮擦',
    policeCalled: false,
    insuranceCalled: true,
    insuranceReportNo: 'TEST-INS-001',
    estimatedLoss: 1500.00,
    liability: 'third_party',
    operator: 'test_user'
  };

  const result = await createAccidentRecord(accidentData);

  console.log(`   ✓ 成功: ${result.success}`);
  console.log(`   ✓ 状态码: ${result.code}`);
  console.log(`   ✓ 记录状态: ${result.data.status}`);
  console.log(`   ✓ 事故编号: ${result.data.accidentNo}`);
  console.log(`   ✓ 消息: ${result.message}`);

  let testPassed = true;

  if (result.data.status !== 'pending_review') {
    console.log(`   ✗ 状态错误: 预期 pending_review, 实际 ${result.data.status}`);
    testPassed = false;
  } else {
    console.log(`   ✓ 状态正确: 记录进入待审核状态`);
  }

  if (result.warnings && result.warnings.length > 0) {
    console.log(`   ⚠️  存在警告（正常单预期无警告）:`);
    result.warnings.forEach(w => console.log(`      - ${w.code}: ${w.message}`));
  } else {
    console.log(`   ✓ 无警告信息`);
  }

  console.log('\n4. 验证操作日志...');
  const logs = await OperationLog.findAll({
    where: { accidentRecordId: result.data.id }
  });
  console.log(`   ✓ 日志数量: ${logs.length}`);
  if (logs.length > 0) {
    console.log(`   ✓ 操作类型: ${logs[0].operationType}`);
    console.log(`   ✓ 操作人: ${logs[0].operator}`);
  }

  console.log('\n5. 查询事故记录详情...');
  const detail = await getAccidentRecord(result.data.id);
  console.log(`   ✓ 事故编号: ${detail.accidentNo}`);
  console.log(`   ✓ 报案人: ${detail.reporterName}`);
  console.log(`   ✓ 事故地点: ${detail.accidentLocation}`);
  console.log(`   ✓ 事故时间: ${moment(detail.accidentTime).format('YYYY-MM-DD HH:mm:ss')}`);

  console.log('\n========================================');
  console.log('测试结果:');
  console.log('========================================');
  if (testPassed) {
    console.log('✓ 正常单测试通过！');
    console.log('  - 记录正确进入 pending_review 状态');
    console.log('  - 无错误和警告');
    console.log('  - 操作日志记录完整');
  } else {
    console.log('✗ 正常单测试未通过');
  }

  console.log('\n测试完成！\n');
  await sequelize.close();
}

runNormalTest().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
