const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../utils/logger');
const AuditService = require('./auditService');

class DiscountService {
  static async generateSaleNo() {
    const date = new Date();
    const prefix = `DS${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    
    const query = `
      SELECT sale_no FROM discount_sales 
      WHERE sale_no LIKE $1 
      ORDER BY sale_no DESC 
      LIMIT 1
    `;
    
    const result = await db.query(query, [`${prefix}%`]);
    
    let sequence = '0001';
    if (result.rows.length > 0) {
      const lastNo = result.rows[0].sale_no;
      const lastSeq = parseInt(lastNo.slice(-4)) + 1;
      sequence = String(lastSeq).padStart(4, '0');
    }
    
    return `${prefix}${sequence}`;
  }

  static async getDiscountSales(filters = {}) {
    let query = `
      SELECT 
        ds.*,
        s.name as store_name,
        cu.full_name as created_by_name,
        au.full_name as approved_by_name
      FROM discount_sales ds
      LEFT JOIN stores s ON ds.store_id = s.id
      LEFT JOIN users cu ON ds.created_by = cu.id
      LEFT JOIN users au ON ds.approved_by = au.id
      WHERE 1=1
    `;
    
    const values = [];
    let paramIndex = 1;
    
    if (filters.storeId) {
      query += ` AND ds.store_id = $${paramIndex}`;
      values.push(filters.storeId);
      paramIndex++;
    }
    
    if (filters.status) {
      query += ` AND ds.status = $${paramIndex}`;
      values.push(filters.status);
      paramIndex++;
    }
    
    if (filters.active) {
      query += ` AND ds.status = 'active' AND ds.start_date <= CURRENT_DATE AND ds.end_date >= CURRENT_DATE`;
    }
    
    query += ` ORDER BY ds.created_at DESC`;
    
    const result = await db.query(query, values);
    return result.rows;
  }

  static async getDiscountSaleById(saleId) {
    const query = `
      SELECT 
        ds.*,
        s.name as store_name,
        cu.full_name as created_by_name,
        au.full_name as approved_by_name
      FROM discount_sales ds
      LEFT JOIN stores s ON ds.store_id = s.id
      LEFT JOIN users cu ON ds.created_by = cu.id
      LEFT JOIN users au ON ds.approved_by = au.id
      WHERE ds.id = $1
    `;
    
    const result = await db.query(query, [saleId]);
    return result.rows[0];
  }

  static async getDiscountSaleItems(saleId) {
    const query = `
      SELECT 
        dsi.*,
        p.sku,
        p.name as product_name,
        p.unit,
        p.original_price,
        ib.batch_no,
        ib.expiry_date,
        ib.status as batch_status
      FROM discount_sale_items dsi
      JOIN products p ON dsi.product_id = p.id
      LEFT JOIN inventory_batches ib ON dsi.batch_id = ib.id
      WHERE dsi.sale_id = $1
      ORDER BY dsi.created_at ASC
    `;
    
    const result = await db.query(query, [saleId]);
    return result.rows;
  }

  static async createDiscountSale(saleData, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const saleNo = await this.generateSaleNo();
      
      const insertQuery = `
        INSERT INTO discount_sales (
          id, sale_no, store_id, status, discount_type, discount_value,
          min_quantity, start_date, end_date, reason, created_by
        ) VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      
      const values = [
        uuidv4(),
        saleNo,
        saleData.store_id,
        saleData.discount_type || 'percentage',
        saleData.discount_value,
        saleData.min_quantity || 1,
        saleData.start_date,
        saleData.end_date,
        saleData.reason,
        userId
      ];
      
      const result = await client.query(insertQuery, values);
      const newSale = result.rows[0];
      
      if (saleData.items && saleData.items.length > 0) {
        await this.addSaleItems(client, newSale.id, saleData.items, newSale.discount_type, newSale.discount_value);
      }
      
      await AuditService.logOperation(
        userId,
        'CREATE',
        'discount_sales',
        newSale.id,
        null,
        newSale,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Discount sale created: ${newSale.sale_no}`);
      return await this.getDiscountSaleById(newSale.id);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating discount sale:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async addSaleItems(client, saleId, items, discountType, discountValue) {
    for (const item of items) {
      const productQuery = `SELECT original_price FROM products WHERE id = $1`;
      const productResult = await client.query(productQuery, [item.product_id]);
      const originalPrice = productResult.rows[0]?.original_price || 0;
      
      let discountPrice;
      if (item.discount_price) {
        discountPrice = item.discount_price;
      } else if (discountType === 'percentage') {
        discountPrice = originalPrice * (1 - discountValue / 100);
      } else {
        discountPrice = Math.max(0, originalPrice - discountValue);
      }
      
      const itemQuery = `
        INSERT INTO discount_sale_items (
          id, sale_id, product_id, batch_id, original_price,
          discount_price, limit_quantity, sold_quantity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
      `;
      
      await client.query(itemQuery, [
        uuidv4(),
        saleId,
        item.product_id,
        item.batch_id,
        originalPrice,
        discountPrice,
        item.limit_quantity || 0
      ]);
    }
  }

  static async activateDiscountSale(saleId, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const beforeQuery = `SELECT * FROM discount_sales WHERE id = $1`;
      const beforeResult = await client.query(beforeQuery, [saleId]);
      const beforeData = beforeResult.rows[0];
      
      const updateQuery = `
        UPDATE discount_sales
        SET status = 'active',
            approved_by = $1,
            approved_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, [userId, saleId]);
      const updatedSale = result.rows[0];
      
      await AuditService.logOperation(
        userId,
        'ACTIVATE',
        'discount_sales',
        saleId,
        beforeData,
        updatedSale,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Discount sale activated: ${saleId}`);
      return updatedSale;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error activating discount sale:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async deactivateDiscountSale(saleId, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const beforeQuery = `SELECT * FROM discount_sales WHERE id = $1`;
      const beforeResult = await client.query(beforeQuery, [saleId]);
      const beforeData = beforeResult.rows[0];
      
      const updateQuery = `
        UPDATE discount_sales
        SET status = 'inactive'
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, [saleId]);
      const updatedSale = result.rows[0];
      
      await AuditService.logOperation(
        userId,
        'DEACTIVATE',
        'discount_sales',
        saleId,
        beforeData,
        updatedSale,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Discount sale deactivated: ${saleId}`);
      return updatedSale;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error deactivating discount sale:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async getActiveDiscounts(storeId) {
    const today = new Date().toISOString().split('T')[0];
    
    const query = `
      SELECT 
        ds.*,
        s.name as store_name
      FROM discount_sales ds
      LEFT JOIN stores s ON ds.store_id = s.id
      WHERE ds.status = 'active'
        AND ds.start_date <= $1
        AND ds.end_date >= $1
        AND (ds.store_id = $2 OR ds.store_id IS NULL)
      ORDER BY ds.created_at DESC
    `;
    
    const result = await db.query(query, [today, storeId]);
    return result.rows;
  }

  static async getProductDiscounts(storeId, productId) {
    const today = new Date().toISOString().split('T')[0];
    
    const query = `
      SELECT 
        ds.*,
        dsi.*
      FROM discount_sales ds
      JOIN discount_sale_items dsi ON ds.id = dsi.sale_id
      WHERE ds.status = 'active'
        AND ds.start_date <= $1
        AND ds.end_date >= $1
        AND ds.store_id = $2
        AND dsi.product_id = $3
      ORDER BY ds.created_at DESC
    `;
    
    const result = await db.query(query, [today, storeId, productId]);
    return result.rows;
  }
}

module.exports = DiscountService;
