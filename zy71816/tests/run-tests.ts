import { InMemoryStore, JudgmentEngine, RefundAuditService, ExplanationGenerator } from '../src/index.js';
import type { ReceiptLine, RefundItem } from '../src/index.js';

function makeReceipt(overrides: Partial<ReceiptLine> = {}): ReceiptLine {
  return {
    id: 'rcpt_001',
    platform: 'Stripe',
    orderId: 'ORD-1001',
    amount: 1000,
    currency: 'USD',
    receivedAt: '2025-03-15T10:00:00Z',
    feeAmount: 30,
    feePeriod: '2025-03',
    netAmount: 970,
    status: 'pending',
    ...overrides,
  };
}

function makeRefundItem(overrides: Partial<RefundItem> = {}): RefundItem {
  return {
    id: 'rfnd_001',
    receiptId: 'rcpt_001',
    refundAmount: 100,
    currency: 'USD',
    reason: '客户退货',
    status: 'pending',
    ...overrides,
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`断言失败: ${msg}`);
  }
}

function assertContains(haystack: string, needle: string) {
  if (!haystack.includes(needle)) {
    throw new Error(`断言失败: 期望 "${haystack.slice(0, 100)}" 包含 "${needle}"`);
  }
}

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
    failed++;
  }
}

console.log('\n=== JudgmentEngine 测试 ===\n');

test('自动确认通过的收款流水，判断理由要留存', () => {
  const store = new InMemoryStore();
  const engine = new JudgmentEngine(store, { crossPeriodContactPerson: '财务部-李明' });
  const receipt = makeReceipt();
  const batch = engine.processBatch([receipt]);

  assert(batch.results.length === 1, '应有1个结果');
  const result = batch.results[0];
  assert(result.judgment === 'auto_confirmed', `判断应为auto_confirmed，实际为${result.judgment}`);
  assert(result.reasons.length > 0, '应有判断理由');
  assert(result.reasons[0].code === 'ALL_CHECKS_PASSED', `理由code应为ALL_CHECKS_PASSED`);
  assert(result.nextSteps.includes('可进入下一步对账流程'), '下一步应包含对账流程');
});

test('跨期手续费：不吞掉，要说出来源和联系人', () => {
  const store = new InMemoryStore();
  const engine = new JudgmentEngine(store, {
    crossPeriodContactPerson: '财务部-李明',
    platformContactMap: { Stripe: '运营部-王芳' },
  });
  const receipt = makeReceipt({ feePeriod: '2025-02', feeAmount: 30 });
  const batch = engine.processBatch([receipt]);

  assert(batch.results[0].judgment === 'cross_period_fee', '应为跨期手续费');
  assert(batch.results[0].reasons.some(r => r.code === 'CROSS_PERIOD_FEE'), '应有CROSS_PERIOD_FEE理由');

  const alerts = store.getCrossPeriodAlerts(receipt.id);
  assert(alerts.length > 0, '应有跨期手续费告警');
  assert(alerts[0].feeSource === 'receipt_line', '来源应为receipt_line');
  assert(alerts[0].contactPerson === '运营部-王芳', '联系人应为运营部-王芳');
  assert(alerts[0].explanation.includes('跨期手续费'), '说明应包含跨期手续费');
  assert(alerts[0].nextAction.includes('运营部-王芳'), '下一步应包含联系人');
  assert(alerts[0].sourceDetail.includes('feeAmount'), '来源详情应包含feeAmount');
});

test('同一批材料第二次跑，不把历史洗成新成功记录', () => {
  const store = new InMemoryStore();
  const engine = new JudgmentEngine(store, { crossPeriodContactPerson: '财务部-李明' });
  const receipt = makeReceipt();

  const batch1 = engine.processBatch([receipt]);
  assert(batch1.results.length === 1, '第一次应有1个结果');
  assert(batch1.results[0].judgment === 'auto_confirmed', '第一次应为auto_confirmed');

  const batch2 = engine.processBatch([receipt]);
  assert(batch2.results.length === 0, '第二次不应有新结果');

  const history = store.getHistory(receipt.id);
  assert(history.length === 2, '应有2条历史记录');
  assert(history[0].skipped === false, '第一次不应跳过');
  assert(history[1].skipped === true, '第二次应跳过');
  assert(history[1].skipReason!.includes('已在批次'), '跳过原因应包含已在批次');
  assert(history[1].skipReason!.includes('不重复生成新记录'), '跳过原因应包含不重复生成新记录');
});

test('争议流水判定为 needs_review', () => {
  const store = new InMemoryStore();
  const engine = new JudgmentEngine(store, { crossPeriodContactPerson: '财务部-李明' });
  const receipt = makeReceipt({ status: 'disputed' });
  const batch = engine.processBatch([receipt]);

  assert(batch.results[0].judgment === 'needs_review', '应为needs_review');
  assert(batch.results[0].reasons.some(r => r.code === 'DISPUTED_STATUS'), '应有DISPUTED_STATUS理由');
});

test('重复订单判定为 duplicate', () => {
  const store = new InMemoryStore();
  const engine = new JudgmentEngine(store, { crossPeriodContactPerson: '财务部-李明' });
  const r1 = makeReceipt({ id: 'rcpt_001', orderId: 'ORD-1001' });
  const r2 = makeReceipt({ id: 'rcpt_002', orderId: 'ORD-1001' });

  engine.processBatch([r1]);
  const batch2 = engine.processBatch([r2]);

  assert(batch2.results[0].judgment === 'duplicate', '应为duplicate');
  assert(batch2.results[0].reasons[0].code === 'DUPLICATE_ORDER', '应为DUPLICATE_ORDER');
});

test('金额异常判定为 needs_review', () => {
  const store = new InMemoryStore();
  const engine = new JudgmentEngine(store, { crossPeriodContactPerson: '财务部-李明' });
  const receipt = makeReceipt({ amount: 0 });
  const batch = engine.processBatch([receipt]);

  assert(batch.results[0].judgment === 'needs_review', '应为needs_review');
  assert(batch.results[0].reasons.some(r => r.code === 'INVALID_AMOUNT'), '应有INVALID_AMOUNT理由');
});

test('多次处理历史完整保留', () => {
  const store = new InMemoryStore();
  const engine = new JudgmentEngine(store, { crossPeriodContactPerson: '财务部-李明' });
  const receipt = makeReceipt();
  engine.processBatch([receipt]);
  engine.processBatch([receipt]);
  engine.processBatch([receipt]);

  const history = store.getHistory(receipt.id);
  assert(history.length === 3, '应有3条历史');
  assert(history.filter(h => h.skipped).length === 2, '应有2条跳过');
  assert(history.filter(h => !h.skipped).length === 1, '应有1条处理');
});

console.log('\n=== RefundAuditService 测试 ===\n');

test('手动改退款金额，前后变化留在历史里', () => {
  const store = new InMemoryStore();
  const auditService = new RefundAuditService(store);
  const receipt = makeReceipt();
  const refund = makeRefundItem();
  store.saveReceipt(receipt);
  store.saveRefundItem(refund);

  const change = auditService.modifyRefundItem(refund.id, '张会计', 'refundAmount', 150, '客户追加了退货商品');

  assert(change.oldValue === 100, `旧值应为100，实际为${change.oldValue}`);
  assert(change.newValue === 150, `新值应为150，实际为${change.newValue}`);
  assert(change.changedBy === '张会计', '操作人应为张会计');
  assert(change.reason === '客户追加了退货商品', '原因应正确');

  const history = auditService.getRefundChangeHistory(refund.id);
  assert(history.length === 1, '应有1条变更记录');
  assert(history[0].field === 'refundAmount', '变更字段应为refundAmount');
});

test('对账说明和明细不各说各话，变更自动同步', () => {
  const store = new InMemoryStore();
  const auditService = new RefundAuditService(store);
  const receipt = makeReceipt();
  const refund = makeRefundItem({ status: 'approved' });
  store.saveReceipt(receipt);
  store.saveRefundItem(refund);

  auditService.modifyRefundItem(refund.id, '张会计', 'refundAmount', 200, '实际退款金额调整');

  const stmt = auditService.getReconciliationForReceipt(receipt.id);
  assert(stmt !== undefined, '对账说明应存在');
  assert(stmt!.notes.includes('张会计'), '对账说明应包含操作人');
  assert(stmt!.notes.includes('refundAmount'), '对账说明应包含变更字段');
  assert(stmt!.notes.includes('200'), '对账说明应包含新值');
  assert(stmt!.changeRecords.length > 0, '变更记录不为空');
});

test('多次变更都留在历史里', () => {
  const store = new InMemoryStore();
  const auditService = new RefundAuditService(store);
  const receipt = makeReceipt();
  const refund = makeRefundItem({ status: 'approved' });
  store.saveReceipt(receipt);
  store.saveRefundItem(refund);

  auditService.modifyRefundItem(refund.id, '张会计', 'refundAmount', 150, '第一次调整');
  auditService.modifyRefundItem(refund.id, '李会计', 'reason', '客户部分退货', '第二次调整');

  const history = auditService.getRefundChangeHistory(refund.id);
  assert(history.length === 2, '应有2条变更记录');
  assert(history[0].changedBy === '张会计', '第一条应为张会计');
  assert(history[1].changedBy === '李会计', '第二条应为李会计');
});

console.log('\n=== ExplanationGenerator 测试 ===\n');

test('判断结果格式化为非技术人员可读文本', () => {
  const store = new InMemoryStore();
  const engine = new JudgmentEngine(store, { crossPeriodContactPerson: '财务部-李明' });
  const receipt = makeReceipt({ feePeriod: '2025-02' });
  const batch = engine.processBatch([receipt]);
  const output = ExplanationGenerator.formatJudgment(batch.results[0]);

  assertContains(output, '收款流水判断结果');
  assertContains(output, '判断理由');
  assertContains(output, '下一步操作');
  assertContains(output, 'CROSS_PERIOD_FEE');
});

test('跨期手续费说明包含来源和联系人', () => {
  const store = new InMemoryStore();
  const engine = new JudgmentEngine(store, {
    crossPeriodContactPerson: '财务部-李明',
    platformContactMap: { Stripe: '运营部-王芳' },
  });
  const receipt = makeReceipt({ feePeriod: '2025-02' });
  engine.processBatch([receipt]);

  const alerts = store.getCrossPeriodAlerts(receipt.id);
  const output = ExplanationGenerator.formatCrossPeriodAlert(alerts[0]);

  assertContains(output, '跨期手续费提醒');
  assertContains(output, '手续费来源');
  assertContains(output, '运营部-王芳');
  assertContains(output, '下一步操作');
});

test('历史记录格式化显示跳过原因', () => {
  const store = new InMemoryStore();
  const engine = new JudgmentEngine(store, { crossPeriodContactPerson: '财务部-李明' });
  const receipt = makeReceipt();
  engine.processBatch([receipt]);
  engine.processBatch([receipt]);

  const history = store.getHistory(receipt.id);
  const output = ExplanationGenerator.formatHistoryEntries(history);

  assertContains(output, '跳过');
  assertContains(output, '不重复生成新记录');
});

test('对账说明格式化包含退款变更明细', () => {
  const store = new InMemoryStore();
  const receipt = makeReceipt();
  const refund = makeRefundItem({ status: 'approved' });
  store.saveReceipt(receipt);
  store.saveRefundItem(refund);

  const auditService = new RefundAuditService(store);
  auditService.modifyRefundItem(refund.id, '张会计', 'refundAmount', 200, '金额调整');

  const stmt = store.getReconciliation(receipt.id, '2025-03');
  const output = ExplanationGenerator.formatReconciliation(stmt!);

  assertContains(output, '退款变更记录');
  assertContains(output, '张会计');
  assertContains(output, 'refundAmount');
});

console.log(`\n═══════════════════════════════════════`);
console.log(`测试结果: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 项`);
console.log(`═══════════════════════════════════════\n`);

if (failed > 0) {
  process.exit(1);
}
