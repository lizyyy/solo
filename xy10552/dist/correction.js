"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.manualCorrect = manualCorrect;
exports.getManualCorrections = getManualCorrections;
exports.approveResult = approveResult;
exports.rejectResult = rejectResult;
const database_1 = require("./database");
const uuid_1 = require("uuid");
function manualCorrect(input) {
    const db = (0, database_1.getDb)();
    const result = db.prepare('SELECT * FROM check_results WHERE id = ?').get(input.resultId);
    if (!result) {
        return {
            success: false,
            message: `Check result ${input.resultId} not found`,
            oldStatus: 'PASS',
            newStatus: input.newStatus
        };
    }
    const oldStatus = result.status;
    if (oldStatus === input.newStatus) {
        return {
            success: false,
            message: `Status is already ${input.newStatus}`,
            oldStatus,
            newStatus: input.newStatus
        };
    }
    db.prepare(`
    UPDATE check_results 
    SET status = ?, check_time = datetime('now')
    WHERE id = ?
  `).run(input.newStatus, input.resultId);
    const diff = {
        status: {
            from: oldStatus,
            to: input.newStatus
        },
        modifiedAt: new Date().toISOString(),
        modifiedBy: input.correctedBy,
        comment: input.comment || null
    };
    const correctionId = (0, uuid_1.v4)();
    db.prepare(`
    INSERT INTO manual_corrections (id, check_result_id, corrected_by, old_status, new_status, comment, diff_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(correctionId, input.resultId, input.correctedBy, oldStatus, input.newStatus, input.comment, JSON.stringify(diff));
    const historyId = (0, uuid_1.v4)();
    db.prepare(`
    INSERT INTO status_history (id, check_result_id, from_status, to_status, reason, operator)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(historyId, input.resultId, oldStatus, input.newStatus, input.comment || 'Manual correction', input.correctedBy);
    return {
        success: true,
        message: `Successfully corrected status from ${oldStatus} to ${input.newStatus}`,
        oldStatus,
        newStatus: input.newStatus
    };
}
function getManualCorrections(resultId) {
    const db = (0, database_1.getDb)();
    return db.prepare(`
    SELECT * FROM manual_corrections 
    WHERE check_result_id = ?
    ORDER BY created_at ASC
  `).all(resultId);
}
function approveResult(resultId, approver, comment) {
    return manualCorrect({
        resultId,
        newStatus: 'MANUALLY_APPROVED',
        correctedBy: approver,
        comment: comment || 'Manual approval'
    });
}
function rejectResult(resultId, rejecter, comment) {
    return manualCorrect({
        resultId,
        newStatus: 'MANUALLY_REJECTED',
        correctedBy: rejecter,
        comment: comment || 'Manual rejection'
    });
}
