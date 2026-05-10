const path = require('path');
const fs = require('fs');
const config = require('../config');
const logger = require('../utils/logger');

const DB_SCHEMA_VERSION = 1;

const runMigrations = (db) => {
  ensureVersionTable(db);
  const currentVersion = getCurrentVersion(db);

  if (currentVersion >= DB_SCHEMA_VERSION) {
    logger.info('数据库架构已是最新版本');
    return;
  }

  logger.info(`数据库迁移: 从版本 ${currentVersion} 到 ${DB_SCHEMA_VERSION}`);

  if (currentVersion < 1) {
    migrateV1(db);
  }

  setCurrentVersion(db, DB_SCHEMA_VERSION);
  logger.info('数据库迁移完成');
};

const ensureVersionTable = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      created_at INTEGER NOT NULL
    )
  `);
};

const getCurrentVersion = (db) => {
  const row = db.prepare(`
    SELECT MAX(version) as version FROM schema_version
  `).get();

  return row?.version || 0;
};

const setCurrentVersion = (db, version) => {
  const now = Date.now();
  db.prepare(`
    INSERT OR REPLACE INTO schema_version (version, created_at)
    VALUES (?, ?)
  `).run(version, now);
};

const migrateV1 = (db) => {
  logger.info('执行迁移 V1: 移除 messages.sender_id 外键约束');

  try {
    const tableInfo = db.prepare(`PRAGMA table_info(messages)`).all();
    const hasOldTable = tableInfo.length > 0;

    if (hasOldTable) {
      db.transaction(() => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS messages_new (
            id TEXT PRIMARY KEY,
            live_room_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            content TEXT NOT NULL,
            message_type TEXT DEFAULT 'chat',
            sequence_number INTEGER NOT NULL,
            version INTEGER DEFAULT 1,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (live_room_id) REFERENCES live_rooms(id)
          )
        `);

        const countResult = db.prepare(`SELECT COUNT(*) as count FROM messages`).get();
        if (countResult.count > 0) {
          db.exec(`
            INSERT INTO messages_new 
              (id, live_room_id, sender_id, content, message_type, 
               sequence_number, version, created_at)
            SELECT 
              id, live_room_id, sender_id, content, message_type,
              sequence_number, version, created_at
            FROM messages
          `);
        }

        db.exec(`DROP TABLE messages`);
        db.exec(`ALTER TABLE messages_new RENAME TO messages`);
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_messages_live_room_sequence 
          ON messages(live_room_id, sequence_number)
        `);
      })();

      logger.info('V1 迁移完成: messages 表已重构');
    }
  } catch (error) {
    logger.error('V1 迁移失败:', error);
    throw error;
  }
};

module.exports = {
  runMigrations,
  DB_SCHEMA_VERSION
};
