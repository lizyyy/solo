const { v4: uuidv4 } = require('uuid');
const { initDb, resetDb, getDb } = require('../src/db');
const inventoryService = require('../src/services/inventory');
const { RESERVATION_STATUSES } = require('../src/constants/statuses');

function getRandomSku() {
  return `SKU-${uuidv4().substring(0, 8).toUpperCase()}`;
}

function createTestExchange() {
  return `EX-TEST-${uuidv4().substring(0, 8)}`;
}

describe('Inventory Service', () => {
  beforeAll(async () => {
    await initDb();
  });

  beforeEach(() => {
    resetDb();
  });

  test('upsertInventory: should create new inventory', () => {
    const sku = getRandomSku();
    inventoryService.upsertInventory(sku, 100, 100, 0);

    const inventory = inventoryService.getInventory(sku);
    expect(inventory).not.toBeNull();
    expect(inventory.sku).toBe(sku);
    expect(inventory.total_qty).toBe(100);
    expect(inventory.available_qty).toBe(100);
    expect(inventory.reserved_qty).toBe(0);
  });

  test('upsertInventory: should update existing inventory', () => {
    const sku = getRandomSku();
    inventoryService.upsertInventory(sku, 100, 100, 0);
    inventoryService.upsertInventory(sku, 150, 150, 0);

    const inventory = inventoryService.getInventory(sku);
    expect(inventory.total_qty).toBe(150);
    expect(inventory.available_qty).toBe(150);
  });

  test('reserveInventory: should reserve available inventory', () => {
    const sku = getRandomSku();
    const exchangeId = createTestExchange();
    inventoryService.upsertInventory(sku, 100, 100, 0);

    const result = inventoryService.reserveInventory(exchangeId, sku, 10);
    expect(result).toBe(true);

    const inventory = inventoryService.getInventory(sku);
    expect(inventory.available_qty).toBe(90);
    expect(inventory.reserved_qty).toBe(10);

    const db = getDb();
    const reservation = db.inventory_reservations.find(
      r => r.exchange_id === exchangeId && r.sku === sku && r.status === RESERVATION_STATUSES.RESERVED
    );
    expect(reservation).not.toBeNull();
    expect(reservation.qty).toBe(10);
  });

  test('reserveInventory: should throw when insufficient inventory', () => {
    const sku = getRandomSku();
    const exchangeId = createTestExchange();
    inventoryService.upsertInventory(sku, 5, 5, 0);

    expect(() => {
      inventoryService.reserveInventory(exchangeId, sku, 10);
    }).toThrow('库存不足');
  });

  test('releaseInventory: should release reserved inventory', () => {
    const sku = getRandomSku();
    const exchangeId = createTestExchange();
    inventoryService.upsertInventory(sku, 100, 100, 0);
    inventoryService.reserveInventory(exchangeId, sku, 10);

    const result = inventoryService.releaseInventory(exchangeId, sku);
    expect(result).toBe(true);

    const inventory = inventoryService.getInventory(sku);
    expect(inventory.available_qty).toBe(100);
    expect(inventory.reserved_qty).toBe(0);
  });

  test('consumeInventory: should consume reserved inventory', () => {
    const sku = getRandomSku();
    const exchangeId = createTestExchange();
    inventoryService.upsertInventory(sku, 100, 100, 0);
    inventoryService.reserveInventory(exchangeId, sku, 10);

    const result = inventoryService.consumeInventory(exchangeId, sku);
    expect(result).toBe(true);

    const inventory = inventoryService.getInventory(sku);
    expect(inventory.total_qty).toBe(90);
    expect(inventory.reserved_qty).toBe(0);
    expect(inventory.available_qty).toBe(90);
  });

  test('getInventoryStats: should return correct statistics', () => {
    const sku1 = getRandomSku();
    const sku2 = getRandomSku();
    inventoryService.upsertInventory(sku1, 100, 100, 0);
    inventoryService.upsertInventory(sku2, 50, 50, 0);

    const stats = inventoryService.getInventoryStats();
    expect(stats.overview.total_skus).toBe(2);
    expect(stats.overview.total_inventory).toBe(150);
    expect(stats.overview.total_available).toBe(150);
  });

  test('multiple reservations: should handle multiple exchanges correctly', () => {
    const sku = getRandomSku();
    const exchange1 = createTestExchange();
    const exchange2 = createTestExchange();
    inventoryService.upsertInventory(sku, 100, 100, 0);

    inventoryService.reserveInventory(exchange1, sku, 20);
    inventoryService.reserveInventory(exchange2, sku, 30);

    let inventory = inventoryService.getInventory(sku);
    expect(inventory.available_qty).toBe(50);
    expect(inventory.reserved_qty).toBe(50);

    inventoryService.releaseInventory(exchange1, sku);
    inventory = inventoryService.getInventory(sku);
    expect(inventory.available_qty).toBe(70);
    expect(inventory.reserved_qty).toBe(30);

    inventoryService.consumeInventory(exchange2, sku);
    inventory = inventoryService.getInventory(sku);
    expect(inventory.total_qty).toBe(70);
    expect(inventory.reserved_qty).toBe(0);
  });
});
