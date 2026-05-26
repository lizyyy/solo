"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessingService = void 0;
const rules_service_1 = require("./rules.service");
const idempotency_service_1 = require("./idempotency.service");
const uuid_1 = require("uuid");
class ProcessingService {
    constructor() {
        this.rulesEngine = new rules_service_1.RulesEngine();
        this.idempotencyService = new idempotency_service_1.IdempotencyService();
    }
    async processBatch(parsedData, filePaths) {
        const warnings = [];
        let fileHashes = [];
        let batchId;
        if (filePaths && filePaths.length > 0) {
            fileHashes = filePaths.map(fp => this.idempotencyService.generateFileHash(fp));
            batchId = this.idempotencyService.generateBatchId(fileHashes);
            if (this.idempotencyService.isBatchProcessed(batchId)) {
                const existingBatch = this.idempotencyService.getExistingBatch(batchId);
                warnings.push(`检测到重复提交：本批文件已于 ${existingBatch?.processedAt} 处理（批次ID: ${batchId}），共 ${existingBatch?.recordCount} 条记录。本次处理将跳过以避免重复生效。`);
                return this.buildEmptyResponse(batchId, warnings);
            }
        }
        else {
            batchId = (0, uuid_1.v4)();
        }
        this.rulesEngine.reset();
        const context = {
            packages: parsedData.packages,
            unitAgreements: parsedData.unitAgreements,
            coupons: parsedData.coupons,
            allRecords: parsedData.addItems,
        };
        const normalItems = [];
        const pendingItems = [];
        const failedItems = [];
        let totalAmount = 0;
        let couponDiscount = 0;
        let unitSettlementAmount = 0;
        parsedData.addItems.forEach(record => {
            const checkResult = this.rulesEngine.checkRecord(record, context);
            const result = {
                status: checkResult.status,
                record,
                originalFields: { ...record },
                appliedRules: checkResult.appliedRules,
                suggestions: checkResult.suggestions,
                readableExplanation: checkResult.readableExplanation,
            };
            switch (checkResult.status) {
                case 'normal':
                    normalItems.push(result);
                    const amount = record.itemPrice * record.quantity;
                    totalAmount += amount;
                    if (record.couponCode) {
                        couponDiscount += record.couponAmount || 0;
                    }
                    if (record.unitCode) {
                        unitSettlementAmount += amount;
                    }
                    break;
                case 'pending':
                    pendingItems.push(result);
                    break;
                case 'failed':
                    failedItems.push(result);
                    break;
            }
        });
        if (filePaths && filePaths.length > 0 && fileHashes.length > 0) {
            this.idempotencyService.markBatchAsProcessed(batchId, fileHashes, parsedData.addItems.length);
        }
        const allResults = [...normalItems, ...pendingItems, ...failedItems];
        const ruleViolations = this.rulesEngine.generateRuleViolations(allResults);
        return {
            batchId,
            totalCount: parsedData.addItems.length,
            normalItems,
            pendingItems,
            failedItems,
            summary: {
                normalCount: normalItems.length,
                pendingCount: pendingItems.length,
                failedCount: failedItems.length,
                totalAmount,
                couponDiscount,
                unitSettlementAmount,
            },
            warnings,
            ruleViolations,
        };
    }
    buildEmptyResponse(batchId, warnings) {
        return {
            batchId,
            totalCount: 0,
            normalItems: [],
            pendingItems: [],
            failedItems: [],
            summary: {
                normalCount: 0,
                pendingCount: 0,
                failedCount: 0,
                totalAmount: 0,
                couponDiscount: 0,
                unitSettlementAmount: 0,
            },
            warnings,
            ruleViolations: [],
        };
    }
}
exports.ProcessingService = ProcessingService;
