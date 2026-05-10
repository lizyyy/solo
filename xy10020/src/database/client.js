const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const logger = require('../utils/logger');
const { runMigrations } = require('./migrations');

let db = null;

const initDatabase = () => {
  const dbPath = config.database.path;
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  logger.info('数据库连接成功');

  createTables();
  runMigrations(db);

  return db;
};

const createTables = () => {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS live_rooms (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      streamer_id TEXT NOT NULL,
      status TEXT DEFAULT 'offline',
      viewer_count INTEGER DEFAULT 0,
      max_viewers INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (streamer_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      live_room_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      content TEXT NOT NULL,
      message_type TEXT DEFAULT 'chat',
      sequence_number INTEGER NOT NULL,
      version INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (live_room_id) REFERENCES live_rooms(id)
    )`,

    `CREATE TABLE IF NOT EXISTS push_tasks (
      id TEXT PRIMARY KEY,
      task_type TEXT NOT NULL,
      live_room_id TEXT,
      target_user_ids TEXT,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      error_message TEXT,
      scheduled_at INTEGER,
      executed_at INTEGER,
      completed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (live_room_id) REFERENCES live_rooms(id)
    )`,

    `CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      user_id TEXT,
      before_data TEXT,
      after_data TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS idempotency_records (
      idempotency_key TEXT PRIMARY KEY,
      request_path TEXT NOT NULL,
      request_method TEXT NOT NULL,
      request_body TEXT,
      response_body TEXT,
      status_code INTEGER,
      user_id TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS user_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      live_room_id TEXT NOT NULL,
      connection_type TEXT DEFAULT 'websocket',
      connected_at INTEGER NOT NULL,
      disconnected_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (live_room_id) REFERENCES live_rooms(id)
    )`
  ];

  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_live_rooms_status ON live_rooms(status)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_live_room_sequence ON messages(live_room_id, sequence_number)`,
    `CREATE INDEX IF NOT EXISTS idx_push_tasks_status ON push_tasks(status)`,
    `CREATE INDEX IF NOT EXISTS idx_operation_logs_entity ON operation_logs(entity_type, entity_id)`,
    `CREATE INDEX IF NOT EXISTS idx_operation_logs_created ON operation_logs(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_user_connections_active ON user_connections(live_room_id, disconnected_at)`
  ];

  db.transaction(() => {
    for (const tableSql of tables) {
      db.exec(tableSql);
    }
    for (const indexSql of indexes) {
      db.exec(indexSql);
    }
  })();

  logger.info('数据库表和索引初始化完成');
};

const getDb = () => {
  if (!db) {
    db = initDatabase();
  }
  return db;
};

const closeDb = () => {
  if (db) {
    db.close();
    db = null;
    logger.info('数据库连接已关闭');
  }
};

module.exports = {
  initDatabase,
  getDb,
  closeDb
};
