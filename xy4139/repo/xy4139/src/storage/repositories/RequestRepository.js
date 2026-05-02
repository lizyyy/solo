const db = require('../database');
const Request = require('../../models/Request');

class RequestRepository {
  async create(request) {
    const sql = `
      INSERT INTO requests (
        id, request_number, requester_id, requester_name, chemical_id, batch_id,
        quantity, unit, purpose, status, requested_at, approver_id, approver_name,
        approved_at, rejection_reason, executor_id, executor_name, executed_at,
        returned_at, return_quantity, disposed_at, disposal_reason, created_at,
        updated_at, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      request.id, request.request_number, request.requester_id, request.requester_name,
      request.chemical_id, request.batch_id, request.quantity, request.unit,
      request.purpose, request.status, request.requested_at, request.approver_id,
      request.approver_name, request.approved_at, request.rejection_reason,
      request.executor_id, request.executor_name, request.executed_at, request.returned_at,
      request.return_quantity, request.disposed_at, request.disposal_reason,
      request.created_at, request.updated_at, request.created_by, request.updated_by
    ];
    
    await db.run(sql, params);
    return request;
  }

  async update(request) {
    const sql = `
      UPDATE requests SET
        requester_id = ?, requester_name = ?, chemical_id = ?, batch_id = ?,
        quantity = ?, unit = ?, purpose = ?, status = ?, requested_at = ?,
        approver_id = ?, approver_name = ?, approved_at = ?, rejection_reason = ?,
        executor_id = ?, executor_name = ?, executed_at = ?, returned_at = ?,
        return_quantity = ?, disposed_at = ?, disposal_reason = ?, updated_at = ?, updated_by = ?
      WHERE id = ?
    `;
    
    const params = [
      request.requester_id, request.requester_name, request.chemical_id, request.batch_id,
      request.quantity, request.unit, request.purpose, request.status, request.requested_at,
      request.approver_id, request.approver_name, request.approved_at, request.rejection_reason,
      request.executor_id, request.executor_name, request.executed_at, request.returned_at,
      request.return_quantity, request.disposed_at, request.disposal_reason,
      request.updated_at, request.updated_by, request.id
    ];
    
    await db.run(sql, params);
    return request;
  }

  async delete(id) {
    const sql = 'DELETE FROM requests WHERE id = ?';
    const result = await db.run(sql, [id]);
    return result.changes > 0;
  }

  async findById(id) {
    const sql = 'SELECT * FROM requests WHERE id = ?';
    const row = await db.get(sql, [id]);
    if (row) {
      return new Request(row);
    }
    return null;
  }

  async findAll(options = {}) {
    let sql = 'SELECT * FROM requests WHERE 1=1';
    const params = [];
    
    if (options.requester_id) {
      sql += ' AND requester_id = ?';
      params.push(options.requester_id);
    }
    
    if (options.chemical_id) {
      sql += ' AND chemical_id = ?';
      params.push(options.chemical_id);
    }
    
    if (options.batch_id) {
      sql += ' AND batch_id = ?';
      params.push(options.batch_id);
    }
    
    if (options.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }
    
    if (options.request_number) {
      sql += ' AND request_number LIKE ?';
      params.push(`%${options.request_number}%`);
    }
    
    if (options.start_date) {
      sql += ' AND created_at >= ?';
      params.push(options.start_date);
    }
    
    if (options.end_date) {
      sql += ' AND created_at <= ?';
      params.push(options.end_date);
    }
    
    if (options.sortBy) {
      const sortOrder = options.sortOrder === 'desc' ? 'DESC' : 'ASC';
      sql += ` ORDER BY ${options.sortBy} ${sortOrder}`;
    } else {
      sql += ' ORDER BY created_at DESC';
    }
    
    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    
    if (options.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }
    
    const rows = await db.all(sql, params);
    return rows.map(row => new Request(row));
  }

  async count(options = {}) {
    let sql = 'SELECT COUNT(*) as total FROM requests WHERE 1=1';
    const params = [];
    
    if (options.requester_id) {
      sql += ' AND requester_id = ?';
      params.push(options.requester_id);
    }
    
    if (options.chemical_id) {
      sql += ' AND chemical_id = ?';
      params.push(options.chemical_id);
    }
    
    if (options.batch_id) {
      sql += ' AND batch_id = ?';
      params.push(options.batch_id);
    }
    
    if (options.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }
    
    const result = await db.get(sql, params);
    return result.total;
  }

  async findByRequestNumber(requestNumber) {
    const sql = 'SELECT * FROM requests WHERE request_number = ?';
    const row = await db.get(sql, [requestNumber]);
    if (row) {
      return new Request(row);
    }
    return null;
  }

  async findByRequesterId(requesterId, options = {}) {
    return this.findAll({
      requester_id: requesterId,
      ...options
    });
  }

  async findPendingRequests() {
    const sql = `
      SELECT * FROM requests 
      WHERE status = 'pending' 
      ORDER BY requested_at ASC
    `;
    const rows = await db.all(sql);
    return rows.map(row => new Request(row));
  }

  async findByBatchId(batchId) {
    const sql = 'SELECT * FROM requests WHERE batch_id = ? ORDER BY created_at DESC';
    const rows = await db.all(sql, [batchId]);
    return rows.map(row => new Request(row));
  }
}

module.exports = RequestRepository;
