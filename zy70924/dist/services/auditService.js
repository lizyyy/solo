"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReviewHistory = exports.getAuditLogs = exports.addReviewRecord = exports.logAction = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
const logAction = (params) => {
    return new Promise((resolve, reject) => {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        database_1.db.run(`INSERT INTO audit_logs (id, batch_id, student_id, certificate_id, action, details, operator, operated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, params.batch_id || null, params.student_id || null, params.certificate_id || null,
            params.action, params.details || null, params.operator, now], (err) => err ? reject(err) : resolve());
    });
};
exports.logAction = logAction;
const addReviewRecord = (params) => {
    return new Promise((resolve, reject) => {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        database_1.db.run(`INSERT INTO record_reviews (id, record_type, record_id, batch_id, student_id, action, reason, processed_by, processed_at, previous_status, new_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, params.record_type, params.record_id, params.batch_id, params.student_id,
            params.action, params.reason, params.processed_by, now, params.previous_status || null, params.new_status || null], (err) => err ? reject(err) : resolve());
    });
};
exports.addReviewRecord = addReviewRecord;
const getAuditLogs = (filters) => {
    return new Promise((resolve, reject) => {
        let sql = `SELECT * FROM audit_logs WHERE 1=1`;
        const params = [];
        if (filters.batch_id) {
            sql += ` AND batch_id = ?`;
            params.push(filters.batch_id);
        }
        if (filters.student_id) {
            sql += ` AND student_id = ?`;
            params.push(filters.student_id);
        }
        if (filters.certificate_id) {
            sql += ` AND certificate_id = ?`;
            params.push(filters.certificate_id);
        }
        sql += ` ORDER BY operated_at DESC`;
        database_1.db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
    });
};
exports.getAuditLogs = getAuditLogs;
const getReviewHistory = (record_type, record_id) => {
    return new Promise((resolve, reject) => {
        database_1.db.all(`SELECT * FROM record_reviews WHERE record_type = ? AND record_id = ? ORDER BY processed_at DESC`, [record_type, record_id], (err, rows) => err ? reject(err) : resolve(rows));
    });
};
exports.getReviewHistory = getReviewHistory;
