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

console.log('\n' + '─'.repeat(60));
console.log('🧪 五、API 别名与持久化：README 入口全对齐');

test('【API1】applyManualChange 别名与 applyManualFix 行为一致', async () => {
  const wf = new ThreeStepWorkflow();
  await wf.executeStep1([
    { lineNumber: 2, mainProcess: 'P', numerator: 50, denominator: '' }
  ]);
  await wf.executeStep2([{ recordId: 'EXP-001', lineNumber: 2, sceneStatement: 'S' }]);

  const r1 = wf.applyManualChange('EXP-001', 'boundaryEvidence.rawData.denominator', '', 100, 'tester', 'reason1', 'next1');
  assert.ok(r1.valuesChanged, 'applyManualChange 应改变值');
  assert.strictEqual(r1.after.denominator, 100);
  assert.strictEqual(r1.after.displayValue, '0.5000');
});

test('【API2】rollbackManualChange 别名与 rollbackManualFix 行为一致', async () => {
  const wf = new ThreeStepWorkflow();
  await wf.executeStep1([
    { lineNumber: 2, mainProcess: 'P', numerator: 50, denominator: '' }
  ]);
  await wf.executeStep2([{ recordId: 'EXP-001', lineNumber: 2, sceneStatement: 'S' }]);

  wf.applyManualChange('EXP-001', 'boundaryEvidence.rawData.denominator', '', 100, 't', 'r');

  const r1 = wf.rollbackManualChange('EXP-001', 0, 'tester');
  assert.ok(r1.valuesRestored, 'rollbackManualChange 应恢复值');
  assert.strictEqual(r1.after.denominator, '');
  assert.strictEqual(r1.change.canRollback, false);
});

test('【API3】rollbackChange 别名同样可用', async () => {
  const wf = new ThreeStepWorkflow();
  await wf.executeStep1([
    { lineNumber: 2, mainProcess: 'P', numerator: 50, denominator: '' }
  ]);
  await wf.executeStep2([{ recordId: 'EXP-001', lineNumber: 2, sceneStatement: 'S' }]);

  wf.applyManualChange('EXP-001', 'boundaryEvidence.rawData.denominator', '', 100, 't', 'r');
  const r = wf.rollbackChange('EXP-001', 0, 't');
  assert.ok(r.valuesRestored, 'rollbackChange 别名应正常工作');
});

test('【API4】updateReviewStatus 别名与 updateReview 一致', async () => {
  const wf = new ThreeStepWorkflow();
  await wf.executeStep1([
    { lineNumber: 2, mainProcess: 'P', numerator: 50, denominator: 100 }
  ]);
  await wf.executeStep2([{ recordId: 'EXP-001', lineNumber: 2, sceneStatement: 'S' }]);

  const r = wf.updateReviewStatus('EXP-001', 'approved', 'reviewerA', 'ok', null);
  assert.strictEqual(r.record.reviewStatus, 'approved');
  assert.strictEqual(r.record.reviewTimeline.length, 1);
});

test('【持久化1】saveToFile / loadFromFile 往返数据一致', async () => {
  const fs = require('fs');
  const path = require('path');
  const tmpDir = path.join(__dirname, '..', '.test-tmp');
  const tmpFile = path.join(tmpDir, 'test-state.json');

  const wf1 = new ThreeStepWorkflow();
  await wf1.executeStep1([
    { lineNumber: 2, mainProcess: 'P1', numerator: 89, denominator: '' },
    { lineNumber: 3, mainProcess: 'P2', numerator: 50, denominator: 100 }
  ]);
  await wf1.executeStep2([
    { recordId: 'EXP-001', lineNumber: 2, sceneStatement: 'S1' },
    { recordId: 'EXP-002', lineNumber: 3, sceneStatement: 'S2' }
  ]);
  wf1.applyManualChange('EXP-001', 'boundaryEvidence.rawData.denominator', '', 200, 'tester', 'test reason', 'nextPerson');

  wf1.saveToFile(tmpFile);
  assert.ok(fs.existsSync(tmpFile), '文件应存在');

  const wf2 = new ThreeStepWorkflow();
  wf2.loadFromFile(tmpFile);

  const rec1 = wf2.store.getRecord('EXP-001');
  assert.strictEqual(rec1.boundaryEvidence.rawData.denominator, 200, '加载后分母应一致');
  assert.strictEqual(rec1.manualChanges.length, 1, '加载后变更数应一致');
  assert.strictEqual(rec1.manualChanges[0].reason, 'test reason');
  assert.strictEqual(rec1.manualChanges[0].nextHandler, 'nextPerson');
  assert.strictEqual(rec1.boundaryEvidence.originalRawData.denominator, '', '原始值应保留');

  const rec2 = wf2.store.getRecord('EXP-002');
  assert.strictEqual(rec2.boundaryEvidence.rawData.denominator, 100);

  const cv = wf2.crossValidateOutputs('EXP-001');
  assert.ok(cv.eval_consistent, '加载后四处仍应一致');

  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
});

test('【持久化2】exportAllArtifacts 生成全部工件', async () => {
  const fs = require('fs');
  const path = require('path');
  const tmpDir = path.join(__dirname, '..', '.test-artifacts');

  const wf = new ThreeStepWorkflow();
  await wf.executeStep1([
    { lineNumber: 2, mainProcess: 'P', numerator: 89, denominator: '' }
  ]);
  await wf.executeStep2([{ recordId: 'EXP-001', lineNumber: 2, sceneStatement: 'S' }]);
  wf.applyManualChange('EXP-001', 'boundaryEvidence.rawData.denominator', '', 300, 't', 'r', 'n');

  const files = wf.exportAllArtifacts(tmpDir);

  assert.ok(files.json && fs.existsSync(files.json), 'JSON 工件应存在');
  assert.ok(files.csv && fs.existsSync(files.csv), 'CSV 工件应存在');
  assert.ok(files.api && fs.existsSync(files.api), 'API 工件应存在');
  assert.ok(files.detail && fs.existsSync(files.detail), '详情工件应存在');
  assert.ok(files.report && fs.existsSync(files.report), '报告工件应存在');
  assert.ok(files.trace && fs.existsSync(files.trace), '追溯链工件应存在');

  const csv = fs.readFileSync(files.csv, 'utf-8');
  assert.ok(csv.includes('结果展示'), 'CSV 应包含结果展示列');
  assert.ok(csv.includes('0.2967'), 'CSV 应包含正确的计算结果');

  const api = JSON.parse(fs.readFileSync(files.api, 'utf-8'));
  assert.strictEqual(api.code, 0);
  assert.strictEqual(api.data.records[0].attributes.displayValue, '0.2967');

  const report = fs.readFileSync(files.report, 'utf-8');
  assert.ok(report.includes('A/B 实验提前停止判断'), '报告应包含标题');
  assert.ok(report.includes('数据已改动'), '报告应包含已改动标记');

  const trace = JSON.parse(fs.readFileSync(files.trace, 'utf-8'));
  assert.strictEqual(trace.recordId, 'EXP-001');
  assert.ok(trace.evidenceOrigin.boundary, '追溯链应包含边界证据');
  assert.ok(trace.valueChanges.length >= 1, '追溯链应包含改动记录');

  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
});

test('【导出1】CSV 内容字段完整（26列）', async () => {
  const wf = new ThreeStepWorkflow();
  await wf.executeStep1([
    { recordId: 'EXP-001', lineNumber: 2, mainProcess: '测试主流程', numerator: 89, denominator: '' }
  ]);
  await wf.executeStep2([{ recordId: 'EXP-001', lineNumber: 2, sceneStatement: '测试现场说法', weight: 'medium' }]);

  wf.applyManualChange('EXP-001', 'boundaryEvidence.rawData.denominator', '', 200, '复核人老李', '补录分母', '阿岚');
  wf.updateReview('EXP-001', 'approved', '老王', '同意改动', null);

  const csv = wf.export_ListCSV();
  const lines = csv.trim().split('\n');
  assert.strictEqual(lines.length, 2, '应包含表头 + 1行数据');

  const headers = lines[0].split(',');
  assert.ok(headers.length >= 20, 'CSV 至少应有20列');
  assert.ok(headers.includes('实验记录ID'));
  assert.ok(headers.includes('主流程（边界值说明）'));
  assert.ok(headers.includes('现场说法（评分权重表）'));
  assert.ok(headers.includes('结果展示'));
  assert.ok(headers.includes('分母'));
  assert.ok(headers.includes('分母(原始值)'));
  assert.ok(headers.includes('分母是否改动'));
  assert.ok(headers.includes('复核状态'));
  assert.ok(headers.includes('下一步处理人'));
  assert.ok(headers.includes('人工变更次数'));
});

test('【导出2】汇总报告包含需关注清单', async () => {
  const wf = new ThreeStepWorkflow();
  await wf.executeStep1([
    { recordId: 'EXP-001', lineNumber: 2, mainProcess: 'P1', numerator: 50, denominator: 100 },
    { recordId: 'EXP-002', lineNumber: 3, mainProcess: 'P2', numerator: 30, denominator: '' }
  ]);
  await wf.executeStep2([
    { recordId: 'EXP-001', lineNumber: 2, sceneStatement: 'S1' },
    { recordId: 'EXP-002', lineNumber: 3, sceneStatement: 'S2' }
  ]);

  wf.applyManualChange('EXP-002', 'boundaryEvidence.rawData.denominator', '', 200, 't', 'r', 'nextP');

  const report = wf.export_Summary('text');
  assert.ok(report.includes('统计概览'));
  assert.ok(report.includes('需关注记录'));
  assert.ok(report.includes('EXP-002'), '需关注清单应包含改动过的 EXP-002');
  assert.ok(report.includes('下一步处理人'), '报告应显示下一步处理人');
  assert.ok(report.includes('已改动'), '报告应标记已改动');
});

test('【追溯1】getFullTraceability 返回完整证据链', async () => {
  const wf = new ThreeStepWorkflow();
  await wf.executeStep1([
    { recordId: 'EXP-001', lineNumber: 5, mainProcess: '主流程A', numerator: 89, denominator: '' }
  ]);
  await wf.executeStep2([{ recordId: 'EXP-001', lineNumber: 3, sceneStatement: '阿岚确认的说法', weight: 'high' }]);

  wf.applyManualChange('EXP-001', 'boundaryEvidence.rawData.denominator', '', 300, '老李', '现场确认补录', '阿岚');
  wf.updateReview('EXP-001', 'approved', '老王', '数据正确', null);
  wf.rollbackManualChange('EXP-001', 0, '回滚测试');

  const t = wf.getFullTraceability('EXP-001');

  assert.strictEqual(t.recordId, 'EXP-001');
  assert.strictEqual(t.evidenceOrigin.boundary.lineNumber, 5, '边界证据行号应正确');
  assert.strictEqual(t.evidenceOrigin.scoring.lineNumber, 3, '评分证据行号应正确');
  assert.strictEqual(t.evidenceOrigin.boundary.originalValues.denominator, '', '原始值应正确');
  assert.strictEqual(t.evidenceOrigin.boundary.currentValues.denominator, '', '回滚后当前值应还原为空');

  assert.ok(t.valueChanges.length >= 1, '应有改动历史');
  assert.strictEqual(t.valueChanges[0].operator, '老李');
  assert.strictEqual(t.valueChanges[0].reason, '现场确认补录');
  assert.strictEqual(t.valueChanges[0].nextHandler, '阿岚');
  assert.strictEqual(t.valueChanges[0].canRollback, false, '回滚后 canRollback 应为 false');
  assert.ok(t.valueChanges[0].rolledBackAt, '应有 rolledBackAt 时间戳');

  assert.ok(t.reviewHistory.length >= 1, '应有复核历史');
  assert.ok(t.auditTrail.length >= 3, '应有多条审计日志');
  assert.ok(t.summary.totalChanges >= 1, '汇总应有总改动数');
});

console.log('\n' + '═'.repeat(60));
console.log(`测试结果: 通过 ${passed} / ${passed + failed}`);
if (failed > 0) { console.log(`❌ 有 ${failed} 个失败`); process.exit(1); }
else console.log('✅ 全部通过！改动同步、回滚恢复、四处输出一致、API别名、持久化均已验证。');
console.log('═'.repeat(60));
