"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addAudioFileRemark = addAudioFileRemark;
exports.addRehearsalChange = addRehearsalChange;
exports.addManualChange = addManualChange;
exports.getRehearsalChangeDetail = getRehearsalChangeDetail;
exports.getTracksWithRework = getTracksWithRework;
const data_store_1 = require("../store/data-store");
function addAudioFileRemark(ticketRowId, audioRemark, addedBy) {
    const row = data_store_1.dataStore.getTicketRow(ticketRowId);
    if (!row)
        return false;
    const now = new Date().toISOString();
    let manualChanges = [...row.manualChanges];
    if (row.audioFileRemark) {
        manualChanges.push({
            changedAt: now,
            changedBy: addedBy,
            fieldName: 'audioFileRemark',
            oldValue: row.audioFileRemark,
            newValue: audioRemark,
            reason: '音频文件备注补充更新',
        });
    }
    const hasRework = audioRemark.includes('返工') || audioRemark.includes('重录') || audioRemark.includes('不合格');
    let newStatus = row.processingStatus;
    if (row.processingStatus === 'imported') {
        newStatus = hasRework ? 'rework_detected' : 'audio_remark_added';
    }
    else if (hasRework && row.processingStatus !== 'pending_review' && row.processingStatus !== 'reviewed_rework') {
        newStatus = 'rework_detected';
    }
    data_store_1.dataStore.updateTicketRow(ticketRowId, {
        audioFileRemark: audioRemark,
        audioRemarkAddedBy: addedBy,
        audioRemarkAddedAt: now,
        manualChanges,
        processingStatus: newStatus,
        lastUpdatedBy: addedBy,
    });
    return true;
}
function addRehearsalChange(ticketRowId, changeType, oldValue, newValue, reason, changedBy, relatedRemarkId) {
    const row = data_store_1.dataStore.getTicketRow(ticketRowId);
    if (!row)
        return null;
    const change = {
        id: data_store_1.dataStore.generateId(),
        trackId: row.trackId,
        changeType,
        oldValue,
        newValue,
        changedBy,
        changedAt: new Date().toISOString(),
        reason,
        relatedRemarkId,
    };
    const newChanges = [...row.rehearsalChanges, change];
    let newStatus = row.processingStatus;
    if (row.processingStatus === 'audio_remark_added' || row.processingStatus === 'reviewed_normal') {
        newStatus = 'rehearsal_updated';
    }
    data_store_1.dataStore.updateTicketRow(ticketRowId, {
        rehearsalChanges: newChanges,
        processingStatus: newStatus,
        lastUpdatedBy: changedBy,
    });
    return change;
}
function addManualChange(ticketRowId, fieldName, oldValue, newValue, reason, changedBy) {
    const row = data_store_1.dataStore.getTicketRow(ticketRowId);
    if (!row)
        return false;
    const change = {
        changedAt: new Date().toISOString(),
        changedBy,
        fieldName,
        oldValue,
        newValue,
        reason,
    };
    data_store_1.dataStore.updateTicketRow(ticketRowId, {
        manualChanges: [...row.manualChanges, change],
        lastUpdatedBy: changedBy,
    });
    return true;
}
function getRehearsalChangeDetail(ticketRowId, changeId) {
    const row = data_store_1.dataStore.getTicketRow(ticketRowId);
    if (!row)
        return null;
    return row.rehearsalChanges.find(c => c.id === changeId) || null;
}
function getTracksWithRework() {
    const rows = data_store_1.dataStore.getAllTicketRows();
    const trackSet = new Set();
    for (const row of rows) {
        const hasReworkRemark = row.trackRemarks.some(r => r.isReworkReason);
        const hasReworkAudio = row.audioFileRemark?.includes('返工') || row.audioFileRemark?.includes('重录');
        if (hasReworkRemark || hasReworkAudio) {
            trackSet.add(row.trackId);
        }
    }
    return Array.from(trackSet);
}
