const db = require('../config/database');

const WarehouseService = {
  getInventory: (sku, location) => {
    return db.prepare(`
      SELECT * FROM warehouse WHERE sku = ? AND location = ?
    `).get(sku, location);
  },

  prepare: (transactionId, sku, fromLocation, toLocation, quantity) => {
    const inventory = db.prepare(`
      SELECT * FROM warehouse WHERE sku = ? AND location = ?
    `).get(sku, fromLocation);

    if (!inventory) {
      throw new Error(`仓库 ${fromLocation} 中不存在 SKU: ${sku}`);
    }

    if (inventory.quantity < quantity) {
      throw new Error(`仓库 ${fromLocation} 库存不足，当前: ${inventory.quantity}, 需求: ${quantity}`);
    }

    db.prepare(`
      UPDATE warehouse SET quantity = quantity - ? WHERE sku = ? AND location = ?
    `).run(quantity, sku, fromLocation);

    db.prepare(`
      INSERT INTO warehouse_operations (transaction_id, sku, from_location, to_location, quantity, operation_type, status)
      VALUES (?, ?, ?, ?, ?, 'PREPARE', 'SUCCESS')
    `).run(transactionId, sku, fromLocation, toLocation, quantity);

    return {
      success: true,
      sku,
      fromLocation,
      toLocation,
      quantity,
      action: 'PREPARE',
      message: `从 ${fromLocation} 预扣 ${quantity} 个 ${sku}`
    };
  },

  confirm: (transactionId, sku, fromLocation, toLocation, quantity) => {
    const targetInventory = db.prepare(`
      SELECT * FROM warehouse WHERE sku = ? AND location = ?
    `).get(sku, toLocation);

    if (targetInventory) {
      db.prepare(`
        UPDATE warehouse SET quantity = quantity + ? WHERE sku = ? AND location = ?
      `).run(quantity, sku, toLocation);
    } else {
      db.prepare(`
        INSERT INTO warehouse (sku, location, quantity) VALUES (?, ?, ?)
      `).run(sku, toLocation, quantity);
    }

    db.prepare(`
      INSERT INTO warehouse_operations (transaction_id, sku, from_location, to_location, quantity, operation_type, status)
      VALUES (?, ?, ?, ?, ?, 'CONFIRM', 'SUCCESS')
    `).run(transactionId, sku, fromLocation, toLocation, quantity);

    return {
      success: true,
      sku,
      fromLocation,
      toLocation,
      quantity,
      action: 'CONFIRM',
      message: `确认调拨 ${quantity} 个 ${sku} 从 ${fromLocation} 到 ${toLocation}`
    };
  },

  cancel: (transactionId, sku, fromLocation, toLocation, quantity) => {
    db.prepare(`
      UPDATE warehouse SET quantity = quantity + ? WHERE sku = ? AND location = ?
    `).run(quantity, sku, fromLocation);

    db.prepare(`
      INSERT INTO warehouse_operations (transaction_id, sku, from_location, to_location, quantity, operation_type, status)
      VALUES (?, ?, ?, ?, ?, 'CANCEL', 'SUCCESS')
    `).run(transactionId, sku, fromLocation, toLocation, quantity);

    return {
      success: true,
      sku,
      fromLocation,
      toLocation,
      quantity,
      action: 'CANCEL',
      message: `取消调拨，归还 ${quantity} 个 ${sku} 到 ${fromLocation}`
    };
  },

  getOperationHistory: (transactionId) => {
    return db.prepare(`
      SELECT * FROM warehouse_operations WHERE transaction_id = ? ORDER BY created_at ASC
    `).all(transactionId);
  },

  listAllInventory: () => {
    return db.prepare('SELECT * FROM warehouse ORDER BY sku, location').all();
  }
};

module.exports = WarehouseService;
