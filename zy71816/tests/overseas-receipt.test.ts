import { describe, it, expect, beforeEach } from 'vitest';
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
    createdAt: '2025-03-16T10:00:00Z',
    ...overrides,
  };
}

describe('JudgmentEngine', () => {
  let store: InMemoryStore;
  let engine: JudgmentEngine;

  beforeEach(() => {
    store = new InMemoryStore();
    engine = new JudgmentEngine(store, {
      crossPeriodContactPerson: '财务部-李明',
      platformContactMap: {
        Stripe: '运营部-王芳',
      },
    });
  });

  it('自动确认通过的收款流水，判断理由要留存', () => {
    const receipt = makeReceipt();
    const batch = engine.processBatch([receipt]);

    expect(batch.results).toHaveLength(1);
    const result = batch.results[0];
    expect(result.judgment).toBe('auto_confirmed');
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons[0].code).toBe('ALL_CHECKS_PASSED');
    expect(result.reasons[0].message).toBeTruthy();
    expect(result.reasons[0].source).toBe('rule_engine');
    expect(result.nextSteps).toContain('可进入下一步对账流程');
  });

  it('跨期手续费：不吞掉，要说出来源和联系人', () => {
    const receipt = makeReceipt({
      feePeriod: '2025-02',
      feeAmount: 30,
    });
    const batch = engine.processBatch([receipt]);

    expect(batch.results[0].judgment).toBe('cross_period_fee');
    expect(batch.results[0].reasons.some(r => r.code === 'CROSS_PERIOD_FEE')).toBe(true);

    const alerts = store.getCrossPeriodAlerts(receipt.id);
    expect(alerts.length).toBeGreaterThan(0);
    const alert = alerts[0];
    expect(alert.feeSource).toBe('receipt_line');
    expect(alert.contactPerson).toBe('运营部-王芳');
    expect(alert.explanation).toContain('跨期手续费');
    expect(alert.nextAction).toContain('运营部-王芳');
    expect(alert.sourceDetail).toContain('feeAmount');
  });

  it('同一批材料第二次跑，不把历史洗成新成功记录', () => {
    const receipt = makeReceipt();

    const batch1 = engine.processBatch([receipt]);
    expect(batch1.results).toHaveLength(1);
    expect(batch1.results[0].judgment).toBe('auto_confirmed');

    const batch2 = engine.processBatch([receipt]);
    expect(batch2.results).toHaveLength(0);

    const history = store.getHistory(receipt.id);
    expect(history).toHaveLength(2);
    expect(history[0].skipped).toBe(false);
    expect(history[1].skipped).toBe(true);
    expect(history[1].skipReason).toContain('已在批次');
    expect(history[1].skipReason).toContain('不重复生成新记录');
  });

  it('争议流水判定为 needs_review，附判断理由', () => {
    const receipt = makeReceipt({ status: 'disputed' });
    const batch = engine.processBatch([receipt]);

    expect(batch.results[0].judgment).toBe('needs_review');
    expect(batch.results[0].reasons.some(r => r.code === 'DISPUTED_STATUS')).toBe(true);
  });

  it('重复订单判定为 duplicate', () => {
    const r1 = makeReceipt({ id: 'rcpt_001', orderId: 'ORD-1001' });
    const r2 = makeReceipt({ id: 'rcpt_002', orderId: 'ORD-1001' });

    engine.processBatch([r1]);
    const batch2 = engine.processBatch([r2]);

    expect(batch2.results[0].judgment).toBe('duplicate');
    expect(batch2.results[0].reasons[0].code).toBe('DUPLICATE_ORDER');
  });

  it('金额异常判定为 needs_review', () => {
    const receipt = makeReceipt({ amount: 0 });
    const batch = engine.processBatch([receipt]);

    expect(batch.results[0].judgment).toBe('needs_review');
    expect(batch.results[0].reasons.some(r => r.code === 'INVALID_AMOUNT')).toBe(true);
  });

  it('多次处理历史完整保留', () => {
    const receipt = makeReceipt();
    engine.processBatch([receipt]);
    engine.processBatch([receipt]);
    engine.processBatch([receipt]);

    const history = store.getHistory(receipt.id);
    expect(history).toHaveLength(3);
    expect(history.filter(h => h.skipped)).toHaveLength(2);
    expect(history.filter(h => !h.skipped)).toHaveLength(1);
  });
});

describe('RefundAuditService', () => {
  let store: InMemoryStore;
  let auditService: RefundAuditService;

  beforeEach(() => {
    store = new InMemoryStore();
    auditService = new RefundAuditService(store);
  });

  it('手动改退款金额，前后变化留在历史里', () => {
    const receipt = makeReceipt();
    const refund = makeRefundItem();
    store.saveReceipt(receipt);
    store.saveRefundItem(refund);

    const change = auditService.modifyRefundItem(
      refund.id,
      '张会计',
      'refundAmount',
      150,
      '客户追加了退货商品',
    );

    expect(change.oldValue).toBe(100);
    expect(change.newValue).toBe(150);
    expect(change.changedBy).toBe('张会计');
    expect(change.reason).toBe('客户追加了退货商品');

    const history = auditService.getRefundChangeHistory(refund.id);
    expect(history).toHaveLength(1);
    expect(history[0].field).toBe('refundAmount');
  });

  it('对账说明和明细不各说各话，变更自动同步到对账说明', () => {
    const receipt = makeReceipt();
    const refund = makeRefundItem({ status: 'approved' });
    store.saveReceipt(receipt);
    store.saveRefundItem(refund);

    auditService.modifyRefundItem(refund.id, '张会计', 'refundAmount', 200, '实际退款金额调整');

    const stmt = auditService.getReconciliationForReceipt(receipt.id);
    expect(stmt).toBeDefined();
    expect(stmt!.notes).toContain('张会计');
    expect(stmt!.notes).toContain('refundAmount');
    expect(stmt!.notes).toContain('200');
    expect(stmt!.changeRecords.length).toBeGreaterThan(0);
  });

  it('多次变更都留在历史里', () => {
    const receipt = makeReceipt();
    const refund = makeRefundItem({ status: 'approved' });
    store.saveReceipt(receipt);
    store.saveRefundItem(refund);

    auditService.modifyRefundItem(refund.id, '张会计', 'refundAmount', 150, '第一次调整');
    auditService.modifyRefundItem(refund.id, '李会计', 'reason', '客户部分退货', '第二次调整');

    const history = auditService.getRefundChangeHistory(refund.id);
    expect(history).toHaveLength(2);
    expect(history[0].changedBy).toBe('张会计');
    expect(history[1].changedBy).toBe('李会计');
  });
});

describe('ExplanationGenerator', () => {
  it('判断结果格式化为非技术人员可读的文本', () => {
    const receipt = makeReceipt({ feePeriod: '2025-02' });
    const store = new InMemoryStore();
    const engine = new JudgmentEngine(store, {
      crossPeriodContactPerson: '财务部-李明',
    });
    const batch = engine.processBatch([receipt]);
    const output = ExplanationGenerator.formatJudgment(batch.results[0]);

    expect(output).toContain('收款流水判断结果');
    expect(output).toContain('判断理由');
    expect(output).toContain('下一步操作');
    expect(output).toContain('CROSS_PERIOD_FEE');
    expect(output).not.toContain('undefined');
  });

  it('跨期手续费说明包含来源和联系人', () => {
    const receipt = makeReceipt({ feePeriod: '2025-02' });
    const store = new InMemoryStore();
    const engine = new JudgmentEngine(store, {
      crossPeriodContactPerson: '财务部-李明',
      platformContactMap: { Stripe: '运营部-王芳' },
    });
    engine.processBatch([receipt]);

    const alerts = store.getCrossPeriodAlerts(receipt.id);
    const output = ExplanationGenerator.formatCrossPeriodAlert(alerts[0]);

    expect(output).toContain('跨期手续费提醒');
    expect(output).toContain('手续费来源');
    expect(output).toContain('运营部-王芳');
    expect(output).toContain('下一步操作');
  });

  it('历史记录格式化显示跳过原因', () => {
    const receipt = makeReceipt();
    const store = new InMemoryStore();
    const engine = new JudgmentEngine(store, { crossPeriodContactPerson: '财务部-李明' });

    engine.processBatch([receipt]);
    engine.processBatch([receipt]);

    const history = store.getHistory(receipt.id);
    const output = ExplanationGenerator.formatHistoryEntries(history);

    expect(output).toContain('跳过');
    expect(output).toContain('不重复生成新记录');
  });

  it('对账说明格式化包含退款变更明细', () => {
    const store = new InMemoryStore();
    const receipt = makeReceipt();
    const refund = makeRefundItem({ status: 'approved' });
    store.saveReceipt(receipt);
    store.saveRefundItem(refund);

    const auditService = new RefundAuditService(store);
    auditService.modifyRefundItem(refund.id, '张会计', 'refundAmount', 200, '金额调整');

    const stmt = store.getReconciliation(receipt.id, '2025-03');
    const output = ExplanationGenerator.formatReconciliation(stmt!);

    expect(output).toContain('退款变更记录');
    expect(output).toContain('张会计');
    expect(output).toContain('refundAmount');
  });
});
