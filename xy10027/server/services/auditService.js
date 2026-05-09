const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../utils/logger');

class AuditService {
  static async logOperation(
    userId,
    operationType,
    resourceType,
    resourceId,
    beforeData,
    afterData,
    requestId,
    clientId,
    ipAddress,
    userAgent,
    status = 'success',
    errorMessage = null
  ) {
    try {
      const query = `
        INSERT INTO operation_logs (
          id, user_id, operation_type, resource_type, resource_id,
          before_data, after_data, request_id, client_id,
          ip_address, user_agent, status, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `;
      
      const values = [
        uuidv4(),
        userId,
        operationType,
        resourceType,
        resourceId,
        beforeData ? JSON.stringify(beforeData) : null,
        afterData ? JSON.stringify(afterData) : null,
        requestId,
        clientId,
        ipAddress,
        userAgent,
        status,
        errorMessage
      ];
      
      await db.query(query, values);
      logger.info(`Audit log: ${operationType} on ${resourceType} by user ${userId}`);
    } catch (error) {
      logger.error('Error creating audit log:', error);
    }
  }

  static async getOperationHistory(resourceType, resourceId, limit = 100) {
    const query = `
      SELECT * FROM operation_logs 
      WHERE resource_type = $1 AND resource_id = $2
      ORDER BY timestamp DESC
      LIMIT $3
    `;
    
    const result = await db.query(query, [resourceType, resourceId, limit]);
    return result.rows;
  }

  static async getUserHistory(userId, limit = 100) {
    const query = `
      SELECT * FROM operation_logs 
      WHERE user_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;
    
    const result = await db.query(query, [userId, limit]);
    return result.rows;
  }

  static async replayOperation(logId) {
    const query = `
      SELECT * FROM operation_logs WHERE id = $1
    `;
    
    const result = await db.query(query, [logId]);
    if (result.rows.length === 0) {
      throw new Error('Operation log not found');
    }
    
    return result.rows[0];
  }

  static async getTimeRangeHistory(startTime, endTime, resourceType = null, userId = null) {
    let query = `
      SELECT * FROM operation_logs 
      WHERE timestamp >= $1 AND timestamp <= $2
    `;
    const values = [startTime, endTime];
    
    if (resourceType) {
      query += ' AND resource_type = $3';
      values.push(resourceType);
    }
    
    if (userId) {
      query += ` AND user_id = $${values.length + 1}`;
      values.push(userId);
    }
    
    query += ' ORDER BY timestamp ASC';
    
    const result = await db.query(query, values);
    return result.rows;
  }
}

module.exports = AuditService;
