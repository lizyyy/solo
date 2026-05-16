"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTicketScanRecord = createTicketScanRecord;
exports.getTicketScanRecordById = getTicketScanRecordById;
exports.getTicketScanRecordsByTicketId = getTicketScanRecordsByTicketId;
exports.getTicketScanRecordsByStatus = getTicketScanRecordsByStatus;
exports.getAllTicketScanRecords = getAllTicketScanRecords;
exports.updateTicketScanStatus = updateTicketScanStatus;
exports.addFailureRecord = addFailureRecord;
exports.manualCorrectRecord = manualCorrectRecord;
const database_1 = require("../database");
const types_1 = require("../types");
const uuid_1 = require("uuid");
function deserializeRecord(row) {
    return {
        id: row.id,
        ticketId: row.ticket_id,
        attachments: JSON.parse(row.attachments),
        scanEngine: row.scan_engine,
        riskLevel: row.risk_level,
        isolationAction: row.isolation_action,
        status: row.status,
        processingSummary: row.processing_summary,
        scanReport: row.scan_report,
        virusFound: row.virus_found ? JSON.parse(row.virus_found) : undefined,
        failureRecords: row.failure_records ? JSON.parse(row.failure_records) : undefined,
        reviewedBy: row.reviewed_by,
        reviewComment: row.review_comment,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        scannedAt: row.scanned_at ? new Date(row.scanned_at) : undefined,
        reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined
    };
}
async function createTicketScanRecord(ticketId, attachments, scanEngine) {
    const db = (0, database_1.getDatabase)();
    const now = new Date().toISOString();
    const id = (0, uuid_1.v4)();
    const attachmentsWithIds = attachments.map(att => ({
        ...att,
        id: (0, uuid_1.v4)()
    }));
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO ticket_scan_records (
        id, ticket_id, attachments, scan_engine, risk_level, 
        isolation_action, status, processing_summary, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            id,
            ticketId,
            JSON.stringify(attachmentsWithIds),
            scanEngine,
            types_1.RiskLevel.SAFE,
            types_1.IsolationAction.NONE,
            types_1.ScanStatus.PENDING,
            '工单附件已提交，等待扫描排队',
            now,
            now
        ], function (err) {
            if (err) {
                reject(err);
                return;
            }
            resolve({
                id,
                ticketId,
                attachments: attachmentsWithIds,
                scanEngine,
                riskLevel: types_1.RiskLevel.SAFE,
                isolationAction: types_1.IsolationAction.NONE,
                status: types_1.ScanStatus.PENDING,
                processingSummary: '工单附件已提交，等待扫描排队',
                createdAt: new Date(now),
                updatedAt: new Date(now)
            });
        });
    });
}
async function getTicketScanRecordById(id) {
    const db = (0, database_1.getDatabase)();
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM ticket_scan_records WHERE id = ?', [id], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            if (!row) {
                resolve(null);
                return;
            }
            resolve(deserializeRecord(row));
        });
    });
}
async function getTicketScanRecordsByTicketId(ticketId) {
    const db = (0, database_1.getDatabase)();
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM ticket_scan_records WHERE ticket_id = ? ORDER BY created_at DESC', [ticketId], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows.map(deserializeRecord));
        });
    });
}
async function getTicketScanRecordsByStatus(status) {
    const db = (0, database_1.getDatabase)();
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM ticket_scan_records WHERE status = ? ORDER BY created_at DESC', [status], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows.map(deserializeRecord));
        });
    });
}
async function getAllTicketScanRecords(page = 1, pageSize = 20) {
    const db = (0, database_1.getDatabase)();
    const offset = (page - 1) * pageSize;
    const recordsPromise = new Promise((resolve, reject) => {
        db.all('SELECT * FROM ticket_scan_records ORDER BY created_at DESC LIMIT ? OFFSET ?', [pageSize, offset], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows.map(deserializeRecord));
        });
    });
    const totalPromise = new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM ticket_scan_records', (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row.count);
        });
    });
    const [records, total] = await Promise.all([recordsPromise, totalPromise]);
    return { records, total };
}
async function updateTicketScanStatus(id, status, updates) {
    const db = (0, database_1.getDatabase)();
    const now = new Date().toISOString();
    const scannedAt = status === types_1.ScanStatus.SUCCESS || status === types_1.ScanStatus.FAILED ? now : undefined;
    const setClauses = ['status = ?', 'updated_at = ?'];
    const params = [status, now];
    if (updates.scanReport !== undefined) {
        setClauses.push('scan_report = ?');
        params.push(updates.scanReport);
    }
    if (updates.virusFound !== undefined) {
        setClauses.push('virus_found = ?');
        params.push(JSON.stringify(updates.virusFound));
    }
    if (updates.riskLevel !== undefined) {
        setClauses.push('risk_level = ?');
        params.push(updates.riskLevel);
    }
    if (updates.isolationAction !== undefined) {
        setClauses.push('isolation_action = ?');
        params.push(updates.isolationAction);
    }
    if (updates.processingSummary !== undefined) {
        setClauses.push('processing_summary = ?');
        params.push(updates.processingSummary);
    }
    if (scannedAt) {
        setClauses.push('scanned_at = ?');
        params.push(scannedAt);
    }
    params.push(id);
    return new Promise((resolve, reject) => {
        db.run(`UPDATE ticket_scan_records SET ${setClauses.join(', ')} WHERE id = ?`, params, async function (err) {
            if (err) {
                reject(err);
                return;
            }
            if (this.changes === 0) {
                resolve(null);
                return;
            }
            const updatedRecord = await getTicketScanRecordById(id);
            resolve(updatedRecord);
        });
    });
}
async function addFailureRecord(id, failureRecord) {
    const db = (0, database_1.getDatabase)();
    const existingRecord = await getTicketScanRecordById(id);
    if (!existingRecord) {
        return null;
    }
    const failureRecords = existingRecord.failureRecords || [];
    failureRecords.push(failureRecord);
    return new Promise((resolve, reject) => {
        db.run('UPDATE ticket_scan_records SET failure_records = ?, updated_at = ? WHERE id = ?', [JSON.stringify(failureRecords), new Date().toISOString(), id], async function (err) {
            if (err) {
                reject(err);
                return;
            }
            const updatedRecord = await getTicketScanRecordById(id);
            resolve(updatedRecord);
        });
    });
}
async function manualCorrectRecord(id, reviewedBy, reviewComment, updates) {
    const db = (0, database_1.getDatabase)();
    const now = new Date().toISOString();
    const setClauses = [
        'status = ?',
        'reviewed_by = ?',
        'review_comment = ?',
        'reviewed_at = ?',
        'updated_at = ?'
    ];
    const params = [updates.status, reviewedBy, reviewComment, now, now];
    if (updates.riskLevel !== undefined) {
        setClauses.push('risk_level = ?');
        params.push(updates.riskLevel);
    }
    if (updates.isolationAction !== undefined) {
        setClauses.push('isolation_action = ?');
        params.push(updates.isolationAction);
    }
    if (updates.processingSummary !== undefined) {
        setClauses.push('processing_summary = ?');
        params.push(updates.processingSummary);
    }
    params.push(id);
    return new Promise((resolve, reject) => {
        db.run(`UPDATE ticket_scan_records SET ${setClauses.join(', ')} WHERE id = ?`, params, async function (err) {
            if (err) {
                reject(err);
                return;
            }
            if (this.changes === 0) {
                resolve(null);
                return;
            }
            const updatedRecord = await getTicketScanRecordById(id);
            resolve(updatedRecord);
        });
    });
}
