"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllTicketRowViews = getAllTicketRowViews;
exports.getTicketRowDetailView = getTicketRowDetailView;
exports.getTicketRowViewsByBatch = getTicketRowViewsByBatch;
exports.getRehearsalChangeDetail = getRehearsalChangeDetail;
exports.getExportRows = getExportRows;
const data_store_1 = require("../store/data-store");
function toTicketRowView(row) {
    const reworkRemarks = row.trackRemarks
        .filter(r => r.isReworkReason)
        .map(r => ({
        id: r.id,
        content: r.content,
        addedBy: r.addedBy,
        addedAt: r.addedAt,
        retainedBy: r.retainedBy,
        retainReason: r.retainReason,
    }));
    return {
        id: row.id,
        originalRowNumber: row.originalRowNumber,
        studentName: row.studentName,
        instrument: row.instrument,
        trackId: row.trackId,
        currentClass: row.currentClass,
        processingStatus: row.processingStatus,
        audioFileRemark: row.audioFileRemark,
        audioRemarkAddedBy: row.audioRemarkAddedBy,
        audioRemarkAddedAt: row.audioRemarkAddedAt,
        hasReworkReason: reworkRemarks.length > 0,
        reworkRemarks,
        rehearsalChangeCount: row.rehearsalChanges.length,
        manualChangeCount: row.manualChanges.length,
        importedAt: row.importedAt,
        importedBy: row.importedBy,
        lastUpdatedAt: row.lastUpdatedAt,
        lastUpdatedBy: row.lastUpdatedBy,
    };
}
function toTicketRowDetailView(row) {
    const base = toTicketRowView(row);
    return {
        ...base,
        rawData: row.rawData,
        manualChanges: row.manualChanges,
        trackRemarks: row.trackRemarks.map(r => ({
            id: r.id,
            type: r.type,
            content: r.content,
            addedBy: r.addedBy,
            addedAt: r.addedAt,
            isReworkReason: r.isReworkReason,
            retainedBy: r.retainedBy,
            retainReason: r.retainReason,
        })),
        rehearsalChanges: row.rehearsalChanges.map(c => ({
            id: c.id,
            changeType: c.changeType,
            oldValue: c.oldValue,
            newValue: c.newValue,
            changedBy: c.changedBy,
            changedAt: c.changedAt,
            reason: c.reason,
        })),
    };
}
function getAllTicketRowViews() {
    return data_store_1.dataStore.getAllTicketRows().map(toTicketRowView);
}
function getTicketRowDetailView(id) {
    const row = data_store_1.dataStore.getTicketRow(id);
    if (!row)
        return null;
    return toTicketRowDetailView(row);
}
function getTicketRowViewsByBatch(batchId) {
    return data_store_1.dataStore.getTicketRowsByBatch(batchId).map(toTicketRowView);
}
function getRehearsalChangeDetail(rowId, changeId) {
    const row = data_store_1.dataStore.getTicketRow(rowId);
    if (!row)
        return null;
    return row.rehearsalChanges.find(c => c.id === changeId) || null;
}
function getExportRows() {
    const rows = data_store_1.dataStore.getAllTicketRows();
    return rows.map(row => {
        const reworkRemarkContents = row.trackRemarks
            .filter(r => r.isReworkReason)
            .map(r => r.content)
            .join('; ');
        return {
            '原始行号': String(row.originalRowNumber),
            '学生姓名': row.studentName,
            '乐器': row.instrument,
            '轨道编号': row.trackId,
            '分班结果': row.currentClass || '',
            '处理状态': row.processingStatus,
            '音频文件备注': row.audioFileRemark || '',
            '含返工原因': row.trackRemarks.some(r => r.isReworkReason) ? '是' : '否',
            '返工原因详情': reworkRemarkContents,
            '排练变更次数': String(row.rehearsalChanges.length),
            '人工改动次数': String(row.manualChanges.length),
            '导入时间': row.importedAt,
            '最后更新时间': row.lastUpdatedAt,
        };
    });
}
