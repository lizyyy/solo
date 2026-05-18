const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'cinema_points.db');
const db = new sqlite3.Database(dbPath);

const RECORD_STATUSES = {
  NORMAL: 'normal',
  REJECTED: 'rejected',
  SUPPLEMENTED: 'supplemented',
  COMPLETED: 'completed'
};

const STATUS_TRANSITIONS = {
  [RECORD_STATUSES.NORMAL]: ['rejected', 'completed'],
  [RECORD_STATUSES.REJECTED]: ['supplemented'],
  [RECORD_STATUSES.SUPPLEMENTED]: ['rejected', 'completed'],
  [RECORD_STATUSES.COMPLETED]: []
};

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS members (
        member_id TEXT PRIMARY KEY,
        member_name TEXT NOT NULL,
        phone TEXT,
        member_level TEXT DEFAULT '普通会员',
        total_points INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS cinemas (
        cinema_id TEXT PRIMARY KEY,
        cinema_name TEXT NOT NULL,
        address TEXT,
        city TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS point_records (
        record_id TEXT PRIMARY KEY,
        ticket_no TEXT NOT NULL,
        member_id TEXT NOT NULL,
        cinema_id TEXT NOT NULL,
        movie_name TEXT NOT NULL,
        show_time DATETIME NOT NULL,
        seat_no TEXT,
        ticket_amount REAL NOT NULL,
        points_earned INTEGER NOT NULL,
        status TEXT DEFAULT 'normal',
        submit_source TEXT NOT NULL,
        submit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        operator TEXT NOT NULL,
        reject_reason TEXT,
        supplement_note TEXT,
        audit_time DATETIME,
        auditor TEXT,
        FOREIGN KEY (member_id) REFERENCES members(member_id),
        FOREIGN KEY (cinema_id) REFERENCES cinemas(cinema_id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS point_flows (
        flow_id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        points_change INTEGER NOT NULL,
        flow_type TEXT NOT NULL,
        flow_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        operator TEXT NOT NULL,
        remark TEXT,
        FOREIGN KEY (record_id) REFERENCES point_records(record_id),
        FOREIGN KEY (member_id) REFERENCES members(member_id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
        log_id TEXT PRIMARY KEY,
        record_id TEXT,
        operator TEXT NOT NULL,
        operation TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT,
        operation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        remark TEXT
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_ticket_no ON point_records(ticket_no)`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function canTransition(fromStatus, toStatus) {
  const allowedTransitions = STATUS_TRANSITIONS[fromStatus];
  return allowedTransitions && allowedTransitions.includes(toStatus);
}

function checkDuplicateTicket(ticketNo, excludeRecordId = null) {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT pr.*, m.member_name 
      FROM point_records pr 
      JOIN members m ON pr.member_id = m.member_id 
      WHERE pr.ticket_no = ? AND pr.status != 'rejected'
    `;
    let params = [ticketNo];
    
    if (excludeRecordId) {
      query += ` AND pr.record_id != ?`;
      params.push(excludeRecordId);
    }
    
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows.length > 0 ? rows : null);
    });
  });
}

function checkPointsConsistency(memberId, recordId, pointsEarned) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT SUM(points_change) as total_flow_points
      FROM point_flows 
      WHERE member_id = ? AND record_id = ?
    `, [memberId, recordId], (err, row) => {
      if (err) reject(err);
      else {
        const flowPoints = row.total_flow_points || 0;
        resolve(flowPoints === pointsEarned);
      }
    });
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  initDatabase,
  RECORD_STATUSES,
  STATUS_TRANSITIONS,
  canTransition,
  checkDuplicateTicket,
  checkPointsConsistency,
  runQuery,
  getQuery,
  allQuery
};