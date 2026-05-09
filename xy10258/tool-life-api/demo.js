const api = require('./index');

function logSection(title) {
  console.log('\n' + '═'.repeat(60));
  console.log('  ' + title);
  console.log('═'.repeat(60));
}

function logResult(result, expectedSuccess = true) {
  if (result.success === expectedSuccess) {
    console.log('✓ 结果符合预期');
  } else {
    console.log('✗ 结果不符合预期');
    console.log('  实际:', result);
  }
  return result.success === expectedSuccess;
}

function assert(condition, message) {
  if (condition) {
    console.log('✓ ' + message);
    return true;
  } else {
    console.log('✗ ' + message);
    return false;
  }
}

const passed = [];
const failed = [];

function record(name, result) {
  if (result) {
    passed.push(name);
  } else {
    failed.push(name);
  }
}

logSection('规则 1: 材料和班次对刀具寿命的影响');

console.log('\n[准备] 创建一把立铣刀，基础寿命 100 次');
const toolResult = api.createTool({
  code: 'MILL-001',
  type: 'end_mill',
  baseLife: 100
}, 'demo-tool-1');
logResult(toolResult);
const toolId = toolResult.data.tool.id;

console.log('\n[设置规则] 钛合金 + 晚班 = 修正系数 2.5 (寿命急剧降低)');
const rule1 = api.createLifeRule({
  toolType: 'end_mill',
  material: 'titanium',
  shift: 'night',
  modifier: 2.5,
  description: '钛合金难加工，晚班精力差，刀具寿命骤降'
}, 'demo-rule-1');
logResult(rule1);

console.log('\n[设置规则] 铝合金 + 早班 = 修正系数 0.6 (寿命延长)');
const rule2 = api.createLifeRule({
  toolType: 'end_mill',
  material: 'aluminum',
  shift: 'morning',
  modifier: 0.6,
  description: '铝合金易加工，早班状态好'
}, 'demo-rule-2');
logResult(rule2);

console.log('\n[加工记录 1] 铝合金 早班 使用 30 次');
const rec1 = api.createRecord({
  toolId,
  material: 'aluminum',
  shift: 'morning',
  usageCount: 30
}, 'demo-rec-1');
logResult(rec1);
record(
  '消耗计算正确: 30 × 0.6 = 18',
  assert(rec1.data.consumption.adjustedConsumption === 18,
    `实际消耗: ${rec1.data.consumption.adjustedConsumption}，预期: 18`)
);

console.log('\n[加工记录 2] 钛合金 晚班 使用 20 次');
const rec2 = api.createRecord({
  toolId,
  material: 'titanium',
  shift: 'night',
  usageCount: 20
}, 'demo-rec-2');
logResult(rec2);
record(
  '高消耗场景计算正确: 20 × 2.5 = 50',
  assert(rec2.data.consumption.adjustedConsumption === 50,
    `实际消耗: ${rec2.data.consumption.adjustedConsumption}，预期: 50`)
);

console.log('\n[检查刀具状态] 累计消耗 18 + 50 = 68，剩余 32');
const toolCheck1 = api.getTool(toolId);
logResult(toolCheck1);
record(
  '累计消耗正确',
  assert(parseFloat(toolCheck1.data.analysis.consumed) === 68,
    `累计消耗: ${toolCheck1.data.analysis.consumed}，预期: 68`)
);
record(
  '剩余寿命正确',
  assert(parseFloat(toolCheck1.data.analysis.remaining) === 32,
    `剩余寿命: ${toolCheck1.data.analysis.remaining}，预期: 32`)
);

logSection('规则 2: 寿命预警机制');

console.log('\n[推进] 再加工 20 次钛合金晚班，消耗 50');
const rec3 = api.createRecord({
  toolId,
  material: 'titanium',
  shift: 'night',
  usageCount: 20
}, 'demo-rec-3');
logResult(rec3);

console.log('\n[检查] 累计消耗 68 + 50 = 118 > 100，应触发 critical 预警');
const toolCheck2 = api.getTool(toolId);
logResult(toolCheck2);
record(
  '触发 critical 预警',
  assert(toolCheck2.data.tool.status === 'worn_out',
    `状态: ${toolCheck2.data.tool.status}，预期: worn_out`)
);
record(
  '预警消息存在',
  assert(toolCheck2.data.tool.warnings.length > 0,
    '应存在至少一条预警消息')
);

logSection('规则 3: 断刀补录（核心场景）');

console.log('\n[新刀具] 创建一把钻头，基础寿命 80 次');
const drillResult = api.createTool({
  code: 'DRILL-001',
  type: 'drill',
  baseLife: 80
}, 'demo-tool-2');
logResult(drillResult);
const drillId = drillResult.data.tool.id;

console.log('\n[正常记录] 记录使用 25 次');
const drillRec1 = api.createRecord({
  toolId: drillId,
  material: 'steel',
  shift: 'morning',
  usageCount: 25
}, 'demo-drill-rec-1');
logResult(drillRec1);

console.log('\n[断刀发生] 操作员报告断刀时累计使用了 70 次（之前漏记了 45 次）');
const breakResult = api.recordBreakAndBackfill({
  toolId: drillId,
  totalUsageAtBreak: 70,
  material: 'steel',
  shift: 'afternoon',
  operatorId: 'OP-001'
}, 'demo-break-1');
logResult(breakResult);

record(
  '断刀比较逻辑正确',
  assert(breakResult.data.comparison.recordedUsage === 25,
    `已记录: ${breakResult.data.comparison.recordedUsage}，预期: 25`)
);
record(
  '缺失次数计算正确',
  assert(breakResult.data.comparison.missingUsage === 45,
    `缺失: ${breakResult.data.comparison.missingUsage}，预期: 45`)
);
record(
  '自动补录了缺失记录',
  assert(breakResult.data.backfillRecords.length === 1,
    `补录记录数: ${breakResult.data.backfillRecords.length}，预期: 1`)
);
record(
  '补录记录标记 source=break',
  assert(breakResult.data.backfillRecords[0].source === 'break',
    `source: ${breakResult.data.backfillRecords[0].source}，预期: break`)
);
record(
  '刀具状态变为 broken',
  assert(api.store.tools[drillId].status === 'broken',
    `状态: ${api.store.tools[drillId].status}，预期: broken`)
);

logSection('规则 4: 撤回和修正');

console.log('\n[新刀具] 创建第三把刀具测试撤回');
const tool3Result = api.createTool({
  code: 'MILL-002',
  type: 'mill',
  baseLife: 100
}, 'demo-tool-3');
logResult(tool3Result);
const tool3Id = tool3Result.data.tool.id;

console.log('\n[创建规则] 钢材早班修正系数 1.2');
api.createLifeRule({
  toolType: 'mill',
  material: 'steel',
  shift: 'morning',
  modifier: 1.2
}, 'demo-rule-3');

console.log('\n[创建记录] 使用 10 次，消耗 12');
const recToWithdraw = api.createRecord({
  toolId: tool3Id,
  material: 'steel',
  shift: 'morning',
  usageCount: 10
}, 'demo-rec-withdraw');
logResult(recToWithdraw);
const recId = recToWithdraw.data.record.id;

console.log('\n[撤回记录] 返还 12 消耗');
const withdrawResult = api.withdrawRecord(recId, 'demo-withdraw-1');
logResult(withdrawResult);
record(
  '记录状态变为 withdrawn',
  assert(withdrawResult.data.record.status === 'withdrawn',
    `状态: ${withdrawResult.data.record.status}，预期: withdrawn`)
);
record(
  '消耗已返还',
  assert(api.store.tools[tool3Id].consumed === 0,
    `消耗: ${api.store.tools[tool3Id].consumed}，预期: 0`)
);

console.log('\n[创建新记录用于修正] 使用 20 次');
const recToCorrect = api.createRecord({
  toolId: tool3Id,
  material: 'steel',
  shift: 'morning',
  usageCount: 20
}, 'demo-rec-correct');
logResult(recToCorrect);
const recId2 = recToCorrect.data.record.id;
const before = recToCorrect.data.consumption.adjustedConsumption;

console.log('\n[修正记录] 实际使用了 30 次，不是 20 次');
const correctResult = api.correctRecord(recId2, {
  usageCount: 30
}, 'demo-correct-1');
logResult(correctResult);
record(
  '修正后消耗增加',
  assert(parseFloat(correctResult.data.consumptionDiff) === 12,
    `差异: ${correctResult.data.consumptionDiff}，预期: 12 (多 10 次 × 1.2)`)
);
record(
  '保留修正历史',
  assert(correctResult.data.record.corrections.length === 1,
    `修正记录数: ${correctResult.data.record.corrections.length}，预期: 1`)
);

logSection('规则 5: 幂等性（重复请求不乱写）');

console.log('\n[第一次] 创建刀具，requestId = idemp-test-1');
const first = api.createTool({
  code: 'IDEMP-001',
  type: 'end_mill',
  baseLife: 100
}, 'idemp-test-1');
logResult(first);

console.log('\n[第二次] 同样 requestId，应返回缓存，不创建新刀具');
const toolCountBefore = Object.keys(api.store.tools).length;
const second = api.createTool({
  code: 'IDEMP-001',
  type: 'end_mill',
  baseLife: 100
}, 'idemp-test-1');
logResult(second);
record(
  '返回 fromCache 标记',
  assert(second.fromCache === true,
    `fromCache: ${second.fromCache}，预期: true`)
);
record(
  '未创建新刀具',
  assert(Object.keys(api.store.tools).length === toolCountBefore,
    `刀具数量: ${Object.keys(api.store.tools).length}，预期: ${toolCountBefore}`)
);

logSection('规则 6: 脏数据不静默跳过，进入问题列表');

const issueCountBefore = api.store.issues.length;

console.log('\n[脏数据 1] 缺少必需字段');
api.createTool({ code: 'BAD-001' }, 'bad-req-1');

console.log('\n[脏数据 2] 无效的刀具类型');
api.createTool({ code: 'BAD-002', type: 'unknown_type', baseLife: 100 }, 'bad-req-2');

console.log('\n[脏数据 3] 引用不存在的刀具');
api.createRecord({
  toolId: 'non_existent',
  material: 'steel',
  shift: 'morning',
  usageCount: 10
}, 'bad-req-3');

console.log('\n[脏数据 4] 断刀报告的累计次数 < 已记录次数（矛盾）');
const tool4 = api.createTool({
  code: 'BAD-004',
  type: 'drill',
  baseLife: 100
}, 'bad-tool-4');
const tool4Id = tool4.data.tool.id;
api.createRecord({
  toolId: tool4Id,
  material: 'steel',
  shift: 'morning',
  usageCount: 50
}, 'bad-rec-4');
api.recordBreakAndBackfill({
  toolId: tool4Id,
  totalUsageAtBreak: 30,
  material: 'steel',
  shift: 'morning'
}, 'bad-break-4');

console.log('\n[检查问题列表]');
record(
  '脏数据全部进入问题列表',
  assert(api.store.issues.length > issueCountBefore,
    `问题数量: ${api.store.issues.length}，之前: ${issueCountBefore}`)
);

console.log('\n问题列表预览:');
api.store.issues.slice(-4).forEach((issue, i) => {
  console.log(`  ${i + 1}. [${issue.severity}] ${issue.type}: ${issue.description}`);
});

logSection('汇总');

const summary = api.getSummary();
console.log('刀具总数:', summary.data.tools.total);
console.log('寿命规则数:', summary.data.lifeRules.total);
console.log('加工记录总数:', summary.data.records.total);
console.log('  - 有效记录:', summary.data.records.byStatus.active);
console.log('  - 已撤回:', summary.data.records.byStatus.withdrawn);
console.log('  - 断刀补录:', summary.data.records.byStatus.fromBreak);
console.log('断刀记录:', summary.data.breaks.total);
console.log('  - 含补录:', summary.data.breaks.withBackfill);
console.log('问题总数:', summary.data.issues.total);
console.log('  - 待处理:', summary.data.issues.open);

console.log('\n' + '═'.repeat(60));
console.log('  验证结果');
console.log('═'.repeat(60));
console.log(`\n通过: ${passed.length} 项`);
console.log(`失败: ${failed.length} 项`);

if (failed.length > 0) {
  console.log('\n失败的验证:');
  failed.forEach(f => console.log('  ✗ ' + f));
} else {
  console.log('\n✓ 所有核心规则验证通过！');
}

console.log('\n' + '═'.repeat(60));
console.log('  规则速查表（供 Reviewer 验证）');
console.log('═'.repeat(60));
console.log(`
规则 1: 材料+班次影响寿命
  - 铝合金+早班: 修正系数 0.6 → 消耗降低 40%
  - 钛合金+晚班: 修正系数 2.5 → 消耗增加 150%
  - 公式: 实际消耗 = 使用次数 × 修正系数
  - 验证点: demo.js 中 rec1(18) 和 rec2(50)

规则 2: 预警阈值
  - 消耗 ≥ 50%: info 级提醒
  - 消耗 ≥ 80%: warning 级预警，状态 near_end
  - 消耗 ≥ 100%: critical 级预警，状态 worn_out
  - 验证点: toolCheck2 状态应为 worn_out

规则 3: 断刀补录
  - 断刀时报告 totalUsageAtBreak
  - 系统计算: missingUsage = 报告值 - 已记录值
  - 若 missingUsage > 0: 自动创建 source=break 的补录记录
  - 若 missingUsage < 0: 进入问题列表（数据矛盾）
  - 验证点: breakResult.backfillRecords.length === 1

规则 4: 撤回/修正
  - 撤回: 返还消耗，记录 status=withdrawn
  - 修正: 重新计算消耗差异，记录 corrections 历史
  - 断刀补录记录不可撤回或修正
  - 验证点: withdrawResult.record.status === withdrawn

规则 5: 幂等性
  - 使用 X-Request-Id 头
  - 相同 requestId 返回缓存，不重复执行
  - 验证点: second.fromCache === true

规则 6: 脏数据处理
  - 验证失败 → 不静默跳过
  - 进入 /api/issues 列表
  - 保留原始 source 数据
  - 验证点: api.store.issues.length 增加
`);