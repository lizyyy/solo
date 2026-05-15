const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../data/audit.db');
const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS connection_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        status TEXT NOT NULL,
        connected_at INTEGER NOT NULL,
        disconnected_at INTEGER,
        disconnect_reason TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS user_devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_type TEXT NOT NULL,
        device_info TEXT,
        ip_address TEXT,
        last_seen INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS heartbeat_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        payload TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES connection_sessions(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS room_members (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        joined_at INTEGER NOT NULL,
        left_at INTEGER,
        is_online INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES connection_sessions(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS disconnect_reasons (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        reason_code TEXT NOT NULL,
        reason_message TEXT,
        detected_at INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES connection_sessions(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS online_snapshots (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        online_count INTEGER NOT NULL,
        member_list TEXT NOT NULL,
        snapshot_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        action TEXT NOT NULL,
        input_data TEXT,
        result_data TEXT,
        responsible_node TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS anomaly_queue (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        session_id TEXT,
        room_id TEXT,
        user_id TEXT,
        description TEXT NOT NULL,
        metadata TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        resolved_at INTEGER,
        created_at INTEGER NOT NULL
      )`);

      resolve();
    });
  });
};

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  initDatabase,
  runQuery,
  getQuery,
  allQuery,
  uuidv4
};
