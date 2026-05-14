"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchService = void 0;
const dataStore_1 = require("../store/dataStore");
const ruleEngine_1 = require("./ruleEngine");
function generateId() {
    return Math.random().toString(36).substring(2, 15);
}
class BatchService {
    static createPreview(name, type, targetIds, createdBy) {
        const affectedItems = targetIds.map(id => {
            const inquiry = dataStore_1.DataStore.getInquiryById(id);
            return {
                id,
                title: inquiry?.title || '未知询价单',
                impact: '将执行复核操作'
            };
        });
        const warnings = [];
        const duplicateCount = affectedItems.filter(item => item.impact.includes('重复')).length;
        if (duplicateCount > 0) {
            warnings.push(`检测到 ${duplicateCount} 条可能存在重复提交的记录`);
        }
        const operation = {
            id: generateId(),
            name,
            type,
            status: 'preview',
            targetIds,
            previewResult: {
                affectedCount: targetIds.length,
                affectedItems,
                warnings
            },
            createdAt: new Date().toISOString(),
            createdBy
        };
        dataStore_1.DataStore.addBatchOperation(operation);
        return operation;
    }
    static executeBatch(operationId) {
        const operation = dataStore_1.DataStore.getBatchOperations().find(o => o.id === operationId);
        if (!operation) {
            throw new Error(`Batch operation ${operationId} not found`);
        }
        if (operation.status !== 'preview') {
            throw new Error('Batch operation can only be executed from preview state');
        }
        const ruleEngine = new ruleEngine_1.RuleEngine();
        for (const inquiryId of operation.targetIds) {
            const inquiry = dataStore_1.DataStore.getInquiryById(inquiryId);
            if (inquiry) {
                const result = ruleEngine.review(inquiry);
                dataStore_1.DataStore.addReviewResult(result);
            }
        }
        const updatedOperation = {
            ...operation,
            status: 'completed',
            executedAt: new Date().toISOString()
        };
        dataStore_1.DataStore.updateBatchOperation(updatedOperation);
        return updatedOperation;
    }
    static getBatchOperations() {
        return dataStore_1.DataStore.getBatchOperations();
    }
    static getBatchOperationById(id) {
        return dataStore_1.DataStore.getBatchOperations().find(o => o.id === id);
    }
}
exports.BatchService = BatchService;
