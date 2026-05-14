"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchProcessor = void 0;
const logistics_processor_1 = require("./logistics-processor");
const result_store_1 = require("./result-store");
const uuid_1 = require("uuid");
class BatchProcessor {
    constructor(resultStore) {
        this.logisticsProcessor = new logistics_processor_1.LogisticsProcessor();
        this.resultStore = resultStore || new result_store_1.ResultStore();
    }
    preview(items) {
        const preview = this.logisticsProcessor.createPreview(items);
        const batchItems = items.map(item => {
            const partition = this.logisticsProcessor.derivePartition(item);
            const validation = this.logisticsProcessor.validateInterception(item, this.getReferenceSchema());
            return {
                id: (0, uuid_1.v4)(),
                orderId: item.orderId,
                status: 'preview',
                schemaDiffs: validation.schemaDiffs,
                failureGroup: validation.failedPath?.split(':')[0],
                failureReason: validation.failedPath,
                lakehousePartition: partition
            };
        });
        return {
            batchId: (0, uuid_1.v4)(),
            submittedAt: new Date().toISOString(),
            totalCount: items.length,
            successCount: preview.willSucceed,
            failedCount: preview.willFail,
            skippedCount: 0,
            items: batchItems,
            previewMode: true
        };
    }
    execute(items, operator, skipPreview = false) {
        const batchId = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        const batchItems = [];
        const partitions = new Set();
        let successCount = 0;
        let failedCount = 0;
        let skippedCount = 0;
        for (const item of items) {
            const partition = this.logisticsProcessor.derivePartition(item);
            partitions.add(partition);
            const validation = this.logisticsProcessor.validateInterception(item, this.getReferenceSchema());
            const conflictCheck = this.resultStore.detectConflict(item.orderId, validation.schemaDiffs);
            let status;
            let previousResultId;
            let conflict;
            let conflictReason;
            if (conflictCheck.previousResult) {
                if (conflictCheck.conflict) {
                    conflict = true;
                    conflictReason = conflictCheck.reason;
                    status = 'failed';
                    failedCount++;
                }
                else if (conflictCheck.canReuse) {
                    previousResultId = conflictCheck.previousResult.id;
                    status = 'skipped';
                    skippedCount++;
                }
                else if (validation.valid) {
                    status = 'success';
                    successCount++;
                }
                else {
                    status = 'failed';
                    failedCount++;
                }
            }
            else if (validation.valid) {
                status = 'success';
                successCount++;
            }
            else {
                status = 'failed';
                failedCount++;
            }
            const batchItem = {
                id: (0, uuid_1.v4)(),
                orderId: item.orderId,
                status,
                previousResultId,
                conflict,
                conflictReason,
                schemaDiffs: validation.schemaDiffs,
                failureGroup: validation.failedPath?.split(':')[0],
                failureReason: validation.failedPath,
                lakehousePartition: partition
            };
            batchItems.push(batchItem);
            if (status !== 'skipped') {
                this.resultStore.storeResult({
                    batchId,
                    itemId: batchItem.id,
                    orderId: item.orderId,
                    waybillNo: item.waybillNo,
                    status: status,
                    schemaDiffs: validation.schemaDiffs,
                    failureReason: validation.failedPath,
                    failureGroup: validation.failedPath?.split(':')[0],
                    lakehousePartition: partition
                });
            }
        }
        if (partitions.size > 0) {
            const partitionList = Array.from(partitions).map(name => ({
                name,
                date: new Date().toISOString().split('T')[0],
                region: 'cn',
                recordCount: items.filter(i => this.logisticsProcessor.derivePartition(i) === name).length
            }));
            this.resultStore.addOrUpdatePartitions(partitionList);
        }
        return {
            batchId,
            submittedAt: now,
            totalCount: items.length,
            successCount,
            failedCount,
            skippedCount,
            items: batchItems,
            previewMode: false
        };
    }
    filterByFailureGroup(result, failureGroup) {
        return this.resultStore.filterByFailure(result.items, failureGroup);
    }
    getReferenceSchema() {
        return {
            status: 'intercepted',
            grayRelease: true,
            hasCompensationActions: true,
            allCompensationsExecuted: true,
            requiredCompensationsCount: 2
        };
    }
}
exports.BatchProcessor = BatchProcessor;
