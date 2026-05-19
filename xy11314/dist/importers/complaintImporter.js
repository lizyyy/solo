"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importComplaintCSV = importComplaintCSV;
const fs_1 = __importDefault(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const dao_1 = require("../database/dao");
const init_1 = require("../database/init");
async function importComplaintCSV(filePath) {
    const batchId = (0, init_1.generateBatchId)();
    const results = [];
    const badRecords = [];
    let rowNumber = 0;
    return new Promise((resolve, reject) => {
        fs_1.default.createReadStream(filePath)
            .pipe((0, csv_parser_1.default)())
            .on('data', (data) => {
            rowNumber++;
            results.push(data);
        })
            .on('end', async () => {
            let successCount = 0;
            for (let i = 0; i < results.length; i++) {
                const row = results[i];
                const validation = validateComplaintRow(row, i + 2);
                if (!validation.valid) {
                    const badRecord = {
                        importBatchId: batchId,
                        sourceType: 'complaint',
                        rawData: JSON.stringify(row),
                        rowNumber: i + 2,
                        failureReason: validation.reason,
                        suggestedFix: validation.suggestedFix
                    };
                    await dao_1.dao.insertBadRecord(badRecord);
                    badRecords.push(badRecord);
                    continue;
                }
                const complaint = {
                    complaintId: row.complaintId.trim(),
                    parentName: row.parentName.trim(),
                    parentPhone: row.parentPhone.trim(),
                    studentName: row.studentName.trim(),
                    routeId: row.routeId.trim(),
                    stopId: row.stopId.trim(),
                    scheduledDate: row.scheduledDate.trim(),
                    scheduledTime: row.scheduledTime.trim(),
                    actualArrivalTime: row.actualArrivalTime?.trim(),
                    complaintType: row.complaintType.trim(),
                    description: row.description.trim(),
                    status: 'pending',
                    importBatchId: batchId
                };
                const id = await dao_1.dao.insertParentComplaint(complaint);
                if (id > 0)
                    successCount++;
            }
            resolve({
                batchId,
                successCount,
                failureCount: badRecords.length,
                badRecords
            });
        })
            .on('error', reject);
    });
}
function validateComplaintRow(row, rowNumber) {
    if (!row.complaintId || !row.complaintId.trim()) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: complaintId 不能为空`,
            suggestedFix: '请填写申诉单号，例如：COMP2024001'
        };
    }
    if (!row.parentName || !row.parentName.trim()) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: parentName 不能为空`,
            suggestedFix: '请填写家长姓名'
        };
    }
    if (!row.parentPhone || !row.parentPhone.trim()) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: parentPhone 不能为空`,
            suggestedFix: '请填写联系电话'
        };
    }
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(row.parentPhone.trim())) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: parentPhone 格式错误`,
            suggestedFix: '请填写正确的手机号格式，例如：13800138000'
        };
    }
    if (!row.studentName || !row.studentName.trim()) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: studentName 不能为空`,
            suggestedFix: '请填写学生姓名'
        };
    }
    if (!row.routeId || !row.routeId.trim()) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: routeId 不能为空`,
            suggestedFix: '请填写线路ID，例如：ROUTE001'
        };
    }
    if (!row.stopId || !row.stopId.trim()) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: stopId 不能为空`,
            suggestedFix: '请填写站点ID，例如：STOP001'
        };
    }
    if (!row.scheduledDate || !row.scheduledDate.trim()) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: scheduledDate 不能为空`,
            suggestedFix: '请填写日期，格式：YYYY-MM-DD'
        };
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(row.scheduledDate.trim())) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: scheduledDate 格式错误`,
            suggestedFix: '请使用正确的日期格式：YYYY-MM-DD'
        };
    }
    if (!row.scheduledTime || !row.scheduledTime.trim()) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: scheduledTime 不能为空`,
            suggestedFix: '请填写时间，格式：HH:mm:ss'
        };
    }
    const timeRegex = /^\d{2}:\d{2}:\d{2}$/;
    if (!timeRegex.test(row.scheduledTime.trim())) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: scheduledTime 格式错误`,
            suggestedFix: '请使用正确的时间格式：HH:mm:ss'
        };
    }
    if (!row.complaintType || !row.complaintType.trim()) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: complaintType 不能为空`,
            suggestedFix: '请填写申诉类型：late/no_show/early/other'
        };
    }
    const validTypes = ['late', 'no_show', 'early', 'other'];
    if (!validTypes.includes(row.complaintType.trim())) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: complaintType 无效`,
            suggestedFix: '申诉类型必须是：late/no_show/early/other 之一'
        };
    }
    if (!row.description || !row.description.trim()) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: description 不能为空`,
            suggestedFix: '请填写申诉详情描述'
        };
    }
    return { valid: true };
}
