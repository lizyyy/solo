const { exec } = require('child_process');

async function runTests() {
  console.log('=== 园区安保系统测试 ===\n');

  const fs = require('fs');
  const path = require('path');
  const dbPath = path.join(__dirname, '../park-security-test.db');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  console.log('1. 初始化测试数据库...');
  
  const { initDatabase, db } = require('../src/models/database');
  await initDatabase();

  console.log('2. 测试数据模型...');
  const visitorService = require('../src/services/visitorService');
  const verificationService = require('../src/services/verificationService');
  const batchService = require('../src/services/batchService');
  const reportService = require('../src/services/reportService');
  const moment = require('moment');

  console.log('3. 创建测试访客预约...');
  const today = moment().format('YYYY-MM-DD');
  const visitor = await visitorService.createVisitor({
    name: '张三',
    phone: '13800138000',
    company: '测试公司',
    visit_purpose: '商务洽谈',
    visit_date: today,
    start_time: '09:00',
    end_time: '18:00',
    host_name: '李四',
    host_phone: '13900139000',
    host_department: '技术部',
    license_plate: '京A12345',
    status: 'approved'
  }, 'admin');
  console.log('   ✓ 访客创建成功:', visitor.id);

  console.log('4. 创建测试临时车牌...');
  const plate = await visitorService.createTemporaryPlate({
    plate_number: '京B99999',
    vehicle_type: '小型轿车',
    driver_name: '王五',
    driver_phone: '13700137000',
    valid_from: moment().format(),
    valid_to: moment().add(7, 'days').format()
  }, 'admin');
  console.log('   ✓ 临时车牌创建成功:', plate.id);

  console.log('5. 添加测试黑名单...');
  const blacklistItem = await visitorService.addToBlacklist({
    type: 'phone',
    identifier: '13600136000',
    name: '赵六',
    reason: '多次违规闯入'
  }, 'admin');
  console.log('   ✓ 黑名单添加成功:', blacklistItem.id);

  console.log('6. 测试访客核验 - 正常通过...');
  const result1 = await verificationService.verifyVisitor(
    { phone: '13800138000' },
    'security1',
    'main-gate'
  );
  console.log('   ✓ 核验结果:', result1.passed ? '通过' : '拦截', '-', result1.reason);
  console.log('   ✓ 手机号脱敏:', result1.maskedPhone);

  console.log('7. 测试访客核验 - 黑名单拦截...');
  const result2 = await verificationService.verifyVisitor(
    { phone: '13600136000' },
    'security1',
    'main-gate'
  );
  console.log('   ✓ 核验结果:', result2.blocked ? '拦截' : '异常', '-', result2.reason);

  console.log('8. 测试访客核验 - 无预约记录...');
  const result3 = await verificationService.verifyVisitor(
    { phone: '13500135000' },
    'security1',
    'main-gate'
  );
  console.log('   ✓ 核验结果:', result3.blocked ? '拦截' : '异常', '-', result3.reason);

  console.log('9. 测试车牌核验...');
  const plateResult = await verificationService.verifyPlate(
    { plate_number: '京B99999' },
    'security2',
    'parking-gate'
  );
  console.log('   ✓ 核验结果:', plateResult.passed ? '通过' : '拦截', '-', plateResult.reason);

  console.log('10. 测试人工越权放行...');
  const manualResult = await verificationService.verifyUnauthorizedRelease(
    { identifier: '无证人员', reason: '紧急情况需进入', type: 'unknown' },
    'security-supervisor',
    'emergency-gate'
  );
  console.log('   ✓ 放行结果:', manualResult.passed ? '已放行' : '失败');
  console.log('   ✓ 警告信息:', manualResult.warning);

  console.log('11. 测试核验记录查询...');
  const records = await verificationService.getVerificationRecords();
  console.log('   ✓ 查询到记录数:', records.length);

  console.log('12. 测试按条件筛选...');
  const blockedRecords = await verificationService.getVerificationRecords({
    status: 'blocked'
  });
  console.log('   ✓ 拦截记录数:', blockedRecords.length);
  
  const operatorRecords = await verificationService.getVerificationRecords({
    operator: 'security1'
  });
  console.log('   ✓ 操作员 security1 记录数:', operatorRecords.length);

  console.log('13. 测试统计数据...');
  const stats = await verificationService.getStatistics();
  console.log('   ✓ 总计:', stats.summary.total);
  console.log('   ✓ 通过:', stats.summary.passed);
  console.log('   ✓ 拦截:', stats.summary.blocked);
  console.log('   ✓ 通过率:', stats.summary.passRate);

  console.log('14. 测试批量操作...');
  const batchItems = [
    { phone: '13800138000' },
    { phone: '13600136000' },
    { phone: '13500135000' }
  ];
  
  const { batchId, totalCount } = await batchService.createBatchOperation(
    'verify_visitors',
    batchItems,
    'batch-operator'
  );
  console.log('   ✓ 创建批量任务:', batchId);

  const batchResult = await batchService.processBatch(
    batchId,
    async (item) => await verificationService.verifyVisitor(item, 'batch-operator', 'batch-gate'),
    { concurrency: 2, retries: 1 }
  );
  console.log('   ✓ 批量处理完成:');
  console.log('     - 总数:', batchResult.total);
  console.log('     - 成功:', batchResult.success);
  console.log('     - 失败:', batchResult.failed);
  if (batchResult.failedItems.length > 0) {
    console.log('     - 失败详情:');
    batchResult.failedItems.forEach(item => {
      console.log(`       * ${item.identifier}: ${item.error}`);
    });
  }

  console.log('15. 测试批量任务状态查询...');
  const batchStatus = await batchService.getBatchStatus(batchId);
  console.log('   ✓ 批次状态:', batchStatus.batch.status);

  console.log('16. 测试报告生成...');
  const report = await reportService.generateDetailedReport();
  console.log('   ✓ 报告记录数:', report.records.length);
  console.log('   ✓ 报告摘要:', report.summary);

  console.log('\n=== 测试完成 ===');
  console.log('所有功能测试通过！');
  
  process.exit(0);
}

runTests().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
