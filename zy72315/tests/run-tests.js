const assert = require('assert');
const {
  UnifiedEvidenceStore,
  BoundaryRuleEngine,
  ThreeStepWorkflow,
  UnifiedResultExporter
} = require('../src');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║        A/B 实验提前停止判断 - 修复后完整测试套件              ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`✅  ${name}`); passed++; }
  catch (e) { console.log(`❌  ${name}\n   错误: ${e.message}`); failed++; }
}

const store = () => {
  const s = new UnifiedEvidenceStore();
  s.addBoundaryRecord('EXP-001', { lineNumber: 2, operator: 't', rawData: { numerator: 50, denominator: 100, mainProcess: 'A' } });
  s.addBoundaryRecord('EXP-002', { lineNumber: 3, operator: 't', rawData: { numerator: 89, denominator: '', mainProcess: 'B' } });
  s.addScoringRecord('EXP-001', { lineNumber: 2, operator: 't', rawData: { sceneStatement: 'S1', weight: 0.3 } });
  s.addScoringRecord('EXP-002', { lineNumber: 3, operator: 't', rawData: { sceneStatement: 'S2', weight: 0.2 } });
  return s;
};
const exporter = new UnifiedResultExporter();
const engine = new BoundaryRuleEngine();

console.log('─'.repeat(60));
console.log('🧪 一、数据层修复：改动真正写入，回滚真正恢复');

test('【修复1】applyManualChange 真正修改 rawData 字段', () => {
  const s = store();
  s.applyManualChange('EXP-002', 'boundaryEvidence.rawData.denominator', '', 300, '老李', '测试原因');
  const rec = s.getRecord('EXP-002');
  assert.strictEqual(rec.boundaryEvidence.rawData.denominator, 300, '改动后 rawData.denominator 应等于 300');
});

test('【修复2】改动后 规则引擎评估结果同步变化', () => {
  const s = store();
  const rec_before = s.getRecord('EXP-002');
  const eval_before = engine.evaluate(rec_before);
  assert.strictEqual(eval_before.ruleId, 'DENOMINATOR_EMPTY_STRING');

  s.applyManualChange('EXP-002', 'boundaryEvidence.rawData.denominator', '', 300, '老李', '测试');
  const rec_after = s.getRecord('EXP-002');
  const eval_after = engine.evaluate(rec_after);
  assert.strictEqual(eval_after.ruleId, 'NORMAL', '分母改为300后，规则应切换为NORMAL');
  assert.strictEqual(eval_after.displayValue, (89 / 300).toFixed(4));
});

test('【修复3】原始值 originalRawData 永不丢失', () => {
  const s = store();
  s.applyManualChange('EXP-002', 'boundaryEvidence.rawData.denominator', '', 300, '老李', 'x');
  const rec = s.getRecord('EXP-002');
  assert.strictEqual(rec.boundaryEvidence.originalRawData.denominator, '', '原始值应保持空字符串');
  assert.strictEqual(rec.boundaryEvidence.rawData.denominator, 300, '当前值为改动后的300');
});

test('【修复4】rollbackChange 真正恢复字段值', () => {
  const s = store();
  const { changeIndex } = s.applyManualChange('EXP-002', 'boundaryEvidence.rawData.denominator', '', 300, '老李', 'x');
  s.rollbackChange('EXP-002', changeIndex);
  const rec = s.getRecord('EXP-002');
  assert.strictEqual(rec.boundaryEvidence.rawData.denominator, '', '回滚后分母应恢复为空字符串');
});

test('【修复5】回滚后 规则评估也恢复为原始状态', () => {
  const s = store();
  const { changeIndex } = s.applyManualChange('EXP-002', 'boundaryEvidence.rawData.denominator', '', 300, '老李', 'x');
  s.rollbackChange('EXP-002', changeIndex);
  const rec = s.getRecord('EXP-002');
  const ev = engine.evaluate(rec);
  assert.strictEqual(ev.ruleId, 'DENOMINATOR_EMPTY_STRING');
});

test('【修复6】nextHandler 和 reviewTimeline 完整追踪', () => {
  const s = store();
  s.applyManualChange('EXP-002', 'boundaryEvidence.rawData.denominator', '', 300, '老李', '原因', '阿岚');
  let rec = s.getRecord('EXP-002');
  assert.strictEqual(rec.nextHandler, '阿岚');
  assert.strictEqual(rec.currentStatus, 'pending_handler_review');

  s.updateReviewStatus('EXP-002', 'approved', '老李', 'ok', '阿岚同步');
  rec = s.getRecord('EXP-002');
  assert.strictEqual(rec.reviewTimeline.length, 1);
  assert.strictEqual(rec.reviewTimeline[0].nextHandler, '阿岚同步');
  assert.strictEqual(rec.reviewTimeline[0].dataSnapshot.boundaryRawData.denominator, 300);
});

test('【修复7】getFullTraceability 完整追溯链', () => {
  const s = store();
  s.applyManualChange('EXP-002', 'boundaryEvidence.rawData.denominator', '', 300, '老李', '漏填', '阿岚');
  const t = s.getFullTraceability('EXP-002');
  assert.strictEqual(t.evidenceOrigin.boundary.lineNumber, 3);
  assert.strictEqual(t.evidenceOrigin.boundary.originalValues.denominator, '');
  assert.strictEqual(t.evidenceOrigin.boundary.currentValues.denominator, 300);
  assert.strictEqual(t.valueChanges[0].operator, '老李');
  assert.strictEqual(t.valueChanges[0].nextHandler, '阿岚');
});

console.log('\n' + '─'.repeat(60));
console.log('🧪 二、输出一致性：列表/详情/CSV/API/报告 读取同一份最新数据');

const s1 = store();
s1.applyManualChange('EXP-002', 'boundaryEvidence.rawData.denominator', '', 300, '老李', '测试改动');
const exported = s1.exportUnifiedResults();
const rec_wrap = exported[1]; // EXP-002
const csv = exporter.formatForCSV(exported).rows[1];
const page = exporter.formatForPageList(exported).data[1];
const api = exporter.formatForAPI(exported).data.records[1].attributes;
const detail = exporter.formatForPageDetail(rec_wrap);

test('【一致1】CSV 读到改动后的值（不是原始值）', () => {
  assert.strictEqual(csv.denominator, 300, `CSV 分母应为300，实际${csv.denominator}`);
  assert.strictEqual(csv.denominator_original, '', 'CSV原始分母应为空');
  assert.strictEqual(csv.denominator_changed, true, 'CSV应标记分母已改动');
});

test('【一致2】页面列表 读到改动后的值', () => {
  assert.strictEqual(page.denominator, 300, `页面前端分母应为300，实际${page.denominator}`);
  assert.strictEqual(page.denominator_original, '');
  assert.strictEqual(page.denominator_changed, true);
  assert.strictEqual(page.display.showChangeBadge, true, '页面应显示改动徽章');
});

test('【一致3】API 返回 读到改动后的值', () => {
  assert.strictEqual(api.denominator, 300, `API分母应为300，实际${api.denominator}`);
  assert.strictEqual(api.denominator_changed, true);
});

test('【一致4】displayValue 三处完全相同（基于改动后分母计算）', () => {
  const expected = (89 / 300).toFixed(4);
  assert.strictEqual(csv.displayValue, expected, `CSV displayValue=${csv.displayValue}, 期望${expected}`);
  assert.strictEqual(page.displayValue, expected, `页面displayValue=${page.displayValue}, 期望${expected}`);
  assert.strictEqual(api.displayValue, expected, `API displayValue=${api.displayValue}, 期望${expected}`);
});

test('【一致5】详情页 追溯面板 含原始/当前值对比', () => {
  const diff = detail.traceability.valueDiff.find(d => d.field === 'denominator');
  assert.ok(diff, '应有分母差异记录');
  assert.strictEqual(diff.original, '', `diff原始应为空，实际${diff.original}`);
  assert.strictEqual(diff.current, 300, `diff当前应为300，实际${diff.current}`);
});

test('【一致6】统计报告 识别为已改动记录 纳入需关注', () => {
  const report = exporter.formatForSummaryReport(exported);
  const target = report.records.find(r => r.id === 'EXP-002');
  assert.strictEqual(target.wasModified, true);
  assert.strictEqual(target.originalDenominator, '');
  assert.strictEqual(target.currentDenominator, 300);
  assert.ok(report.attentionItems.some(i => i.id === 'EXP-002'));
});

console.log('\n' + '─'.repeat(60));
console.log('🧪 三、回滚后输出一致性（恢复原始值，各处同步）');

const s2 = store();
const { changeIndex } = s2.applyManualChange('EXP-002', 'boundaryEvidence.rawData.denominator', '', 300, '老李', 'x');
s2.rollbackChange('EXP-002', changeIndex, '操作人');
const exported2 = s2.exportUnifiedResults();
const csv2 = exporter.formatForCSV(exported2).rows[1];
const page2 = exporter.formatForPageList(exported2).data[1];
const api2 = exporter.formatForAPI(exported2).data.records[1].attributes;

test('【回滚一致1】回滚后分母恢复为空（所有输出）', () => {
  assert.strictEqual(csv2.denominator, '', `CSV分母应为空，实际${typeof csv2.denominator}:${JSON.stringify(csv2.denominator)}`);
  assert.strictEqual(page2.denominator, '', `页面前端分母应为空，实际${JSON.stringify(page2.denominator)}`);
  assert.strictEqual(api2.denominator, '', `API分母应为空，实际${JSON.stringify(api2.denominator)}`);
});

test('【回滚一致2】回滚后 displayValue 恢复为需复核提示', () => {
  assert.strictEqual(csv2.displayValue, '[需复核 - 分母为空]', `CSV: ${csv2.displayValue}`);
  assert.strictEqual(page2.displayValue, '[需复核 - 分母为空]', `页面: ${page2.displayValue}`);
  assert.strictEqual(api2.displayValue, '[需复核 - 分母为空]', `API: ${api2.displayValue}`);
});

test('【回滚一致3】回滚后 统计报告重新计入需复核', () => {
  const stats = exporter._calculateStatistics(exported2);
  assert.strictEqual(stats.needsReview >= 1, true, '需复核数量应>=1');
});

console.log('\n' + '─'.repeat(60));
console.log('🧪 四、ThreeStepWorkflow 完整链路集成测试');

test('【集成1】改动→验证四处一致→回滚→再次验证一致', async () => {
  const wf = new ThreeStepWorkflow();
  await wf.executeStep1([
    { lineNumber: 2, mainProcess: 'P1', numerator: 89, denominator: '' }
  ]);
  await wf.executeStep2([
    { recordId: 'EXP-001', lineNumber: 2, sceneStatement: 'S1', weight: 0.3 }
  ]);

  const fixR = wf.applyManualFix('EXP-001', {
    field: 'boundaryEvidence.rawData.denominator',
    oldValue: '', newValue: 300, reason: '测试', nextHandler: '阿岚'
  }, '老李');
  assert.ok(fixR.valuesChanged, '应检测到结果值变化');
  assert.strictEqual(fixR.after.denominator, 300);

  const v1 = wf.crossValidateOutputs('EXP-001');
  assert.ok(v1.eval_consistent, `改动后四处应一致，实际${JSON.stringify(v1.checkValues)}`);

  const rb = wf.rollbackManualFix('EXP-001', 0);
  assert.ok(rb.valuesRestored, '回滚后值应恢复');
  assert.strictEqual(rb.after.denominator, '');

  const v2 = wf.crossValidateOutputs('EXP-001');
  assert.ok(v2.eval_consistent, `回滚后四处应一致，实际${JSON.stringify(v2.checkValues)}`);
});

test('【集成2】分母为0 路径同样：改动同步+回滚恢复', async () => {
  const wf = new ThreeStepWorkflow();
  await wf.executeStep1([
    { lineNumber: 2, mainProcess: 'P', numerator: 50, denominator: 0 }
  ]);
  await wf.executeStep2([{ recordId: 'EXP-001', lineNumber: 2, sceneStatement: 'S' }]);

  wf.applyManualFix('EXP-001', {
    field: 'boundaryEvidence.rawData.denominator',
    oldValue: 0, newValue: 200, reason: '修正'
  }, '复核人');

  const v = wf.crossValidateOutputs('EXP-001');
  assert.ok(v.eval_consistent, `分母为0→200 后四处一致: ${JSON.stringify(v.checkValues)}`);
  assert.strictEqual(v.checkValues.csv, (50 / 200).toFixed(4));

  wf.rollbackManualFix('EXP-001', 0);
  const v2 = wf.crossValidateOutputs('EXP-001');
  assert.ok(v2.eval_consistent);
  assert.strictEqual(v2.checkValues.csv, '[需复核 - 分母为0]');
});

console.log('\n' + '═'.repeat(60));
console.log(`测试结果: 通过 ${passed} / ${passed + failed}`);
if (failed > 0) { console.log(`❌ 有 ${failed} 个失败`); process.exit(1); }
else console.log('✅ 全部通过！改动同步、回滚恢复、四处输出一致均已验证。');
console.log('═'.repeat(60));
