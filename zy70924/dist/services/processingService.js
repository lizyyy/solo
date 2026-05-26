"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecordWithHistory = exports.returnBatchForRevision = exports.processHomeworkRecord = exports.processAttendanceRecord = void 0;
const database_1 = require("../database");
const auditService_1 = require("./auditService");
const processAttendanceRecord = async (params) => {
    const record = await getRecordById('attendance_records', params.recordId);
    if (!record)
        throw new Error('记录不存在');
    let newStatus = record.status;
    switch (params.action) {
        case 'approve':
            newStatus = 'normal';
            break;
        case 'reject':
            newStatus = 'absent';
            break;
        case 'makeup_approve':
            newStatus = 'makeup_approved';
            break;
        case 'makeup_reject':
            newStatus = 'makeup_rejected';
            break;
    }
    const now = new Date().toISOString();
    const updateFields = { status: newStatus };
    if (params.action === 'makeup_approve') {
        updateFields.is_makeup = 1;
        updateFields.makeup_approved_by = params.processedBy;
        updateFields.makeup_approved_at = now;
        updateFields.makeup_reason = params.reason;
    }
    await new Promise((resolve, reject) => {
        const setClauses = Object.keys(updateFields).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(updateFields), params.recordId];
        database_1.db.run(`UPDATE attendance_records SET ${setClauses} WHERE id = ?`, values, (err) => err ? reject(err) : resolve());
    });
    await (0, auditService_1.addReviewRecord)({
        record_type: 'attendance',
        record_id: params.recordId,
        batch_id: record.batch_id,
        student_id: record.student_id,
        action: params.action,
        reason: params.reason,
        processed_by: params.processedBy,
        previous_status: record.status,
        new_status: newStatus
    });
    await (0, auditService_1.logAction)({
        batch_id: record.batch_id,
        student_id: record.student_id,
        action: `attendance_${params.action}`,
        details: params.reason,
        operator: params.processedBy
    });
};
exports.processAttendanceRecord = processAttendanceRecord;
const processHomeworkRecord = async (params) => {
    const record = await getRecordById('homework_records', params.recordId);
    if (!record)
        throw new Error('记录不存在');
    const newStatus = params.action === 'approve' ? 'graded' : 'absent';
    await new Promise((resolve, reject) => {
        database_1.db.run(`UPDATE homework_records SET status = ?, score = COALESCE(?, score) WHERE id = ?`, [newStatus, params.newScore || null, params.recordId], (err) => err ? reject(err) : resolve());
    });
    await (0, auditService_1.addReviewRecord)({
        record_type: 'homework',
        record_id: params.recordId,
        batch_id: record.batch_id,
        student_id: record.student_id,
        action: params.action,
        reason: params.reason,
        processed_by: params.processedBy,
        previous_status: record.status,
        new_status: newStatus
    });
    await (0, auditService_1.logAction)({
        batch_id: record.batch_id,
        student_id: record.student_id,
        action: `homework_${params.action}`,
        details: params.reason,
        operator: params.processedBy
    });
};
exports.processHomeworkRecord = processHomeworkRecord;
const returnBatchForRevision = async (batchId, reason, processedBy) => {
    await new Promise((resolve, reject) => {
        const now = new Date().toISOString();
        database_1.db.run(`UPDATE batches SET status = 'returned', updated_at = ? WHERE id = ?`, [now, batchId], (err) => err ? reject(err) : resolve());
    });
    await (0, auditService_1.logAction)({
        batch_id: batchId,
        action: 'batch_returned',
        details: reason,
        operator: processedBy
    });
};
exports.returnBatchForRevision = returnBatchForRevision;
const getRecordById = (table, id) => {
    return new Promise((resolve, reject) => {
        database_1.db.get(`SELECT * FROM ${table} WHERE id = ?`, [id], (err, row) => {
            err ? reject(err) : resolve(row);
        });
    });
};
const getRecordWithHistory = async (recordType, recordId) => {
    const tableMap = {
        attendance: 'attendance_records',
        homework: 'homework_records',
        certificate: 'certificates'
    };
    const record = await getRecordById(tableMap[recordType], recordId);
    if (!record)
        return null;
    const history = await (0, auditService_1.getReviewHistory)(recordType, recordId);
    return {
        record,
        review_history: history
    };
};
exports.getRecordWithHistory = getRecordWithHistory;
