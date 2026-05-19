"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importScheduleCSV = importScheduleCSV;
const fs_1 = __importDefault(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const dao_1 = require("../database/dao");
const init_1 = require("../database/init");
async function importScheduleCSV(filePath) {
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
                const validation = validateScheduleRow(row, i + 2);
                if (!validation.valid) {
                    const badRecord = {
                        importBatchId: batchId,
                        sourceType: 'schedule_csv',
                        rawData: JSON.stringify(row),
                        rowNumber: i + 2,
                        failureReason: validation.reason,
                        suggestedFix: validation.suggestedFix
                    };
                    await dao_1.dao.insertBadRecord(badRecord);
                    badRecords.push(badRecord);
                    continue;
                }
                const schedule = {
                    routeId: row.routeId.trim(),
                    stopId: row.stopId.trim(),
                    stopName: row.stopName.trim(),
                    scheduledTime: row.scheduledTime.trim(),
                    latitude: parseFloat(row.latitude),
                    longitude: parseFloat(row.longitude),
                    importBatchId: batchId
                };
                const id = await dao_1.dao.insertStopSchedule(schedule);
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
function validateScheduleRow(row, rowNumber) {
    if (!row.routeId || !row.routeId.trim()) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: routeId 不能为空`,
            suggestedFix: '请填写有效的线路ID，例如：ROUTE001'
        };
    }
    if (!row.stopId || !row.stopId.trim()) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: stopId 不能为空`,
            suggestedFix: '请填写有效的站点ID，例如：STOP001'
        };
    }
    if (!row.stopName || !row.stopName.trim()) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: stopName 不能为空`,
            suggestedFix: '请填写站点名称，例如：东门站'
        };
    }
    if (!row.scheduledTime || !row.scheduledTime.trim()) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: scheduledTime 不能为空`,
            suggestedFix: '请填写发车时间，格式：YYYY-MM-DD HH:mm:ss'
        };
    }
    const timeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    if (!timeRegex.test(row.scheduledTime.trim())) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: scheduledTime 格式错误`,
            suggestedFix: '请使用正确的时间格式：YYYY-MM-DD HH:mm:ss'
        };
    }
    const lat = parseFloat(row.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: latitude 无效`,
            suggestedFix: '纬度应在 -90 到 90 之间，例如：39.9042'
        };
    }
    const lng = parseFloat(row.longitude);
    if (isNaN(lng) || lng < -180 || lng > 180) {
        return {
            valid: false,
            reason: `第 ${rowNumber} 行: longitude 无效`,
            suggestedFix: '经度应在 -180 到 180 之间，例如：116.4074'
        };
    }
    return { valid: true };
}
