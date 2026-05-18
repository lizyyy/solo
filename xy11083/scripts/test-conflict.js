const { sequelize, TestDrive } = require('../src/models');
const { createAccidentRecord, updateAccidentRecord } = require('../src/services/accidentService');
const moment = require('moment');

async function runConflictTest() {
  console.log('========================================');
  console.log('汽车试驾中心试驾事故登记API - 冲突单测试');
  console.log('========================================\n');

  console.log('1. 初始化数据库...');
  await sequelize.sync({ force: true });

  console.log('2. 创建试驾记录...');
  const testDrive = await TestDrive.create({
    testDriveNo: 'TD-TEST-CONFLICT-001',
    customerName: '冲突测试用户',
    customerPhone: '13800000002',
    salesConsultant: '测试销售',
    vehicleModel: '冲突测试车型',
    vehiclePlateNumber: 'TEST-002',
    startTime: moment().subtract(72, 'hours').toDate(),
    endTime: moment().subtract(70, 'hours').toDate(),
    status: 'completed',
    hasAccident: false
  });
  console.log(`   ✓ 试驾记录ID: ${testDrive.id}`);

  let allTestsPassed = true;
  const testResults = [];

  console.log('\n3. 测试场景1：试驾结束后超时补报（超过24小时可信窗口）');
  console.log('────────────────────────────────────────');
  try {
    const result1 = await createAccidentRecord({
      testDriveId: testDrive.id,
      reporterName: '冲突测试用户',
      reporterPhone: '13800000002',
      reporterRole: 'customer',
      accidentTime: moment().subtract(45, 'hours').toDate(),
      accidentLocation: '超时补报地点',
      accidentType: 'scratch',
      accidentSeverity: 'minor',
      accidentDescription: '试驾结束后第二天才报案',
      driverName: '冲突测试用户',
      hasInjury: false,
      vehicleDamage: '轻微刮擦',
      operator: 'test_user'
    });

    console.log(`   状态: ${result1.data.status}`);
    const hasSuspiciousWarning = result1.warnings?.some(w => 
      w.code === 'ACCIDENT_TIME_AFTER_TESTDRIVE_SUSPICIOUS'
    );
    
    if (result1.data.status === 'pending_processing' && hasSuspiciousWarning) {
      console.log('   ✓ 测试通过：超时补报正确进入待处理状态');
      testResults.push({ scenario: '超时补报', passed: true });
    } else {
      console.log('   ✗ 测试失败：未正确识别超时补报');
      testResults.push({ scenario: '超时补报', passed: false });
      allTestsPassed = false;
    }
    console.log(`   警告数量: ${result1.warnings?.length || 0}`);
  } catch (e) {
    console.log(`   ✗ 异常: ${e.message}`);
    testResults.push({ scenario: '超时补报', passed: false });
    allTestsPassed = false;
  }

  console.log('\n4. 测试场景2：事故时间早于试驾开始时间（逻辑错误驳回）');
  console.log('────────────────────────────────────────');
  try {
    const result2 = await createAccidentRecord({
      testDriveId: testDrive.id,
      reporterName: '冲突测试用户',
      reporterPhone: '13800000002',
      reporterRole: 'customer',
      accidentTime: moment().subtract(75, 'hours').toDate(),
      accidentLocation: '逻辑错误地点',
      accidentType: 'collision',
      accidentSeverity: 'minor',
      accidentDescription: '事故时间早于试驾开始',
      driverName: '冲突测试用户',
      hasInjury: false,
      vehicleDamage: '损坏',
      operator: 'test_user'
    });

    console.log(`   成功标志: ${result2.success}`);
    console.log(`   状态: ${result2.data.status}`);
    console.log(`   错误数量: ${result2.errors?.length || 0}`);

    const hasTimeError = result2.errors?.some(e => 
      e.code === 'ACCIDENT_TIME_BEFORE_TESTDRIVE'
    );

    if (result2.data.status === 'rejected' && hasTimeError) {
      console.log('   ✓ 测试通过：逻辑错误正确驳回');
      testResults.push({ scenario: '时间逻辑错误', passed: true });
    } else {
      console.log('   ✗ 测试失败：未正确识别时间逻辑错误');
      testResults.push({ scenario: '时间逻辑错误', passed: false });
      allTestsPassed = false;
    }
  } catch (e) {
    console.log(`   ✗ 异常: ${e.message}`);
    testResults.push({ scenario: '时间逻辑错误', passed: false });
    allTestsPassed = false;
  }

  console.log('\n5. 测试场景3：驾驶员与试驾客户不一致（需人工审核）');
  console.log('────────────────────────────────────────');
  try {
    const result3 = await createAccidentRecord({
      testDriveId: testDrive.id,
      reporterName: '冲突测试用户',
      reporterPhone: '13800000002',
      reporterRole: 'customer',
      accidentTime: moment().subtract(71, 'hours').toDate(),
      accidentLocation: '驾驶员不一致地点',
      accidentType: 'scratch',
      accidentSeverity: 'minor',
      accidentDescription: '实际驾驶员不是登记的试驾客户',
      driverName: '其他驾驶员',
      hasInjury: false,
      vehicleDamage: '轻微刮擦',
      operator: 'test_user'
    });

    console.log(`   状态: ${result3.data.status}`);
    const hasMismatchWarning = result3.warnings?.some(w => 
      w.code === 'DRIVER_MISMATCH'
    );

    if (result3.data.status === 'pending_review' && hasMismatchWarning) {
      console.log('   ✓ 测试通过：驾驶员不一致正确进入待审核状态');
      testResults.push({ scenario: '驾驶员不一致', passed: true });
    } else {
      console.log('   ✗ 测试失败：未正确识别驾驶员不一致');
      testResults.push({ scenario: '驾驶员不一致', passed: false });
      allTestsPassed = false;
    }
    console.log(`   警告数量: ${result3.warnings?.length || 0}`);
  } catch (e) {
    console.log(`   ✗ 异常: ${e.message}`);
    testResults.push({ scenario: '驾驶员不一致', passed: false });
    allTestsPassed = false;
  }

  console.log('\n6. 测试场景4：同一次试驾重复登记（冲突检测）');
  console.log('────────────────────────────────────────');
  try {
    const firstResult = await createAccidentRecord({
      testDriveId: testDrive.id,
      reporterName: '冲突测试用户',
      reporterPhone: '13800000002',
      reporterRole: 'customer',
      accidentTime: moment().subtract(71, 'hours').toDate(),
      accidentLocation: '重复登记地点',
      accidentType: 'collision',
      accidentSeverity: 'minor',
      accidentDescription: '第一次登记',
      driverName: '冲突测试用户',
      hasInjury: false,
      vehicleDamage: '轻微损坏',
      operator: 'test_user'
    });

    const duplicateResult = await createAccidentRecord({
      testDriveId: testDrive.id,
      reporterName: '冲突测试用户',
      reporterPhone: '13800000002',
      reporterRole: 'customer',
      accidentTime: moment().subtract(71.5, 'hours').toDate(),
      accidentLocation: '重复登记地点2',
      accidentType: 'collision',
      accidentSeverity: 'minor',
      accidentDescription: '重复登记测试',
      driverName: '冲突测试用户',
      hasInjury: false,
      vehicleDamage: '损坏',
      operator: 'test_user'
    });

    console.log(`   第一次记录状态: ${firstResult.data.status}`);
    console.log(`   重复记录状态: ${duplicateResult.data.status}`);
    
    const hasDuplicateWarning = duplicateResult.warnings?.some(w => 
      w.code === 'POTENTIAL_DUPLICATE'
    );

    if (hasDuplicateWarning) {
      console.log('   ✓ 测试通过：正确检测到潜在重复登记');
      testResults.push({ scenario: '重复登记检测', passed: true });
    } else {
      console.log('   ✗ 测试失败：未检测到潜在重复登记');
      testResults.push({ scenario: '重复登记检测', passed: false });
      allTestsPassed = false;
    }
    console.log(`   警告数量: ${duplicateResult.warnings?.length || 0}`);
  } catch (e) {
    console.log(`   ✗ 异常: ${e.message}`);
    testResults.push({ scenario: '重复登记检测', passed: false });
    allTestsPassed = false;
  }

  console.log('\n7. 测试场景5：频繁修改同一条记录（超过修改阈值）');
  console.log('────────────────────────────────────────');
  try {
    const createResult = await createAccidentRecord({
      testDriveId: testDrive.id,
      reporterName: '冲突测试用户',
      reporterPhone: '13800000002',
      reporterRole: 'customer',
      accidentTime: moment().subtract(71, 'hours').toDate(),
      accidentLocation: '频繁修改地点',
      accidentType: 'scratch',
      accidentSeverity: 'minor',
      accidentDescription: '初始记录',
      driverName: '冲突测试用户',
      hasInjury: false,
      vehicleDamage: '轻微刮擦',
      operator: 'test_user'
    });

    const recordId = createResult.data.id;
    let lastResult = createResult;

    for (let i = 1; i <= 6; i++) {
      lastResult = await updateAccidentRecord(recordId, {
        accidentDescription: `第${i}次修改记录描述`,
        estimatedLoss: 1000 + i * 100
      }, 'test_user');
    }

    console.log(`   修改次数: 6次`);
    console.log(`   最终状态: ${lastResult.data.status}`);
    
    const hasModificationWarning = lastResult.warnings?.some(w => 
      w.code === 'EXCESSIVE_MODIFICATIONS'
    );

    if (hasModificationWarning) {
      console.log('   ✓ 测试通过：正确检测到频繁修改');
      testResults.push({ scenario: '频繁修改检测', passed: true });
    } else {
      console.log('   ✗ 测试失败：未检测到频繁修改');
      testResults.push({ scenario: '频繁修改检测', passed: false });
      allTestsPassed = false;
    }
    console.log(`   警告数量: ${lastResult.warnings?.length || 0}`);
  } catch (e) {
    console.log(`   ✗ 异常: ${e.message}`);
    testResults.push({ scenario: '频繁修改检测', passed: false });
    allTestsPassed = false;
  }

  console.log('\n========================================');
  console.log('测试结果汇总:');
  console.log('========================================');
  testResults.forEach((r, i) => {
    console.log(`${i + 1}. ${r.scenario}: ${r.passed ? '✓ 通过' : '✗ 失败'}`);
  });

  const passedCount = testResults.filter(r => r.passed).length;
  console.log(`\n总计: ${passedCount}/${testResults.length} 个测试场景通过`);

  if (allTestsPassed) {
    console.log('\n✓ 所有冲突单测试通过！');
    console.log('  - 超时补报检测正常');
    console.log('  - 时间逻辑错误正确驳回');
    console.log('  - 驾驶员不一致正确进入待审核');
    console.log('  - 重复登记检测正常');
    console.log('  - 频繁修改检测正常');
  } else {
    console.log('\n✗ 部分测试未通过');
  }

  console.log('\n测试完成！\n');
  await sequelize.close();
}

runConflictTest().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
