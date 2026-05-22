"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbService = exports.DatabaseService = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const types_1 = require("../models/types");
class DatabaseService {
    constructor(config) {
        this.db = null;
        const baseDir = process.cwd();
        this.config = {
            path: config?.path || path_1.default.join(baseDir, '.tea-inspect', 'data.db'),
            workDir: config?.workDir || path_1.default.join(baseDir, '.tea-inspect'),
            importDir: config?.importDir || path_1.default.join(baseDir, '.tea-inspect', 'imports'),
            exportDir: config?.exportDir || path_1.default.join(baseDir, '.tea-inspect', 'exports'),
            photoDir: config?.photoDir || path_1.default.join(baseDir, '.tea-inspect', 'photos')
        };
    }
    getConfig() {
        return { ...this.config };
    }
    isInitialized() {
        return fs_1.default.existsSync(this.config.path);
    }
    async initialize() {
        const dirs = [
            this.config.workDir,
            this.config.importDir,
            this.config.exportDir,
            this.config.photoDir
        ];
        for (const dir of dirs) {
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
        }
        return new Promise((resolve, reject) => {
            this.db = new sqlite3_1.default.Database(this.config.path, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                this.createTables()
                    .then(() => this.createDefaultOperator())
                    .then(resolve)
                    .catch(reject);
            });
        });
    }
    async createTables() {
        const sql = `
      CREATE TABLE IF NOT EXISTS operators (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        permission TEXT NOT NULL,
        department TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS import_batches (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_file TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        total_records INTEGER NOT NULL DEFAULT 0,
        success_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        error_message TEXT,
        FOREIGN KEY (operator_id) REFERENCES operators(id)
      );

      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_file TEXT NOT NULL,
        original_row_number INTEGER NOT NULL,
        raw_content TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        import_batch_id TEXT NOT NULL,
        status TEXT NOT NULL,
        material_code TEXT,
        material_name TEXT,
        quantity REAL,
        unit TEXT,
        price REAL,
        total_amount REAL,
        supplier TEXT,
        batch_number TEXT,
        production_date TEXT,
        expiry_date TEXT,
        store_id TEXT,
        store_name TEXT,
        photo_path TEXT,
        photo_hash TEXT,
        notes TEXT,
        tags TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (import_batch_id) REFERENCES import_batches(id)
      );

      CREATE TABLE IF NOT EXISTS state_changes (
        id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        operator_name TEXT NOT NULL,
        operator_permission TEXT NOT NULL,
        reason TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (record_id) REFERENCES records(id),
        FOREIGN KEY (operator_id) REFERENCES operators(id)
      );

      CREATE TABLE IF NOT EXISTS check_results (
        id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL,
        check_name TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        timestamp INTEGER NOT NULL,
        operator_id TEXT NOT NULL,
        FOREIGN KEY (record_id) REFERENCES records(id),
        FOREIGN KEY (operator_id) REFERENCES operators(id)
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        operator_name TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        details TEXT,
        ip_address TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_records_status ON records(status);
      CREATE INDEX IF NOT EXISTS idx_records_source_type ON records(source_type);
      CREATE INDEX IF NOT EXISTS idx_records_batch ON records(import_batch_id);
      CREATE INDEX IF NOT EXISTS idx_state_changes_record ON state_changes(record_id);
      CREATE INDEX IF NOT EXISTS idx_check_results_record ON check_results(record_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    `;
        return new Promise((resolve, reject) => {
            this.db.exec(sql, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async createDefaultOperator() {
        const existing = await this.getOperatorById('default-admin');
        if (!existing) {
            await this.insertOperator({
                id: 'default-admin',
                name: '系统管理员',
                permission: types_1.PermissionLevel.ADMIN,
                department: '总部'
            });
        }
    }
    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err)
                        reject(err);
                    else {
                        this.db = null;
                        resolve();
                    }
                });
            }
            else {
                resolve();
            }
        });
    }
    async getOperatorById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM operators WHERE id = ?', [id], (err, row) => {
                if (err)
                    reject(err);
                else if (row) {
                    resolve({
                        id: row.id,
                        name: row.name,
                        permission: row.permission,
                        department: row.department
                    });
                }
                else {
                    resolve(null);
                }
            });
        });
    }
    async insertOperator(operator) {
        const now = Date.now();
        return new Promise((resolve, reject) => {
            this.db.run('INSERT INTO operators (id, name, permission, department, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [operator.id, operator.name, operator.permission, operator.department || null, now, now], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async insertImportBatch(batch) {
        return new Promise((resolve, reject) => {
            this.db.run(`INSERT INTO import_batches 
         (id, source_type, source_file, file_hash, operator_id, timestamp, 
          total_records, success_count, failed_count, status, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                batch.id,
                batch.sourceType,
                batch.sourceFile,
                batch.fileHash,
                batch.operatorId,
                batch.timestamp,
                batch.totalRecords,
                batch.successCount,
                batch.failedCount,
                batch.status,
                batch.errorMessage || null
            ], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async getImportBatchByHash(fileHash) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM import_batches WHERE file_hash = ? ORDER BY timestamp DESC LIMIT 1', [fileHash], (err, row) => {
                if (err)
                    reject(err);
                else if (row) {
                    resolve({
                        id: row.id,
                        sourceType: row.source_type,
                        sourceFile: row.source_file,
                        fileHash: row.file_hash,
                        operatorId: row.operator_id,
                        timestamp: row.timestamp,
                        totalRecords: row.total_records,
                        successCount: row.success_count,
                        failedCount: row.failed_count,
                        status: row.status,
                        errorMessage: row.error_message
                    });
                }
                else {
                    resolve(null);
                }
            });
        });
    }
    async insertRecord(record) {
        return new Promise((resolve, reject) => {
            this.db.run(`INSERT INTO records 
         (id, source_type, source_file, original_row_number, raw_content, file_hash,
          import_batch_id, status, material_code, material_name, quantity, unit,
          price, total_amount, supplier, batch_number, production_date, expiry_date,
          store_id, store_name, photo_path, photo_hash, notes, tags,
          created_at, updated_at, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                record.id,
                record.rawData.sourceType,
                record.rawData.sourceFile,
                record.rawData.originalRowNumber,
                JSON.stringify(record.rawData.rawContent),
                record.rawData.fileHash,
                record.rawData.importBatchId,
                record.status,
                record.materialCode || null,
                record.materialName || null,
                record.quantity ?? null,
                record.unit || null,
                record.price ?? null,
                record.totalAmount ?? null,
                record.supplier || null,
                record.batchNumber || null,
                record.productionDate || null,
                record.expiryDate || null,
                record.storeId || null,
                record.storeName || null,
                record.photoPath || null,
                record.photoHash || null,
                record.notes || null,
                JSON.stringify(record.tags || []),
                record.createdAt,
                record.updatedAt,
                record.isDeleted ? 1 : 0
            ], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async updateRecordStatus(recordId, status) {
        const now = Date.now();
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE records SET status = ?, updated_at = ? WHERE id = ?', [status, now, recordId], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async insertStateChange(change) {
        return new Promise((resolve, reject) => {
            this.db.run(`INSERT INTO state_changes 
         (id, record_id, from_status, to_status, operator_id, operator_name, 
          operator_permission, reason, timestamp, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                change.id,
                change.recordId,
                change.fromStatus,
                change.toStatus,
                change.operator.id,
                change.operator.name,
                change.operator.permission,
                change.reason,
                change.timestamp,
                change.metadata ? JSON.stringify(change.metadata) : null
            ], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async insertCheckResult(result) {
        return new Promise((resolve, reject) => {
            this.db.run(`INSERT INTO check_results 
         (id, record_id, check_name, status, message, details, timestamp, operator_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                result.id,
                result.recordId,
                result.checkName,
                result.status,
                result.message,
                result.details ? JSON.stringify(result.details) : null,
                result.timestamp,
                result.operatorId
            ], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async getRecordById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM records WHERE id = ?', [id], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (!row) {
                    resolve(null);
                    return;
                }
                this.getStateChangesByRecordId(id)
                    .then(stateChanges => this.getCheckResultsByRecordId(id)
                    .then(checkResults => {
                    resolve({
                        id: row.id,
                        rawData: {
                            sourceType: row.source_type,
                            sourceFile: row.source_file,
                            originalRowNumber: row.original_row_number,
                            rawContent: JSON.parse(row.raw_content),
                            fileHash: row.file_hash,
                            importBatchId: row.import_batch_id
                        },
                        status: row.status,
                        stateChanges,
                        checkResults,
                        materialCode: row.material_code,
                        materialName: row.material_name,
                        quantity: row.quantity,
                        unit: row.unit,
                        price: row.price,
                        totalAmount: row.total_amount,
                        supplier: row.supplier,
                        batchNumber: row.batch_number,
                        productionDate: row.production_date,
                        expiryDate: row.expiry_date,
                        storeId: row.store_id,
                        storeName: row.store_name,
                        photoPath: row.photo_path,
                        photoHash: row.photo_hash,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                        isDeleted: row.is_deleted === 1,
                        notes: row.notes,
                        tags: row.tags ? JSON.parse(row.tags) : []
                    });
                }))
                    .catch(reject);
            });
        });
    }
    async getStateChangesByRecordId(recordId) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM state_changes WHERE record_id = ? ORDER BY timestamp ASC', [recordId], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows.map(row => ({
                    id: row.id,
                    recordId: row.record_id,
                    fromStatus: row.from_status,
                    toStatus: row.to_status,
                    operator: {
                        id: row.operator_id,
                        name: row.operator_name,
                        permission: row.operator_permission
                    },
                    reason: row.reason,
                    timestamp: row.timestamp,
                    metadata: row.metadata ? JSON.parse(row.metadata) : undefined
                })));
            });
        });
    }
    async getCheckResultsByRecordId(recordId) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM check_results WHERE record_id = ? ORDER BY timestamp ASC', [recordId], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows.map(row => ({
                    id: row.id,
                    recordId: row.record_id,
                    checkName: row.check_name,
                    status: row.status,
                    message: row.message,
                    details: row.details ? JSON.parse(row.details) : undefined,
                    timestamp: row.timestamp,
                    operatorId: row.operator_id
                })));
            });
        });
    }
    async insertAuditLog(log) {
        return new Promise((resolve, reject) => {
            this.db.run(`INSERT INTO audit_logs 
         (id, action, operator_id, operator_name, timestamp, resource_type, resource_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                log.id,
                log.action,
                log.operatorId,
                log.operatorName,
                log.timestamp,
                log.resourceType,
                log.resourceId || null,
                JSON.stringify(log.details),
                log.ipAddress || null
            ], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async getAllRecords(filters) {
        let sql = 'SELECT id FROM records WHERE 1=1';
        const params = [];
        if (filters?.status) {
            sql += ' AND status = ?';
            params.push(filters.status);
        }
        if (filters?.sourceType) {
            sql += ' AND source_type = ?';
            params.push(filters.sourceType);
        }
        if (filters?.batchId) {
            sql += ' AND import_batch_id = ?';
            params.push(filters.batchId);
        }
        if (!filters?.includeDeleted) {
            sql += ' AND is_deleted = 0';
        }
        sql += ' ORDER BY created_at DESC';
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, async (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                try {
                    const records = [];
                    for (const row of rows) {
                        const record = await this.getRecordById(row.id);
                        if (record)
                            records.push(record);
                    }
                    resolve(records);
                }
                catch (e) {
                    reject(e);
                }
            });
        });
    }
    async getAuditLogs(limit = 100) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?', [limit], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows.map(row => ({
                    id: row.id,
                    action: row.action,
                    operatorId: row.operator_id,
                    operatorName: row.operator_name,
                    timestamp: row.timestamp,
                    resourceType: row.resource_type,
                    resourceId: row.resource_id,
                    details: row.details ? JSON.parse(row.details) : {},
                    ipAddress: row.ip_address
                })));
            });
        });
    }
    async getImportBatches(limit = 50) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM import_batches ORDER BY timestamp DESC LIMIT ?', [limit], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows.map(row => ({
                    id: row.id,
                    sourceType: row.source_type,
                    sourceFile: row.source_file,
                    fileHash: row.file_hash,
                    operatorId: row.operator_id,
                    timestamp: row.timestamp,
                    totalRecords: row.total_records,
                    successCount: row.success_count,
                    failedCount: row.failed_count,
                    status: row.status,
                    errorMessage: row.error_message
                })));
            });
        });
    }
    async updateImportBatch(batchId, updates) {
        const setClauses = [];
        const params = [];
        if (updates.status !== undefined) {
            setClauses.push('status = ?');
            params.push(updates.status);
        }
        if (updates.successCount !== undefined) {
            setClauses.push('success_count = ?');
            params.push(updates.successCount);
        }
        if (updates.failedCount !== undefined) {
            setClauses.push('failed_count = ?');
            params.push(updates.failedCount);
        }
        if (updates.errorMessage !== undefined) {
            setClauses.push('error_message = ?');
            params.push(updates.errorMessage);
        }
        if (setClauses.length === 0)
            return;
        params.push(batchId);
        const sql = `UPDATE import_batches SET ${setClauses.join(', ')} WHERE id = ?`;
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows);
            });
        });
    }
}
exports.DatabaseService = DatabaseService;
exports.dbService = new DatabaseService();
