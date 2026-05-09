const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/log_analysis.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('数据库连接失败:', err.message);
        process.exit(1);
    }
    console.log('数据库连接成功');
    initializeDatabase();
});

function initializeDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS logs (
            id TEXT PRIMARY KEY,
            source_type TEXT NOT NULL,
            level TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            metadata TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            version INTEGER NOT NULL DEFAULT 1
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_logs_status ON logs(status)`);

        db.run(`CREATE TABLE IF NOT EXISTS log_analysis (
            id TEXT PRIMARY KEY,
            log_id TEXT NOT NULL,
            analysis_type TEXT NOT NULL,
            result TEXT NOT NULL,
            confidence REAL NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (log_id) REFERENCES logs(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_log_analysis_log_id ON log_analysis(log_id)`);

        db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            action TEXT NOT NULL,
            entity_type TEXT,
            entity_id TEXT,
            old_value TEXT,
            new_value TEXT,
            ip_address TEXT,
            user_agent TEXT,
            timestamp INTEGER NOT NULL,
            status TEXT NOT NULL
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)`);

        db.run(`CREATE TABLE IF NOT EXISTS failed_operations (
            id TEXT PRIMARY KEY,
            operation_type TEXT NOT NULL,
            data TEXT NOT NULL,
            error_message TEXT,
            retry_count INTEGER NOT NULL DEFAULT 0,
            max_retries INTEGER NOT NULL DEFAULT 3,
            status TEXT NOT NULL DEFAULT 'failed',
            created_at INTEGER NOT NULL,
            last_attempt_at INTEGER,
            next_retry_at INTEGER
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_failed_operations_status ON failed_operations(status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_failed_operations_next_retry ON failed_operations(next_retry_at)`);

        db.run(`CREATE TABLE IF NOT EXISTS requests (
            id TEXT PRIMARY KEY,
            request_id TEXT NOT NULL UNIQUE,
            endpoint TEXT NOT NULL,
            method TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            completed_at INTEGER
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_requests_request_id ON requests(request_id)`);

        console.log('数据库表初始化完成');
    });
}

module.exports = db;
