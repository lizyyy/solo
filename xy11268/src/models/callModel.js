const db = require('../config/database');

function createCall(callData) {
  return new Promise((resolve, reject) => {
    const { call_id, agent_id, transcript, call_time, duration, customer_phone } = callData;
    db.run(
      `INSERT INTO calls (call_id, agent_id, transcript, call_time, duration, customer_phone) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [call_id, agent_id, transcript, call_time, duration, customer_phone],
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...callData });
      }
    );
  });
}

function getCallById(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM calls WHERE id = ?`, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getCallByCallId(callId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM calls WHERE call_id = ?`, [callId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function updateCallStatus(id, status) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE calls SET status = ? WHERE id = ?`, [status, id], function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes });
    });
  });
}

function getCalls(filters = {}) {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT c.*, u.name as agent_name, 
             ir.has_apology, ir.has_refund_promise, ir.has_sensitive_word,
             ir.sensitive_words, ir.summary, ir.anomaly_types, ir.review_status
      FROM calls c 
      LEFT JOIN users u ON c.agent_id = u.id
      LEFT JOIN inspection_results ir ON c.id = ir.call_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.agent_id) {
      query += ` AND c.agent_id = ?`;
      params.push(filters.agent_id);
    }
    if (filters.start_time) {
      query += ` AND c.call_time >= ?`;
      params.push(filters.start_time);
    }
    if (filters.end_time) {
      query += ` AND c.call_time <= ?`;
      params.push(filters.end_time);
    }
    if (filters.status) {
      query += ` AND c.status = ?`;
      params.push(filters.status);
    }
    if (filters.review_status) {
      query += ` AND ir.review_status = ?`;
      params.push(filters.review_status);
    }
    if (filters.anomaly_type) {
      query += ` AND ir.anomaly_types LIKE ?`;
      params.push(`%${filters.anomaly_type}%`);
    }

    query += ` ORDER BY c.call_time DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
    }
    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(filters.offset);
    }

    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  createCall,
  getCallById,
  getCallByCallId,
  updateCallStatus,
  getCalls
};
