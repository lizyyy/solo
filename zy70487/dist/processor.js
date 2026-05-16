"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processor = exports.MessageProcessor = void 0;
const uuid_1 = require("uuid");
const database_1 = require("./database");
const blockRules_1 = require("./blockRules");
const types_1 = require("./types");
class MessageProcessor {
    async createTempTicket(params) {
        const ticket = {
            id: (0, uuid_1.v4)(),
            ...params,
            createdAt: new Date()
        };
        return database_1.db.saveTempTicket(ticket);
    }
    async createBatch(params) {
        const batchId = (0, uuid_1.v4)();
        const now = new Date();
        const messageRecords = params.records.map(record => ({
            id: (0, uuid_1.v4)(),
            batchId,
            ticketId: params.ticketId,
            ...record,
            status: types_1.ProcessingStatus.PENDING,
            operator: params.operator,
            createdAt: now,
            reviewRecords: []
        }));
        const batch = {
            id: batchId,
            batchNo: params.batchNo,
            name: params.name,
            operator: params.operator,
            totalCount: messageRecords.length,
            successCount: 0,
            failedCount: 0,
            blockedCount: 0,
            status: types_1.ProcessingStatus.PENDING,
            createdAt: now
        };
        await database_1.db.saveBatch(batch);
        await database_1.db.saveMessageRecords(messageRecords);
        return batch;
    }
    async previewBatch(batchId) {
        const records = await database_1.db.findMessageRecordsByBatch(batchId);
        if (records.length === 0) {
            throw new Error('批次不存在或无记录');
        }
        const batch = await database_1.db.findBatchById(batchId);
        if (!batch) {
            throw new Error('批次不存在');
        }
        const ticket = await database_1.db.findTempTicketById(records[0].ticketId);
        if (!ticket) {
            throw new Error('临时票不存在');
        }
        let success = 0;
        let blocked = 0;
        let failed = 0;
        const results = records.map(record => {
            const blockReason = (0, blockRules_1.checkBlockRules)(record, ticket);
            if (blockReason) {
                blocked++;
                return {
                    recordId: record.id,
                    userName: record.userName,
                    phone: record.phone,
                    status: types_1.ProcessingStatus.BLOCKED,
                    reason: blockReason
                };
            }
            success++;
            return {
                recordId: record.id,
                userName: record.userName,
                phone: record.phone,
                status: types_1.ProcessingStatus.SUCCESS,
                reason: '符合处理条件'
            };
        });
        return {
            batchId,
            total: records.length,
            success,
            failed,
            blocked,
            results
        };
    }
    async processBatch(batchId) {
        const records = await database_1.db.findMessageRecordsByBatch(batchId);
        if (records.length === 0) {
            throw new Error('批次不存在或无记录');
        }
        const batch = await database_1.db.findBatchById(batchId);
        if (!batch) {
            throw new Error('批次不存在');
        }
        const ticket = await database_1.db.findTempTicketById(records[0].ticketId);
        if (!ticket) {
            throw new Error('临时票不存在');
        }
        let success = 0;
        let blocked = 0;
        let failed = 0;
        const now = new Date();
        const results = await Promise.all(records.map(async (record) => {
            const blockReason = (0, blockRules_1.checkBlockRules)(record, ticket);
            if (blockReason) {
                blocked++;
                await database_1.db.updateMessageRecord(record.id, {
                    status: types_1.ProcessingStatus.EARLY_TERMINATION_BLOCKED,
                    blockReason,
                    processedAt: now
                });
                return {
                    recordId: record.id,
                    userName: record.userName,
                    phone: record.phone,
                    status: types_1.ProcessingStatus.EARLY_TERMINATION_BLOCKED,
                    reason: blockReason
                };
            }
            success++;
            await database_1.db.updateMessageRecord(record.id, {
                status: types_1.ProcessingStatus.SUCCESS,
                processedAt: now
            });
            return {
                recordId: record.id,
                userName: record.userName,
                phone: record.phone,
                status: types_1.ProcessingStatus.SUCCESS,
                reason: '处理成功'
            };
        }));
        const batchStatus = blocked > 0 && success > 0
            ? types_1.ProcessingStatus.PARTIAL_SUCCESS
            : blocked > 0
                ? types_1.ProcessingStatus.BLOCKED
                : types_1.ProcessingStatus.SUCCESS;
        await database_1.db.updateBatch(batchId, {
            successCount: success,
            blockedCount: blocked,
            failedCount: failed,
            status: batchStatus,
            completedAt: now
        });
        return {
            batchId,
            total: records.length,
            success,
            failed,
            blocked,
            results
        };
    }
    async reviewMessage(params) {
        const record = await database_1.db.findMessageRecordById(params.messageId);
        if (!record) {
            throw new Error('消息记录不存在');
        }
        const reviewRecord = {
            id: (0, uuid_1.v4)(),
            messageId: params.messageId,
            reviewer: params.reviewer,
            reviewOpinion: params.reviewOpinion,
            serviceTicketNo: params.serviceTicketNo,
            originalConclusion: record.status,
            newConclusion: params.newConclusion,
            reviewedAt: new Date()
        };
        await database_1.db.saveReviewRecord(reviewRecord);
        await database_1.db.updateMessageRecord(params.messageId, {
            status: params.newConclusion,
            reviewRecords: [...record.reviewRecords, reviewRecord]
        });
        return reviewRecord;
    }
    async queryRecords(filters) {
        let records = await database_1.db.findAllMessageRecords();
        if (filters) {
            if (filters.batchId) {
                records = records.filter(r => r.batchId === filters.batchId);
            }
            if (filters.operator) {
                records = records.filter(r => r.operator === filters.operator);
            }
            if (filters.riskType) {
                records = records.filter(r => r.riskType === filters.riskType);
            }
            if (filters.status) {
                records = records.filter(r => r.status === filters.status);
            }
        }
        return records;
    }
    async queryBatches() {
        return database_1.db.findAllBatches();
    }
    async getRecordDetail(recordId) {
        const record = await database_1.db.findMessageRecordById(recordId);
        if (!record) {
            return null;
        }
        const reviews = await database_1.db.findReviewRecordsByMessage(recordId);
        return { record, reviews };
    }
}
exports.MessageProcessor = MessageProcessor;
exports.processor = new MessageProcessor();
