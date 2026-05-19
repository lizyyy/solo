const db = require('../database');

class InventoryService {
  async addToInventory(deliveryItem, operatedBy = 'system') {
    const { product_code, product_name, batch_no, quantity, unit, production_date, expiry_date } = deliveryItem;

    const existing = await db.get(
      'SELECT id, quantity FROM inventory WHERE product_code = ? AND batch_no = ?',
      [product_code, batch_no]
    );

    let inventoryId;
    if (existing) {
      await db.run(
        'UPDATE inventory SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [quantity, existing.id]
      );
      inventoryId = existing.id;
    } else {
      const result = await db.run(`
        INSERT INTO inventory 
        (product_code, product_name, batch_no, quantity, unit, production_date, expiry_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [product_code, product_name, batch_no, quantity, unit || '支', production_date, expiry_date]);
      inventoryId = result.lastID;
    }

    await this.recordTransaction({
      transaction_type: 'IN',
      product_code,
      batch_no,
      quantity_change: quantity,
      reference_id: deliveryItem.id,
      reference_type: 'delivery',
      operated_by: operatedBy,
      remark: `入库：${product_name}（批号：${batch_no}）`
    });

    return inventoryId;
  }

  async removeFromInventory(productCode, batchNo, quantity, operatedBy = 'system', remark = '') {
    const existing = await db.get(
      'SELECT id, quantity FROM inventory WHERE product_code = ? AND batch_no = ?',
      [productCode, batchNo]
    );

    if (!existing) {
      throw new Error('库存记录不存在');
    }

    if (existing.quantity < quantity) {
      throw new Error('库存不足');
    }

    const newQuantity = existing.quantity - quantity;
    if (newQuantity === 0) {
      await db.run('DELETE FROM inventory WHERE id = ?', [existing.id]);
    } else {
      await db.run(
        'UPDATE inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newQuantity, existing.id]
      );
    }

    await this.recordTransaction({
      transaction_type: 'OUT',
      product_code: productCode,
      batch_no: batchNo,
      quantity_change: -quantity,
      operated_by: operatedBy,
      remark: remark || `出库：${productCode}（批号：${batchNo}）`
    });

    return true;
  }

  async recordTransaction(transaction) {
    const { transaction_type, product_code, batch_no, quantity_change, reference_id, reference_type, operated_by, remark } = transaction;
    
    await db.run(`
      INSERT INTO inventory_transactions 
      (transaction_type, product_code, batch_no, quantity_change, reference_id, reference_type, operated_by, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [transaction_type, product_code, batch_no, quantity_change, reference_id, reference_type, operated_by, remark]);
  }

  async getInventory(productCode = null, batchNo = null) {
    let sql = 'SELECT * FROM inventory WHERE 1=1';
    const params = [];

    if (productCode) {
      sql += ' AND product_code = ?';
      params.push(productCode);
    }

    if (batchNo) {
      sql += ' AND batch_no = ?';
      params.push(batchNo);
    }

    sql += ' ORDER BY created_at DESC';

    return await db.all(sql, params);
  }

  async getInventoryTransactions(productCode = null, batchNo = null, limit = 100) {
    let sql = 'SELECT * FROM inventory_transactions WHERE 1=1';
    const params = [];

    if (productCode) {
      sql += ' AND product_code = ?';
      params.push(productCode);
    }

    if (batchNo) {
      sql += ' AND batch_no = ?';
      params.push(batchNo);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    return await db.all(sql, params);
  }

  async getInventorySummary() {
    const result = await db.get(`
      SELECT 
        COUNT(*) as total_skus,
        SUM(quantity) as total_quantity
      FROM inventory
    `);
    return result || { total_skus: 0, total_quantity: 0 };
  }
}

module.exports = new InventoryService();
