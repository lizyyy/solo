"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixRecord = fixRecord;
exports.batchFix = batchFix;
exports.getFixedRecords = getFixedRecords;
exports.autoFixBySuggestion = autoFixBySuggestion;
const database_1 = require("../db/database");
const utils_1 = require("../utils");
const auditService_1 = require("./auditService");
const types_1 = require("../types");
function fixRecord(options) {
    const db = (0, database_1.getDatabase)();
    const record = db.prepare(`
    SELECT * FROM visitor_records WHERE id = ?
  `).get(options.recordId);
    if (!record) {
        throw new Error(`记录不存在: ${options.recordId}`);
    }
    const fieldMap = {
        'visitorName': 'visitor_name',
        'visitorPhone': 'visitor_phone',
        'idCard': 'id_card',
        'plateNumber': 'plate_number',
        'visitDate': 'visit_date',
        'startTime': 'start_time',
        'endTime': 'end_time',
    };
    const dbField = fieldMap[options.field] || options.field;
    const oldValue = record[dbField] || '';
    db.prepare(`
    UPDATE visitor_records 
    SET ${dbField} = ?, status = ?, updated_at = ? 
    WHERE id = ?
  `).run(options.newValue, types_1.RecordStatus.FIXED, (0, utils_1.now)(), options.recordId);
    (0, auditService_1.logAudit)({
        recordId: options.recordId,
        batchId: record.batch_id,
        operator: options.operator,
        action: 'fix_record',
        oldValue: { [dbField]: oldValue },
        newValue: { [dbField]: options.newValue, reason: options.reason }
    });
    return {
        recordId: options.recordId,
        originalLineNo: record.original_line_no,
        visitorName: record.visitor_name,
        field: options.field,
        oldValue,
        newValue: options.newValue,
        reason: options.reason
    };
}
function batchFix(batchId, fixes) {
    const results = [];
    for (const fix of fixes) {
        try {
            const result = fixRecord(fix);
            results.push(result);
        }
        catch (error) {
            console.error(`修复记录 ${fix.recordId} 失败:`, error.message);
        }
    }
    const db = (0, database_1.getDatabase)();
    const fixedCount = db.prepare(`
    SELECT COUNT(*) as count FROM visitor_records 
    WHERE batch_id = ? AND status = ?
  `).get(batchId, types_1.RecordStatus.FIXED);
    db.prepare(`
    UPDATE import_batches 
    SET status = 'fixed', updated_at = ? 
    WHERE id = ?
  `).run((0, utils_1.now)(), batchId);
    (0, auditService_1.logAudit)({
        batchId,
        operator: fixes[0]?.operator || 'system',
        action: 'batch_fix',
        newValue: { fixedCount: fixedCount?.count || results.length }
    });
    return results;
}
function getFixedRecords(batchId) {
    const db = (0, database_1.getDatabase)();
    return db.prepare(`
    SELECT 
      vr.*,
      al.old_value,
      al.new_value
    FROM visitor_records vr
    JOIN audit_logs al ON vr.id = al.record_id
    WHERE vr.batch_id = ? AND vr.status = ? AND al.action = 'fix_record'
    ORDER BY vr.original_line_no
  `).all(batchId, types_1.RecordStatus.FIXED);
}
function autoFixBySuggestion(batchId, operator) {
    const db = (0, database_1.getDatabase)();
    const failedRecords = db.prepare(`
    SELECT * FROM visitor_records 
    WHERE batch_id = ? AND status = ?
  `).all(batchId, types_1.RecordStatus.INVALID);
    const fixes = [];
    for (const record of failedRecords) {
        if (!record.check_result)
            continue;
        const checkResults = JSON.parse(record.check_result);
        for (const check of checkResults) {
            if (check.message === '开始时间晚于结束时间') {
                fixes.push({
                    recordId: record.id,
                    field: 'endTime',
                    newValue: '23:59:59',
                    operator,
                    reason: '自动修复：将结束时间设为当天23:59:59'
                });
            }
            if (check.message.includes('手机号格式不正确') && record.visitor_phone) {
                const cleanPhone = record.visitor_phone.replace(/\D/g, '');
                if (cleanPhone.length === 11) {
                    fixes.push({
                        recordId: record.id,
                        field: 'visitorPhone',
                        newValue: cleanPhone,
                        operator,
                        reason: '自动修复：清除手机号中的非数字字符'
                    });
                }
            }
        }
    }
    return batchFix(batchId, fixes);
}
