"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecords = getRecords;
exports.getRecordById = getRecordById;
exports.createRecord = createRecord;
exports.updateRecord = updateRecord;
exports.confirmRecord = confirmRecord;
exports.rejectRecord = rejectRecord;
exports.sendToAlgorithmReview = sendToAlgorithmReview;
exports.importFromExcel = importFromExcel;
exports.exportRecords = exportRecords;
exports.getConflicts = getConflicts;
const uuid_1 = require("uuid");
const XLSX = __importStar(require("xlsx"));
const database_1 = require("../database");
const types_1 = require("../types");
const conflictDetector_1 = require("./conflictDetector");
const maskService_1 = require("./maskService");
function readAllRecords() {
    return database_1.records.getAll();
}
function getRecords(params) {
    const { page = 1, pageSize = 20, status, keyword } = params;
    let allRecords = readAllRecords();
    if (status) {
        allRecords = allRecords.filter((r) => r.review_status === status);
    }
    if (keyword) {
        const kw = keyword.toLowerCase();
        allRecords = allRecords.filter((r) => r.user_query.toLowerCase().includes(kw) ||
            r.annotator_comment.toLowerCase().includes(kw) ||
            r.session_id.toLowerCase().includes(kw));
    }
    allRecords.sort((a, b) => b.created_at - a.created_at);
    const total = allRecords.length;
    const offset = (page - 1) * pageSize;
    const pagedRecords = allRecords.slice(offset, offset + pageSize);
    return { records: pagedRecords, total };
}
function getRecordById(id) {
    return database_1.records.getById(id);
}
function createRecord(data) {
    const now = Date.now();
    const id = data.id || (0, uuid_1.v4)();
    const record = {
        id,
        session_id: data.session_id || `sess_${Date.now()}`,
        user_query: data.user_query || '',
        annotator_comment: data.annotator_comment || '',
        model_output: data.model_output || '',
        phone_number: data.phone_number || '',
        is_intercepted: data.is_intercepted ?? false,
        review_status: data.review_status || types_1.ReviewStatus.PENDING,
        conflict_evidence: data.conflict_evidence,
        created_at: now,
        updated_at: now,
        imported_from: data.imported_from || 'manual',
        version: 1,
    };
    const conflict = (0, conflictDetector_1.detectConflict)(record);
    if (conflict) {
        record.review_status = types_1.ReviewStatus.CONFLICT;
        record.conflict_evidence = JSON.stringify(conflict.evidence);
    }
    database_1.records.add(record);
    return record;
}
function updateRecord(id, data) {
    const existing = database_1.records.getById(id);
    if (!existing)
        return undefined;
    const now = Date.now();
    const updated = {
        ...existing,
        ...data,
        updated_at: now,
        version: existing.version + 1,
    };
    const conflict = (0, conflictDetector_1.detectConflict)(updated);
    if (conflict) {
        updated.review_status = types_1.ReviewStatus.CONFLICT;
        updated.conflict_evidence = JSON.stringify(conflict.evidence);
    }
    else if (updated.review_status === types_1.ReviewStatus.CONFLICT) {
        updated.review_status = types_1.ReviewStatus.PENDING;
        updated.conflict_evidence = undefined;
    }
    database_1.records.update(id, updated);
    return database_1.records.getById(id);
}
function confirmRecord(id) {
    return updateRecord(id, { review_status: types_1.ReviewStatus.CONFIRMED });
}
function rejectRecord(id) {
    return updateRecord(id, { review_status: types_1.ReviewStatus.REJECTED });
}
function sendToAlgorithmReview(id) {
    return updateRecord(id, { review_status: types_1.ReviewStatus.NEED_ALGORITHM_REVIEW });
}
function importFromExcel(buffer, fileName) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    const result = {
        total: rows.length,
        success: 0,
        duplicates: 0,
        errors: 0,
        errorDetails: [],
    };
    const existingSessions = database_1.records.getSessionIds();
    rows.forEach((row, index) => {
        try {
            const sessionId = row['会话ID'] || row['session_id'] || row['SessionId'] || `import_${Date.now()}_${index}`;
            if (existingSessions.has(sessionId)) {
                result.duplicates++;
                return;
            }
            existingSessions.add(sessionId);
            createRecord({
                session_id: sessionId,
                user_query: row['用户问题'] || row['user_query'] || row['query'] || '',
                annotator_comment: row['标注员留言'] || row['annotator_comment'] || row['comment'] || '',
                model_output: row['模型输出'] || row['model_output'] || row['output'] || '',
                phone_number: row['手机号'] || row['phone_number'] || row['phone'] || '',
                is_intercepted: Boolean(row['是否拦截'] || row['is_intercepted'] || false),
                imported_from: fileName,
            });
            result.success++;
        }
        catch (e) {
            result.errors++;
            result.errorDetails.push(`第${index + 2}行: ${e.message}`);
        }
    });
    return result;
}
function exportRecords(recordIds) {
    let allRecords = readAllRecords();
    if (recordIds && recordIds.length > 0) {
        allRecords = allRecords.filter((r) => recordIds.includes(r.id));
    }
    allRecords.sort((a, b) => b.created_at - a.created_at);
    const seenMaskedPhones = new Map();
    const duplicatePhoneRecords = [];
    allRecords.forEach((r) => {
        const masked = (0, maskService_1.maskPhone)(r.phone_number || '');
        if (masked && masked.includes('****')) {
            if (seenMaskedPhones.has(masked)) {
                duplicatePhoneRecords.push(r.id);
            }
            else {
                seenMaskedPhones.set(masked, r);
            }
        }
    });
    const dedupedRecords = allRecords.filter((r) => !duplicatePhoneRecords.includes(r.id));
    let phoneLeakCount = 0;
    const exportData = dedupedRecords.map((r) => {
        const phoneAudits = (0, maskService_1.auditRecordPhones)({
            phone_number: r.phone_number,
            user_query: r.user_query,
            annotator_comment: r.annotator_comment,
            model_output: r.model_output,
        });
        const hasPhoneLeak = phoneAudits.length > 0;
        if (hasPhoneLeak)
            phoneLeakCount++;
        const leakLocations = phoneAudits.map((a) => `${a.fieldName}(${a.occurrences.length}个)`).join('、');
        const allLeakedLast4 = Array.from(new Set(phoneAudits.flatMap((a) => a.occurrences.map((o) => o.last4)))).join(',');
        return {
            '记录ID': r.id,
            '会话ID': r.session_id,
            '用户问题（已脱敏）': (0, maskService_1.maskText)(r.user_query || ''),
            '标注员留言（已脱敏）': (0, maskService_1.maskText)(r.annotator_comment || ''),
            '模型输出片段（已脱敏）': (0, maskService_1.maskText)(r.model_output || ''),
            '手机号脱敏': (0, maskService_1.maskPhone)(r.phone_number || ''),
            '原始手机号后4位': (0, maskService_1.getPhoneLast4)(r.phone_number || ''),
            '是否拦截': r.is_intercepted ? '是' : '否',
            '审核状态': statusText(r.review_status),
            '是否存在手机号漏遮风险': hasPhoneLeak ? '是（需算法复核）' : '否',
            '漏遮溯源位置': leakLocations || '-',
            '漏遮手机号后4位汇总': allLeakedLast4 || '-',
            '导入来源': r.imported_from,
            '版本': r.version,
            '创建时间': new Date(r.created_at).toLocaleString('zh-CN'),
            '更新时间': new Date(r.updated_at).toLocaleString('zh-CN'),
        };
    });
    const summaryData = [
        { '汇总项': '原始记录总数', '数值': allRecords.length },
        { '汇总项': '按脱敏手机号去重后导出数', '数值': dedupedRecords.length },
        { '汇总项': '因同手机号重复被去重的记录数', '数值': duplicatePhoneRecords.length },
        { '汇总项': '存在手机号漏遮需算法复核数', '数值': phoneLeakCount },
    ];
    const wsRecords = XLSX.utils.json_to_sheet(exportData);
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, '导出汇总');
    XLSX.utils.book_append_sheet(wb, wsRecords, '越权拦截明细');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
function statusText(status) {
    const map = {
        [types_1.ReviewStatus.PENDING]: '待处理',
        [types_1.ReviewStatus.CONFLICT]: '存在冲突',
        [types_1.ReviewStatus.CONFIRMED]: '已确认',
        [types_1.ReviewStatus.REJECTED]: '已驳回',
        [types_1.ReviewStatus.NEED_ALGORITHM_REVIEW]: '待算法复核',
    };
    return map[status] || status;
}
function getConflicts() {
    const allRecords = readAllRecords();
    return allRecords
        .filter((r) => r.review_status === types_1.ReviewStatus.CONFLICT)
        .map((r) => ({
        record: r,
        evidence: r.conflict_evidence ? JSON.parse(r.conflict_evidence) : [],
    }));
}
