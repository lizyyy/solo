const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../utils/logger');
const AuditService = require('./auditService');

class StoreService {
  static async getAllStores(filters = {}) {
    let query = `SELECT * FROM stores WHERE is_active = true`;
    const values = [];
    let paramIndex = 1;
    
    if (filters.type) {
      query += ` AND type = $${paramIndex}`;
      values.push(filters.type);
      paramIndex++;
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const result = await db.query(query, values);
    return result.rows;
  }

  static async getStoreById(storeId) {
    const query = `SELECT * FROM stores WHERE id = $1`;
    const result = await db.query(query, [storeId]);
    return result.rows[0];
  }

  static async createStore(storeData, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const query = `
        INSERT INTO stores (
          id, code, name, type, address, phone, manager, is_active, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
        RETURNING *
      `;
      
      const values = [
        uuidv4(),
        storeData.code,
        storeData.name,
        storeData.type || 'store',
        storeData.address,
        storeData.phone,
        storeData.manager,
        userId
      ];
      
      const result = await client.query(query, values);
      const newStore = result.rows[0];
      
      await AuditService.logOperation(
        userId,
        'CREATE',
        'stores',
        newStore.id,
        null,
        newStore,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Store created: ${newStore.id}`);
      return newStore;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating store:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateStore(storeId, updateData, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const beforeQuery = `SELECT * FROM stores WHERE id = $1`;
      const beforeResult = await client.query(beforeQuery, [storeId]);
      
      if (beforeResult.rows.length === 0) {
        throw new Error('Store not found');
      }
      
      const beforeData = beforeResult.rows[0];
      
      const setClauses = [];
      const values = [];
      let paramIndex = 1;
      
      const allowedFields = ['name', 'type', 'address', 'phone', 'manager', 'is_active'];
      allowedFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          setClauses.push(`${field} = $${paramIndex}`);
          values.push(updateData[field]);
          paramIndex++;
        }
      });
      
      if (setClauses.length === 0) {
        return beforeData;
      }
      
      values.push(storeId);
      
      const query = `
        UPDATE stores 
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      
      const result = await client.query(query, values);
      const updatedStore = result.rows[0];
      
      await AuditService.logOperation(
        userId,
        'UPDATE',
        'stores',
        storeId,
        beforeData,
        updatedStore,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Store updated: ${storeId}`);
      return updatedStore;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating store:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = StoreService;
