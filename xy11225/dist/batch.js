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
exports.batchImport = batchImport;
exports.retryFailed = retryFailed;
const fs = __importStar(require("fs"));
const storage_1 = require("./storage");
const rules_1 = require("./rules");
const types_1 = require("./types");
function batchImport(filePath) {
    const successes = [];
    const failures = [];
    let data;
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        data = JSON.parse(content);
        if (!Array.isArray(data)) {
            throw new Error('数据必须是数组格式');
        }
    }
    catch (error) {
        return storage_1.storage.addBatchResult({
            total: 0,
            successCount: 0,
            failureCount: 1,
            successes: [],
            failures: [{ error: `文件读取失败: ${error.message}` }]
        });
    }
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        try {
            if (!item.cabinetId || !item.faultType || !item.description || !item.reporter) {
                throw new Error(`第 ${i + 1} 条记录缺少必填字段`);
            }
            if (!Object.values(types_1.FaultType).includes(item.faultType)) {
                throw new Error(`第 ${i + 1} 条记录故障类型无效: ${item.faultType}`);
            }
            const record = storage_1.storage.addRecord({
                cabinetId: item.cabinetId,
                faultType: item.faultType,
                description: item.description,
                reporter: item.reporter,
                handler: item.handler,
                status: types_1.RecordStatus.PENDING,
                isOffline: storage_1.storage.isCabinetOffline(item.cabinetId)
            });
            const result = rules_1.ruleEngine.processRecord(record);
            successes.push(record.id);
        }
        catch (error) {
            failures.push({
                error: error.message
            });
        }
    }
    return storage_1.storage.addBatchResult({
        total: data.length,
        successCount: successes.length,
        failureCount: failures.length,
        successes,
        failures
    });
}
function retryFailed(batchId) {
    const originalBatch = storage_1.storage.getBatchResult(batchId);
    if (!originalBatch) {
        return storage_1.storage.addBatchResult({
            total: 0,
            successCount: 0,
            failureCount: 1,
            successes: [],
            failures: [{ error: `未找到批次: ${batchId}` }]
        });
    }
    const successes = [];
    const failures = [];
    const failedRecordIds = originalBatch.failures
        .filter(f => f.recordId)
        .map(f => f.recordId);
    for (const recordId of failedRecordIds) {
        const record = storage_1.storage.getRecord(recordId);
        if (!record) {
            failures.push({ recordId, error: '记录不存在' });
            continue;
        }
        try {
            const result = rules_1.ruleEngine.processRecord(record);
            if (result.overallResult === '放行') {
                successes.push(recordId);
            }
            else {
                failures.push({ recordId, error: result.reason });
            }
        }
        catch (error) {
            failures.push({ recordId, error: error.message });
        }
    }
    return storage_1.storage.addBatchResult({
        total: failedRecordIds.length,
        successCount: successes.length,
        failureCount: failures.length,
        successes,
        failures
    });
}
