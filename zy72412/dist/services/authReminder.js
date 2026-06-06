"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectMixedBatches = detectMixedBatches;
exports.generateInitialRemindersForBatch = generateInitialRemindersForBatch;
exports.updateReminderAfterAudioRemark = updateReminderAfterAudioRemark;
exports.recordingEngineerReview = recordingEngineerReview;
exports.getReminderByTicketId = getReminderByTicketId;
exports.getRemindersByAssignee = getRemindersByAssignee;
exports.getAllReminders = getAllReminders;
exports.markReminderRead = markReminderRead;
const database_1 = require("../db/database");
const ticketImporter_1 = require("./ticketImporter");
function detectMixedBatches() {
    const db = (0, database_1.getDb)();
    return db.ticketBatches
        .filter(b => b.hasMixedTypes && b.reviewStatus === 'new')
        .map(b => b.batchId);
}
function generateInitialRemindersForBatch(batchId) {
    const batch = (0, ticketImporter_1.getBatchById)(batchId);
    if (!batch)
        return [];
    const tickets = (0, ticketImporter_1.getTicketsByBatch)(batchId);
    const reminders = [];
    const db = (0, database_1.getDb)();
    const now = new Date().toISOString();
    for (const ticket of tickets) {
        if (!ticket.id)
            continue;
        let status = 'pending';
        let reason = '';
        let missingMaterials = [];
        let nextStep = '';
        let assignee = 'copyright_operations';
        if (batch.hasMixedTypes) {
            status = 'needs_review';
            reason = `该票所属批次(${batchId})存在赠票与售票混排情况，需录音师复核确认授权边界`;
            missingMaterials = ['录音师复核确认', '音频文件授权备注'];
            nextStep = '请录音师确认该票是否在授权范围内，补充音频文件备注后版权运营可继续处理';
            assignee = 'recording_engineer';
        }
        else if (ticket.ticketType === 'complimentary') {
            status = 'needs_review';
            reason = '赠票需确认是否在采样包授权范围内';
            missingMaterials = ['赠票授权确认函', '音频文件备注'];
            nextStep = '请版权运营小鹿核对赠票名单，确认是否需要额外授权材料';
            assignee = 'copyright_operations';
        }
        else {
            status = 'pending';
            reason = '售票待核对音频文件备注';
            missingMaterials = ['音频文件备注'];
            nextStep = '请版权运营小鹿补录音频文件备注信息';
            assignee = 'copyright_operations';
        }
        const existingReminderIdx = db.authReminders.findIndex(r => r.ticketId === ticket.id);
        const reminderId = existingReminderIdx >= 0 ? db.authReminders[existingReminderIdx].id : (0, database_1.getNextReminderId)();
        const reminder = {
            id: reminderId,
            ticketId: ticket.id,
            ticketNo: ticket.ticketNo,
            batchId,
            status,
            reason,
            missingMaterials,
            nextStep,
            assignee,
            isRead: false,
            createdAt: existingReminderIdx >= 0 ? db.authReminders[existingReminderIdx].createdAt : now,
            updatedAt: now
        };
        if (existingReminderIdx >= 0) {
            db.authReminders[existingReminderIdx] = reminder;
        }
        else {
            db.authReminders.push(reminder);
        }
        reminders.push(reminder);
        const ticketIdx = db.tickets.findIndex(t => t.id === ticket.id);
        if (ticketIdx >= 0) {
            db.tickets[ticketIdx].authStatus = status;
            db.tickets[ticketIdx].updatedAt = now;
        }
    }
    const batchIdx = db.ticketBatches.findIndex(b => b.batchId === batchId);
    if (batchIdx >= 0) {
        db.ticketBatches[batchIdx].reviewStatus = 'in_review';
    }
    (0, database_1.saveDb)();
    return reminders;
}
function updateReminderAfterAudioRemark(ticketId, audioRemark) {
    const ticket = (0, ticketImporter_1.getTicketById)(ticketId);
    if (!ticket || !ticket.id)
        return null;
    const db = (0, database_1.getDb)();
    const now = new Date().toISOString();
    const batch = (0, ticketImporter_1.getBatchById)(ticket.batchId);
    let newStatus = 'audio_verified';
    let reason = '';
    let missingMaterials = [];
    let nextStep = '';
    let assignee = 'copyright_operations';
    if (batch?.hasMixedTypes) {
        newStatus = 'needs_review';
        reason = `音频备注已补充: "${audioRemark}"，但批次存在混排，仍需录音师最终确认`;
        missingMaterials = ['录音师最终复核确认'];
        nextStep = '请录音师根据音频备注确认该票授权状态';
        assignee = 'recording_engineer';
    }
    else if (ticket.ticketType === 'complimentary') {
        newStatus = 'audio_verified';
        reason = `音频备注已补充: "${audioRemark}"，赠票待版权运营最终确认`;
        missingMaterials = ['赠票最终授权确认'];
        nextStep = '请版权运营小鹿根据音频备注确认赠票授权';
        assignee = 'copyright_operations';
    }
    else {
        newStatus = 'audio_verified';
        reason = `音频备注已补充: "${audioRemark}"，售票信息完整`;
        missingMaterials = [];
        nextStep = '授权材料完整，可进入下一流程';
        assignee = 'copyright_operations';
    }
    const ticketIdx = db.tickets.findIndex(t => t.id === ticketId);
    if (ticketIdx >= 0) {
        db.tickets[ticketIdx].audioRemark = audioRemark;
        db.tickets[ticketIdx].authStatus = newStatus;
        db.tickets[ticketIdx].updatedAt = now;
    }
    const reminderIdx = db.authReminders.findIndex(r => r.ticketId === ticketId);
    if (reminderIdx >= 0) {
        db.authReminders[reminderIdx] = {
            ...db.authReminders[reminderIdx],
            status: newStatus,
            reason,
            missingMaterials,
            nextStep,
            assignee,
            updatedAt: now
        };
    }
    (0, database_1.saveDb)();
    return getReminderByTicketId(ticketId);
}
function recordingEngineerReview(ticketId, approve, remark) {
    const ticket = (0, ticketImporter_1.getTicketById)(ticketId);
    if (!ticket || !ticket.id)
        return null;
    const db = (0, database_1.getDb)();
    const now = new Date().toISOString();
    const newStatus = approve ? 'approved' : 'rejected';
    const reason = approve
        ? `录音师复核通过: "${remark}"，授权确认`
        : `录音师复核驳回: "${remark}"，不在授权范围内`;
    const missingMaterials = [];
    const nextStep = approve ? '授权已确认，可归档处理' : '需进一步沟通确认或补充材料';
    const assignee = 'copyright_operations';
    const ticketIdx = db.tickets.findIndex(t => t.id === ticketId);
    if (ticketIdx >= 0) {
        db.tickets[ticketIdx].authStatus = newStatus;
        db.tickets[ticketIdx].updatedAt = now;
    }
    const reminderIdx = db.authReminders.findIndex(r => r.ticketId === ticketId);
    if (reminderIdx >= 0) {
        db.authReminders[reminderIdx] = {
            ...db.authReminders[reminderIdx],
            status: newStatus,
            reason,
            missingMaterials,
            nextStep,
            assignee,
            updatedAt: now
        };
    }
    const ticketIdsInBatch = db.tickets.filter(t => t.batchId === ticket.batchId);
    const allReviewed = ticketIdsInBatch.every(t => t.authStatus === 'approved' || t.authStatus === 'rejected' || t.authStatus === 'audio_verified');
    if (allReviewed) {
        const batchIdx = db.ticketBatches.findIndex(b => b.batchId === ticket.batchId);
        if (batchIdx >= 0) {
            db.ticketBatches[batchIdx].reviewStatus = 'reviewed';
            db.ticketBatches[batchIdx].reviewedBy = 'recording_engineer';
            db.ticketBatches[batchIdx].reviewedAt = now;
        }
    }
    (0, database_1.saveDb)();
    return getReminderByTicketId(ticketId);
}
function getReminderByTicketId(ticketId) {
    const db = (0, database_1.getDb)();
    const reminder = db.authReminders.find(r => r.ticketId === ticketId);
    return reminder || null;
}
function getRemindersByAssignee(assignee) {
    const db = (0, database_1.getDb)();
    return db.authReminders
        .filter(r => r.assignee === assignee && !r.isRead)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
function getAllReminders() {
    const db = (0, database_1.getDb)();
    return [...db.authReminders]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
function markReminderRead(reminderId) {
    const db = (0, database_1.getDb)();
    const idx = db.authReminders.findIndex(r => r.id === reminderId);
    if (idx >= 0) {
        db.authReminders[idx].isRead = true;
        (0, database_1.saveDb)();
        return true;
    }
    return false;
}
