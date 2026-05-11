const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../utils/logger');
const AuditService = require('./auditService');

class ProductService {
  static async getAllProducts(filters = {}) {
    let query = `SELECT * FROM products WHERE is_active = true`;
    const values = [];
    let paramIndex = 1;
    
    if (filters.category) {
      query += ` AND category = $${paramIndex}`;
      values.push(filters.category);
      paramIndex++;
    }
    
    if (filters.keyword) {
      query += ` AND (name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex})`;
      values.push(`%${filters.keyword}%`);
      paramIndex++;
    }
    
    query += ` ORDER BY updated_at DESC`;
    
    const result = await db.query(query, values);
    return result.rows;
  }

  static async getProductById(productId) {
    const query = `SELECT * FROM products WHERE id = $1`;
    const result = await db.query(query, [productId]);
    return result.rows[0];
  }

  static async createProduct(productData, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const query = `
        INSERT INTO products (
          id, sku, name, bar_code, category, unit, spec, brand,
          original_price, cost_price, min_stock_level, max_stock_level,
          description, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
        RETURNING *
      `;
      
      const values = [
        uuidv4(),
        productData.sku,
        productData.name,
        productData.bar_code,
        productData.category,
        productData.unit,
        productData.spec,
        productData.brand,
        productData.original_price || 0,
        productData.cost_price || 0,
        productData.min_stock_level || 0,
        productData.max_stock_level || 0,
        productData.description
      ];
      
      const result = await client.query(query, values);
      const newProduct = result.rows[0];
      
      await AuditService.logOperation(
        userId,
        'CREATE',
        'products',
        newProduct.id,
        null,
        newProduct,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Product created: ${newProduct.sku}`);
      return newProduct;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating product:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateProduct(productId, updateData, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const beforeQuery = `SELECT * FROM products WHERE id = $1`;
      const beforeResult = await client.query(beforeQuery, [productId]);
      
      if (beforeResult.rows.length === 0) {
        throw new Error('Product not found');
      }
      
      const beforeData = beforeResult.rows[0];
      
      const setClauses = [];
      const values = [];
      let paramIndex = 1;
      
      const allowedFields = ['name', 'bar_code', 'category', 'unit', 'spec', 'brand', 
                            'original_price', 'cost_price', 'min_stock_level', 
                            'max_stock_level', 'description', 'is_active'];
      
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
      
      values.push(productId);
      
      const query = `
        UPDATE products 
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      
      const result = await client.query(query, values);
      const updatedProduct = result.rows[0];
      
      await AuditService.logOperation(
        userId,
        'UPDATE',
        'products',
        productId,
        beforeData,
        updatedProduct,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Product updated: ${productId}`);
      return updatedProduct;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating product:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async getProductCategories() {
    const query = `
      SELECT DISTINCT category 
      FROM products 
      WHERE is_active = true AND category IS NOT NULL
      ORDER BY category
    `;
    
    const result = await db.query(query);
    return result.rows.map(row => row.category);
  }
}

module.exports = ProductService;
