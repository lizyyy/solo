const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../utils/logger');
const AuditService = require('./auditService');

class TransferService {
  static async generateOrderNo() {
    const date = new Date();
    const prefix = `TO${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    
    const query = `
      SELECT order_no FROM transfer_orders 
      WHERE order_no LIKE $1 
      ORDER BY order_no DESC 
      LIMIT 1
    `;
    
    const result = await db.query(query, [`${prefix}%`]);
    
    let sequence = '0001';
    if (result.rows.length > 0) {
      const lastNo = result.rows[0].order_no;
      const lastSeq = parseInt(lastNo.slice(-4)) + 1;
      sequence = String(lastSeq).padStart(4, '0');
    }
    
    return `${prefix}${sequence}`;
  }

  static async getTransferOrders(filters = {}) {
    let query = `
      SELECT 
        to.*,
        fs.name as from_store_name,
        ts.name as to_store_name,
        cu.full_name as created_by_name,
        au.full_name as approved_by_name,
        su.full_name as shipped_by_name,
        ru.full_name as received_by_name
      FROM transfer_orders to
      LEFT JOIN stores fs ON to.from_store_id = fs.id
      LEFT JOIN stores ts ON to.to_store_id = ts.id
      LEFT JOIN users cu ON to.created_by = cu.id
      LEFT JOIN users au ON to.approved_by = au.id
      LEFT JOIN users su ON to.shipped_by = su.id
      LEFT JOIN users ru ON to.received_by = ru.id
      WHERE 1=1
    `;
    
    const values = [];
    let paramIndex = 1;
    
    if (filters.fromStoreId) {
      query += ` AND to.from_store_id = $${paramIndex}`;
      values.push(filters.fromStoreId);
      paramIndex++;
    }
    
    if (filters.toStoreId) {
      query += ` AND to.to_store_id = $${paramIndex}`;
      values.push(filters.toStoreId);
      paramIndex++;
    }
    
    if (filters.status) {
      query += ` AND to.status = $${paramIndex}`;
      values.push(filters.status);
      paramIndex++;
    }
    
    query += ` ORDER BY to.created_at DESC`;
    
    if (filters.limit) {
      query += ` LIMIT $${paramIndex}`;
      values.push(filters.limit);
      paramIndex++;
    }
    
    const result = await db.query(query, values);
    return result.rows;
  }

  static async getTransferOrderById(orderId) {
    const query = `
      SELECT 
        to.*,
        fs.name as from_store_name,
        ts.name as to_store_name,
        cu.full_name as created_by_name,
        au.full_name as approved_by_name,
        su.full_name as shipped_by_name,
        ru.full_name as received_by_name
      FROM transfer_orders to
      LEFT JOIN stores fs ON to.from_store_id = fs.id
      LEFT JOIN stores ts ON to.to_store_id = ts.id
      LEFT JOIN users cu ON to.created_by = cu.id
      LEFT JOIN users au ON to.approved_by = au.id
      LEFT JOIN users su ON to.shipped_by = su.id
      LEFT JOIN users ru ON to.received_by = ru.id
      WHERE to.id = $1
    `;
    
    const result = await db.query(query, [orderId]);
    return result.rows[0];
  }

  static async getTransferOrderItems(orderId) {
    const query = `
      SELECT 
        toi.*,
        p.sku,
        p.name as product_name,
        p.unit,
        ib.batch_no,
        ib.expiry_date
      FROM transfer_order_items toi
      JOIN products p ON toi.product_id = p.id
      LEFT JOIN inventory_batches ib ON toi.batch_id = ib.id
      WHERE toi.order_id = $1
      ORDER BY toi.created_at ASC
    `;
    
    const result = await db.query(query, [orderId]);
    return result.rows;
  }

  static async createTransferOrder(orderData, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const orderNo = await this.generateOrderNo();
      
      const insertQuery = `
        INSERT INTO transfer_orders (
          id, order_no, from_store_id, to_store_id, status, priority,
          transfer_type, reason, remark, total_quantity, total_amount,
          created_by
        ) VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, 0, 0, $9)
        RETURNING *
      `;
      
      const values = [
        uuidv4(),
        orderNo,
        orderData.from_store_id,
        orderData.to_store_id,
        orderData.priority || 'normal',
        orderData.transfer_type || 'normal',
        orderData.reason,
        orderData.remark,
        userId
      ];
      
      const result = await client.query(insertQuery, values);
      const newOrder = result.rows[0];
      
      if (orderData.items && orderData.items.length > 0) {
        await this.addOrderItems(client, newOrder.id, orderData.items);
      }
      
      await AuditService.logOperation(
        userId,
        'CREATE',
        'transfer_orders',
        newOrder.id,
        null,
        newOrder,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Transfer order created: ${newOrder.order_no}`);
      return await this.getTransferOrderById(newOrder.id);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating transfer order:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async addOrderItems(client, orderId, items) {
    for (const item of items) {
      const itemQuery = `
        INSERT INTO transfer_order_items (
          id, order_id, product_id, batch_id, requested_quantity,
          shipped_quantity, received_quantity, rejected_quantity,
          unit_price, amount, remark
        ) VALUES ($1, $2, $3, $4, $5, 0, 0, 0, $6, $7, $8)
      `;
      
      await client.query(itemQuery, [
        uuidv4(),
        orderId,
        item.product_id,
        item.batch_id,
        item.requested_quantity,
        item.unit_price || 0,
        (item.unit_price || 0) * item.requested_quantity,
        item.remark
      ]);
    }
    
    const updateQuery = `
      UPDATE transfer_orders 
      SET total_quantity = (
        SELECT SUM(requested_quantity) FROM transfer_order_items WHERE order_id = $1
      ),
      total_amount = (
        SELECT SUM(amount) FROM transfer_order_items WHERE order_id = $1
      )
      WHERE id = $1
    `;
    
    await client.query(updateQuery, [orderId]);
  }

  static async submitTransferOrder(orderId, userId, clientId, requestId, ipAddress, userAgent) {
    return this.updateOrderStatus(
      orderId,
      'submitted',
      'SUBMIT',
      userId,
      clientId,
      requestId,
      ipAddress,
      userAgent,
      null
    );
  }

  static async approveTransferOrder(orderId, userId, clientId, requestId, ipAddress, userAgent) {
    return this.updateOrderStatus(
      orderId,
      'approved',
      'APPROVE',
      userId,
      clientId,
      requestId,
      ipAddress,
      userAgent,
      { approved_by: userId, approved_at: new Date() }
    );
  }

  static async rejectTransferOrder(orderId, rejectReason, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const beforeQuery = `SELECT * FROM transfer_orders WHERE id = $1`;
      const beforeResult = await client.query(beforeQuery, [orderId]);
      const beforeData = beforeResult.rows[0];
      
      const updateQuery = `
        UPDATE transfer_orders
        SET status = 'rejected',
            rejected_by = $1,
            rejected_at = CURRENT_TIMESTAMP,
            reject_reason = $2
        WHERE id = $3
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, [userId, rejectReason, orderId]);
      const updatedOrder = result.rows[0];
      
      await AuditService.logOperation(
        userId,
        'REJECT',
        'transfer_orders',
        orderId,
        beforeData,
        updatedOrder,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Transfer order rejected: ${orderId}`);
      return updatedOrder;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error rejecting transfer order:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async shipTransferOrder(orderId, items, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const beforeQuery = `SELECT * FROM transfer_orders WHERE id = $1`;
      const beforeResult = await client.query(beforeQuery, [orderId]);
      const beforeData = beforeResult.rows[0];
      
      for (const item of items) {
        const updateItemQuery = `
          UPDATE transfer_order_items
          SET shipped_quantity = $1
          WHERE id = $2
          RETURNING *
        `;
        
        const itemResult = await client.query(updateItemQuery, [item.shipped_quantity, item.id]);
        const updatedItem = itemResult.rows[0];
        
        const updateBatchQuery = `
          UPDATE inventory_batches
          SET available_quantity = available_quantity - $1,
              locked_quantity = locked_quantity + $1
          WHERE id = $2 AND available_quantity >= $1
          RETURNING *
        `;
        
        const batchResult = await client.query(updateBatchQuery, [
          item.shipped_quantity,
          item.batch_id
        ]);
        
        if (batchResult.rows.length === 0) {
          throw new Error(`Insufficient stock for batch ${item.batch_id}`);
        }
      }
      
      const updateOrderQuery = `
        UPDATE transfer_orders
        SET status = 'shipped',
            shipped_by = $1,
            shipped_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      
      const orderResult = await client.query(updateOrderQuery, [userId, orderId]);
      const updatedOrder = orderResult.rows[0];
      
      await AuditService.logOperation(
        userId,
        'SHIP',
        'transfer_orders',
        orderId,
        beforeData,
        updatedOrder,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Transfer order shipped: ${orderId}`);
      return updatedOrder;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error shipping transfer order:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async receiveTransferOrder(orderId, items, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const beforeQuery = `SELECT * FROM transfer_orders WHERE id = $1`;
      const beforeResult = await client.query(beforeQuery, [orderId]);
      const beforeData = beforeResult.rows[0];
      const order = beforeData;
      
      for (const item of items) {
        const getItemQuery = `SELECT * FROM transfer_order_items WHERE id = $1`;
        const itemResult = await client.query(getItemQuery, [item.id]);
        const orderItem = itemResult.rows[0];
        
        const updateItemQuery = `
          UPDATE transfer_order_items
          SET received_quantity = $1,
              rejected_quantity = $2
          WHERE id = $3
          RETURNING *
        `;
        
        await client.query(updateItemQuery, [
          item.received_quantity,
          item.rejected_quantity,
          item.id
        ]);
        
        if (item.received_quantity > 0) {
          const newBatchQuery = `
            INSERT INTO inventory_batches (
              id, store_id, product_id, batch_no, quantity, available_quantity,
              production_date, expiry_date, inbound_date, status
            ) SELECT
              $1, $2, $3, $4, $5, $5, $6, $7, CURRENT_DATE, 'normal'
            RETURNING *
          `;
          
          const originalBatchQuery = `SELECT * FROM inventory_batches WHERE id = $1`;
          const originalBatchResult = await client.query(originalBatchQuery, [orderItem.batch_id]);
          const originalBatch = originalBatchResult.rows[0];
          
          await client.query(newBatchQuery, [
            uuidv4(),
            order.to_store_id,
            orderItem.product_id,
            originalBatch.batch_no,
            item.received_quantity,
            originalBatch.production_date,
            originalBatch.expiry_date
          ]);
        }
        
        if (item.shipped_quantity > 0) {
          const unlockBatchQuery = `
            UPDATE inventory_batches
            SET locked_quantity = locked_quantity - $1
            WHERE id = $2
            RETURNING *
          `;
          
          await client.query(unlockBatchQuery, [
            item.shipped_quantity,
            orderItem.batch_id
          ]);
        }
      }
      
      const updateOrderQuery = `
        UPDATE transfer_orders
        SET status = 'received',
            received_by = $1,
            received_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      
      const orderResult = await client.query(updateOrderQuery, [userId, orderId]);
      const updatedOrder = orderResult.rows[0];
      
      await AuditService.logOperation(
        userId,
        'RECEIVE',
        'transfer_orders',
        orderId,
        beforeData,
        updatedOrder,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Transfer order received: ${orderId}`);
      return updatedOrder;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error receiving transfer order:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateOrderStatus(orderId, newStatus, operationType, userId, clientId, requestId, ipAddress, userAgent, extraUpdates = {}) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const beforeQuery = `SELECT * FROM transfer_orders WHERE id = $1`;
      const beforeResult = await client.query(beforeQuery, [orderId]);
      const beforeData = beforeResult.rows[0];
      
      const setClauses = ['status = $1'];
      const values = [newStatus];
      let paramIndex = 2;
      
      for (const [key, value] of Object.entries(extraUpdates)) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
      
      values.push(orderId);
      
      const updateQuery = `
        UPDATE transfer_orders
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, values);
      const updatedOrder = result.rows[0];
      
      await AuditService.logOperation(
        userId,
        operationType,
        'transfer_orders',
        orderId,
        beforeData,
        updatedOrder,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Transfer order ${operationType.toLowerCase()}: ${orderId}`);
      return updatedOrder;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error ${operationType.toLowerCase()} transfer order:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async lockStockForTransfer(fromStoreId, items, userId, requestId) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      for (const item of items) {
        const lockQuery = `
          INSERT INTO stock_locks (
            id, store_id, product_id, batch_id, quantity, lock_type,
            reference_type, reason, locked_by, status
          ) VALUES ($1, $2, $3, $4, $5, 'transfer',
            'transfer_order', '调拨锁定', $6, 'locked')
        `;
        
        await client.query(lockQuery, [
          uuidv4(),
          fromStoreId,
          item.product_id,
          item.batch_id,
          item.requested_quantity,
          userId
        ]);
        
        const updateBatchQuery = `
          UPDATE inventory_batches
          SET available_quantity = available_quantity - $1,
              locked_quantity = locked_quantity + $1
          WHERE id = $2 AND available_quantity >= $1
          RETURNING *
        `;
        
        const result = await client.query(updateBatchQuery, [
          item.requested_quantity,
          item.batch_id
        ]);
        
        if (result.rows.length === 0) {
          throw new Error(`Insufficient available stock for product ${item.product_id}`);
        }
      }
      
      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = TransferService;
