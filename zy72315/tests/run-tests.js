const assert = require('assert');
const {
  UnifiedEvidenceStore,
  BoundaryRuleEngine,
  ThreeStepWorkflow,
  UnifiedResultExporter
} = require('../src');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║              A/B 实验提前停止判断 - 测试套件                  ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅  ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌  ${name}`);
    console.log(`   错误: ${e.message}`);
    failed++;
  }
}

console.log('─' .repeat(60));
console.log('🧪 测试 1: 边界规则引擎 - 分母为空字符串');
test('分母为空字符串应标记需复核', () => {
  const engine = new BoundaryRuleEngine();
  const record = { boundaryEvidence: { rawData: { numerator: 50, denominator: '' } } };
  const result = engine.evaluate(record);
  assert.strictEqual(result.ruleId, 'DENOMINATOR_EMPTY_STRING');
  assert.strictEqual(result.reviewRequired, true);
  assert.strictEqual(result.displayValue, '[需复核 - 分母为空]');
});

console.log('\n🧪 测试 2: 边界规则引擎 - 分母为 0');
test('分母为 0 应标记需复核', () => {
  const engine = new BoundaryRuleEngine();
  const record = { boundaryEvidence: { rawData: { numerator: 50, denominator: 0 } } };
  const result = engine.evaluate(record);
  assert.strictEqual(result.ruleId, 'DENOMINATOR_ZERO');
  assert.strictEqual(result.reviewRequired, true);
});

console.log('\n🧪 测试 3: 边界规则引擎 - 正常数据');
test('正常数据应自动计算', () => {
  const engine = new BoundaryRuleEngine();
  const record = { boundaryEvidence: { rawData: { numerator: 50, denominator: 100 } } };
  const result = engine.evaluate(record);
  assert.strictEqual(result.ruleId, 'NORMAL');
  assert.strictEqual(result.displayValue, '0.5000');
});

console.log('\n🧪 测试 4: 统一证据存储 - 添加边界记录');
test('添加边界记录应保留原始行号', () => {
  const store = new UnifiedEvidenceStore();
  store.addBoundaryRecord('TEST-001', {
    lineNumber: 5,
    operator: 'test_user',
    rawData: { mainProcess: '测试流程', numerator: 10, denominator: 50 }
  });
  const record = store.getRecord('TEST-001');
  assert.strictEqual(record.boundaryEvidence.originalLineNumber, 5);
  assert.strictEqual(record.currentStatus, 'boundary_imported');
});

console.log('\n🧪 测试 5: 统一证据存储 - 人工改动追踪');
test('人工改动应记录并可回滚', () => {
  const store = new UnifiedEvidenceStore();
  store.addBoundaryRecord('TEST-002', {
    lineNumber: 6,
    operator: 'test_user',
    rawData: { numerator: 10, denominator: '' }
  });
  store.applyManualChange('TEST-002', 'denominator', '', 0, 'tester', '测试修改');
  const record = store.getRecord('TEST-002');
  assert.strictEqual(record.manualChanges.length, 1);
  assert.strictEqual(record.manualChanges[0].canRollback, true);
  
  const rolledBack = store.rollbackChange('TEST-002', 0);
  assert.strictEqual(rolledBack.canRollback, false);
});

console.log('\n🧪 测试 6: 三步工作流 - 流程顺序验证');
test('未完成步骤1不能执行步骤2', async () => {
  const workflow = new ThreeStepWorkflow();
  try {
    await workflow.executeStep2([{ recordId: 'A', sceneStatement: 'test' }]);
    assert.fail('应该抛出错误');
  } catch (e) {
    assert.ok(e.message.includes('请先完成步骤1'));
  }
});

console.log('\n🧪 测试 7: 三步工作流 - 步骤1导入边界数据');
test('步骤1应导入边界数据并标记需复核', async () => {
  const workflow = new ThreeStepWorkflow();
  const result = await workflow.executeStep1([
    { lineNumber: 2, mainProcess: '流程A', numerator: 50, denominator: 100 },
    { lineNumber: 3, mainProcess: '流程B', numerator: 30, denominator: '' }
  ]);
  assert.strictEqual(result.recordCount, 2);
  assert.strictEqual(result.needsReviewCount, 1);
});

console.log('\n🧪 测试 8: 统一结果输出 - 三处一致');
test('导出、页面、API应使用同一份数据源', () => {
  const workflow = new ThreeStepWorkflow();
  const store = new UnifiedEvidenceStore();
  store.addBoundaryRecord('EXP-001', {
    lineNumber: 2,
    rawData: { mainProcess: '流程A', numerator: 50, denominator: '' }
  });
  store.addScoringRecord('EXP-001', {
    lineNumber: 2,
    rawData: { sceneStatement: '高权重' }
  });
  
  const exporter = new UnifiedResultExporter();
  const records = store.exportUnifiedResults();
  
  const csvData = exporter.formatForCSV(records);
  const pageData = exporter.formatForPageDisplay(records);
  const apiData = exporter.formatForAPI(records);
  
  const csvDenominator = csvData.rows[0].denominator;
  const pageDenominator = pageData.data[0].denominator;
  const apiDenominator = apiData.data.records[0].attributes.denominator;
  
  assert.strictEqual(csvDenominator, pageDenominator);
  assert.strictEqual(pageDenominator, apiDenominator);
  
  const csvDisplay = csvData.rows[0].displayValue;
  const pageDisplay = pageData.data[0].displayValue;
  const apiDisplay = apiData.data.records[0].attributes.displayValue;
  
  assert.strictEqual(csvDisplay, pageDisplay);
  assert.strictEqual(pageDisplay, apiDisplay);
});

console.log('\n🧪 测试 9: 边界规则 - 不会消失的空分母记录');
test('分母为空的记录不会在导出时消失', () => {
  const store = new UnifiedEvidenceStore();
  store.addBoundaryRecord('EXP-001', {
    lineNumber: 2,
    rawData: { mainProcess: '测试', numerator: 50, denominator: '' }
  });
  
  const exporter = new UnifiedResultExporter();
  const records = store.exportUnifiedResults();
  const csvContent = exporter.exportCSVContent(records);
  
  assert.ok(csvContent.includes('[需复核 - 分母为空]'));
  assert.strictEqual(records.length, 1);
});

console.log('\n🧪 测试 10: 审计日志 - 完整追踪操作历史');
test('所有操作都应记录审计日志', () => {
  const store = new UnifiedEvidenceStore();
  store.addBoundaryRecord('EXP-001', {
    lineNumber: 2,
    operator: 'user_a',
    rawData: {}
  });
  store.addScoringRecord('EXP-001', {
    lineNumber: 2,
    operator: 'user_b',
    rawData: {}
  });
  store.applyManualChange('EXP-001', 'field', 'old', 'new', 'user_c', 'test');
  store.updateReviewStatus('EXP-001', 'approved', 'user_d', 'ok');
  
  const record = store.getRecord('EXP-001');
  assert.strictEqual(record.auditTrail.length, 4);
  assert.ok(record.auditTrail.some(a => a.action === 'boundary_imported'));
  assert.ok(record.auditTrail.some(a => a.action === 'scoring_imported'));
  assert.ok(record.auditTrail.some(a => a.action === 'manual_change'));
  assert.ok(record.auditTrail.some(a => a.action === 'review'));
});

console.log('\n' + '═' .repeat(60));
console.log(`测试结果: 通过 ${passed} / ${passed + failed}`);
if (failed > 0) {
  console.log(`❌ 有 ${failed} 个测试失败`);
  process.exit(1);
} else {
  console.log('✅ 所有测试通过！');
}
console.log('═' .repeat(60));
