const { v4: uuidv4 } = require('uuid');
const { initDb, resetDb } = require('../src/db');
const exchangeService = require('../src/services/exchangeService');
const inventoryService = require('../src/services/inventory');
const { EXCHANGE_STATUSES } = require('../src/constants/statuses');

function getRandomSku() {
  return `SKU-${uuidv4().substring(0, 8).toUpperCase()}`;
}

describe('Exchange Service', () => {
  let targetSku;

  beforeAll(() => {
    process.env.DB_PATH = ':memory:';
    initDb();
  });

  beforeEach(() => {
    resetDb();
    targetSku = getRandomSku();
    inventoryService.upsertInventory(targetSku, 100, 100, 0);
  });

  test('createExchange: should create new exchange with correct initial state', () => {
    const exchange = exchangeService.createExchange({
      order_id: 'ORD-001',
      original_sku: 'SKU-OLD-001',
      target_sku: targetSku,
      original_qty: 1,
      target_qty: 1,
      reason: '尺码不对'
    });

    expect(exchange.id).toBeDefined();
    expect(exchange.id).toMatch(/^EX-/);
    expect(exchange.status).toBe(EXCHANGE_STATUSES.PENDING_APPLY);
    expect(exchange.order_id).toBe('ORD-001');
    expect(exchange.reason).toBe('尺码不对');
  });

  test('getExchangeWithLogs: should return exchange with status logs', () => {
    const exchange = exchangeService.createExchange({
      order_id: 'ORD-001',
      original_sku: 'SKU-OLD-001',
      target_sku: targetSku,
      reason: 'test'
    });

    const result = exchangeService.getExchangeWithLogs(exchange.id);
    expect(result).not.toBeNull();
    expect(result.status_logs).toBeDefined();
    expect(result.status_logs.length).toBeGreaterThan(0);
  });

  test('full flow with positive price difference', () => {
    const exchange = exchangeService.createExchange({
      order_id: 'ORD-001',
      original_sku: 'SKU-OLD',
      target_sku: targetSku,
      reason: 'test'
    });

    expect(exchange.status).toBe(EXCHANGE_STATUSES.PENDING_APPLY);

    let current = exchangeService.submitApply(exchange.id);
    expect(current.status).toBe(EXCHANGE_STATUSES.APPLIED);

    current = exchangeService.shipBack(exchange.id);
    expect(current.status).toBe(EXCHANGE_STATUSES.SHIPPED_BACK);

    current = exchangeService.passQC(exchange.id);
    expect(current.status).toBe(EXCHANGE_STATUSES.QC_PASSED);

    current = exchangeService.calculatePriceDiff(exchange.id, 5000);
    expect(current.status).toBe(EXCHANGE_STATUSES.NEED_PAYMENT);
    expect(current.price_diff).toBe(5000);

    current = exchangeService.payDiff(exchange.id, 5000);
    expect(current.status).toBe(EXCHANGE_STATUSES.PAID);
    expect(current.paid_amount).toBe(5000);

    current = exchangeService.startReshipping(exchange.id);
    expect(current.status).toBe(EXCHANGE_STATUSES.RESHIPPING);

    let inventory = inventoryService.getInventory(targetSku);
    expect(inventory.reserved_qty).toBe(1);
    expect(inventory.available_qty).toBe(99);

    current = exchangeService.complete(exchange.id);
    expect(current.status).toBe(EXCHANGE_STATUSES.COMPLETED);

    inventory = inventoryService.getInventory(targetSku);
    expect(inventory.total_qty).toBe(99);
    expect(inventory.reserved_qty).toBe(0);
  });

  test('full flow with zero price difference', () => {
    const exchange = exchangeService.createExchange({
      order_id: 'ORD-002',
      original_sku: 'SKU-OLD',
      target_sku: targetSku,
      reason: 'test'
    });

    exchangeService.submitApply(exchange.id);
    exchangeService.shipBack(exchange.id);
    exchangeService.passQC(exchange.id);
    
    const current = exchangeService.calculatePriceDiff(exchange.id, 0);
    expect(current.status).toBe(EXCHANGE_STATUSES.RESHIPPING);
  });

  test('cancel flow: should release reserved inventory on cancel', () => {
    const exchange = exchangeService.createExchange({
      order_id: 'ORD-CANCEL',
      original_sku: 'SKU-OLD',
      target_sku: targetSku,
      reason: 'test'
    });

    exchangeService.submitApply(exchange.id);
    
    const current = exchangeService.cancel(exchange.id);
    expect(current.status).toBe(EXCHANGE_STATUSES.CANCELLED);
  });

  test('payDiff: should throw when payment amount mismatch', () => {
    const exchange = exchangeService.createExchange({
      order_id: 'ORD-003',
      original_sku: 'SKU-OLD',
      target_sku: targetSku,
      reason: 'test'
    });

    exchangeService.submitApply(exchange.id);
    exchangeService.shipBack(exchange.id);
    exchangeService.passQC(exchange.id);
    exchangeService.calculatePriceDiff(exchange.id, 5000);

    expect(() => {
      exchangeService.payDiff(exchange.id, 3000);
    }).toThrow('支付金额不匹配');
  });

  test('qc_fail flow: should allow cancellation after QC failure', () => {
    const exchange = exchangeService.createExchange({
      order_id: 'ORD-QC-FAIL',
      original_sku: 'SKU-OLD',
      target_sku: targetSku,
      reason: 'test'
    });

    exchangeService.submitApply(exchange.id);
    exchangeService.shipBack(exchange.id);
    
    let current = exchangeService.failQC(exchange.id);
    expect(current.status).toBe(EXCHANGE_STATUSES.QC_FAILED);

    current = exchangeService.cancel(exchange.id);
    expect(current.status).toBe(EXCHANGE_STATUSES.CANCELLED);
  });

  test('listExchanges: should list exchanges with filters', () => {
    const ex1 = exchangeService.createExchange({
      order_id: 'ORD-FILTER-1',
      original_sku: 'SKU-OLD',
      target_sku: targetSku,
      reason: 'test'
    });
    const ex2 = exchangeService.createExchange({
      order_id: 'ORD-FILTER-2',
      original_sku: 'SKU-OLD',
      target_sku: targetSku,
      reason: 'test'
    });

    exchangeService.submitApply(ex2.id);

    const all = exchangeService.listExchanges({});
    expect(all.length).toBe(2);

    const applied = exchangeService.listExchanges({ status: EXCHANGE_STATUSES.APPLIED });
    expect(applied.length).toBe(1);
    expect(applied[0].id).toBe(ex2.id);

    const byOrder = exchangeService.listExchanges({ order_id: 'ORD-FILTER-1' });
    expect(byOrder.length).toBe(1);
    expect(byOrder[0].id).toBe(ex1.id);
  });

  test('getExchangeStats: should return statistics', () => {
    const ex1 = exchangeService.createExchange({
      order_id: 'ORD-STATS-1',
      original_sku: 'SKU-OLD',
      target_sku: targetSku,
      reason: 'test'
    });
    const ex2 = exchangeService.createExchange({
      order_id: 'ORD-STATS-2',
      original_sku: 'SKU-OLD',
      target_sku: targetSku,
      reason: 'test'
    });
    exchangeService.submitApply(ex2.id);

    const stats = exchangeService.getExchangeStats();
    expect(stats.totals.total).toBe(2);
    expect(stats.by_status.length).toBe(2);
  });

  test('invalid state transitions should be rejected', () => {
    const exchange = exchangeService.createExchange({
      order_id: 'ORD-INVALID',
      original_sku: 'SKU-OLD',
      target_sku: targetSku,
      reason: 'test'
    });

    expect(() => {
      exchangeService.complete(exchange.id);
    }).toThrow();

    expect(() => {
      exchangeService.shipBack(exchange.id);
    }).toThrow();
  });

  test('non-existent exchange should throw', () => {
    expect(() => {
      exchangeService.submitApply('NON-EXISTENT-ID');
    }).toThrow('换货单不存在');
  });

  describe('createExchange validation', () => {
    test('should reject missing order_id', () => {
      expect(() => {
        exchangeService.createExchange({
          original_sku: 'SKU-OLD',
          target_sku: targetSku
        });
      }).toThrow('order_id 不能为空');
    });

    test('should reject empty order_id', () => {
      expect(() => {
        exchangeService.createExchange({
          order_id: '   ',
          original_sku: 'SKU-OLD',
          target_sku: targetSku
        });
      }).toThrow('order_id 不能为空');
    });

    test('should reject missing original_sku', () => {
      expect(() => {
        exchangeService.createExchange({
          order_id: 'ORD-TEST',
          target_sku: targetSku
        });
      }).toThrow('original_sku 不能为空');
    });

    test('should reject missing target_sku', () => {
      expect(() => {
        exchangeService.createExchange({
          order_id: 'ORD-TEST',
          original_sku: 'SKU-OLD'
        });
      }).toThrow('target_sku 不能为空');
    });

    test('should reject when original_sku equals target_sku', () => {
      expect(() => {
        exchangeService.createExchange({
          order_id: 'ORD-TEST',
          original_sku: 'SKU-SAME',
          target_sku: 'SKU-SAME'
        });
      }).toThrow('换货商品不能与原商品相同');
    });

    test('should reject invalid original_qty (negative)', () => {
      expect(() => {
        exchangeService.createExchange({
          order_id: 'ORD-TEST',
          original_sku: 'SKU-OLD',
          target_sku: targetSku,
          original_qty: -1
        });
      }).toThrow('original_qty 必须是正整数');
    });

    test('should reject invalid original_qty (zero)', () => {
      expect(() => {
        exchangeService.createExchange({
          order_id: 'ORD-TEST',
          original_sku: 'SKU-OLD',
          target_sku: targetSku,
          original_qty: 0
        });
      }).toThrow('original_qty 必须是正整数');
    });

    test('should reject invalid original_qty (decimal)', () => {
      expect(() => {
        exchangeService.createExchange({
          order_id: 'ORD-TEST',
          original_sku: 'SKU-OLD',
          target_sku: targetSku,
          original_qty: 1.5
        });
      }).toThrow('original_qty 必须是正整数');
    });

    test('should reject invalid target_qty', () => {
      expect(() => {
        exchangeService.createExchange({
          order_id: 'ORD-TEST',
          original_sku: 'SKU-OLD',
          target_sku: targetSku,
          target_qty: 0
        });
      }).toThrow('target_qty 必须是正整数');
    });

    test('should use default qty of 1 when not provided', () => {
      const exchange = exchangeService.createExchange({
        order_id: 'ORD-TEST-DEFAULT',
        original_sku: 'SKU-OLD',
        target_sku: targetSku
      });
      expect(exchange.original_qty).toBe(1);
      expect(exchange.target_qty).toBe(1);
    });

    test('should trim whitespace from skus and order_id', () => {
      const exchange = exchangeService.createExchange({
        order_id: '  ORD-TRIM  ',
        original_sku: '  SKU-OLD-TRIM  ',
        target_sku: `  ${targetSku}  `
      });
      expect(exchange.order_id).toBe('ORD-TRIM');
      expect(exchange.original_sku).toBe('SKU-OLD-TRIM');
      expect(exchange.target_sku).toBe(targetSku);
    });
  });

  describe('calculatePriceDiff strict state check', () => {
    test('should reject if state is not qc_passed', () => {
      const exchange = exchangeService.createExchange({
        order_id: 'ORD-STATE-TEST',
        original_sku: 'SKU-OLD',
        target_sku: targetSku,
        reason: 'test'
      });

      expect(() => {
        exchangeService.calculatePriceDiff(exchange.id, 1000);
      }).toThrow('Invalid state transition');

      const after = exchangeService.getExchangeById(exchange.id);
      expect(after.price_diff).toBe(0);
      expect(after.status).toBe(EXCHANGE_STATUSES.PENDING_APPLY);
    });

    test('should reject invalid price_diff type', () => {
      const exchange = exchangeService.createExchange({
        order_id: 'ORD-PRICE-TEST',
        original_sku: 'SKU-OLD',
        target_sku: targetSku,
        reason: 'test'
      });

      expect(() => {
        exchangeService.calculatePriceDiff(exchange.id, 'not a number');
      }).toThrow('price_diff 必须是数字');
    });

    test('should reject NaN price_diff', () => {
      const exchange = exchangeService.createExchange({
        order_id: 'ORD-PRICE-NAN',
        original_sku: 'SKU-OLD',
        target_sku: targetSku,
        reason: 'test'
      });

      expect(() => {
        exchangeService.calculatePriceDiff(exchange.id, NaN);
      }).toThrow('price_diff 必须是数字');
    });
  });

  describe('payDiff strict state check', () => {
    test('should reject if state is not need_payment', () => {
      const exchange = exchangeService.createExchange({
        order_id: 'ORD-PAY-TEST',
        original_sku: 'SKU-OLD',
        target_sku: targetSku,
        reason: 'test'
      });

      exchangeService.submitApply(exchange.id);
      exchangeService.shipBack(exchange.id);
      exchangeService.passQC(exchange.id);
      exchangeService.calculatePriceDiff(exchange.id, 5000);

      exchangeService.payDiff(exchange.id, 5000);
      
      expect(() => {
        exchangeService.payDiff(exchange.id, 0);
      }).toThrow('Invalid state transition');

      const after = exchangeService.getExchangeById(exchange.id);
      expect(after.paid_amount).toBe(5000);
    });

    test('should reject invalid paid_amount type', () => {
      const exchange = exchangeService.createExchange({
        order_id: 'ORD-PAY-TYPE',
        original_sku: 'SKU-OLD',
        target_sku: targetSku,
        reason: 'test'
      });

      expect(() => {
        exchangeService.payDiff(exchange.id, 'invalid');
      }).toThrow('paid_amount 必须是数字');
    });
  });

  describe('startReshipping atomic operation', () => {
    test('should reject if state is invalid, no inventory dirty', () => {
      const exchange = exchangeService.createExchange({
        order_id: 'ORD-RESHIP-STATE',
        original_sku: 'SKU-OLD',
        target_sku: targetSku,
        reason: 'test'
      });

      const beforeInventory = inventoryService.getInventory(targetSku);
      
      expect(() => {
        exchangeService.startReshipping(exchange.id);
      }).toThrow('Invalid state transition');

      const afterInventory = inventoryService.getInventory(targetSku);
      expect(afterInventory.available_qty).toBe(beforeInventory.available_qty);
      expect(afterInventory.reserved_qty).toBe(beforeInventory.reserved_qty);

      const afterExchange = exchangeService.getExchangeById(exchange.id);
      expect(afterExchange.status).toBe(EXCHANGE_STATUSES.PENDING_APPLY);
    });

    test('should reject if inventory insufficient, no state dirty', () => {
      const limitedSku = 'SKU-LIMITED';
      inventoryService.upsertInventory(limitedSku, 1, 1, 0);
      
      const exchange = exchangeService.createExchange({
        order_id: 'ORD-RESHIP-INV',
        original_sku: 'SKU-OLD',
        target_sku: limitedSku,
        target_qty: 10,
        reason: 'test'
      });

      exchangeService.submitApply(exchange.id);
      exchangeService.shipBack(exchange.id);
      exchangeService.passQC(exchange.id);
      exchangeService.calculatePriceDiff(exchange.id, 5000);
      exchangeService.payDiff(exchange.id, 5000);

      expect(() => {
        exchangeService.startReshipping(exchange.id);
      }).toThrow('库存不足');

      const afterExchange = exchangeService.getExchangeById(exchange.id);
      expect(afterExchange.status).toBe(EXCHANGE_STATUSES.PAID);
    });

    test('should atomically reserve inventory and change status', () => {
      const exchange = exchangeService.createExchange({
        order_id: 'ORD-RESHIP-ATOMIC',
        original_sku: 'SKU-OLD',
        target_sku: targetSku,
        reason: 'test'
      });

      exchangeService.submitApply(exchange.id);
      exchangeService.shipBack(exchange.id);
      exchangeService.passQC(exchange.id);
      exchangeService.calculatePriceDiff(exchange.id, 5000);
      exchangeService.payDiff(exchange.id, 5000);

      const beforeInventory = inventoryService.getInventory(targetSku);
      const beforeAvailable = beforeInventory.available_qty;
      const beforeReserved = beforeInventory.reserved_qty;

      const result = exchangeService.startReshipping(exchange.id);

      expect(result.status).toBe(EXCHANGE_STATUSES.RESHIPPING);

      const afterInventory = inventoryService.getInventory(targetSku);
      expect(afterInventory.available_qty).toBe(beforeAvailable - 1);
      expect(afterInventory.reserved_qty).toBe(beforeReserved + 1);
    });
  });

  describe('zero price diff flow with inventory', () => {
    test('should reserve inventory when price_diff is zero', () => {
      const exchange = exchangeService.createExchange({
        order_id: 'ORD-ZERO-PRICE',
        original_sku: 'SKU-OLD',
        target_sku: targetSku,
        reason: 'test'
      });

      exchangeService.submitApply(exchange.id);
      exchangeService.shipBack(exchange.id);
      exchangeService.passQC(exchange.id);

      const beforeInventory = inventoryService.getInventory(targetSku);
      const beforeAvailable = beforeInventory.available_qty;

      const result = exchangeService.calculatePriceDiff(exchange.id, 0);

      expect(result.status).toBe(EXCHANGE_STATUSES.RESHIPPING);
      expect(result.price_diff).toBe(0);

      const afterInventory = inventoryService.getInventory(targetSku);
      expect(afterInventory.available_qty).toBe(beforeAvailable - 1);
      expect(afterInventory.reserved_qty).toBe(1);

      const afterExchange = exchangeService.complete(exchange.id);
      expect(afterExchange.status).toBe(EXCHANGE_STATUSES.COMPLETED);

      const finalInventory = inventoryService.getInventory(targetSku);
      expect(finalInventory.reserved_qty).toBe(0);
      expect(finalInventory.total_qty).toBe(beforeAvailable - 1);
    });

    test('should reject zero price diff when inventory insufficient, no state dirty', () => {
      const limitedSku = 'SKU-ZERO-LIMITED';
      inventoryService.upsertInventory(limitedSku, 1, 1, 0);
      
      const exchange = exchangeService.createExchange({
        order_id: 'ORD-ZERO-NO-INV',
        original_sku: 'SKU-OLD',
        target_sku: limitedSku,
        target_qty: 5,
        reason: 'test'
      });

      exchangeService.submitApply(exchange.id);
      exchangeService.shipBack(exchange.id);
      exchangeService.passQC(exchange.id);

      expect(() => {
        exchangeService.calculatePriceDiff(exchange.id, 0);
      }).toThrow('库存不足');

      const afterExchange = exchangeService.getExchangeById(exchange.id);
      expect(afterExchange.status).toBe(EXCHANGE_STATUSES.QC_PASSED);
      expect(afterExchange.price_diff).toBe(0);
    });
  });

  describe('complete/cancel with optional inventory', () => {
    test('complete should work even without inventory reservation', () => {
      const exchange = exchangeService.createExchange({
        order_id: 'ORD-COMPLETE-NO-RES',
        original_sku: 'SKU-OLD',
        target_sku: targetSku,
        reason: 'test'
      });

      exchangeService.submitApply(exchange.id);
      exchangeService.shipBack(exchange.id);
      exchangeService.passQC(exchange.id);
      exchangeService.calculatePriceDiff(exchange.id, 5000);
      exchangeService.payDiff(exchange.id, 5000);
      exchangeService.startReshipping(exchange.id);

      const beforeInventory = inventoryService.getInventory(targetSku);

      const result = exchangeService.complete(exchange.id);
      expect(result.status).toBe(EXCHANGE_STATUSES.COMPLETED);

      const afterInventory = inventoryService.getInventory(targetSku);
      expect(afterInventory.reserved_qty).toBe(0);
      expect(afterInventory.total_qty).toBe(beforeInventory.total_qty);
    });

    test('cancel should work even without inventory reservation', () => {
      const exchange = exchangeService.createExchange({
        order_id: 'ORD-CANCEL-NO-RES',
        original_sku: 'SKU-OLD',
        target_sku: targetSku,
        reason: 'test'
      });

      exchangeService.submitApply(exchange.id);

      const beforeInventory = inventoryService.getInventory(targetSku);

      const result = exchangeService.cancel(exchange.id);
      expect(result.status).toBe(EXCHANGE_STATUSES.CANCELLED);

      const afterInventory = inventoryService.getInventory(targetSku);
      expect(afterInventory.available_qty).toBe(beforeInventory.available_qty);
    });
  });
});
