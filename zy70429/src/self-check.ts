import chalk from 'chalk';
import { CacheAnalyzer } from './cache-analyzer';
import { generateConcurrentConflictScenario, generateReservation, generateBatchReservations } from './data-generator';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => { passed: boolean; message: string }): void {
  try {
    const result = fn();
    results.push({ name, ...result });
  } catch (error) {
    results.push({
      name,
      passed: false,
      message: `异常: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

console.log(chalk.blue('=== 缓存分析器自检脚本 ===\n'));

test('空缓存统计正确', () => {
  const analyzer = new CacheAnalyzer();
  const stats = analyzer.getStats();
  const passed = stats.totalOperations === 0 && stats.hits === 0 && stats.misses === 0;
  return {
    passed,
    message: passed ? '空缓存统计正确' : `预期全0，实际: ops=${stats.totalOperations}, hits=${stats.hits}, misses=${stats.misses}`,
  };
});

test('缓存写入和读取正确', () => {
  const analyzer = new CacheAnalyzer();
  const reservation = generateReservation({ id: 'TEST-001' });
  analyzer.set('TEST-001', reservation);
  const result = analyzer.get('TEST-001');
  const passed = result?.id === 'TEST-001';
  return {
    passed,
    message: passed ? '缓存写入读取正确' : `预期ID=TEST-001，实际: ${result?.id}`,
  };
});

test('缓存命中统计正确', () => {
  const analyzer = new CacheAnalyzer();
  const reservation = generateReservation({ id: 'TEST-002' });
  analyzer.set('TEST-002', reservation);
  analyzer.get('TEST-002');
  analyzer.get('TEST-002');
  analyzer.get('NON-EXISTENT');
  
  const stats = analyzer.getStats();
  const passed = stats.hits === 2 && stats.misses === 1 && stats.totalOperations === 4;
  return {
    passed,
    message: passed 
      ? '命中统计正确 (2命中, 1未命中)' 
      : `预期 hits=2, misses=1, ops=4; 实际 hits=${stats.hits}, misses=${stats.misses}, ops=${stats.totalOperations}`,
  };
});

test('命中率计算正确', () => {
  const analyzer = new CacheAnalyzer();
  const reservation = generateReservation({ id: 'TEST-003' });
  analyzer.set('TEST-003', reservation);
  
  for (let i = 0; i < 90; i++) analyzer.get('TEST-003');
  for (let i = 0; i < 10; i++) analyzer.get('MISSING');
  
  const stats = analyzer.getStats();
  const expectedRate = 0.9;
  const passed = Math.abs(stats.hitRate - expectedRate) < 0.01;
  return {
    passed,
    message: passed 
      ? `命中率正确 (${(stats.hitRate * 100).toFixed(1)}%)` 
      : `预期 90.0%，实际 ${(stats.hitRate * 100).toFixed(1)}%`,
  };
});

test('并发覆盖场景能被检测到', () => {
  const analyzer = new CacheAnalyzer();
  const scenario = generateConcurrentConflictScenario();
  
  analyzer.set(scenario.original.id, scenario.original);
  analyzer.set(scenario.writerA.id, scenario.writerA);
  analyzer.set(scenario.writerB.id, scenario.writerB);
  
  const result = analyzer.analyze();
  const hasConflict = result.anomalies.some(a => a.type === 'concurrent_overwrite');
  const passed = hasConflict && result.stats.concurrentConflicts >= 1;
  return {
    passed,
    message: passed 
      ? `成功检测到并发覆盖 (冲突数: ${result.stats.concurrentConflicts})` 
      : `未检测到并发覆盖，异常数: ${result.anomalies.length}, 冲突数: ${result.stats.concurrentConflicts}`,
  };
});

test('并发覆盖能正确追溯变更前后值', () => {
  const analyzer = new CacheAnalyzer();
  const scenario = generateConcurrentConflictScenario();
  
  analyzer.set(scenario.original.id, scenario.original);
  analyzer.set(scenario.writerA.id, scenario.writerA);
  analyzer.set(scenario.writerB.id, scenario.writerB);
  
  const result = analyzer.analyze();
  const anomaly = result.anomalies.find(a => a.type === 'concurrent_overwrite');
  
  if (!anomaly) {
    return { passed: false, message: '未找到并发覆盖异常' };
  }
  
  const hasBefore = anomaly.beforeValue?.busRoute !== undefined;
  const hasAfter = anomaly.afterValue?.busRoute !== undefined;
  const hasAffectedFields = anomaly.affectedFields.length > 0;
  const passed = hasBefore && hasAfter && hasAffectedFields;
  
  return {
    passed,
    message: passed 
      ? `变更前后值追溯正确，影响字段: ${anomaly.affectedFields.join(', ')}` 
      : `追溯失败，before=${hasBefore}, after=${hasAfter}, fields=${hasAffectedFields}`,
  };
});

test('原始输入字段完整可追溯', () => {
  const analyzer = new CacheAnalyzer();
  const reservation = generateReservation();
  analyzer.set(reservation.id, reservation);
  
  const result = analyzer.analyze();
  const raw = result.rawData[0];
  
  const requiredFields = ['employeeId', 'employeeName', 'department', 'busRoute', 'busStop', 'date', 'timeSlot', 'status', 'createdAt', 'updatedAt', 'source', 'version'];
  const missing = requiredFields.filter(f => !(f in raw) || raw[f as keyof typeof raw] === undefined);
  const passed = missing.length === 0;
  
  return {
    passed,
    message: passed 
      ? '所有字段完整可追溯' 
      : `缺失字段: ${missing.join(', ')}`,
  };
});

test('预览功能正确显示影响范围', () => {
  const analyzer = new CacheAnalyzer();
  const scenario = generateConcurrentConflictScenario();
  analyzer.set(scenario.original.id, scenario.original);
  analyzer.set(scenario.writerA.id, scenario.writerA);
  analyzer.set(scenario.writerB.id, scenario.writerB);
  
  const result = analyzer.analyze();
  const anomaly = result.anomalies[0];
  
  if (!anomaly) {
    return { passed: false, message: '未生成异常，无法测试预览' };
  }
  
  const preview = analyzer.previewFix(anomaly);
  const passed = preview.count === 1 && preview.affectedIds.includes(anomaly.reservationId);
  
  return {
    passed,
    message: passed 
      ? `预览正确，影响 ${preview.count} 条记录` 
      : `预览错误，预期 count=1, id=${anomaly.reservationId}`,
  };
});

test('回滚计划生成正确', () => {
  const analyzer = new CacheAnalyzer();
  const reservations = generateBatchReservations(5);
  reservations.forEach(r => analyzer.set(r.id, r));
  
  const plan = analyzer.createRollbackPlan();
  const passed = plan.rollbackId.startsWith('ROLLBACK-') && 
                 plan.backupSnapshot.length === 5 && 
                 plan.createdAt.length > 0;
  
  return {
    passed,
    message: passed 
      ? `回滚计划生成正确: ${plan.rollbackId}` 
      : `回滚计划生成失败，备份数: ${plan.backupSnapshot.length}`,
  };
});

test('异常修复功能正确', () => {
  const analyzer = new CacheAnalyzer();
  const scenario = generateConcurrentConflictScenario();
  analyzer.set(scenario.original.id, scenario.original);
  analyzer.set(scenario.writerA.id, scenario.writerA);
  analyzer.set(scenario.writerB.id, scenario.writerB);
  
  const result = analyzer.analyze();
  const anomaly = result.anomalies.find(a => a.type === 'concurrent_overwrite');
  
  if (!anomaly) {
    return { passed: false, message: '未找到异常' };
  }
  
  const fixed = analyzer.applyFix(anomaly);
  const passed = fixed !== null && fixed.version > scenario.writerB.version && fixed.source === 'fixed-by-analyzer';
  
  return {
    passed,
    message: passed 
      ? `修复正确，版本号: v${fixed.version}, 来源: ${fixed.source}` 
      : `修复失败，返回: ${JSON.stringify(fixed)}`,
  };
});

test('清理缓存功能正确', () => {
  const analyzer = new CacheAnalyzer();
  const reservation = generateReservation();
  analyzer.set(reservation.id, reservation);
  analyzer.get(reservation.id);
  
  analyzer.clear();
  const stats = analyzer.getStats();
  const reservations = analyzer.getAllReservations();
  
  const passed = stats.totalOperations === 0 && reservations.length === 0;
  
  return {
    passed,
    message: passed 
      ? '缓存清理正确' 
      : `清理失败，ops=${stats.totalOperations}, reservations=${reservations.length}`,
  };
});

test('边界情况: 空数据检测', () => {
  const analyzer = new CacheAnalyzer();
  const result = analyzer.analyze();
  
  const passed = result.anomalies.length === 0 && result.reservations.length === 0;
  
  return {
    passed,
    message: passed 
      ? '空数据处理正确' 
      : `空数据处理错误，异常数: ${result.anomalies.length}, 记录数: ${result.reservations.length}`,
  };
});

test('边界情况: 缺失字段检测', () => {
  const analyzer = new CacheAnalyzer();
  const badReservation = generateReservation({ employeeId: '', employeeName: '' });
  analyzer.set(badReservation.id, badReservation);
  
  const result = analyzer.analyze();
  const missingFieldAnomaly = result.anomalies.find(a => a.type === 'missing_field');
  
  const passed = missingFieldAnomaly !== undefined;
  
  return {
    passed,
    message: passed 
      ? `缺失字段检测正确，影响字段: ${missingFieldAnomaly.affectedFields.join(', ')}` 
      : '缺失字段检测失败',
  };
});

const passed = results.filter(r => r.passed).length;
const total = results.length;

console.log(chalk.blue('\n=== 测试结果汇总 ===\n'));

results.forEach(r => {
  const status = r.passed ? chalk.green('✓ PASS') : chalk.red('✗ FAIL');
  console.log(`${status} ${r.name}`);
  if (!r.passed) {
    console.log(chalk.gray(`  ${r.message}`));
  }
});

console.log('\n' + chalk.blue('='.repeat(50)));
console.log(chalk.bold(`通过: ${passed}/${total} (${((passed/total)*100).toFixed(1)}%)`));

if (passed === total) {
  console.log(chalk.green('\n✓ 所有测试通过！边界情况均已覆盖。'));
  process.exit(0);
} else {
  console.log(chalk.red('\n✗ 部分测试失败，请检查。'));
  process.exit(1);
}
