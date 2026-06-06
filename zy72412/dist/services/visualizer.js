"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBatchVisualization = getBatchVisualization;
exports.getOverviewChartData = getOverviewChartData;
exports.getAuthStatusSummary = getAuthStatusSummary;
exports.getTicketTrace = getTicketTrace;
const ticketImporter_1 = require("./ticketImporter");
const authReminder_1 = require("./authReminder");
const audioManager_1 = require("./audioManager");
function getBatchVisualization(batchId) {
    const batch = (0, ticketImporter_1.getBatchById)(batchId);
    if (!batch)
        return null;
    const tickets = (0, ticketImporter_1.getTicketsByBatch)(batchId);
    const audioFiles = (0, audioManager_1.getAudioFilesByBatch)(batchId);
    const audioMap = new Map(audioFiles.map(a => [a.ticketNo, a]));
    return {
        batchId: batch.batchId,
        totalCount: batch.totalCount,
        paidCount: batch.paidCount,
        complimentaryCount: batch.complimentaryCount,
        hasMixedTypes: batch.hasMixedTypes,
        reviewStatus: batch.reviewStatus,
        importDate: batch.importDate,
        tickets: tickets.map(ticket => ({
            ticketId: ticket.id,
            ticketNo: ticket.ticketNo,
            ticketType: ticket.ticketType,
            authStatus: ticket.authStatus,
            attendeeName: ticket.attendeeName,
            audioRemark: ticket.audioRemark,
            sourceLink: {
                type: audioMap.has(ticket.ticketNo) ? 'audio_file' : 'ticket_export',
                reference: audioMap.has(ticket.ticketNo)
                    ? `audio:${audioMap.get(ticket.ticketNo).fileId}`
                    : `batch:${batchId}`
            }
        }))
    };
}
function getOverviewChartData() {
    const batches = (0, ticketImporter_1.getAllBatches)();
    const mixedCount = batches.filter(b => b.hasMixedTypes).length;
    const pureCount = batches.filter(b => !b.hasMixedTypes).length;
    const newCount = batches.filter(b => b.reviewStatus === 'new').length;
    const inReviewCount = batches.filter(b => b.reviewStatus === 'in_review').length;
    const reviewedCount = batches.filter(b => b.reviewStatus === 'reviewed').length;
    return {
        labels: ['混批批次', '纯批次', '待处理', '处理中', '已完成'],
        datasets: [{
                label: '数量',
                data: [mixedCount, pureCount, newCount, inReviewCount, reviewedCount],
                backgroundColor: [
                    '#FF6B6B',
                    '#4ECDC4',
                    '#FFE66D',
                    '#45B7D1',
                    '#96CEB4'
                ]
            }]
    };
}
function getAuthStatusSummary() {
    const reminders = (0, authReminder_1.getAllReminders)();
    return reminders.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, {});
}
function getTicketTrace(ticketId) {
    const reminders = (0, authReminder_1.getAllReminders)().filter(r => r.ticketId === ticketId);
    if (reminders.length === 0)
        return null;
    const reminder = reminders[0];
    const audioFiles = (0, audioManager_1.getAudioFilesByBatch)(reminder.batchId).filter(a => a.ticketNo === reminder.ticketNo);
    return {
        ticketNo: reminder.ticketNo,
        batchId: reminder.batchId,
        authTrail: reminders.map(r => ({
            status: r.status,
            reason: r.reason,
            timestamp: r.updatedAt,
            assignee: r.assignee
        })),
        sourceReferences: [
            {
                type: 'ticket_export',
                reference: `batch:${reminder.batchId}`,
                description: '票务导出表原始记录'
            },
            ...audioFiles.map(a => ({
                type: 'audio_file',
                reference: `audio:${a.fileId}`,
                description: `音频文件: ${a.fileName}${a.remark ? ` (备注: ${a.remark})` : ''}`
            }))
        ]
    };
}
