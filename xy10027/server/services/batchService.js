const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../utils/logger');
const AuditService = require('./auditService');

class BatchService {
  static async getBatchesByStore(storeId, filters = {}) {
    let query = `
      SELECT 
        ib.*,
        p.sku,
        p.name as product_name,
        p.original_price,
        p.unit
      FROM inventory_batches ib
      JOIN products p ON ib.product_id = p.id
      WHERE ib.store_id = $1
    `;
    
    const values = [storeId];
    let paramIndex = 2;
    
    if (filters.status) {
      query += ` AND ib.status = $${paramIndex}`;
      values.push(filters.status);
      paramIndex++;
    }
    
    if (filters.expiringSoon) {
      query += ` AND (ib.expiry_date - CURRENT_DATE) <= 30`;
    }
    
    if (filters.expired) {
      query += ` AND ib.expiry_date < CURRENT_DATE`;
    }
    
    if (filters.productId) {
      query += ` AND ib.product_id = $${paramIndex}`;
      values.push(filters.productId);
      paramIndex++;
    }
    
    query += ` ORDER BY ib.expiry_date ASC, ib.created_at DESC`;
    
    const result = await db.query(query, values);
    return result.rows;
  }

  static async getBatchById(batchId) {
    const query = `
      SELECT 
        ib.*,
        p.sku,
        p.name as product_name,
        p.original_price,
        p.unit
      FROM inventory_batches ib
      JOIN products p ON ib.product_id = p.id
      WHERE ib.id = $1
    `;
    
    const result = await db.query(query, [batchId]);
    return result.rows[0];
  }

  static async createBatch(batchData, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const query = `
        INSERT INTO inventory_batches (
          id, store_id, product_id, batch_no, quantity, available_quantity,
          locked_quantity, production_date, expiry_date, inbound_date,
          supplier, purchase_price, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, CURRENT_DATE, $9, $10, 'normal')
        RETURNING *
      `;
      
      const values = [
        uuidv4(),
        batchData.store_id,
        batchData.product_id,
        batchData.batch_no,
        batchData.quantity,
        batchData.quantity,
        batchData.production_date,
        batchData.expiry_date,
        batchData.supplier,
        batchData.purchase_price || 0
      ];
      
      const result = await client.query(query, values);
      const newBatch = result.rows[0];
      
      await this.updateStoreInventory(client, batchData.store_id, batchData.product_id);
      
      await AuditService.logOperation(
        userId,
        'CREATE',
        'inventory_batches',
        newBatch.id,
        null,
        newBatch,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Batch created: ${newBatch.id}`);
      return newBatch;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating batch:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateBatchQuantity(batchId, quantityChange, reason, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const beforeQuery = `SELECT * FROM inventory_batches WHERE id = $1`;
      const beforeResult = await client.query(beforeQuery, [batchId]);
      
      if (beforeResult.rows.length === 0) {
        throw new Error('Batch not found');
      }
      
      const beforeData = beforeResult.rows[0];
      
      const newQuantity = beforeData.quantity + quantityChange;
      const newAvailableQuantity = beforeData.available_quantity + quantityChange;
      
      if (newQuantity < 0 || newAvailableQuantity < 0) {
        throw new Error('Cannot have negative quantity');
      }
      
      const updateQuery = `
        UPDATE inventory_batches
        SET quantity = $1,
            available_quantity = $2
        WHERE id = $3
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, [
        newQuantity,
        newAvailableQuantity,
        batchId
      ]);
      
      const updatedBatch = result.rows[0];
      
      await this.updateStoreInventory(client, beforeData.store_id, beforeData.product_id);
      
      await AuditService.logOperation(
        userId,
        'UPDATE_QUANTITY',
        'inventory_batches',
        batchId,
        { ...beforeData, changeReason: reason },
        { ...updatedBatch, changeReason: reason },
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Batch quantity updated: ${batchId}, change: ${quantityChange}`);
      return updatedBatch;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating batch quantity:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateStoreInventory(client, storeId, productId) {
    const summaryQuery = `
      SELECT 
        COALESCE(SUM(quantity), 0) as total_quantity,
        COALESCE(SUM(available_quantity), 0) as available_quantity,
        COALESCE(SUM(locked_quantity), 0) as locked_quantity,
        COALESCE(SUM(CASE WHEN status = 'expiring_soon' THEN quantity ELSE 0 END), 0) as expiring_soon_quantity,
        COALESCE(SUM(CASE WHEN status = 'expired' THEN quantity ELSE 0 END), 0) as expired_quantity,
        MAX(inbound_date) as last_inbound_date
      FROM inventory_batches
      WHERE store_id = $1 AND product_id = $2
    `;
    
    const summaryResult = await client.query(summaryQuery, [storeId, productId]);
    const summary = summaryResult.rows[0];
    
    const upsertQuery = `
      INSERT INTO store_inventory (
        id, store_id, product_id, total_quantity, available_quantity,
        locked_quantity, expiring_soon_quantity, expired_quantity, last_inbound_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (store_id, product_id) DO UPDATE SET
        total_quantity = EXCLUDED.total_quantity,
        available_quantity = EXCLUDED.available_quantity,
        locked_quantity = EXCLUDED.locked_quantity,
        expiring_soon_quantity = EXCLUDED.expiring_soon_quantity,
        expired_quantity = EXCLUDED.expired_quantity,
        last_inbound_date = EXCLUDED.last_inbound_date
      RETURNING *
    `;
    
    await client.query(upsertQuery, [
      uuidv4(),
      storeId,
      productId,
      summary.total_quantity,
      summary.available_quantity,
      summary.locked_quantity,
      summary.expiring_soon_quantity,
      summary.expired_quantity,
      summary.last_inbound_date
    ]);
  }

  static async getStoreInventory(storeId, filters = {}) {
    let query = `
      SELECT 
        si.*,
        p.sku,
        p.name as product_name,
        p.original_price,
        p.unit
      FROM store_inventory si
      JOIN products p ON si.product_id = p.id
      WHERE si.store_id = $1
    `;
    
    const values = [storeId];
    let paramIndex = 2;
    
    if (filters.hasExpiring) {
      query += ` AND si.expiring_soon_quantity > 0`;
    }
    
    if (filters.hasExpired) {
      query += ` AND si.expired_quantity > 0`;
    }
    
    query += ` ORDER BY si.updated_at DESC`;
    
    const result = await db.query(query, values);
    return result.rows;
  }

  static async getExpiringBatches(storeId, daysThreshold = 30) {
    const query = `
      SELECT 
        ib.*,
        p.sku,
        p.name as product_name,
        p.original_price,
        p.unit,
        (ib.expiry_date - CURRENT_DATE) as days_until_expiry
      FROM inventory_batches ib
      JOIN products p ON ib.product_id = p.id
      WHERE ib.store_id = $1
        AND (ib.expiry_date - CURRENT_DATE) <= $2
        AND ib.expiry_date >= CURRENT_DATE
        AND ib.available_quantity > 0
      ORDER BY ib.expiry_date ASC
    `;
    
    const result = await db.query(query, [storeId, daysThreshold]);
    return result.rows;
  }

  static async getExpiredBatches(storeId) {
    const query = `
      SELECT 
        ib.*,
        p.sku,
        p.name as product_name,
        p.original_price,
        p.unit,
        (CURRENT_DATE - ib.expiry_date) as days_expired
      FROM inventory_batches ib
      JOIN products p ON ib.product_id = p.id
      WHERE ib.store_id = $1
        AND ib.expiry_date < CURRENT_DATE
        AND ib.available_quantity > 0
      ORDER BY ib.expiry_date DESC
    `;
    
    const result = await db.query(query, [storeId]);
    return result.rows;
  }
}

module.exports = BatchService;
