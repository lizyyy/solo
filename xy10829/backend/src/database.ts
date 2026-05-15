import sqlite3 from 'sqlite3';

let db: sqlite3.Database;

export async function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database('./sla_callback.db', (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
      createTables().then(resolve).catch(reject);
    });
  });
}

function createTables(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS tickets (
          id TEXT PRIMARY KEY,
          ticketId TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          content TEXT,
          status TEXT NOT NULL,
          priority TEXT NOT NULL,
          assignee TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS sla_rules (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          priority TEXT NOT NULL,
          timeoutMinutes INTEGER NOT NULL,
          warningMinutes INTEGER,
          isActive INTEGER NOT NULL DEFAULT 1,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS callback_targets (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          url TEXT NOT NULL,
          method TEXT NOT NULL,
          headers TEXT,
          timeoutMs INTEGER NOT NULL DEFAULT 5000,
          maxRetries INTEGER NOT NULL DEFAULT 3,
          retryIntervalMs INTEGER NOT NULL DEFAULT 60000,
          isActive INTEGER NOT NULL DEFAULT 1,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS timeout_events (
          id TEXT PRIMARY KEY,
          eventKey TEXT UNIQUE NOT NULL,
          ticketId TEXT NOT NULL,
          slaRuleId TEXT NOT NULL,
          status TEXT NOT NULL,
          triggeredAt TEXT NOT NULL,
          nextRetryAt TEXT,
          retryCount INTEGER NOT NULL DEFAULT 0,
          maxRetries INTEGER NOT NULL DEFAULT 3,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY (ticketId) REFERENCES tickets(id),
          FOREIGN KEY (slaRuleId) REFERENCES sla_rules(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS retry_batches (
          id TEXT PRIMARY KEY,
          eventIds TEXT NOT NULL,
          triggeredBy TEXT NOT NULL,
          reason TEXT NOT NULL,
          status TEXT NOT NULL,
          startedAt TEXT,
          completedAt TEXT,
          successCount INTEGER NOT NULL DEFAULT 0,
          failedCount INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS response_summaries (
          id TEXT PRIMARY KEY,
          eventId TEXT NOT NULL,
          targetId TEXT NOT NULL,
          status TEXT NOT NULL,
          statusCode INTEGER,
          responseBody TEXT,
          errorMessage TEXT,
          durationMs INTEGER NOT NULL,
          requestedAt TEXT NOT NULL,
          respondedAt TEXT NOT NULL,
          FOREIGN KEY (eventId) REFERENCES timeout_events(id),
          FOREIGN KEY (targetId) REFERENCES callback_targets(id)
        )
      `);

      insertInitialData().then(resolve).catch(reject);
    });
  });
}

function insertInitialData(): Promise<void> {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    db.get('SELECT COUNT(*) as count FROM sla_rules', (err, row: any) => {
      if (err) {
        reject(err);
        return;
      }
      if (row.count === 0) {
        db.run(`
          INSERT INTO sla_rules (id, name, description, priority, timeoutMinutes, warningMinutes, isActive, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, ['rule-1', '标准SLA', '标准工单响应时间', 'normal', 120, 60, 1, now, now]);
        
        db.run(`
          INSERT INTO sla_rules (id, name, description, priority, timeoutMinutes, warningMinutes, isActive, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, ['rule-2', '紧急SLA', '紧急工单响应时间', 'urgent', 30, 15, 1, now, now]);
      }
    });

    db.get('SELECT COUNT(*) as count FROM callback_targets', (err, row: any) => {
      if (err) {
        reject(err);
        return;
      }
      if (row.count === 0) {
        db.run(`
          INSERT INTO callback_targets (id, name, description, url, method, timeoutMs, maxRetries, retryIntervalMs, isActive, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, ['target-1', '工单通知服务', '发送工单超时通知', 'http://localhost:3001/webhook/notify', 'POST', 5000, 3, 60000, 1, now, now]);
        
        db.run(`
          INSERT INTO callback_targets (id, name, description, url, method, timeoutMs, maxRetries, retryIntervalMs, isActive, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, ['target-2', '监控告警系统', '超时事件告警', 'http://localhost:3001/webhook/alert', 'POST', 3000, 5, 30000, 1, now, now]);
      }
      resolve();
    });
  });
}

export function getDb(): sqlite3.Database {
  return db;
}

export function runQuery(sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function getOne<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

export function getAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}
