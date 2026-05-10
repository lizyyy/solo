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
exports.exportOperationsReport = exportOperationsReport;
exports.exportFailedOperationsReport = exportFailedOperationsReport;
const csv_writer_1 = require("csv-writer");
const loggingService_1 = require("./loggingService");
const lifecycleService_1 = require("./lifecycleService");
const thawService_1 = require("./thawService");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const EXPORT_DIR = './exports';
if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
}
async function exportOperationsReport(startTime, endTime, userId) {
    const logs = await (0, loggingService_1.getLogsByTimeRange)(startTime, endTime, userId);
    const enrichedLogs = await Promise.all(logs.map(async (log) => {
        let objectInfo = '';
        let thawInfo = '';
        if (log.objectId) {
            const obj = await (0, lifecycleService_1.getObjectById)(log.objectId);
            if (obj) {
                const sizeGB = obj.size / (1024 * 1024 * 1024);
                objectInfo = `${obj.storageClass} (${sizeGB.toFixed(2)} GB)`;
            }
            const thawJobs = await (0, thawService_1.getThawJobsByObject)(log.objectId);
            if (thawJobs.length > 0) {
                thawInfo = `${thawJobs.length} 次解冻`;
            }
        }
        return {
            ...log,
            objectInfo,
            thawInfo
        };
    }));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `operations_report_${timestamp}.csv`;
    const filepath = path.join(EXPORT_DIR, filename);
    const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
        path: filepath,
        header: [
            { id: 'timestamp', title: '操作时间' },
            { id: 'logId', title: '日志ID' },
            { id: 'operation', title: '操作类型' },
            { id: 'bucketName', title: '存储桶' },
            { id: 'objectKey', title: '对象键' },
            { id: 'userId', title: '操作用户' },
            { id: 'status', title: '操作状态' },
            { id: 'details', title: '操作详情' },
            { id: 'objectInfo', title: '对象信息' },
            { id: 'thawInfo', title: '解冻信息' },
            { id: 'costEstimate', title: '预估费用(USD)' }
        ]
    });
    await csvWriter.writeRecords(enrichedLogs.map(log => ({
        timestamp: log.timestamp,
        logId: log.logId,
        operation: log.operation,
        bucketName: log.bucketName || '',
        objectKey: log.objectKey || '',
        userId: log.userId,
        status: log.status,
        details: log.details,
        objectInfo: log.objectInfo,
        thawInfo: log.thawInfo,
        costEstimate: log.costEstimate || 0
    })));
    return filepath;
}
async function exportFailedOperationsReport() {
    const logs = await (0, loggingService_1.getFailedOperations)(1000);
    const enrichedLogs = await Promise.all(logs.map(async (log) => {
        let objectInfo = '';
        let currentStatus = '';
        if (log.objectId) {
            const obj = await (0, lifecycleService_1.getObjectById)(log.objectId);
            if (obj) {
                objectInfo = `${obj.storageClass}, 删除保护: ${obj.deleteProtection ? '是' : '否'}`;
                currentStatus = obj.currentThawJobId ? '有解冻任务' : '无解冻任务';
            }
        }
        return {
            ...log,
            objectInfo,
            currentStatus
        };
    }));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `failed_operations_${timestamp}.csv`;
    const filepath = path.join(EXPORT_DIR, filename);
    const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
        path: filepath,
        header: [
            { id: 'timestamp', title: '失败时间' },
            { id: 'logId', title: '日志ID' },
            { id: 'operation', title: '失败操作' },
            { id: 'bucketName', title: '存储桶' },
            { id: 'objectKey', title: '对象键' },
            { id: 'userId', title: '操作用户' },
            { id: 'details', title: '失败原因' },
            { id: 'objectInfo', title: '对象当前状态' },
            { id: 'currentStatus', title: '对象操作状态' },
            { id: 'requestId', title: '请求ID' }
        ]
    });
    await csvWriter.writeRecords(enrichedLogs.map(log => ({
        timestamp: log.timestamp,
        logId: log.logId,
        operation: log.operation,
        bucketName: log.bucketName || '',
        objectKey: log.objectKey || '',
        userId: log.userId,
        details: log.details,
        objectInfo: log.objectInfo,
        currentStatus: log.currentStatus,
        requestId: log.requestId
    })));
    return filepath;
}
