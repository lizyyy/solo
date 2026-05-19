const db = require('../database');
const inventoryService = require('./inventoryService');
const validationService = require('./validationService');

class DeliveryService {
  async getDeliveryOrders(page = 1, pageSize = 20, status = null) {
    let sql = 'SELECT * FROM delivery_orders WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, (page - 1) * pageSize);

    const orders = await db.all(sql, params);
    
    const countResult = await db.get('SELECT COUNT(*) as total FROM delivery_orders');

    return {
      orders,
      pagination: {
        page,
        pageSize,
        total: countResult.total
      }
    };
  }

  async getDeliveryOrderById(orderId) {
    const order = await db.get('SELECT * FROM delivery_orders WHERE id = ?', [orderId]);
    if (!order) return null;

    const items = await db.all(`
      SELECT * FROM delivery_items 
      WHERE order_id = ?
      ORDER BY id
    `, [orderId]);

    return {
      ...order,
      items: items.map(item => ({
        ...item,
        validation_details: item.validation_details ? JSON.parse(item.validation_details) : null
      }))
    };
  }

  async getDeliveryItems(orderId, isValid = null) {
    let sql = 'SELECT * FROM delivery_items WHERE order_id = ?';
    const params = [orderId];

    if (isValid !== null) {
      sql += ' AND is_valid = ?';
      params.push(isValid ? 1 : 0);
    }

    sql += ' ORDER BY id';

    const items = await db.all(sql, params);
    return items.map(item => ({
      ...item,
      validation_details: item.validation_details ? JSON.parse(item.validation_details) : null
    }));
  }

  async reviewDeliveryItem(itemId, reviewedBy, approved = true, remark = '') {
    const item = await db.get('SELECT * FROM delivery_items WHERE id = ?', [itemId]);
    if (!item) {
      throw new Error('送货单明细不存在');
    }

    if (item.review_status === 'reviewed') {
      throw new Error('该明细已复核，不能重复复核');
    }

    const reviewStatus = approved ? 'approved' : 'rejected';
    const status = approved ? 'completed' : 'rejected';

    await db.run(`
      UPDATE delivery_items 
      SET review_status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, status = ?
      WHERE id = ?
    `, [reviewStatus, reviewedBy, status, itemId]);

    if (approved && item.is_valid) {
      await inventoryService.addToInventory(item, reviewedBy);
    }

    await this.updateOrderStatus(item.order_id);

    return {
      itemId,
      reviewStatus,
      approved,
      remark
    };
  }

  async reviewDeliveryOrder(orderId, reviewedBy, approvedItemIds = []) {
    const items = await this.getDeliveryItems(orderId);
    
    if (items.length === 0) {
      throw new Error('送货单没有明细');
    }

    let successCount = 0;
    let failCount = 0;
    const results = [];

    for (const item of items) {
      const isApproved = approvedItemIds.includes(item.id);
      
      try {
        await this.reviewDeliveryItem(item.id, reviewedBy, isApproved);
        successCount++;
        results.push({
          itemId: item.id,
          product_code: item.product_code,
          batch_no: item.batch_no,
          success: true,
          approved: isApproved
        });
      } catch (error) {
        failCount++;
        results.push({
          itemId: item.id,
          product_code: item.product_code,
          batch_no: item.batch_no,
          success: false,
          error: error.message
        });
      }
    }

    return {
      orderId,
      totalCount: items.length,
      successCount,
      failCount,
      results
    };
  }

  async updateOrderStatus(orderId) {
    const result = await db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN review_status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN review_status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN review_status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM delivery_items
      WHERE order_id = ?
    `, [orderId]);

    let status = 'pending';
    if (result.pending === 0) {
      status = result.approved > 0 ? 'completed' : 'rejected';
    } else if (result.approved > 0 || result.rejected > 0) {
      status = 'reviewing';
    }

    await db.run(`
      UPDATE delivery_orders 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, orderId]);

    return status;
  }

  async deleteDeliveryOrder(orderId) {
    const order = await this.getDeliveryOrderById(orderId);
    if (!order) {
      throw new Error('送货单不存在');
    }

    if (order.status !== 'pending' && order.status !== 'invalid') {
      throw new Error('只能删除待处理或无效的送货单');
    }

    await db.run('DELETE FROM delivery_items WHERE order_id = ?', [orderId]);
    await db.run('DELETE FROM delivery_orders WHERE id = ?', [orderId]);

    return true;
  }

  async revalidateDeliveryOrder(orderId) {
    const items = await this.getDeliveryItems(orderId);
    
    let validCount = 0;
    let invalidCount = 0;

    for (const item of items) {
      const validation = await validationService.validateDeliveryItem(item, orderId);
      
      await db.run(`
        UPDATE delivery_items 
        SET status = ?, validation_result = ?, validation_details = ?, is_valid = ?
        WHERE id = ?
      `, [
        validation.status,
        validation.validationResult,
        validation.validationDetails,
        validation.isValid ? 1 : 0,
        item.id
      ]);

      if (validation.isValid) {
        validCount++;
      } else {
        invalidCount++;
      }
    }

    await db.run(`
      UPDATE delivery_orders 
      SET valid_items = ?, invalid_items = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [validCount, invalidCount, orderId]);

    return {
      orderId,
      totalCount: items.length,
      validCount,
      invalidCount
    };
  }

  async getDeliveryStatistics() {
    const result = await db.get(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_orders,
        SUM(total_items) as total_items,
        SUM(valid_items) as valid_items,
        SUM(invalid_items) as invalid_items
      FROM delivery_orders
    `);

    return result || {
      total_orders: 0,
      pending_orders: 0,
      completed_orders: 0,
      rejected_orders: 0,
      total_items: 0,
      valid_items: 0,
      invalid_items: 0
    };
  }
}

module.exports = new DeliveryService();
