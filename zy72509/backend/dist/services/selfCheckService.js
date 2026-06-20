"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSelfCheck = runSelfCheck;
exports.getSelfCheckResults = getSelfCheckResults;
exports.resolveSelfCheck = resolveSelfCheck;
const uuid_1 = require("uuid");
const database_1 = require("../database");
const types_1 = require("../types");
const maskService_1 = require("./maskService");
function readAllRecords() {
    return database_1.records.getAll();
}
function runSelfCheck() {
    const allRecords = readAllRecords();
    const results = [];
    const now = Date.now();
    const sessionMap = new Map();
    allRecords.forEach((r) => {
        if (!sessionMap.has(r.session_id))
            sessionMap.set(r.session_id, []);
        sessionMap.get(r.session_id).push(r);
    });
    for (const [sessionId, sessionRecords] of sessionMap.entries()) {
        if (sessionRecords.length > 1) {
            sessionRecords.slice(1).forEach((record) => {
                results.push({
                    id: (0, uuid_1.v4)(),
                    record_id: record.id,
                    check_type: types_1.SelfCheckType.DUPLICATE_IMPORT,
                    description: `会话 ${sessionId} 存在重复导入记录（共 ${sessionRecords.length} 条）`,
                    severity: 'medium',
                    is_resolved: false,
                    created_at: now,
                });
            });
        }
    }
    const phoneLeakRecordIds = [];
    allRecords.forEach((record) => {
        const audits = (0, maskService_1.auditRecordPhones)({
            phone_number: record.phone_number,
            user_query: record.user_query,
            annotator_comment: record.annotator_comment,
            model_output: record.model_output,
        });
        if (audits.length > 0) {
            phoneLeakRecordIds.push(record.id);
            const locations = audits.map((a) => `${a.fieldName}(${a.occurrences.length}个)`).join('、');
            results.push({
                id: (0, uuid_1.v4)(),
                record_id: record.id,
                check_type: types_1.SelfCheckType.PHONE_LEAKED,
                description: `手机号在导出中可能漏遮，涉及位置：${locations}`,
                severity: 'high',
                is_resolved: false,
                created_at: now,
            });
        }
    });
    allRecords.forEach((record) => {
        if (record.version > 1 && record.review_status === 'pending') {
            results.push({
                id: (0, uuid_1.v4)(),
                record_id: record.id,
                check_type: types_1.SelfCheckType.RECALC_NEEDED,
                description: `记录已补录更新（版本 ${record.version}），需要重新计算审核结果`,
                severity: 'medium',
                is_resolved: false,
                created_at: now,
            });
        }
    });
    const maskedPhoneMap = new Map();
    allRecords.forEach((r) => {
        const masked = (0, maskService_1.maskPhone)(r.phone_number || '');
        if (masked && masked.includes('****')) {
            if (!maskedPhoneMap.has(masked))
                maskedPhoneMap.set(masked, []);
            maskedPhoneMap.get(masked).push(r);
        }
    });
    for (const [masked, phoneRecords] of maskedPhoneMap.entries()) {
        if (phoneRecords.length > 1) {
            const sourceNames = phoneRecords.map((r) => `${r.session_id}(版本${r.version})`).join('、');
            phoneRecords.slice(1).forEach((record) => {
                results.push({
                    id: (0, uuid_1.v4)(),
                    record_id: record.id,
                    check_type: types_1.SelfCheckType.EXPORT_INCONSISTENT,
                    description: `导出一致：脱敏手机号 ${masked} 对应 ${phoneRecords.length} 条记录（${sourceNames}），同一批重传会翻倍，导出时将自动去重仅保留最早1条`,
                    severity: 'high',
                    is_resolved: false,
                    created_at: now,
                });
            });
        }
    }
    allRecords.forEach((record) => {
        if (!record.phone_number)
            return;
        const masked = (0, maskService_1.maskPhone)(record.phone_number);
        const traced = database_1.records.getByMaskedPhone(masked);
        if (traced.length === 0) {
            results.push({
                id: (0, uuid_1.v4)(),
                record_id: record.id,
                check_type: types_1.SelfCheckType.EXPORT_INCONSISTENT,
                description: `导出一致：脱敏手机号 ${masked} 无法通过反向追溯到原始记录，导出明细将缺失溯源链`,
                severity: 'high',
                is_resolved: false,
                created_at: now,
            });
        }
        const maskedQuery = (0, maskService_1.maskText)(record.user_query || '');
        const maskedComment = (0, maskService_1.maskText)(record.annotator_comment || '');
        const maskedOutput = (0, maskService_1.maskText)(record.model_output || '');
        const rawRemainInQuery = (0, maskService_1.checkPhoneLeaked)(maskedQuery);
        const rawRemainInComment = (0, maskService_1.checkPhoneLeaked)(maskedComment);
        const rawRemainInOutput = (0, maskService_1.checkPhoneLeaked)(maskedOutput);
        if (rawRemainInQuery || rawRemainInComment || rawRemainInOutput) {
            const failedFields = [];
            if (rawRemainInQuery)
                failedFields.push('用户问题');
            if (rawRemainInComment)
                failedFields.push('标注员留言');
            if (rawRemainInOutput)
                failedFields.push('模型输出');
            results.push({
                id: (0, uuid_1.v4)(),
                record_id: record.id,
                check_type: types_1.SelfCheckType.EXPORT_INCONSISTENT,
                description: `导出一致：${failedFields.join('、')} 字段脱敏后仍有明文手机号残留，页面展示和导出明细会出现一个地方异常另一个地方消失的问题`,
                severity: 'high',
                is_resolved: false,
                created_at: now,
            });
        }
    });
    let phoneLeakInExportCount = 0;
    allRecords.forEach((record) => {
        const audits = (0, maskService_1.auditRecordPhones)({
            phone_number: record.phone_number,
            user_query: record.user_query,
            annotator_comment: record.annotator_comment,
            model_output: record.model_output,
        });
        if (audits.length > 0)
            phoneLeakInExportCount++;
    });
    if (phoneLeakRecordIds.length !== phoneLeakInExportCount && allRecords.length > 0) {
        results.push({
            id: (0, uuid_1.v4)(),
            record_id: allRecords[0].id,
            check_type: types_1.SelfCheckType.EXPORT_INCONSISTENT,
            description: `导出一致：自检标记手机号漏遮 ${phoneLeakRecordIds.length} 条，导出汇总统计 ${phoneLeakInExportCount} 条，数量不一致`,
            severity: 'high',
            is_resolved: false,
            created_at: now,
        });
    }
    database_1.selfCheck.clear();
    results.forEach((r) => database_1.selfCheck.add(r));
    return results;
}
function getSelfCheckResults(onlyUnresolved = true) {
    let results = database_1.selfCheck.getAll();
    if (onlyUnresolved) {
        results = results.filter((r) => !r.is_resolved);
    }
    results.sort((a, b) => {
        const sevOrder = { high: 0, medium: 1, low: 2 };
        const sevDiff = sevOrder[a.severity] - sevOrder[b.severity];
        if (sevDiff !== 0)
            return sevDiff;
        return b.created_at - a.created_at;
    });
    return results;
}
function resolveSelfCheck(id) {
    database_1.selfCheck.resolve(id);
}
