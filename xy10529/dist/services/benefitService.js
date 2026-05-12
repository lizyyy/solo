"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.benefitService = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
const storage_1 = require("../storage");
const MAX_COMPENSATION_DAYS = 90;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
function generateId() {
    return (0, uuid_1.v4)();
}
function getNow() {
    return Date.now();
}
function createLedgerEntry(params) {
    return {
        ledgerId: generateId(),
        memberId: params.memberId,
        benefitId: params.benefitId,
        operationType: params.operationType,
        beforeState: { ...params.beforeState },
        afterState: { ...params.afterState },
        changeDetail: params.changeDetail,
        operator: params.operator,
        requestId: params.requestId,
        createdAt: getNow(),
        success: params.success,
        failureReason: params.failureReason
    };
}
function saveIdempotentRecord(params) {
    const record = {
        requestId: params.requestId,
        operationType: params.operationType,
        benefitId: params.benefitId,
        memberId: params.memberId,
        result: params.result,
        createdAt: getNow()
    };
    storage_1.storage.saveIdempotentRecord(record);
}
function checkIdempotent(requestId) {
    const record = storage_1.storage.getIdempotentRecord(requestId);
    if (record) {
        return { exists: true, result: record.result };
    }
    return { exists: false };
}
function createFailureResult(requestId, message) {
    return {
        success: false,
        message,
        requestId,
        isIdempotent: false
    };
}
exports.benefitService = {
    createMember(params) {
        const idempotentCheck = checkIdempotent(params.requestId);
        if (idempotentCheck.exists) {
            return { ...idempotentCheck.result, isIdempotent: true };
        }
        const existingMember = storage_1.storage.getMemberByPhone(params.phone);
        if (existingMember) {
            const result = createFailureResult(params.requestId, `手机号 ${params.phone} 已存在会员`);
            saveIdempotentRecord({
                requestId: params.requestId,
                operationType: types_1.OperationType.CREATE_MEMBER,
                memberId: existingMember.memberId,
                result
            });
            return result;
        }
        const member = {
            memberId: generateId(),
            name: params.name,
            phone: params.phone,
            createdAt: getNow(),
            updatedAt: getNow()
        };
        storage_1.storage.saveMember(member);
        const result = {
            success: true,
            data: member,
            message: '会员创建成功',
            requestId: params.requestId,
            isIdempotent: false
        };
        saveIdempotentRecord({
            requestId: params.requestId,
            operationType: types_1.OperationType.CREATE_MEMBER,
            memberId: member.memberId,
            result
        });
        return result;
    },
    grantBenefit(params) {
        const idempotentCheck = checkIdempotent(params.requestId);
        if (idempotentCheck.exists) {
            return { ...idempotentCheck.result, isIdempotent: true };
        }
        const member = storage_1.storage.getMember(params.memberId);
        if (!member) {
            const result = createFailureResult(params.requestId, `会员 ${params.memberId} 不存在`);
            saveIdempotentRecord({
                requestId: params.requestId,
                operationType: types_1.OperationType.GRANT_BENEFIT,
                memberId: params.memberId,
                result
            });
            return result;
        }
        if (params.totalDays <= 0) {
            const result = createFailureResult(params.requestId, '权益天数必须大于0');
            saveIdempotentRecord({
                requestId: params.requestId,
                operationType: types_1.OperationType.GRANT_BENEFIT,
                memberId: params.memberId,
                result
            });
            return result;
        }
        const benefit = {
            benefitId: generateId(),
            memberId: params.memberId,
            type: params.benefitType,
            name: params.benefitName,
            totalDays: params.totalDays,
            usedDays: 0,
            remainingDays: params.totalDays,
            originalRemainingDays: params.totalDays,
            status: types_1.BenefitStatus.ACTIVE,
            freezeHistory: [],
            createdAt: getNow(),
            updatedAt: getNow(),
            expiresAt: getNow() + params.totalDays * ONE_DAY_MS
        };
        storage_1.storage.saveBenefit(benefit);
        const ledgerEntry = createLedgerEntry({
            memberId: params.memberId,
            benefitId: benefit.benefitId,
            operationType: types_1.OperationType.GRANT_BENEFIT,
            beforeState: {
                status: types_1.BenefitStatus.INVALID,
                remainingDays: 0
            },
            afterState: {
                status: types_1.BenefitStatus.ACTIVE,
                remainingDays: params.totalDays
            },
            changeDetail: `发放权益: ${params.benefitName}, 类型: ${params.benefitType}, 总天数: ${params.totalDays}天`,
            requestId: params.requestId,
            success: true
        });
        storage_1.storage.saveLedger(ledgerEntry);
        const result = {
            success: true,
            data: benefit,
            message: '权益发放成功',
            requestId: params.requestId,
            isIdempotent: false
        };
        saveIdempotentRecord({
            requestId: params.requestId,
            operationType: types_1.OperationType.GRANT_BENEFIT,
            benefitId: benefit.benefitId,
            memberId: params.memberId,
            result
        });
        return result;
    },
    freezeBenefit(params) {
        const idempotentCheck = checkIdempotent(params.requestId);
        if (idempotentCheck.exists) {
            return { ...idempotentCheck.result, isIdempotent: true };
        }
        const benefit = storage_1.storage.getBenefit(params.benefitId);
        if (!benefit) {
            const result = createFailureResult(params.requestId, `权益 ${params.benefitId} 不存在`);
            saveIdempotentRecord({
                requestId: params.requestId,
                operationType: types_1.OperationType.FREEZE,
                benefitId: params.benefitId,
                memberId: '',
                result
            });
            return result;
        }
        const beforeState = {
            status: benefit.status,
            remainingDays: benefit.remainingDays,
            freezeReason: benefit.currentFreezeReason
        };
        if (benefit.status === types_1.BenefitStatus.FROZEN) {
            const failureReason = '权益已处于冻结状态，不允许重复冻结';
            const ledgerEntry = createLedgerEntry({
                memberId: benefit.memberId,
                benefitId: benefit.benefitId,
                operationType: types_1.OperationType.FREEZE,
                beforeState,
                afterState: beforeState,
                changeDetail: `尝试冻结失败: ${failureReason}`,
                operator: params.operator,
                requestId: params.requestId,
                success: false,
                failureReason
            });
            storage_1.storage.saveLedger(ledgerEntry);
            const result = createFailureResult(params.requestId, failureReason);
            saveIdempotentRecord({
                requestId: params.requestId,
                operationType: types_1.OperationType.FREEZE,
                benefitId: benefit.benefitId,
                memberId: benefit.memberId,
                result
            });
            return result;
        }
        if (benefit.status === types_1.BenefitStatus.REFUNDED) {
            const failureReason = '权益已退款失效，不允许冻结';
            const ledgerEntry = createLedgerEntry({
                memberId: benefit.memberId,
                benefitId: benefit.benefitId,
                operationType: types_1.OperationType.FREEZE,
                beforeState,
                afterState: beforeState,
                changeDetail: `尝试冻结失败: ${failureReason}`,
                operator: params.operator,
                requestId: params.requestId,
                success: false,
                failureReason
            });
            storage_1.storage.saveLedger(ledgerEntry);
            const result = createFailureResult(params.requestId, failureReason);
            saveIdempotentRecord({
                requestId: params.requestId,
                operationType: types_1.OperationType.FREEZE,
                benefitId: benefit.benefitId,
                memberId: benefit.memberId,
                result
            });
            return result;
        }
        const isPermanent = params.reason === types_1.FreezeReason.REFUND;
        const freezeRecord = {
            freezeId: generateId(),
            reason: params.reason,
            detail: params.detail,
            frozenAt: getNow(),
            isPermanent
        };
        benefit.freezeHistory.push(freezeRecord);
        benefit.currentFreezeReason = params.reason;
        benefit.status = isPermanent ? types_1.BenefitStatus.REFUNDED : types_1.BenefitStatus.FROZEN;
        benefit.originalRemainingDays = benefit.remainingDays;
        benefit.updatedAt = getNow();
        if (isPermanent) {
            benefit.remainingDays = 0;
        }
        storage_1.storage.saveBenefit(benefit);
        const afterState = {
            status: benefit.status,
            remainingDays: benefit.remainingDays,
            freezeReason: benefit.currentFreezeReason
        };
        const ledgerEntry = createLedgerEntry({
            memberId: benefit.memberId,
            benefitId: benefit.benefitId,
            operationType: types_1.OperationType.FREEZE,
            beforeState,
            afterState,
            changeDetail: isPermanent
                ? `退款永久冻结: ${params.detail}, 剩余天数清零`
                : `临时冻结: 原因=${params.reason}, 详情=${params.detail}, 剩余天数=${benefit.remainingDays}天`,
            operator: params.operator,
            requestId: params.requestId,
            success: true
        });
        storage_1.storage.saveLedger(ledgerEntry);
        const result = {
            success: true,
            data: benefit,
            message: isPermanent ? '权益已退款永久冻结' : '权益冻结成功',
            requestId: params.requestId,
            isIdempotent: false
        };
        saveIdempotentRecord({
            requestId: params.requestId,
            operationType: types_1.OperationType.FREEZE,
            benefitId: benefit.benefitId,
            memberId: benefit.memberId,
            result
        });
        return result;
    },
    unfreezeBenefit(params) {
        const idempotentCheck = checkIdempotent(params.requestId);
        if (idempotentCheck.exists) {
            return { ...idempotentCheck.result, isIdempotent: true };
        }
        const benefit = storage_1.storage.getBenefit(params.benefitId);
        if (!benefit) {
            const result = createFailureResult(params.requestId, `权益 ${params.benefitId} 不存在`);
            saveIdempotentRecord({
                requestId: params.requestId,
                operationType: types_1.OperationType.UNFREEZE,
                benefitId: params.benefitId,
                memberId: '',
                result
            });
            return result;
        }
        const beforeState = {
            status: benefit.status,
            remainingDays: benefit.remainingDays,
            freezeReason: benefit.currentFreezeReason
        };
        if (benefit.status === types_1.BenefitStatus.ACTIVE) {
            const failureReason = '权益未处于冻结状态';
            const ledgerEntry = createLedgerEntry({
                memberId: benefit.memberId,
                benefitId: benefit.benefitId,
                operationType: types_1.OperationType.UNFREEZE,
                beforeState,
                afterState: beforeState,
                changeDetail: `尝试解冻失败: ${failureReason}`,
                operator: params.operator,
                requestId: params.requestId,
                success: false,
                failureReason
            });
            storage_1.storage.saveLedger(ledgerEntry);
            const result = createFailureResult(params.requestId, failureReason);
            saveIdempotentRecord({
                requestId: params.requestId,
                operationType: types_1.OperationType.UNFREEZE,
                benefitId: benefit.benefitId,
                memberId: benefit.memberId,
                result
            });
            return result;
        }
        if (benefit.status === types_1.BenefitStatus.REFUNDED) {
            const failureReason = '权益已退款失效，不可解冻';
            const ledgerEntry = createLedgerEntry({
                memberId: benefit.memberId,
                benefitId: benefit.benefitId,
                operationType: types_1.OperationType.UNFREEZE,
                beforeState,
                afterState: beforeState,
                changeDetail: `尝试解冻失败: ${failureReason}`,
                operator: params.operator,
                requestId: params.requestId,
                success: false,
                failureReason
            });
            storage_1.storage.saveLedger(ledgerEntry);
            const result = createFailureResult(params.requestId, failureReason);
            saveIdempotentRecord({
                requestId: params.requestId,
                operationType: types_1.OperationType.UNFREEZE,
                benefitId: benefit.benefitId,
                memberId: benefit.memberId,
                result
            });
            return result;
        }
        const latestFreeze = benefit.freezeHistory[benefit.freezeHistory.length - 1];
        if (latestFreeze && !latestFreeze.unfrozenAt) {
            latestFreeze.unfrozenAt = getNow();
            latestFreeze.unfreezeReason = params.reason;
        }
        benefit.status = types_1.BenefitStatus.ACTIVE;
        benefit.remainingDays = benefit.originalRemainingDays;
        benefit.currentFreezeReason = undefined;
        benefit.updatedAt = getNow();
        storage_1.storage.saveBenefit(benefit);
        const afterState = {
            status: benefit.status,
            remainingDays: benefit.remainingDays,
            freezeReason: benefit.currentFreezeReason
        };
        const ledgerEntry = createLedgerEntry({
            memberId: benefit.memberId,
            benefitId: benefit.benefitId,
            operationType: types_1.OperationType.UNFREEZE,
            beforeState,
            afterState,
            changeDetail: `解冻成功: 原因=${params.reason}, 恢复剩余天数=${benefit.remainingDays}天`,
            operator: params.operator,
            requestId: params.requestId,
            success: true
        });
        storage_1.storage.saveLedger(ledgerEntry);
        const result = {
            success: true,
            data: benefit,
            message: '权益解冻成功，已恢复剩余天数',
            requestId: params.requestId,
            isIdempotent: false
        };
        saveIdempotentRecord({
            requestId: params.requestId,
            operationType: types_1.OperationType.UNFREEZE,
            benefitId: benefit.benefitId,
            memberId: benefit.memberId,
            result
        });
        return result;
    },
    processRefund(params) {
        return this.freezeBenefit({
            requestId: params.requestId,
            benefitId: params.benefitId,
            reason: types_1.FreezeReason.REFUND,
            detail: params.detail,
            operator: params.operator
        });
    },
    compensateBenefit(params) {
        const idempotentCheck = checkIdempotent(params.requestId);
        if (idempotentCheck.exists) {
            return { ...idempotentCheck.result, isIdempotent: true };
        }
        const benefit = storage_1.storage.getBenefit(params.benefitId);
        if (!benefit) {
            const result = createFailureResult(params.requestId, `权益 ${params.benefitId} 不存在`);
            saveIdempotentRecord({
                requestId: params.requestId,
                operationType: types_1.OperationType.COMPENSATE,
                benefitId: params.benefitId,
                memberId: '',
                result
            });
            return result;
        }
        const beforeState = {
            status: benefit.status,
            remainingDays: benefit.remainingDays,
            freezeReason: benefit.currentFreezeReason
        };
        if (params.days <= 0 || params.days > MAX_COMPENSATION_DAYS) {
            const failureReason = `补偿天数必须在1-${MAX_COMPENSATION_DAYS}天之间`;
            const ledgerEntry = createLedgerEntry({
                memberId: benefit.memberId,
                benefitId: benefit.benefitId,
                operationType: types_1.OperationType.COMPENSATE,
                beforeState,
                afterState: beforeState,
                changeDetail: `尝试补偿失败: ${failureReason}`,
                operator: params.operator,
                requestId: params.requestId,
                success: false,
                failureReason
            });
            storage_1.storage.saveLedger(ledgerEntry);
            const result = createFailureResult(params.requestId, failureReason);
            saveIdempotentRecord({
                requestId: params.requestId,
                operationType: types_1.OperationType.COMPENSATE,
                benefitId: benefit.benefitId,
                memberId: benefit.memberId,
                result
            });
            return result;
        }
        if (benefit.status === types_1.BenefitStatus.REFUNDED) {
            const failureReason = '权益已退款失效，不允许补偿';
            const ledgerEntry = createLedgerEntry({
                memberId: benefit.memberId,
                benefitId: benefit.benefitId,
                operationType: types_1.OperationType.COMPENSATE,
                beforeState,
                afterState: beforeState,
                changeDetail: `尝试补偿失败: ${failureReason}`,
                operator: params.operator,
                requestId: params.requestId,
                success: false,
                failureReason
            });
            storage_1.storage.saveLedger(ledgerEntry);
            const result = createFailureResult(params.requestId, failureReason);
            saveIdempotentRecord({
                requestId: params.requestId,
                operationType: types_1.OperationType.COMPENSATE,
                benefitId: benefit.benefitId,
                memberId: benefit.memberId,
                result
            });
            return result;
        }
        benefit.remainingDays += params.days;
        benefit.totalDays += params.days;
        benefit.originalRemainingDays = benefit.remainingDays;
        benefit.expiresAt = benefit.expiresAt + params.days * ONE_DAY_MS;
        benefit.updatedAt = getNow();
        storage_1.storage.saveBenefit(benefit);
        const afterState = {
            status: benefit.status,
            remainingDays: benefit.remainingDays,
            freezeReason: benefit.currentFreezeReason
        };
        const ledgerEntry = createLedgerEntry({
            memberId: benefit.memberId,
            benefitId: benefit.benefitId,
            operationType: types_1.OperationType.COMPENSATE,
            beforeState,
            afterState,
            changeDetail: `人工补偿: +${params.days}天, 原因=${params.reason}, 操作人=${params.operator || '系统'}`,
            operator: params.operator,
            requestId: params.requestId,
            success: true
        });
        storage_1.storage.saveLedger(ledgerEntry);
        const result = {
            success: true,
            data: benefit,
            message: `补偿成功，新增${params.days}天权益`,
            requestId: params.requestId,
            isIdempotent: false
        };
        saveIdempotentRecord({
            requestId: params.requestId,
            operationType: types_1.OperationType.COMPENSATE,
            benefitId: benefit.benefitId,
            memberId: benefit.memberId,
            result
        });
        return result;
    },
    manualCorrect(params) {
        const idempotentCheck = checkIdempotent(params.requestId);
        if (idempotentCheck.exists) {
            return { ...idempotentCheck.result, isIdempotent: true };
        }
        const benefit = storage_1.storage.getBenefit(params.benefitId);
        if (!benefit) {
            const result = createFailureResult(params.requestId, `权益 ${params.benefitId} 不存在`);
            saveIdempotentRecord({
                requestId: params.requestId,
                operationType: types_1.OperationType.MANUAL_CORRECT,
                benefitId: params.benefitId,
                memberId: '',
                result
            });
            return result;
        }
        const beforeState = {
            status: benefit.status,
            remainingDays: benefit.remainingDays,
            freezeReason: benefit.currentFreezeReason
        };
        const diffs = [];
        const changeDetails = [];
        if (params.changes.remainingDays !== undefined && params.changes.remainingDays !== benefit.remainingDays) {
            diffs.push({
                field: 'remainingDays',
                before: benefit.remainingDays,
                after: params.changes.remainingDays
            });
            changeDetails.push(`剩余天数: ${benefit.remainingDays} → ${params.changes.remainingDays}`);
            benefit.remainingDays = params.changes.remainingDays;
            benefit.originalRemainingDays = params.changes.remainingDays;
        }
        if (params.changes.status !== undefined && params.changes.status !== benefit.status) {
            diffs.push({
                field: 'status',
                before: benefit.status,
                after: params.changes.status
            });
            changeDetails.push(`状态: ${benefit.status} → ${params.changes.status}`);
            benefit.status = params.changes.status;
        }
        if (params.changes.name !== undefined && params.changes.name !== benefit.name) {
            diffs.push({
                field: 'name',
                before: benefit.name,
                after: params.changes.name
            });
            changeDetails.push(`名称: ${benefit.name} → ${params.changes.name}`);
            benefit.name = params.changes.name;
        }
        if (diffs.length === 0) {
            const result = createFailureResult(params.requestId, '没有需要修改的内容');
            saveIdempotentRecord({
                requestId: params.requestId,
                operationType: types_1.OperationType.MANUAL_CORRECT,
                benefitId: benefit.benefitId,
                memberId: benefit.memberId,
                result
            });
            return result;
        }
        benefit.updatedAt = getNow();
        storage_1.storage.saveBenefit(benefit);
        const afterState = {
            status: benefit.status,
            remainingDays: benefit.remainingDays,
            freezeReason: benefit.currentFreezeReason
        };
        const ledgerEntry = createLedgerEntry({
            memberId: benefit.memberId,
            benefitId: benefit.benefitId,
            operationType: types_1.OperationType.MANUAL_CORRECT,
            beforeState,
            afterState,
            changeDetail: `人工修正: [${changeDetails.join('; ')}], 原因=${params.reason}, 操作人=${params.operator}`,
            operator: params.operator,
            requestId: params.requestId,
            success: true
        });
        storage_1.storage.saveLedger(ledgerEntry);
        const result = {
            success: true,
            data: { benefit, diffs },
            message: '人工修正成功',
            requestId: params.requestId,
            isIdempotent: false
        };
        saveIdempotentRecord({
            requestId: params.requestId,
            operationType: types_1.OperationType.MANUAL_CORRECT,
            benefitId: benefit.benefitId,
            memberId: benefit.memberId,
            result
        });
        return result;
    },
    queryBenefit(params) {
        const benefit = storage_1.storage.getBenefit(params.benefitId);
        if (!benefit) {
            return {
                success: false,
                message: `权益 ${params.benefitId} 不存在`,
                requestId: params.requestId || generateId(),
                isIdempotent: false
            };
        }
        const history = storage_1.storage.getLedgersByBenefit(benefit.benefitId);
        const canUnfreeze = benefit.status === types_1.BenefitStatus.FROZEN &&
            benefit.currentFreezeReason !== types_1.FreezeReason.REFUND;
        const canCompensate = benefit.status !== types_1.BenefitStatus.REFUNDED &&
            benefit.status !== types_1.BenefitStatus.EXPIRED;
        const ledgerExplanation = this.generateLedgerExplanation(history);
        return {
            success: true,
            data: {
                benefit,
                history,
                currentState: {
                    status: benefit.status,
                    remainingDays: benefit.remainingDays,
                    freezeReason: benefit.currentFreezeReason,
                    freezeHistory: benefit.freezeHistory,
                    canUnfreeze,
                    canCompensate
                },
                ledgerExplanation
            },
            message: '查询成功',
            requestId: params.requestId || generateId(),
            isIdempotent: false
        };
    },
    generateLedgerExplanation(history) {
        const explanations = [];
        for (const entry of history) {
            const dateStr = new Date(entry.createdAt).toLocaleString('zh-CN');
            const statusMap = {
                [types_1.BenefitStatus.ACTIVE]: '正常',
                [types_1.BenefitStatus.FROZEN]: '冻结',
                [types_1.BenefitStatus.REFUNDED]: '已退款',
                [types_1.BenefitStatus.EXPIRED]: '已过期',
                [types_1.BenefitStatus.COMPENSATED]: '已补偿',
                [types_1.BenefitStatus.INVALID]: '无效'
            };
            const beforeStatus = statusMap[entry.beforeState.status] || entry.beforeState.status;
            const afterStatus = statusMap[entry.afterState.status] || entry.afterState.status;
            if (entry.success) {
                explanations.push(`[${dateStr}] ${entry.changeDetail} (状态: ${beforeStatus} → ${afterStatus}, 天数: ${entry.beforeState.remainingDays} → ${entry.afterState.remainingDays})`);
            }
            else {
                explanations.push(`[${dateStr}] ❌ ${entry.changeDetail} - 失败原因: ${entry.failureReason || '未知'}`);
            }
        }
        return explanations;
    },
    queryMemberBenefits(params) {
        const member = storage_1.storage.getMember(params.memberId);
        if (!member) {
            return {
                success: false,
                message: `会员 ${params.memberId} 不存在`,
                requestId: params.requestId || generateId(),
                isIdempotent: false
            };
        }
        const benefits = storage_1.storage.getBenefitsByMember(params.memberId);
        const results = [];
        for (const benefit of benefits) {
            const queryResult = this.queryBenefit({ benefitId: benefit.benefitId });
            if (queryResult.success && queryResult.data) {
                results.push(queryResult.data);
            }
        }
        return {
            success: true,
            data: results,
            message: '查询成功',
            requestId: params.requestId || generateId(),
            isIdempotent: false
        };
    },
    getMember(params) {
        const member = storage_1.storage.getMember(params.memberId);
        if (!member) {
            return {
                success: false,
                message: `会员 ${params.memberId} 不存在`,
                requestId: generateId(),
                isIdempotent: false
            };
        }
        return {
            success: true,
            data: member,
            message: '查询成功',
            requestId: generateId(),
            isIdempotent: false
        };
    },
    exportReport(params) {
        let ledgers;
        if (params.benefitId) {
            const benefit = storage_1.storage.getBenefit(params.benefitId);
            if (!benefit) {
                return {
                    success: false,
                    message: `权益 ${params.benefitId} 不存在`,
                    requestId: generateId(),
                    isIdempotent: false
                };
            }
            ledgers = storage_1.storage.getLedgersByBenefit(params.benefitId);
        }
        else if (params.memberId) {
            const member = storage_1.storage.getMember(params.memberId);
            if (!member) {
                return {
                    success: false,
                    message: `会员 ${params.memberId} 不存在`,
                    requestId: generateId(),
                    isIdempotent: false
                };
            }
            ledgers = storage_1.storage.getLedgersByMember(params.memberId);
        }
        else {
            ledgers = storage_1.storage.getAllLedgers();
        }
        const report = ledgers.map(entry => ({
            时间: new Date(entry.createdAt).toLocaleString('zh-CN'),
            操作类型: entry.operationType,
            会员ID: entry.memberId,
            权益ID: entry.benefitId,
            操作前状态: entry.beforeState.status,
            操作后状态: entry.afterState.status,
            操作前剩余天数: entry.beforeState.remainingDays,
            操作后剩余天数: entry.afterState.remainingDays,
            操作详情: entry.changeDetail,
            操作人: entry.operator || '系统',
            是否成功: entry.success ? '是' : '否',
            失败原因: entry.failureReason || '-',
            请求ID: entry.requestId
        }));
        return {
            success: true,
            data: report,
            message: '报告导出成功',
            requestId: generateId(),
            isIdempotent: false
        };
    },
    clearAll() {
        storage_1.storage.clearAll();
    },
    getAllData() {
        return {
            members: storage_1.storage.getAllMembers(),
            benefits: storage_1.storage.getAllBenefits(),
            ledgers: storage_1.storage.getAllLedgers()
        };
    }
};
//# sourceMappingURL=benefitService.js.map