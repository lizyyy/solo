const { run, get, all } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class TimelineService {
  static async record(operationType, entityType, entityId, status, resultType, description, operator = 'system', operationData = {}, failureReason = null, idempotencyKey = null) {
    const timelineId = `TL-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    await run(
      `INSERT INTO operation_timeline 
       (timeline_id, operation_type, entity_type, entity_id, status, result_type, description, operator, operation_data, failure_reason, idempotency_key) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        timelineId,
        operationType,
        entityType,
        entityId,
        status,
        resultType,
        description,
        operator,
        JSON.stringify(operationData),
        failureReason,
        idempotencyKey
      ]
    );

    return timelineId;
  }

  static async getTimeline(filters = {}) {
    let sql = 'SELECT * FROM operation_timeline WHERE 1=1';
    const params = [];

    if (filters.entityType) {
      sql += ' AND entity_type = ?';
      params.push(filters.entityType);
    }

    if (filters.entityId) {
      sql += ' AND entity_id = ?';
      params.push(filters.entityId);
    }

    if (filters.resultType) {
      sql += ' AND result_type = ?';
      params.push(filters.resultType);
    }

    if (filters.operationType) {
      sql += ' AND operation_type = ?';
      params.push(filters.operationType);
    }

    sql += ' ORDER BY created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    return await all(sql, params);
  }
}

module.exports = TimelineService;