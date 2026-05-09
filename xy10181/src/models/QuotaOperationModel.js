const db = require('../config/database');

class QuotaOperationModel {
  static async create(data, client) {
    const result = await client.query(`
      INSERT INTO quota_operations (
        quota_id, quota_code, approval_record_id, 
        request_id, operation_type, amount, operator, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      data.quotaId,
      data.quotaCode,
      data.approvalRecordId,
      data.requestId,
      data.operationType,
      data.amount,
      data.operator,
      data.description,
    ]);
    return result.rows[0];
  }

  static async findByRequestId(requestId, operationType = null, client = null) {
    const query = db || client;
    let sql = `SELECT * FROM quota_operations WHERE request_id = $1`;
    const params = [requestId];
    
    if (operationType) {
      sql += ` AND operation_type = $2`;
      params.push(operationType);
    }
    
    const result = await query.query(sql, params);
    return result.rows;
  }

  static async getQuotaOperations(quotaId, limit = 100, client = null) {
    const query = db || client;
    const result = await query.query(`
      SELECT * FROM quota_operations 
      WHERE quota_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `, [quotaId, limit]);
    return result.rows;
  }

  static async getStatistics(client = null) {
    const query = db || client;
    const result = await query.query(`
      SELECT 
        operation_type,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM quota_operations
      GROUP BY operation_type
    `);
    return result.rows;
  }
}

module.exports = QuotaOperationModel;
