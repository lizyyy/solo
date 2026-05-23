const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class ExceptionService {
  async logException(data) {
    const id = uuidv4();
    const transactionId = data.transaction_id || uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO exception_logs (
        id, transaction_id, api_endpoint, raw_input, error_type, error_message,
        processing_result, resolution_status, related_gate_event_id, related_personnel_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    await stmt.run(
      id,
      transactionId,
      data.api_endpoint || null,
      JSON.stringify(data.raw_input),
      data.error_type || null,
      data.error_message || null,
      JSON.stringify(data.processing_result),
      'pending',
      data.related_gate_event_id || null,
      data.related_personnel_id || null
    );
    
    return this.getExceptionById(id);
  }

  async getExceptionById(id) {
    const stmt = db.prepare('SELECT * FROM exception_logs WHERE id = ?');
    return await stmt.get(id);
  }

  async getExceptionByTransactionId(transactionId) {
    const stmt = db.prepare('SELECT * FROM exception_logs WHERE transaction_id = ?');
    return await stmt.get(transactionId);
  }

  async resolveException(id, data) {
    const stmt = db.prepare(`
      UPDATE exception_logs 
      SET resolution_status = 'resolved',
          resolved_by = ?,
          resolved_at = CURRENT_TIMESTAMP,
          resolution_notes = ?
      WHERE id = ?
    `);
    
    await stmt.run(data.resolved_by, data.resolution_notes || '', id);
    return this.getExceptionById(id);
  }

  async getExceptions(filters = {}) {
    let sql = 'SELECT * FROM exception_logs WHERE 1=1';
    const params = [];
    
    if (filters.resolution_status) {
      sql += ' AND resolution_status = ?';
      params.push(filters.resolution_status);
    }
    
    if (filters.related_personnel_id) {
      sql += ' AND related_personnel_id = ?';
      params.push(filters.related_personnel_id);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(filters.limit || 50);
    params.push(filters.offset || 0);
    
    const stmt = db.prepare(sql);
    return await stmt.all(...params);
  }

  async getExceptionTrace(exceptionId) {
    const exception = await this.getExceptionById(exceptionId);
    if (!exception) return null;

    const trace = {
      exception,
      related_records: {}
    };

    if (exception.related_gate_event_id) {
      const eventStmt = db.prepare('SELECT * FROM gate_events WHERE id = ?');
      trace.related_records.gate_event = await eventStmt.get(exception.related_gate_event_id);
    }

    if (exception.related_personnel_id) {
      const personnelStmt = db.prepare('SELECT * FROM personnel WHERE id = ?');
      trace.related_records.personnel = await personnelStmt.get(exception.related_personnel_id);

      const trainingStmt = db.prepare('SELECT * FROM training_status WHERE personnel_id = ?');
      trace.related_records.training = await trainingStmt.all(exception.related_personnel_id);

      const blacklistStmt = db.prepare('SELECT * FROM blacklist WHERE personnel_id = ?');
      trace.related_records.blacklist = await blacklistStmt.all(exception.related_personnel_id);
    }

    return trace;
  }
}

module.exports = new ExceptionService();
