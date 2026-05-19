"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ruleEngine = exports.RuleEngine = void 0;
const types_1 = require("./types");
const storage_1 = require("./storage");
class RuleEngine {
    constructor() {
        this.rules = [];
        this.registerRules();
    }
    registerRules() {
        this.rules.push({
            name: '离线柜排除',
            validate: this.offlineCabinetRule.bind(this)
        });
        this.rules.push({
            name: '重复故障合并',
            validate: this.duplicateFaultRule.bind(this)
        });
        this.rules.push({
            name: '维修前后状态一致校验',
            validate: this.maintenanceStatusRule.bind(this)
        });
    }
    offlineCabinetRule(record) {
        const isOffline = storage_1.storage.isCabinetOffline(record.cabinetId);
        if (isOffline) {
            return {
                passed: false,
                reason: `柜子 ${record.cabinetId} 处于离线状态，已拦截`,
                action: 'block'
            };
        }
        return {
            passed: true,
            reason: `柜子 ${record.cabinetId} 在线，放行`,
            action: 'allow'
        };
    }
    duplicateFaultRule(record, existingRecords) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const duplicate = existingRecords.find(r => r.id !== record.id &&
            r.cabinetId === record.cabinetId &&
            r.faultType === record.faultType &&
            r.createdAt >= oneHourAgo &&
            r.status !== types_1.RecordStatus.MERGED);
        if (duplicate) {
            return {
                passed: false,
                reason: `检测到1小时内相同故障（柜子 ${record.cabinetId}，${record.faultType}），已合并到记录 ${duplicate.id.slice(0, 8)}`,
                action: 'merge',
                relatedRecordId: duplicate.id
            };
        }
        return {
            passed: true,
            reason: '无重复故障，放行',
            action: 'allow'
        };
    }
    maintenanceStatusRule(record, existingRecords) {
        const cabinetRecords = existingRecords.filter(r => r.cabinetId === record.cabinetId);
        const lastResolved = cabinetRecords
            .filter(r => r.status === types_1.RecordStatus.RESOLVED)
            .sort((a, b) => new Date(b.resolvedAt || b.updatedAt).getTime() - new Date(a.resolvedAt || a.updatedAt).getTime())[0];
        if (lastResolved) {
            const timeSinceResolve = Date.now() - new Date(lastResolved.resolvedAt || lastResolved.updatedAt).getTime();
            const hoursSinceResolve = timeSinceResolve / (1000 * 60 * 60);
            if (hoursSinceResolve < 24) {
                return {
                    passed: true,
                    reason: `注意：柜子 ${record.cabinetId} 在 ${hoursSinceResolve.toFixed(1)} 小时前刚维修解决，建议检查维修质量`,
                    action: 'flag'
                };
            }
        }
        return {
            passed: true,
            reason: '维修状态校验通过',
            action: 'allow'
        };
    }
    validateRecord(record) {
        const existingRecords = storage_1.storage.getRecords();
        const results = [];
        let overallResult = types_1.ProcessingResult.ALLOWED;
        let primaryReason = '';
        let targetRecordId;
        let hasBlock = false;
        let hasMerge = false;
        for (const rule of this.rules) {
            const validation = rule.validate(record, existingRecords);
            results.push({
                ruleName: rule.name,
                validation
            });
            if (validation.action === 'block' && !hasBlock) {
                hasBlock = true;
                overallResult = types_1.ProcessingResult.BLOCKED;
                primaryReason = validation.reason;
            }
            else if (validation.action === 'merge' && !hasBlock && !hasMerge) {
                hasMerge = true;
                overallResult = types_1.ProcessingResult.BLOCKED;
                primaryReason = validation.reason;
                targetRecordId = validation.relatedRecordId;
            }
            else if (!primaryReason && validation.action === 'flag') {
                primaryReason = validation.reason;
            }
        }
        if (!primaryReason) {
            primaryReason = '所有规则校验通过，已放行';
        }
        return {
            overallResult,
            results,
            primaryReason,
            targetRecordId
        };
    }
    processRecord(record) {
        const validation = this.validateRecord(record);
        let processedRecord = record;
        let mergedTo;
        if (validation.targetRecordId) {
            const targetRecord = storage_1.storage.getRecord(validation.targetRecordId);
            if (targetRecord) {
                storage_1.storage.updateRecord(validation.targetRecordId, {
                    mergedFrom: [...(targetRecord.mergedFrom || []), record.id]
                });
                storage_1.storage.updateRecord(record.id, {
                    status: types_1.RecordStatus.MERGED,
                    processingResult: validation.overallResult,
                    processingReason: validation.primaryReason
                });
                mergedTo = validation.targetRecordId;
            }
        }
        else {
            storage_1.storage.updateRecord(record.id, {
                processingResult: validation.overallResult,
                processingReason: validation.primaryReason
            });
        }
        const updatedRecord = storage_1.storage.getRecord(record.id);
        if (updatedRecord) {
            processedRecord = updatedRecord;
        }
        return {
            record: processedRecord,
            overallResult: validation.overallResult,
            reason: validation.primaryReason,
            mergedTo
        };
    }
}
exports.RuleEngine = RuleEngine;
exports.ruleEngine = new RuleEngine();
