const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

function getInventory(warehouseId, skuId) {
  return db.prepare(`
    SELECT inv.*, sku.code as sku_code, sku.name as sku_name, wh.code as warehouse_code, wh.name as warehouse_name
    FROM inventory inv
    JOIN skus sku ON inv.sku_id = sku.id
    JOIN warehouses wh ON inv.warehouse_id = wh.id
    WHERE inv.warehouse_id = ? AND inv.sku_id = ?
  `).get(warehouseId, skuId);
}

function lockInventory(waveId, warehouseId, skuId, orderLineId, qty) {
  const inv = db.prepare('SELECT * FROM inventory WHERE warehouse_id = ? AND sku_id = ?').get(warehouseId, skuId);
  if (!inv) {
    throw new Error(`仓库库存不存在`);
  }

  if (inv.available_qty < qty) {
    throw new Error(`可用库存不足，当前可用: ${inv.available_qty}, 需要: ${qty}`);
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE inventory
      SET available_qty = available_qty - ?,
          locked_qty = locked_qty + ?
      WHERE warehouse_id = ? AND sku_id = ?
    `).run(qty, qty, warehouseId, skuId);

    db.prepare(`
      INSERT INTO inventory_locks (id, wave_id, warehouse_id, sku_id, order_line_id, qty, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).run(
      `lock_${uuidv4()}`,
      waveId,
      warehouseId,
      skuId,
      orderLineId,
      qty
    );
  });

  transaction();
  return getInventory(warehouseId, skuId);
}

function releaseInventory(waveId, warehouseId, skuId, orderLineId, qty) {
  const locks = db.prepare(`
    SELECT * FROM inventory_locks
    WHERE wave_id = ? AND warehouse_id = ? AND sku_id = ? AND order_line_id = ? AND status = 'active'
  `).all(waveId, warehouseId, skuId, orderLineId);

  const totalLocked = locks.reduce((sum, l) => sum + l.qty, 0);
  if (totalLocked < qty) {
    throw new Error(`可释放库存不足`);
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE inventory
      SET available_qty = available_qty + ?,
          locked_qty = locked_qty - ?
      WHERE warehouse_id = ? AND sku_id = ?
    `).run(qty, qty, warehouseId, skuId);

    db.prepare(`
      UPDATE inventory_locks
      SET status = 'released'
      WHERE wave_id = ? AND warehouse_id = ? AND sku_id = ? AND order_line_id = ? AND status = 'active'
    `).run(waveId, warehouseId, skuId, orderLineId);
  });

  transaction();
  return getInventory(warehouseId, skuId);
}

function confirmPicked(waveId, warehouseId, skuId, orderLineId, qty) {
  const locks = db.prepare(`
    SELECT * FROM inventory_locks
    WHERE wave_id = ? AND warehouse_id = ? AND sku_id = ? AND order_line_id = ? AND status = 'active'
  `).all(waveId, warehouseId, skuId, orderLineId);

  const totalLocked = locks.reduce((sum, l) => sum + l.qty, 0);
  if (totalLocked < qty) {
    throw new Error(`锁定库存不足`);
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE inventory
      SET locked_qty = locked_qty - ?
      WHERE warehouse_id = ? AND sku_id = ?
    `).run(qty, warehouseId, skuId);

    db.prepare(`
      UPDATE inventory_locks
      SET status = 'consumed'
      WHERE wave_id = ? AND warehouse_id = ? AND sku_id = ? AND order_line_id = ? AND status = 'active'
    `).run(waveId, warehouseId, skuId, orderLineId);
  });

  transaction();
  return getInventory(warehouseId, skuId);
}

function findAvailableWarehouses(skuId, excludeWarehouseId, qty) {
  return db.prepare(`
    SELECT inv.*, wh.code as warehouse_code, wh.name as warehouse_name,
           sku.code as sku_code, sku.name as sku_name
    FROM inventory inv
    JOIN warehouses wh ON inv.warehouse_id = wh.id
    JOIN skus sku ON inv.sku_id = sku.id
    WHERE inv.sku_id = ? AND inv.warehouse_id != ? AND inv.available_qty >= ?
    ORDER BY inv.available_qty DESC
  `).all(skuId, excludeWarehouseId, qty);
}

function getInventoryBySkuCode(warehouseCode, skuCode) {
  return db.prepare(`
    SELECT inv.*, sku.code as sku_code, sku.name as sku_name,
           wh.code as warehouse_code, wh.name as warehouse_name
    FROM inventory inv
    JOIN skus sku ON inv.sku_id = sku.id
    JOIN warehouses wh ON inv.warehouse_id = wh.id
    WHERE wh.code = ? AND sku.code = ?
  `).get(warehouseCode, skuCode);
}

function listInventoryByWarehouse(warehouseId) {
  return db.prepare(`
    SELECT inv.*, sku.code as sku_code, sku.name as sku_name
    FROM inventory inv
    JOIN skus sku ON inv.sku_id = sku.id
    WHERE inv.warehouse_id = ?
    ORDER BY sku.code ASC
  `).all(warehouseId);
}

module.exports = {
  getInventory,
  lockInventory,
  releaseInventory,
  confirmPicked,
  findAvailableWarehouses,
  getInventoryBySkuCode,
  listInventoryByWarehouse
};
