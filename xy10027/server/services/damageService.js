const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../utils/logger');
const AuditService = require('./auditService');

class DamageService {
  static async generateReportNo() {
    const date = new Date();
    const prefix = `DR${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    
    const query = `
      SELECT report_no FROM damage_reports 
      WHERE report_no LIKE $1 
      ORDER BY report_no DESC 
      LIMIT 1
    `;
    
    const result = await db.query(query, [`${prefix}%`]);
    
    let sequence = '0001';
    if (result.rows.length > 0) {
      const lastNo = result.rows[0].report_no;
      const lastSeq = parseInt(lastNo.slice(-4)) + 1;
      sequence = String(lastSeq).padStart(4, '0');
    }
    
    return `${prefix}${sequence}`;
  }

  static async getDamageReports(filters = {}) {
    let query = `
      SELECT 
        dr.*,
        s.name as store_name,
        cu.full_name as created_by_name,
        au.full_name as approved_by_name
      FROM damage_reports dr
      LEFT JOIN stores s ON dr.store_id = s.id
      LEFT JOIN users cu ON dr.created_by = cu.id
      LEFT JOIN users au ON dr.approved_by = au.id
      WHERE 1=1
    `;
    
    const values = [];
    let paramIndex = 1;
    
    if (filters.storeId) {
      query += ` AND dr.store_id = $${paramIndex}`;
      values.push(filters.storeId);
      paramIndex++;
    }
    
    if (filters.status) {
      query += ` AND dr.status = $${paramIndex}`;
      values.push(filters.status);
      paramIndex++;
    }
    
    if (filters.damageType) {
      query += ` AND dr.damage_type = $${paramIndex}`;
      values.push(filters.damageType);
      paramIndex++;
    }
    
    query += ` ORDER BY dr.created_at DESC`;
    
    const result = await db.query(query, values);
    return result.rows;
  }

  static async getDamageReportById(reportId) {
    const query = `
      SELECT 
        dr.*,
        s.name as store_name,
        cu.full_name as created_by_name,
        au.full_name as approved_by_name
      FROM damage_reports dr
      LEFT JOIN stores s ON dr.store_id = s.id
      LEFT JOIN users cu ON dr.created_by = cu.id
      LEFT JOIN users au ON dr.approved_by = au.id
      WHERE dr.id = $1
    `;
    
    const result = await db.query(query, [reportId]);
    return result.rows[0];
  }

  static async getDamageReportItems(reportId) {
    const query = `
      SELECT 
        dri.*,
        p.sku,
        p.name as product_name,
        p.unit,
        ib.batch_no,
        ib.expiry_date
      FROM damage_report_items dri
      JOIN products p ON dri.product_id = p.id
      LEFT JOIN inventory_batches ib ON dri.batch_id = ib.id
      WHERE dri.report_id = $1
      ORDER BY dri.created_at ASC
    `;
    
    const result = await db.query(query, [reportId]);
    return result.rows;
  }

  static async createDamageReport(reportData, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const reportNo = await this.generateReportNo();
      
      const insertQuery = `
        INSERT INTO damage_reports (
          id, report_no, store_id, status, total_quantity, total_amount,
          damage_type, reason, created_by
        ) VALUES ($1, $2, $3, 'pending', 0, 0, $4, $5, $6)
        RETURNING *
      `;
      
      const values = [
        uuidv4(),
        reportNo,
        reportData.store_id,
        reportData.damage_type || 'normal',
        reportData.reason,
        userId
      ];
      
      const result = await client.query(insertQuery, values);
      const newReport = result.rows[0];
      
      if (reportData.items && reportData.items.length > 0) {
        await this.addReportItems(client, newReport.id, reportData.items);
      }
      
      await AuditService.logOperation(
        userId,
        'CREATE',
        'damage_reports',
        newReport.id,
        null,
        newReport,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Damage report created: ${newReport.report_no}`);
      return await this.getDamageReportById(newReport.id);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating damage report:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async addReportItems(client, reportId, items) {
    let totalQuantity = 0;
    let totalAmount = 0;
    
    for (const item of items) {
      const amount = (item.unit_price || 0) * item.quantity;
      
      const itemQuery = `
        INSERT INTO damage_report_items (
          id, report_id, product_id, batch_id, quantity,
          unit_price, amount, damage_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      
      await client.query(itemQuery, [
        uuidv4(),
        reportId,
        item.product_id,
        item.batch_id,
        item.quantity,
        item.unit_price || 0,
        amount,
        item.damage_reason
      ]);
      
      totalQuantity += item.quantity;
      totalAmount += amount;
    }
    
    const updateQuery = `
      UPDATE damage_reports 
      SET total_quantity = $1, total_amount = $2
      WHERE id = $3
    `;
    
    await client.query(updateQuery, [totalQuantity, totalAmount, reportId]);
  }

  static async submitDamageReport(reportId, userId, clientId, requestId, ipAddress, userAgent) {
    return this.updateReportStatus(
      reportId,
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

  static async approveDamageReport(reportId, approveData, userId, clientId, requestId, ipAddress, userAgent) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const beforeQuery = `SELECT * FROM damage_reports WHERE id = $1`;
      const beforeResult = await client.query(beforeQuery, [reportId]);
      const beforeData = beforeResult.rows[0];
      
      const itemsQuery = `SELECT * FROM damage_report_items WHERE report_id = $1`;
      const itemsResult = await client.query(itemsQuery, [reportId]);
      
      if (approveData.approved_status === 'approved') {
        for (const item of itemsResult.rows) {
          const updateBatchQuery = `
            UPDATE inventory_batches
            SET quantity = quantity - $1,
                available_quantity = available_quantity - $1
            WHERE id = $2 AND quantity >= $1
            RETURNING *
          `;
          
          const batchResult = await client.query(updateBatchQuery, [
            item.quantity,
            item.batch_id
          ]);
          
          if (batchResult.rows.length === 0) {
            throw new Error(`Insufficient stock for batch ${item.batch_id}`);
          }
        }
      }
      
      const updateQuery = `
        UPDATE damage_reports
        SET status = $1,
            approved_by = $2,
            approved_at = CURRENT_TIMESTAMP,
            approved_status = $3,
            approve_remark = $4
        WHERE id = $5
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, [
        'processed',
        userId,
        approveData.approved_status,
        approveData.approve_remark,
        reportId
      ]);
      
      const updatedReport = result.rows[0];
      
      await AuditService.logOperation(
        userId,
        'APPROVE',
        'damage_reports',
        reportId,
        beforeData,
        updatedReport,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Damage report ${approveData.approved_status}: ${reportId}`);
      return updatedReport;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error approving damage report:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateReportStatus(reportId, newStatus, operationType, userId, clientId, requestId, ipAddress, userAgent, extraUpdates = {}) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const beforeQuery = `SELECT * FROM damage_reports WHERE id = $1`;
      const beforeResult = await client.query(beforeQuery, [reportId]);
      const beforeData = beforeResult.rows[0];
      
      const setClauses = ['status = $1'];
      const values = [newStatus];
      let paramIndex = 2;
      
      for (const [key, value] of Object.entries(extraUpdates)) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
      
      values.push(reportId);
      
      const updateQuery = `
        UPDATE damage_reports
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, values);
      const updatedReport = result.rows[0];
      
      await AuditService.logOperation(
        userId,
        operationType,
        'damage_reports',
        reportId,
        beforeData,
        updatedReport,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        'success'
      );
      
      await client.query('COMMIT');
      
      logger.info(`Damage report ${operationType.toLowerCase()}: ${reportId}`);
      return updatedReport;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error ${operationType.toLowerCase()} damage report:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = DamageService;
