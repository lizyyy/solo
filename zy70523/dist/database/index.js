"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.Database = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const uuid_1 = require("uuid");
const dayjs_1 = __importDefault(require("dayjs"));
const types_1 = require("../types");
class Database {
    constructor(dbPath = './filing.db') {
        this.db = new sqlite3_1.default.Database(dbPath);
        this.initTables();
    }
    initTables() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run(`
          CREATE TABLE IF NOT EXISTS filing_records (
            id TEXT PRIMARY KEY,
            serviceName TEXT NOT NULL,
            egressAddress TEXT NOT NULL,
            openWindow TEXT NOT NULL,
            purpose TEXT NOT NULL,
            closeCondition TEXT NOT NULL,
            status TEXT NOT NULL,
            approvalStatus TEXT NOT NULL,
            approver TEXT,
            approvedAt TEXT,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            creator TEXT NOT NULL,
            closedAt TEXT,
            closer TEXT,
            closeReason TEXT
          )
        `);
                this.db.run(`
          CREATE TABLE IF NOT EXISTS status_history (
            id TEXT PRIMARY KEY,
            filingId TEXT NOT NULL,
            fromStatus TEXT,
            toStatus TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            operator TEXT,
            reason TEXT NOT NULL,
            FOREIGN KEY (filingId) REFERENCES filing_records(id)
          )
        `);
                this.db.run(`
          CREATE TABLE IF NOT EXISTS exception_traces (
            id TEXT PRIMARY KEY,
            filingId TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            step TEXT NOT NULL,
            originalInput TEXT NOT NULL,
            processingBasis TEXT NOT NULL,
            conclusion TEXT NOT NULL,
            errorCode TEXT,
            errorMessage TEXT,
            operator TEXT,
            FOREIGN KEY (filingId) REFERENCES filing_records(id)
          )
        `);
                this.db.run(`
          CREATE TABLE IF NOT EXISTS access_logs (
            id TEXT PRIMARY KEY,
            filingId TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            sourceIp TEXT NOT NULL,
            destination TEXT NOT NULL,
            action TEXT NOT NULL,
            result TEXT NOT NULL,
            FOREIGN KEY (filingId) REFERENCES filing_records(id)
          )
        `);
                this.db.run(`
          CREATE TABLE IF NOT EXISTS manual_corrections (
            id TEXT PRIMARY KEY,
            filingId TEXT NOT NULL,
            field TEXT NOT NULL,
            oldValue TEXT,
            newValue TEXT,
            operator TEXT NOT NULL,
            reason TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (filingId) REFERENCES filing_records(id)
          )
        `);
                resolve();
            });
        });
    }
    createFiling(request) {
        return new Promise((resolve, reject) => {
            const id = (0, uuid_1.v4)();
            const now = (0, dayjs_1.default)().toISOString();
            const record = {
                id,
                ...request,
                status: types_1.FilingStatus.PENDING,
                approvalStatus: types_1.ApprovalStatus.PENDING,
                createdAt: now,
                updatedAt: now
            };
            this.db.run(`INSERT INTO filing_records (
          id, serviceName, egressAddress, openWindow, purpose, closeCondition,
          status, approvalStatus, createdAt, updatedAt, creator
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                id,
                record.serviceName,
                record.egressAddress,
                JSON.stringify(record.openWindow),
                record.purpose,
                JSON.stringify(record.closeCondition),
                record.status,
                record.approvalStatus,
                record.createdAt,
                record.updatedAt,
                record.creator
            ], function (err) {
                if (err)
                    reject(err);
                else
                    resolve(record);
            });
        });
    }
    getFiling(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM filing_records WHERE id = ?', [id], (err, row) => {
                if (err)
                    reject(err);
                else if (!row)
                    resolve(null);
                else
                    resolve({
                        ...row,
                        openWindow: JSON.parse(row.openWindow),
                        closeCondition: JSON.parse(row.closeCondition)
                    });
            });
        });
    }
    listFilings(filters) {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM filing_records WHERE 1=1';
            const params = [];
            if (filters?.status) {
                query += ' AND status = ?';
                params.push(filters.status);
            }
            if (filters?.serviceName) {
                query += ' AND serviceName LIKE ?';
                params.push(`%${filters.serviceName}%`);
            }
            query += ' ORDER BY createdAt DESC';
            this.db.all(query, params, (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows.map(row => ({
                        ...row,
                        openWindow: JSON.parse(row.openWindow),
                        closeCondition: JSON.parse(row.closeCondition)
                    })));
            });
        });
    }
    updateFilingStatus(id, status, operator, reason) {
        return new Promise((resolve, reject) => {
            this.db.serialize(async () => {
                try {
                    const oldFiling = await this.getFiling(id);
                    if (!oldFiling) {
                        reject(new Error('Filing not found'));
                        return;
                    }
                    const now = (0, dayjs_1.default)().toISOString();
                    this.db.run('UPDATE filing_records SET status = ?, updatedAt = ? WHERE id = ?', [status, now, id]);
                    const historyId = (0, uuid_1.v4)();
                    this.db.run(`INSERT INTO status_history (id, filingId, fromStatus, toStatus, timestamp, operator, reason)
             VALUES (?, ?, ?, ?, ?, ?, ?)`, [historyId, id, oldFiling.status, status, now, operator || null, reason || '状态更新']);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
        });
    }
    updateApprovalStatus(id, approvalStatus, approver) {
        return new Promise((resolve, reject) => {
            const now = (0, dayjs_1.default)().toISOString();
            this.db.run('UPDATE filing_records SET approvalStatus = ?, approver = ?, approvedAt = ?, updatedAt = ? WHERE id = ?', [approvalStatus, approver, now, now, id], function (err) {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    closeFiling(id, closer, closeReason) {
        return new Promise((resolve, reject) => {
            this.db.serialize(async () => {
                try {
                    const now = (0, dayjs_1.default)().toISOString();
                    this.db.run(`UPDATE filing_records 
             SET status = ?, closedAt = ?, closer = ?, closeReason = ?, updatedAt = ?
             WHERE id = ?`, [types_1.FilingStatus.CLOSED, now, closer, closeReason, now, id]);
                    const oldFiling = await this.getFiling(id);
                    const historyId = (0, uuid_1.v4)();
                    this.db.run(`INSERT INTO status_history (id, filingId, fromStatus, toStatus, timestamp, operator, reason)
             VALUES (?, ?, ?, ?, ?, ?, ?)`, [historyId, id, oldFiling?.status || null, types_1.FilingStatus.CLOSED, now, closer, closeReason]);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
        });
    }
    recordException(filingId, request) {
        return new Promise((resolve, reject) => {
            const id = (0, uuid_1.v4)();
            const now = (0, dayjs_1.default)().toISOString();
            const trace = {
                id,
                filingId,
                timestamp: now,
                step: request.step,
                originalInput: request.originalInput,
                processingBasis: request.processingBasis,
                conclusion: request.conclusion,
                errorCode: request.errorCode,
                errorMessage: request.errorMessage,
                operator: request.operator
            };
            this.db.run(`INSERT INTO exception_traces (
          id, filingId, timestamp, step, originalInput, processingBasis,
          conclusion, errorCode, errorMessage, operator
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                id,
                filingId,
                now,
                request.step,
                JSON.stringify(request.originalInput),
                request.processingBasis,
                request.conclusion,
                request.errorCode || null,
                request.errorMessage || null,
                request.operator || null
            ], function (err) {
                if (err)
                    reject(err);
                else
                    resolve(trace);
            });
        });
    }
    getExceptions(filingId) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM exception_traces WHERE filingId = ? ORDER BY timestamp DESC', [filingId], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows.map(row => ({
                        ...row,
                        originalInput: JSON.parse(row.originalInput)
                    })));
            });
        });
    }
    recordAccessLog(filingId, sourceIp, destination, action, result) {
        return new Promise((resolve, reject) => {
            const id = (0, uuid_1.v4)();
            const now = (0, dayjs_1.default)().toISOString();
            const log = {
                id,
                filingId,
                timestamp: now,
                sourceIp,
                destination,
                action,
                result
            };
            this.db.run(`INSERT INTO access_logs (id, filingId, timestamp, sourceIp, destination, action, result)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, filingId, now, sourceIp, destination, action, result], function (err) {
                if (err)
                    reject(err);
                else
                    resolve(log);
            });
        });
    }
    getAccessLogs(filingId) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM access_logs WHERE filingId = ? ORDER BY timestamp DESC', [filingId], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows);
            });
        });
    }
    getStatusHistory(filingId) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM status_history WHERE filingId = ? ORDER BY timestamp DESC', [filingId], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows);
            });
        });
    }
    recordManualCorrection(filingId, field, oldValue, newValue, operator, reason) {
        return new Promise((resolve, reject) => {
            const id = (0, uuid_1.v4)();
            const now = (0, dayjs_1.default)().toISOString();
            this.db.run(`INSERT INTO manual_corrections (id, filingId, field, oldValue, newValue, operator, reason, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, filingId, field, JSON.stringify(oldValue), JSON.stringify(newValue), operator, reason, now], function (err) {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    updateFilingField(filingId, field, value) {
        return new Promise((resolve, reject) => {
            const now = (0, dayjs_1.default)().toISOString();
            this.db.run(`UPDATE filing_records SET ${field} = ?, updatedAt = ? WHERE id = ?`, [value, now, filingId], function (err) {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    close() {
        return new Promise((resolve, reject) => {
            this.db.close(err => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
}
exports.Database = Database;
exports.db = new Database();
