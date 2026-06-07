"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addTrackRemark = addTrackRemark;
exports.retainReworkRemark = retainReworkRemark;
exports.reviewReworkRemark = reviewReworkRemark;
exports.getTrackRemarksWithRework = getTrackRemarksWithRework;
const data_store_1 = require("../store/data-store");
function addTrackRemark(ticketRowId, type, content, addedBy, isReworkReason = false, retainReason) {
    const row = data_store_1.dataStore.getTicketRow(ticketRowId);
    if (!row)
        return null;
    const remark = {
        id: data_store_1.dataStore.generateId(),
        trackId: row.trackId,
        type,
        content,
        addedBy,
        addedAt: new Date().toISOString(),
        isReworkReason,
        retainedBy: isReworkReason ? addedBy : undefined,
        retainReason: isReworkReason ? retainReason : undefined,
    };
    const newRemarks = [...row.trackRemarks, remark];
    let newStatus = row.processingStatus;
    if (isReworkReason && row.processingStatus !== 'pending_review' && row.processingStatus !== 'reviewed_rework') {
        newStatus = 'rework_detected';
    }
    data_store_1.dataStore.updateTicketRow(ticketRowId, {
        trackRemarks: newRemarks,
        processingStatus: newStatus,
        lastUpdatedBy: addedBy,
    });
    return remark;
}
function retainReworkRemark(ticketRowId, remarkId, retainedBy, retainReason) {
    const row = data_store_1.dataStore.getTicketRow(ticketRowId);
    if (!row)
        return false;
    const remark = row.trackRemarks.find(r => r.id === remarkId);
    if (!remark || !remark.isReworkReason)
        return false;
    const newRemarks = row.trackRemarks.map(r => r.id === remarkId
        ? { ...r, retainedBy, retainReason }
        : r);
    data_store_1.dataStore.updateTicketRow(ticketRowId, {
        trackRemarks: newRemarks,
        processingStatus: 'pending_review',
        lastUpdatedBy: retainedBy,
    });
    return true;
}
function reviewReworkRemark(ticketRowId, remarkId, reviewedBy, approveAsNormal) {
    const row = data_store_1.dataStore.getTicketRow(ticketRowId);
    if (!row)
        return false;
    const remark = row.trackRemarks.find(r => r.id === remarkId);
    if (!remark || !remark.isReworkReason)
        return false;
    const newStatus = approveAsNormal ? 'reviewed_normal' : 'reviewed_rework';
    data_store_1.dataStore.updateTicketRow(ticketRowId, {
        processingStatus: newStatus,
        lastUpdatedBy: reviewedBy,
    });
    return true;
}
function getTrackRemarksWithRework(ticketRowId) {
    const row = data_store_1.dataStore.getTicketRow(ticketRowId);
    if (!row)
        return [];
    return row.trackRemarks.filter(r => r.isReworkReason);
}
