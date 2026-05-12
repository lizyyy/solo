const { all, get, run } = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const { INVENTORY_CHANGE_TYPE } = require('../utils/constants');

class InventoryService {
  static async checkAndLockStock(productId, quantity, idempotentKey, operatorId, operatorName, remark = '') {
    const existingLog = await get('SELECT id FROM inventory_change_logs WHERE idempotent_key = ?', [idempotentKey]);
    if (existingLog) {
      return { success: true, duplicate: true, message: '幂等重复，跳过处理' };
    }

    const product = await get('SELECT * FROM flash_sale_products WHERE id = ?', [productId]);
    if (!product) {
      return { success: false, message: '商品不存在' };
    }

    if (product.available_stock < quantity) {
      return { success: false, message: '库存不足' };
    }

    const beforeStock = product.available_stock;
    const afterStock = product.available_stock - quantity;

    await run(`
      UPDATE flash_sale_products 
      SET available_stock = available_stock - ?, locked_stock = locked_stock + ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [quantity, quantity, productId]);

    await run(`
      INSERT INTO inventory_change_logs (id, product_id, change_type, change_quantity, before_stock, after_stock, operator_id, operator_name, remark, idempotent_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [uuidv4(), productId, INVENTORY_CHANGE_TYPE.LOCK, -quantity, beforeStock, afterStock, operatorId, operatorName, remark, idempotentKey]);

    return { success: true, duplicate: false };
  }

  static async confirmStock(productId, quantity, orderId, idempotentKey, operatorId, operatorName, remark = '') {
    const existingLog = await get('SELECT id FROM inventory_change_logs WHERE idempotent_key = ?', [idempotentKey]);
    if (existingLog) {
      return { success: true, duplicate: true, message: '幂等重复，跳过处理' };
    }

    const product = await get('SELECT * FROM flash_sale_products WHERE id = ?', [productId]);
    if (!product) {
      return { success: false, message: '商品不存在' };
    }

    const beforeStock = product.locked_stock;
    const afterStock = product.locked_stock - quantity;

    await run(`
      UPDATE flash_sale_products 
      SET locked_stock = locked_stock - ?, sold_count = sold_count + ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [quantity, quantity, productId]);

    await run(`
      INSERT INTO inventory_change_logs (id, product_id, order_id, change_type, change_quantity, before_stock, after_stock, operator_id, operator_name, remark, idempotent_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [uuidv4(), productId, orderId, INVENTORY_CHANGE_TYPE.CONFIRM, -quantity, beforeStock, afterStock, operatorId, operatorName, remark, idempotentKey]);

    return { success: true, duplicate: false };
  }

  static async releaseStock(productId, quantity, orderId, idempotentKey, operatorId, operatorName, remark = '') {
    const existingLog = await get('SELECT id FROM inventory_change_logs WHERE idempotent_key = ?', [idempotentKey]);
    if (existingLog) {
      return { success: true, duplicate: true, message: '幂等重复，跳过处理' };
    }

    const product = await get('SELECT * FROM flash_sale_products WHERE id = ?', [productId]);
    if (!product) {
      return { success: false, message: '商品不存在' };
    }

    const beforeStock = product.available_stock;
    const afterStock = product.available_stock + quantity;

    await run(`
      UPDATE flash_sale_products 
      SET available_stock = available_stock + ?, locked_stock = locked_stock - ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [quantity, quantity, productId]);

    await run(`
      INSERT INTO inventory_change_logs (id, product_id, order_id, change_type, change_quantity, before_stock, after_stock, operator_id, operator_name, remark, idempotent_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [uuidv4(), productId, orderId, INVENTORY_CHANGE_TYPE.RELEASE, quantity, beforeStock, afterStock, operatorId, operatorName, remark, idempotentKey]);

    return { success: true, duplicate: false };
  }

  static async returnStockAfterRefund(productId, quantity, orderId, idempotentKey, operatorId, operatorName, remark = '') {
    const existingLog = await get('SELECT id FROM inventory_change_logs WHERE idempotent_key = ?', [idempotentKey]);
    if (existingLog) {
      return { success: true, duplicate: true, message: '幂等重复，跳过处理' };
    }

    const product = await get('SELECT * FROM flash_sale_products WHERE id = ?', [productId]);
    if (!product) {
      return { success: false, message: '商品不存在' };
    }

    const beforeStock = product.available_stock;
    const afterStock = product.available_stock + quantity;

    await run(`
      UPDATE flash_sale_products 
      SET available_stock = available_stock + ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [quantity, productId]);

    await run(`
      INSERT INTO inventory_change_logs (id, product_id, order_id, change_type, change_quantity, before_stock, after_stock, operator_id, operator_name, remark, idempotent_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [uuidv4(), productId, orderId, INVENTORY_CHANGE_TYPE.REFUND_RETURN, quantity, beforeStock, afterStock, operatorId, operatorName, remark, idempotentKey]);

    return { success: true, duplicate: false };
  }

  static async compensationLockStock(productId, quantity, idempotentKey, operatorId, operatorName, remark = '') {
    const existingLog = await get('SELECT id FROM inventory_change_logs WHERE idempotent_key = ?', [idempotentKey]);
    if (existingLog) {
      return { success: true, duplicate: true, message: '幂等重复，跳过处理' };
    }

    const product = await get('SELECT * FROM flash_sale_products WHERE id = ?', [productId]);
    if (!product) {
      return { success: false, message: '商品不存在' };
    }

    if (product.available_stock < quantity) {
      return { success: false, message: '库存不足，无法补单' };
    }

    const beforeStock = product.available_stock;
    const afterStock = product.available_stock - quantity;

    await run(`
      UPDATE flash_sale_products 
      SET available_stock = available_stock - ?, locked_stock = locked_stock + ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [quantity, quantity, productId]);

    await run(`
      INSERT INTO inventory_change_logs (id, product_id, change_type, change_quantity, before_stock, after_stock, operator_id, operator_name, remark, idempotent_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [uuidv4(), productId, INVENTORY_CHANGE_TYPE.COMPENSATION_LOCK, -quantity, beforeStock, afterStock, operatorId, operatorName, remark, idempotentKey]);

    return { success: true, duplicate: false };
  }

  static async getInventoryLogs(productId, limit = 50) {
    if (productId) {
      return await all(`
        SELECT * FROM inventory_change_logs 
        WHERE product_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `, [productId, limit]);
    }
    return await all(`
      SELECT l.*, p.name as product_name 
      FROM inventory_change_logs l
      LEFT JOIN flash_sale_products p ON l.product_id = p.id
      ORDER BY l.created_at DESC 
      LIMIT ?
    `, [limit]);
  }

  static async getAllLogs(limit = 100) {
    return await all(`
      SELECT l.*, p.name as product_name 
      FROM inventory_change_logs l
      LEFT JOIN flash_sale_products p ON l.product_id = p.id
      ORDER BY l.created_at DESC 
      LIMIT ?
    `, [limit]);
  }
}

module.exports = InventoryService;
