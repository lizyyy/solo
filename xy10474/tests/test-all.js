const ReconciliationManager = require('../src/ReconciliationManager');
const reportGenerator = require('../src/reportGenerator');
const path = require('path');
const fs = require('fs');

const testDataDir = path.join(__dirname, '..', 'test-data');

async function runTest(scenarioName, sampleDir, date, storeId, expectedStatus) {
  console.log(`\n\n`);
  console.log('='.repeat(70));
  console.log(`测试场景: ${scenarioName}`);
  console.log('='.repeat(70));

  const scenarioDataDir = path.join(testDataDir, scenarioName.replace(/\s+/g, '-'));
  
  if (fs.existsSync(scenarioDataDir)) {
    fs.rmSync(scenarioDataDir, { recursive: true, force: true });
  }

  const manager = new ReconciliationManager(scenarioDataDir);

  const transactionsPath = path.join(sampleDir, 'transactions.json');
  const refundsPath = path.join(sampleDir, 'refunds.json');
  const pettyCashPath = path.join(sampleDir, 'pettyCash.json');
  const handoverPath = path.join(sampleDir, 'handover.json');

  console.log('\n📥 导入数据...');
  
  if (fs.existsSync(transactionsPath)) {
    manager.importData('transactions', transactionsPath);
    console.log('  ✓ 收银流水已导入');
  }
  
  if (fs.existsSync(refundsPath)) {
    manager.importData('refunds', refundsPath);
    console.log('  ✓ 退款记录已导入');
  }
  
  if (fs.existsSync(pettyCashPath)) {
    manager.importData('petty-cash', pettyCashPath);
    console.log('  ✓ 备用金变动已导入');
  }
  
  if (fs.existsSync(handoverPath)) {
    manager.importData('handover', handoverPath);
    console.log('  ✓ 交接记录已导入');
  }

  console.log('\n📊 执行日结核对...');
  const result = manager.reconcile(date, storeId);

  console.log('\n📄 生成报告...');
  console.log(reportGenerator.formatConsoleReport(result));

  if (result.summary.status === expectedStatus) {
    console.log(`\n✅ 测试通过: 状态为 ${expectedStatus}`);
  } else {
    console.log(`\n❌ 测试失败: 期望状态 ${expectedStatus}，实际状态 ${result.summary.status}`);
  }

  return { result, dataDir: scenarioDataDir };
}

async function testAllScenarios() {
  const samplesDir = path.join(__dirname, '..', 'samples');

  console.log('\n\n' + '🚀'.repeat(30));
  console.log('开始门店现金长短款 CLI 测试');
  console.log('🚀'.repeat(30));

  try {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }

    const normalResult = await runTest(
      '正常日结',
      path.join(samplesDir, 'normal-day'),
      '2026-05-10',
      'STORE001',
      'normal'
    );

    const shortageTest = await runTest(
      '短款场景',
      path.join(samplesDir, 'shortage-day'),
      '2026-05-11',
      'STORE001',
      'shortage'
    );

    const overageResult = await runTest(
      '长款场景',
      path.join(samplesDir, 'overage-day'),
      '2026-05-12',
      'STORE001',
      'overage'
    );

    const anomalyResult = await runTest(
      '退款异常场景',
      path.join(samplesDir, 'refund-anomaly'),
      '2026-05-13',
      'STORE001',
      'warning'
    );

    console.log('\n\n' + '📝'.repeat(30));
    console.log('测试调查备注功能');
    console.log('📝'.repeat(30));

    const manager = new ReconciliationManager(shortageTest.dataDir);
    
    console.log('\n✏️  添加调查备注...');
    manager.addNote('2026-05-11', 'STORE001', 'CASHIER003', '已核对该收银员的收银抽屉，发现有130元现金未入账，可能是忘记存入系统');
    manager.addNote('2026-05-11', 'STORE001', 'CASHIER003', '已与该收银员谈话，承认是操作失误');
    
    console.log('✓ 备注已添加');

    console.log('\n🔄 重新生成报告...');
    const regeneratedResult = manager.regenerateReport('2026-05-11', 'STORE001');
    console.log(reportGenerator.formatConsoleReport(regeneratedResult));

    console.log('\n\n' + '🎉'.repeat(30));
    console.log('所有测试完成！');
    console.log('🎉'.repeat(30));

    return true;
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    console.error(error.stack);
    return false;
  }
}

testAllScenarios().then(success => {
  process.exit(success ? 0 : 1);
});
