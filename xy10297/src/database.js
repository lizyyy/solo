const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'fresh_label.db');
const fs = require('fs');

if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS weighing_records (
                id TEXT PRIMARY KEY,
                sku_code TEXT NOT NULL,
                sku_name TEXT NOT NULL,
                weight REAL NOT NULL,
                unit_price REAL NOT NULL,
                total_price REAL NOT NULL,
                batch_number TEXT NOT NULL,
                counter_code TEXT NOT NULL,
                operator_id TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS label_versions (
                id TEXT PRIMARY KEY,
                weighing_record_id TEXT NOT NULL,
                version_number INTEGER NOT NULL,
                print_time INTEGER NOT NULL,
                operator_id TEXT NOT NULL,
                status TEXT NOT NULL,
                printed_data TEXT,
                FOREIGN KEY (weighing_record_id) REFERENCES weighing_records(id),
                UNIQUE(weighing_record_id, version_number)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS reprint_requests (
                id TEXT PRIMARY KEY,
                weighing_record_id TEXT NOT NULL,
                reason TEXT NOT NULL,
                current_version INTEGER NOT NULL,
                requested_version INTEGER,
                status TEXT NOT NULL,
                requester_id TEXT NOT NULL,
                approver_id TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (weighing_record_id) REFERENCES weighing_records(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                request_id TEXT,
                action TEXT NOT NULL,
                operator_id TEXT NOT NULL,
                details TEXT,
                timestamp INTEGER NOT NULL,
                FOREIGN KEY (request_id) REFERENCES reprint_requests(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS batch_locks (
                id TEXT PRIMARY KEY,
                batch_number TEXT NOT NULL,
                counter_code TEXT NOT NULL,
                locked_by TEXT NOT NULL,
                reason TEXT,
                locked_at INTEGER NOT NULL,
                expires_at INTEGER,
                UNIQUE(batch_number, counter_code)
            )`);

            resolve();
        });
    });
};

const runQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
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
    db,
    initDatabase,
    runQuery,
    getQuery,
    allQuery
};
