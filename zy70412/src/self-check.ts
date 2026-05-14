#!/usr/bin/env node

import { SchemaDiffer } from './schema-diff';
import { LogisticsProcessor } from './logistics-processor';
import { ResultStore } from './result-store';
import { BatchProcessor } from './batch-processor';
import { LogisticsInterception } from './types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import chalk from 'chalk';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(chalk.green(`✓ ${name}`));
    passed++;
  } catch (e) {
    console.log(chalk.red(`✗ ${name}`));
    console.log(chalk.red(`  Error: ${(e as Error).message}`));
    failed++;
  }
}

function assertEqual(actual: any, expected: any, message?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assert(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertExists(value: any, message?: string) {
  if (value === undefined || value === null) {
    throw new Error(message || 'Expected value to exist');
  }
}

async function runSelfCheck() {
  console.log(chalk.blue('='.repeat(60)));
  console.log(chalk.blue.bold('JSON Schema Diff - 自检脚本'));
  console.log(chalk.blue('='.repeat(60)));
  console.log();

  console.log(chalk.yellow('1. Schema 差异比较测试'));
  console.log(chalk.yellow('-'.repeat(40)));

  const differ = new SchemaDiffer();

  test('检测新增字段', () => {
    const diffs = differ.compare({ a: 1 }, { a: 1, b: 2 });
    assertEqual(diffs.length, 1);
    assertEqual(diffs[0].type, 'added');
    assertEqual(diffs[0].path, 'b');
  });

  test('检测删除字段', () => {
    const diffs = differ.compare({ a: 1, b: 2 }, { a: 1 });
    assertEqual(diffs.length, 1);
    assertEqual(diffs[0].type, 'removed');
  });

  test('检测修改字段', () => {
    const diffs = differ.compare({ a: 1 }, { a: 2 });
    assertEqual(diffs.length, 1);
    assertEqual(diffs[0].type, 'modified');
  });

  test('检测嵌套差异', () => {
    const diffs = differ.compare(
      { a: { b: 1, c: 2 } },
      { a: { b: 2, d: 3 } }
    );
    assert(diffs.length >= 2);
  });

  test('hasCriticalDiffs 检测关键差异', () => {
    const removedDiffs = differ.compare({ a: 1 }, {});
    assert(differ.hasCriticalDiffs(removedDiffs) === true);
    
    const addedDiffs = differ.compare({}, { a: 1 });
    assert(differ.hasCriticalDiffs(addedDiffs) === false);
  });

  test('summarizeDiffs 差异摘要', () => {
    const diffs = differ.compare({ a: 1, b: 2 }, { a: 2, c: 3 });
    const summary = differ.summarizeDiffs(diffs);
    assertEqual(summary.minor.length, 2);
  });

  console.log();
  console.log(chalk.yellow('2. 物流处理器测试'));
  console.log(chalk.yellow('-'.repeat(40)));

  const processor = new LogisticsProcessor();

  const validItem: LogisticsInterception = {
    id: uuidv4(),
    orderId: 'TEST001',
    waybillNo: 'SFTEST001',
    status: 'intercepted',
    interceptionTime: new Date().toISOString(),
    reason: '测试',
    grayRelease: true,
    compensationActions: [
      { id: uuidv4(), name: '退款', description: '', required: true, executed: true },
      { id: uuidv4(), name: '优惠券', description: '', required: true, executed: true }
    ]
  };

  test('验证有效的拦截记录', () => {
    const referenceSchema = {
      status: 'intercepted',
      grayRelease: true,
      hasCompensationActions: true,
      allCompensationsExecuted: true,
      requiredCompensationsCount: 2
    };
    const result = processor.validateInterception(validItem, referenceSchema);
    assert(result.valid === true);
  });

  test('检测补偿动作缺失', () => {
    const item: LogisticsInterception = {
      ...validItem,
      id: uuidv4(),
      compensationActions: [
        { id: uuidv4(), name: '退款', description: '', required: true, executed: true },
        { id: uuidv4(), name: '优惠券', description: '', required: true, executed: false }
      ]
    };
    const referenceSchema = {
      status: 'intercepted',
      grayRelease: true,
      hasCompensationActions: true,
      allCompensationsExecuted: true,
      requiredCompensationsCount: 2
    };
    const result = processor.validateInterception(item, referenceSchema);
    assert(result.valid === false);
    assertExists(result.failedPath);
    assert(result.failedPath!.includes('COMPENSATION_MISSING'));
    assert(result.missingCompensations.length === 1);
  });

  test('检测灰度发布失败', () => {
    const item: LogisticsInterception = {
      ...validItem,
      id: uuidv4(),
      status: 'failed'
    };
    const referenceSchema = {
      status: 'intercepted',
      grayRelease: true,
      hasCompensationActions: true,
      allCompensationsExecuted: true,
      requiredCompensationsCount: 2
    };
    const result = processor.validateInterception(item, referenceSchema);
    assert(result.valid === false);
    assertExists(result.failedPath);
    assert(result.failedPath!.includes('GRAY_RELEASE_FAILED'));
  });

  test('检测拦截时间缺失', () => {
    const item: LogisticsInterception = {
      ...validItem,
      id: uuidv4(),
      interceptionTime: undefined
    };
    const referenceSchema = {
      status: 'intercepted',
      grayRelease: true,
      hasCompensationActions: true,
      allCompensationsExecuted: true,
      requiredCompensationsCount: 2
    };
    const result = processor.validateInterception(item, referenceSchema);
    assert(result.valid === false);
    assertExists(result.failedPath);
    assert(result.failedPath!.includes('INTERCEPTION_TIME_MISSING'));
  });

  test('批量预览功能', () => {
    const items: LogisticsInterception[] = [
      validItem,
      { ...validItem, id: uuidv4(), status: 'failed' }
    ];
    const preview = processor.createPreview(items);
    assertEqual(preview.totalCount, 2);
    assertExists(preview.failureGroups['GRAY_RELEASE_FAILED']);
  });

  test('失败分组功能', () => {
    const items: LogisticsInterception[] = [
      validItem,
      { ...validItem, id: uuidv4(), status: 'failed' }
    ];
    const groups = processor.groupByFailure(items);
    assertExists(groups['GRAY_RELEASE_FAILED']);
    assertExists(groups['SUCCESS']);
  });

  console.log();
  console.log(chalk.yellow('3. 结果存储测试'));
  console.log(chalk.yellow('-'.repeat(40)));

  const testDataDir = './test-data-' + Date.now();
  const store = new ResultStore(testDataDir);

  test('存储结果', () => {
    const result = store.storeResult({
      batchId: uuidv4(),
      itemId: uuidv4(),
      orderId: 'TEST001',
      waybillNo: 'SFTEST001',
      status: 'failed',
      schemaDiffs: [],
      failureReason: '测试失败',
      failureGroup: 'TEST_GROUP',
      lakehousePartition: 'date=2024-01-01/gray=true'
    });
    assert(result.id !== undefined);
    assertEqual(result.orderId, 'TEST001');
  });

  test('查找之前的结果', () => {
    const found = store.findPreviousResult('TEST001');
    assert(found !== null);
    assertEqual(found?.orderId, 'TEST001');
  });

  test('检测Schema变更但有人工备注时的冲突', () => {
    const result = store.storeResult({
      batchId: uuidv4(),
      itemId: uuidv4(),
      orderId: 'TEST_CONFLICT',
      waybillNo: 'SFTEST_CONFLICT',
      status: 'failed',
      schemaDiffs: [{ path: 'a', type: 'added' as const, newValue: 1 }]
    });
    store.addHumanRemark(result.id, '已人工审核', 'admin');
    
    const differentSchemaDiffs = [{ path: 'b', type: 'added' as const, newValue: 2 }];
    const conflictCheck = store.detectConflict('TEST_CONFLICT', differentSchemaDiffs);
    
    assert(conflictCheck.conflict === true);
    assert(conflictCheck.canReuse === false);
    assertExists(conflictCheck.reason);
    assert(conflictCheck.reason!.includes('Schema已变更'));
  });

  test('相同Schema时可复用旧结果', () => {
    const schemaDiffs = [{ path: 'c', type: 'added' as const, newValue: 3 }];
    const result = store.storeResult({
      batchId: uuidv4(),
      itemId: uuidv4(),
      orderId: 'TEST_REUSE',
      waybillNo: 'SFTEST_REUSE',
      status: 'failed',
      schemaDiffs
    });
    
    const conflictCheck = store.detectConflict('TEST_REUSE', schemaDiffs);
    assert(conflictCheck.conflict === false);
    assert(conflictCheck.canReuse === true);
    assertEqual(conflictCheck.previousResult?.id, result.id);
  });

  test('添加人工备注', () => {
    const result = store.storeResult({
      batchId: uuidv4(),
      itemId: uuidv4(),
      orderId: 'TEST002',
      waybillNo: 'SFTEST002',
      status: 'failed',
      schemaDiffs: []
    });
    const updated = store.addHumanRemark(result.id, '已人工审核通过', 'admin');
    assert(updated !== null);
    assertEqual(updated?.humanRemarks, '已人工审核通过');
  });

  test('加载失败项', () => {
    const failures = store.loadFailures();
    assert(failures.length >= 2);
  });

  test('按分组过滤失败项', () => {
    const failures = store.getFailuresByGroup('TEST_GROUP');
    assertEqual(failures.length, 1);
  });

  test('湖仓分区管理', () => {
    store.addPartitions([{
      name: 'date=2024-01-01/gray=true',
      date: '2024-01-01',
      region: 'cn',
      recordCount: 100
    }]);
    const partitions = store.getPartitions();
    assertEqual(partitions.length, 1);
    const confirmed = store.confirmPartition('date=2024-01-01/gray=true', 'admin');
    assert(confirmed?.humanConfirmed === true);
  });

  test('获取未确认分区', () => {
    store.addPartitions([{
      name: 'date=2024-01-02/gray=true',
      date: '2024-01-02',
      region: 'cn',
      recordCount: 50
    }]);
    const unconfirmed = store.getUnconfirmedPartitions();
    assert(unconfirmed.length === 1);
  });

  test('addOrUpdatePartitions 新增并更新分区计数', () => {
    store.addOrUpdatePartitions([{
      name: 'date=2024-01-03/gray=true',
      date: '2024-01-03',
      region: 'cn',
      recordCount: 10
    }]);
    const partitions1 = store.getPartitions().filter(p => p.name === 'date=2024-01-03/gray=true');
    assert(partitions1[0].recordCount === 10);
    
    store.addOrUpdatePartitions([{
      name: 'date=2024-01-03/gray=true',
      date: '2024-01-03',
      region: 'cn',
      recordCount: 5
    }]);
    const partitions2 = store.getPartitions().filter(p => p.name === 'date=2024-01-03/gray=true');
    assert(partitions2[0].recordCount === 15);
  });

  console.log();
  console.log(chalk.yellow('4. 批量处理器测试'));
  console.log(chalk.yellow('-'.repeat(40)));

  const batchStore = new ResultStore(testDataDir + '-batch');
  const batchProcessor = new BatchProcessor(batchStore);

  test('批量预览', () => {
    const items: LogisticsInterception[] = [validItem];
    const result = batchProcessor.preview(items);
    assertEqual(result.previewMode, true);
    assertEqual(result.totalCount, 1);
  });

  test('批量执行', () => {
    const items: LogisticsInterception[] = [validItem];
    const result = batchProcessor.execute(items, 'tester', true);
    assertEqual(result.previewMode, false);
    assert(result.batchId !== undefined);
  });

  test('结果复用 - 相同内容再次提交', () => {
    const items: LogisticsInterception[] = [validItem];
    const result1 = batchProcessor.execute(items, 'tester', true);
    const result2 = batchProcessor.execute(items, 'tester', true);
    assertEqual(result2.skippedCount, 1);
  });

  console.log();
  console.log(chalk.blue('='.repeat(60)));
  console.log(chalk.blue.bold('测试结果汇总'));
  console.log(chalk.blue('='.repeat(60)));
  console.log(`通过: ${chalk.green(passed)}`);
  console.log(`失败: ${chalk.red(failed)}`);
  console.log(`总计: ${passed + failed}`);
  
  if (failed > 0) {
    console.log();
    console.log(chalk.red.bold('❌ 存在测试失败，请检查代码！'));
    process.exit(1);
  } else {
    console.log();
    console.log(chalk.green.bold('✓ 所有测试通过！'));
  }

  await fs.remove(testDataDir);
  await fs.remove(testDataDir + '-batch');
  console.log();
}

runSelfCheck().catch(console.error);
