const { v4: uuidv4 } = require('uuid');
const { initDb, resetDb, insert } = require('../src/db');
const stateMachine = require('../src/services/stateMachine');
const { EXCHANGE_STATUSES } = require('../src/constants/statuses');

function createTestExchange() {
  const id = `EX-TEST-${uuidv4().substring(0, 8)}`;
  insert('exchanges', {
    id,
    order_id: 'ORD-001',
    original_sku: 'SKU-OLD',
    target_sku: 'SKU-NEW',
    original_qty: 1,
    target_qty: 1,
    reason: 'test',
    status: EXCHANGE_STATUSES.PENDING_APPLY,
    price_diff: 0,
    paid_amount: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  insert('exchange_status_logs', {
    id: Date.now(),
    exchange_id: id,
    from_status: null,
    to_status: EXCHANGE_STATUSES.PENDING_APPLY,
    remark: '创建换货单',
    created_at: new Date().toISOString()
  });
  return id;
}

describe('State Machine', () => {
  beforeAll(async () => {
    await initDb();
  });

  beforeEach(() => {
    resetDb();
  });

  test('canTransition: should allow valid transitions', () => {
    expect(stateMachine.canTransition(
      EXCHANGE_STATUSES.PENDING_APPLY, 
      EXCHANGE_STATUSES.APPLIED
    )).toBe(true);

    expect(stateMachine.canTransition(
      EXCHANGE_STATUSES.APPLIED, 
      EXCHANGE_STATUSES.SHIPPED_BACK
    )).toBe(true);

    expect(stateMachine.canTransition(
      EXCHANGE_STATUSES.SHIPPED_BACK, 
      EXCHANGE_STATUSES.QC_PASSED
    )).toBe(true);
  });

  test('canTransition: should reject invalid transitions', () => {
    expect(stateMachine.canTransition(
      EXCHANGE_STATUSES.PENDING_APPLY, 
      EXCHANGE_STATUSES.COMPLETED
    )).toBe(false);

    expect(stateMachine.canTransition(
      EXCHANGE_STATUSES.QC_PASSED, 
      EXCHANGE_STATUSES.COMPLETED
    )).toBe(false);

    expect(stateMachine.canTransition(
      EXCHANGE_STATUSES.COMPLETED, 
      EXCHANGE_STATUSES.APPLIED
    )).toBe(false);
  });

  test('getNextAllowedStatuses: should return correct next statuses', () => {
    const nextStatuses = stateMachine.getNextAllowedStatuses(EXCHANGE_STATUSES.APPLIED);
    expect(nextStatuses).toHaveLength(2);
    expect(nextStatuses.map(s => s.status)).toContain(EXCHANGE_STATUSES.SHIPPED_BACK);
    expect(nextStatuses.map(s => s.status)).toContain(EXCHANGE_STATUSES.CANCELLED);
  });

  test('transitionState: should transition valid state and log it', () => {
    const exchangeId = createTestExchange();

    const result = stateMachine.transitionState(exchangeId, EXCHANGE_STATUSES.APPLIED);

    expect(result.status).toBe(EXCHANGE_STATUSES.APPLIED);

    const { getDb } = require('../src/db');
    const db = getDb();
    const logs = db.exchange_status_logs.filter(l => l.exchange_id === exchangeId);

    expect(logs.length).toBeGreaterThanOrEqual(2);
    const lastLog = logs[logs.length - 1];
    expect(lastLog.from_status).toBe(EXCHANGE_STATUSES.PENDING_APPLY);
    expect(lastLog.to_status).toBe(EXCHANGE_STATUSES.APPLIED);
  });

  test('transitionState: should throw for invalid transition', () => {
    const exchangeId = createTestExchange();

    expect(() => {
      stateMachine.transitionState(exchangeId, EXCHANGE_STATUSES.COMPLETED);
    }).toThrow(stateMachine.StateTransitionError);

    expect(() => {
      stateMachine.transitionState(exchangeId, EXCHANGE_STATUSES.COMPLETED);
    }).toThrow('Invalid state transition: pending_apply -> completed');
  });

  test('transitionState: should throw for non-existent exchange', () => {
    expect(() => {
      stateMachine.transitionState('NON-EXISTENT-ID', EXCHANGE_STATUSES.APPLIED);
    }).toThrow('Exchange not found');
  });
});
