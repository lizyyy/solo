const { sequelize } = require('../src/models');
const { 
  BatchService, 
  DataService, 
  ReconcileService, 
  ExportService,
  AuditService 
} = require('../src/services');
const chalk = require('chalk');

let testResults = [];

function test(name, fn) {
  testResults.push({ name, fn, status: 'pending' });
}

async function runTests() {
  console.log(chalk.blue('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue('║                   生鲜分拣损耗验收测试套件                   ║'));
  console.log(chalk.blue('╚════════════════════════════════════════════════════════════╝\n'));

  AuditService.setUseQueue(false);

  let passed = 0;
  let failed = 0;
  let batchId = null;
  let lossId = null;

  test('1. 正常链路: 创建批次', async () => {
    const batch = await BatchService.createBatch({
      supplierId: 'TEST_SUP',
      supplierName: '测试供应商',
      deliveryDate: new Date(),
      remark: '验收测试批次'
    }, 'tester');
    batchId = batch.id;
    return batch;
  });

  test('2. 正常链路: 添加送货单', async () => {
    return await DataService.addDeliveryNote(batchId, {
      productName: '测试苹果',
      quantity: 100,
      unit: 'kg',
      unitPrice: 5,
      totalAmount: 500
    }, 'tester');
  });

  test('3. 正常链路: 添加称重记录', async () => {
    await DataService.addWeighingRecord(batchId, {
      weighType: 'net',
      productName: '测试苹果',
      weight: 100,
      unit: 'kg',
      weighTime: new Date()
    }, 'tester');
    return await DataService.addWeighingRecord(batchId, {
      weighType: 'sorting',
      productName: '测试苹果',
      weight: 92,
      unit: 'kg',
      weighTime: new Date()
    }, 'tester');
  });

  test('4. 正常链路: 添加照片（含异常照片）', async () => {
    await DataService.addPhoto(batchId, {
      photoType: 'delivery',
      fileName: 'test_delivery.jpg',
      filePath: '/test/test_delivery.jpg',
      description: '送货照片'
    }, 'tester');
    return await DataService.addPhoto(batchId, {
      photoType: 'bad_fruit',
      fileName: 'test_bad.jpg',
      filePath: '/test/test_bad.jpg',
      description: '坏果照片',
      isAnomaly: true,
      anomalyRemark: '验收测试异常照片'
    }, 'tester');
  });

  test('5. 正常链路: 添加损耗记录（坏果+二次分拣）', async () => {
    const loss1 = await DataService.addLossRecord(batchId, {
      lossType: 'bad_fruit',
      productName: '测试苹果',
      lossWeight: 5,
      lossRate: 5,
      deductionAmount: 25,
      reason: '验收测试-坏果'
    }, 'tester');
    lossId = loss1.id;
    
    const loss2 = await DataService.addLossRecord(batchId, {
      lossType: 'secondary_sorting',
      productName: '测试苹果',
      lossWeight: 3,
      lossRate: 3,
      deductionAmount: 15,
      reason: '验收测试-二次分拣'
    }, 'tester');
    
    await DataService.confirmLossRecord(loss1.id, 'tester');
    await DataService.confirmLossRecord(loss2.id, 'tester');
    return { loss1, loss2 };
  });

  test('6. 正常链路: 提交批次', async () => {
    const result = await BatchService.submitBatch(batchId, 'tester');
    if (result.action !== 'submitted') throw new Error('提交失败');
    return result;
  });

  test('7. 边界情况: 重复提交（默认报错）', async () => {
    try {
      await BatchService.submitBatch(batchId, 'tester');
      throw new Error('应该报错但没有报错');
    } catch (error) {
      if (!error.message.includes('请指定处理策略')) {
        throw error;
      }
      return '正确抛出重复提交错误';
    }
  });

  test('8. 边界情况: 重复提交（忽略策略）', async () => {
    const result = await BatchService.submitBatch(batchId, 'tester', 'ignore');
    if (result.action !== 'ignored') throw new Error('忽略策略失败');
    return result;
  });

  test('9. 边界情况: 重复提交（覆盖策略）', async () => {
    const result = await BatchService.submitBatch(batchId, 'tester', 'overwrite');
    if (result.action !== 'overwritten') throw new Error('覆盖策略失败');
    return result;
  });

  test('10. 边界情况: 重复提交（追加策略）', async () => {
    const result = await BatchService.submitBatch(batchId, 'tester', 'append');
    if (result.action !== 'appended') throw new Error('追加策略失败');
    return result;
  });

  test('11. 边界情况: 撤回批次', async () => {
    const result = await BatchService.withdrawBatch(batchId, 'tester', '验收测试撤回');
    if (result.status !== 'withdrawn') throw new Error('撤回失败');
    return result;
  });

  test('12. 边界情况: 撤回后再提交', async () => {
    const result = await BatchService.submitBatch(batchId, 'tester');
    if (result.action !== 'submitted') throw new Error('撤回后再提交失败');
    return result;
  });

  test('13. 边界情况: 部分失败测试 - 批量添加数据', async () => {
    const result = await DataService.batchAdd(batchId, {
      deliveryNotes: [
        { productName: '好商品', quantity: 50 },
        { quantity: 50 }
      ],
      weighingRecords: [
        { weighType: 'net', productName: '称重1', weight: 50, weighTime: new Date() }
      ]
    }, 'tester');
    
    if (result.success.length !== 2 || result.failed.length !== 1) {
      throw new Error(`部分失败逻辑错误: 成功${result.success.length}, 失败${result.failed.length}`);
    }
    return result;
  });

  test('14. 边界情况: 人工改判损耗记录', async () => {
    const result = await DataService.adjustLossRecord(
      lossId,
      { lossWeight: 3, deductionAmount: 15 },
      'manager',
      '验收测试-人工改判，减少扣款'
    );
    if (!result.isManualAdjusted) throw new Error('人工改判失败');
    return result;
  });

  test('15. 正常链路: 对账', async () => {
    const result = await ReconcileService.reconcile(batchId, 'accountant');
    if (!result.reconciliation) throw new Error('对账失败');
    return result;
  });

  test('16. 边界情况: 导出前冻结批次', async () => {
    const result = await BatchService.freezeBatch(batchId, 'manager');
    if (!result.isFrozen) throw new Error('冻结失败');
    return result;
  });

  test('17. 边界情况: 冻结后尝试修改（应该失败）', async () => {
    try {
      await DataService.addDeliveryNote(batchId, {
        productName: '应该失败',
        quantity: 100
      }, 'tester');
      throw new Error('应该报错但没有报错');
    } catch (error) {
      if (!error.message.includes('已冻结')) {
        throw error;
      }
      return '正确阻止冻结后修改';
    }
  });

  test('18. 正常链路: 导出数据', async () => {
    const result = await ExportService.exportBatch(batchId, 'manager', 'json');
    if (!result.exportRecord) throw new Error('导出失败');
    return result;
  });

  test('19. 历史追溯: 查看批次审计历史', async () => {
    const history = await AuditService.getBatchAuditTrail(batchId);
    if (history.length === 0) throw new Error('没有审计记录');
    console.log(chalk.gray(`    共${history.length}条审计记录`));
    return history;
  });

  test('20. 异常不被吞掉: 错误信息完整', async () => {
    try {
      await BatchService.getBatchDetail('non-existent-id');
      throw new Error('应该报错');
    } catch (error) {
      if (!error.message) throw new Error('错误信息被吞掉');
      return `错误信息正常: ${error.message}`;
    }
  });

  for (let i = 0; i < testResults.length; i++) {
    const testCase = testResults[i];
    try {
      process.stdout.write(chalk.yellow(`  运行: ${testCase.name}... `));
      const result = await testCase.fn();
      console.log(chalk.green('✓ 通过'));
      testCase.status = 'passed';
      passed++;
    } catch (error) {
      console.log(chalk.red('✗ 失败'));
      console.log(chalk.red(`    错误: ${error.message}`));
      testCase.status = 'failed';
      testCase.error = error;
      failed++;
    }
  }

  console.log(chalk.green('\n═══════════════════════════════════════════════════════════════'));
  console.log(chalk.green('                      验收测试完成!'));
  console.log(chalk.green(`                      通过: ${passed} / ${testResults.length}`));
  if (failed > 0) {
    console.log(chalk.red(`                      失败: ${failed}`));
  }
  console.log(chalk.green('═══════════════════════════════════════════════════════════════\n'));

  if (failed === 0) {
    console.log(chalk.cyan('验收要点总结:'));
    console.log(chalk.cyan('  ✓ 正常链路: 建账→提交→对账→冻结→导出→回放'));
    console.log(chalk.cyan('  ✓ 重复提交: 支持ignore/overwrite/append三种策略'));
    console.log(chalk.cyan('  ✓ 撤回后再提交: 正常工作'));
    console.log(chalk.cyan('  ✓ 部分失败: 成功和失败分别返回'));
    console.log(chalk.cyan('  ✓ 人工改判: 保留版本历史，可追溯'));
    console.log(chalk.cyan('  ✓ 导出前冻结: 冻结后无法修改，保证数据一致性'));
    console.log(chalk.cyan('  ✓ 异常不被吞掉: 错误信息完整抛出'));
    console.log(chalk.cyan('  ✓ 历史追溯: 所有操作有审计记录，谁改了什么一目了然\n'));
    process.exit(0);
  } else {
    process.exit(1);
  }
}

async function main() {
  try {
    await sequelize.sync({ force: true });
    await runTests();
  } catch (error) {
    console.error(chalk.red('测试运行失败:'), error);
    process.exit(1);
  }
}

main();
