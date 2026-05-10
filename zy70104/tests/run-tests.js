const chalk = require('chalk');
const path = require('path');
const Batch = require('../src/models/Batch');
const BatchService = require('../src/services/BatchService');
const ReviewService = require('../src/services/ReviewService');
const SettlementService = require('../src/services/SettlementService');
const dataStore = require('../src/utils/dataStore');
const moistureCalculator = require('../src/utils/moistureCalculator');
const energyAllocator = require('../src/utils/energyAllocator');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(chalk.green(`  ✓ ${name}`));
  } catch (e) {
    failed++;
    console.log(chalk.red(`  ✗ ${name}`));
    console.log(chalk.red(`    Error: ${e.message}`));
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function runAllTests() {
  console.log(chalk.cyan('\n' + '='.repeat(60)));
  console.log(chalk.cyan('  粮食烘干批次结算服务 - 测试套件'));
  console.log(chalk.cyan('='.repeat(60) + '\n'));
  
  dataStore.init();
  
  console.log(chalk.blue('1. 工具函数测试'));
  
  test('水分去除量计算正确', () => {
    const removed = moistureCalculator.calculateMoistureRemoved(10000, 28, 14);
    assert(removed > 0, '水分去除量应该大于0');
    assert(removed < 10000, '水分去除量应该小于总重量');
  });
  
  test('理论出仓重量计算正确', () => {
    const expected = moistureCalculator.calculateExpectedOutWeight(10000, 28, 14);
    const dryMatter = 10000 * (1 - 28/100);
    const actual = dryMatter / (1 - 14/100);
    assert(Math.abs(expected - actual) < 0.01, '理论出仓重量计算错误');
  });
  
  test('水分降幅验证通过', () => {
    const result = moistureCalculator.validateMoistureReduction(28, 14);
    assert(result.valid === true, '正常降幅应该通过验证');
  });
  
  test('水分降幅超限检测', () => {
    const result = moistureCalculator.validateMoistureReduction(30, 5, 20);
    assert(result.valid === false, '超限降幅应该被拒绝');
  });
  
  test('能耗直接成本计算', () => {
    const config = { fuelCostPerUnit: 1.2, powerCostPerKWh: 0.8 };
    const result = energyAllocator.calculateDirectEnergyCost(100, 200, config);
    assert(result.fuelCost === 120, '燃料成本计算错误');
    assert(result.powerCost === 160, '电力成本计算错误');
    assert(result.totalDirectCost === 280, '总成本计算错误');
  });
  
  console.log(chalk.blue('\n2. 批次管理测试'));
  
  const batchService = new BatchService();
  let testBatch = null;
  
  test('创建批次成功', () => {
    testBatch = batchService.createBatch({
      batchNo: `TEST-${Date.now()}`,
      grainType: '玉米',
      inWeight: 10000,
      inMoisture: 28.5,
      inTemp: 22
    });
    assert(testBatch !== null, '批次应该创建成功');
    assert(testBatch.status === Batch.STATUS.CREATED, '初始状态应为 created');
  });
  
  test('按编号查询批次', () => {
    const found = batchService.getBatchByNo(testBatch.batchNo);
    assert(found !== null, '应该能查到刚创建的批次');
    assert(found.batchNo === testBatch.batchNo, '批次编号应该匹配');
  });
  
  test('补录数据后状态变更', () => {
    const updated = batchService.updateBatch(testBatch.batchNo, {
      outWeight: 8500,
      outMoisture: 14.5,
      outTemp: 35,
      dryingTime: 480,
      fuelUsed: 500,
      powerUsed: 320
    });
    assert(updated.status === Batch.STATUS.DATA_COMPLETE, '补录后状态应为 data_complete');
  });
  
  console.log(chalk.blue('\n3. 审核流程测试'));
  
  const reviewService = new ReviewService();
  let testReview = null;
  
  test('提交审核成功', async () => {
    testReview = await reviewService.submitReview(testBatch.batchNo);
    assert(testReview !== null, '审核应该提交成功');
    assert(testReview.status === ReviewService.STATUS.PENDING, '审核状态应为 pending');
  });
  
  test('审核通过成功', () => {
    const approved = reviewService.approveReview(testReview.id);
    assert(approved.status === ReviewService.STATUS.APPROVED, '审核状态应为 approved');
    const batch = batchService.getBatchByNo(testBatch.batchNo);
    assert(batch.status === Batch.STATUS.APPROVED, '批次状态应为 approved');
  });
  
  console.log(chalk.blue('\n4. 结算流程测试'));
  
  const settlementService = new SettlementService();
  let testSettlement = null;
  
  test('执行结算成功', async () => {
    testSettlement = await settlementService.calculateSettlement(testBatch.batchNo);
    assert(testSettlement !== null, '结算应该执行成功');
    assert(testSettlement.status === SettlementService.STATUS.COMPLETED, '结算状态应为 completed');
    assert(testSettlement.moistureRemoved > 0, '水分去除量应该大于0');
    assert(testSettlement.dryingAmount > 0, '烘干量应该大于0');
  });
  
  test('结算金额计算正确', () => {
    assert(typeof testSettlement.settlementAmount === 'number', '结算金额应该是数字');
    assert(testSettlement.baseAmount > 0, '基础金额应该大于0');
  });
  
  test('结算后批次状态变更', () => {
    const batch = batchService.getBatchByNo(testBatch.batchNo);
    assert(batch.status === Batch.STATUS.SETTLED, '批次状态应为 settled');
  });
  
  console.log(chalk.blue('\n5. 异常场景测试'));
  
  test('重复创建相同批次应失败', () => {
    try {
      batchService.createBatch({
        batchNo: testBatch.batchNo,
        grainType: '小麦',
        inWeight: 5000,
        inMoisture: 25
      });
      assert(false, '应该抛出异常');
    } catch (e) {
      assert(e.message.includes('已存在'), '错误信息应该包含已存在');
    }
  });
  
  test('已结算批次不能直接更新', () => {
    try {
      batchService.updateBatch(testBatch.batchNo, { outWeight: 8000 });
      assert(false, '应该抛出异常');
    } catch (e) {
      assert(e.message.includes('无法更新'), '错误信息应该包含无法更新');
    }
  });
  
  test('水分降幅超过限制应拒绝', () => {
    const badBatch = batchService.createBatch({
      batchNo: `BAD-${Date.now()}`,
      grainType: '玉米',
      inWeight: 10000,
      inMoisture: 30
    });
    try {
      batchService.updateBatch(badBatch.batchNo, {
        outWeight: 9000,
        outMoisture: 5
      });
      assert(false, '应该抛出异常');
    } catch (e) {
      assert(e.message.includes('超过'), '错误信息应该包含超过限制');
    }
  });
  
  console.log(chalk.blue('\n6. 撤销流程测试'));
  
  test('撤销结算成功', () => {
    const rollback = settlementService.rollbackSettlement(testBatch.batchNo);
    assert(rollback.status === SettlementService.STATUS.ROLLBACK, '结算状态应为 rollback');
    const batch = batchService.getBatchByNo(testBatch.batchNo);
    assert(batch.status === Batch.STATUS.APPROVED, '批次状态应回退到 approved');
  });
  
  test('再次结算成功', async () => {
    const reSettle = await settlementService.calculateSettlement(testBatch.batchNo);
    assert(reSettle.status === SettlementService.STATUS.COMPLETED, '应该可以再次结算');
  });
  
  console.log(chalk.cyan('\n' + '='.repeat(60)));
  console.log(chalk.green(`  测试完成: ${passed} 通过, ${failed} 失败`));
  console.log(chalk.cyan('='.repeat(60) + '\n'));
  
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(e => {
  console.error(chalk.red('测试运行失败:'), e);
  process.exit(1);
});
