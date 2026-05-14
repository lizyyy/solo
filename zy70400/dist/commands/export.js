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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportRecords = exportRecords;
exports.showRecordDetail = showRecordDetail;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const storage_1 = require("../storage");
const types_1 = require("../types");
const EXPORT_DIR = path.join(process.cwd(), 'exports');
function ensureExportDir() {
    if (!fs.existsSync(EXPORT_DIR)) {
        fs.mkdirSync(EXPORT_DIR, { recursive: true });
    }
}
function recordToCSV(record) {
    const batch = storage_1.Storage.getBatchById(record.batchId);
    return [
        `"${record.id}"`,
        `"${record.batchId}"`,
        `"${batch?.batchName || ''}"`,
        `"${batch?.source || ''}"`,
        `"${batch?.processingBasis || ''}"`,
        `"${record.recordingId}"`,
        `"${record.customerName}"`,
        `"${record.phoneNumber}"`,
        `"${record.serviceType}"`,
        `"${record.startTime}"`,
        `"${record.endTime}"`,
        `"${record.duration}"`,
        `"${record.agentName}"`,
        `"${record.summary}"`,
        `"${record.status}"`,
        `"${record.abnormalType || ''}"`,
        `"${record.abnormalReason || ''}"`,
        `"${record.correctedBy || ''}"`,
        `"${record.correctionReason || ''}"`,
        `"${record.processingResult || ''}"`
    ].join(',');
}
function exportRecords(options) {
    ensureExportDir();
    const queryOptions = {};
    if (options.batch)
        queryOptions.batchId = options.batch;
    if (options.abnormalOnly)
        queryOptions.status = types_1.ProcessingStatus.ABNORMAL;
    const records = storage_1.Storage.queryRecords(queryOptions);
    if (records.length === 0) {
        console.log(chalk_1.default.yellow('没有找到可导出的记录'));
        return;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const format = options.format || 'json';
    if (format === 'json') {
        const fileName = `export_${timestamp}.json`;
        const filePath = path.join(EXPORT_DIR, fileName);
        const exportData = records.map(record => {
            const batch = storage_1.Storage.getBatchById(record.batchId);
            return {
                ...record,
                batchInfo: batch ? {
                    batchName: batch.batchName,
                    source: batch.source,
                    processingBasis: batch.processingBasis
                } : null
            };
        });
        fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf8');
        console.log(chalk_1.default.green(`成功导出 ${records.length} 条记录到: ${filePath}`));
    }
    else if (format === 'csv') {
        const fileName = `export_${timestamp}.csv`;
        const filePath = path.join(EXPORT_DIR, fileName);
        const headers = [
            'ID', '批次号', '批次名称', '来源', '处理依据',
            '录音ID', '客户姓名', '电话号码', '服务类型',
            '开始时间', '结束时间', '时长(秒)', '客服姓名',
            '摘要', '状态', '异常类型', '异常原因',
            '修正人', '修正原因', '处理结果'
        ];
        const csvContent = [
            headers.join(','),
            ...records.map(recordToCSV)
        ].join('\n');
        fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf8');
        console.log(chalk_1.default.green(`成功导出 ${records.length} 条记录到: ${filePath}`));
    }
    console.log(chalk_1.default.blue.bold('\n导出统计:'));
    console.log(`总计: ${records.length} 条`);
    console.log(`成功记录: ${chalk_1.default.green(records.filter(r => r.status === types_1.ProcessingStatus.SUCCESS).length)}`);
    console.log(`异常记录: ${chalk_1.default.red(records.filter(r => r.status === types_1.ProcessingStatus.ABNORMAL).length)}`);
    console.log(`已修正记录: ${chalk_1.default.cyan(records.filter(r => r.status === types_1.ProcessingStatus.MANUALLY_CORRECTED).length)}`);
}
function showRecordDetail(recordId) {
    const record = storage_1.Storage.getRecordById(recordId);
    if (!record) {
        console.log(chalk_1.default.red(`记录 ${recordId} 不存在`));
        return;
    }
    const batch = storage_1.Storage.getBatchById(record.batchId);
    console.log(chalk_1.default.blue.bold('\n记录详情:\n'));
    console.log(chalk_1.default.cyan('基本信息:'));
    console.log(`  ID: ${record.id}`);
    console.log(`  批次号: ${record.batchId}`);
    if (batch) {
        console.log(`  批次名称: ${batch.batchName}`);
        console.log(`  来源: ${chalk_1.default.yellow(batch.source)}`);
        console.log(`  处理依据: ${chalk_1.default.yellow(batch.processingBasis)}`);
    }
    console.log(`  录音ID: ${record.recordingId}`);
    console.log(`  客户姓名: ${record.customerName}`);
    console.log(`  电话号码: ${record.phoneNumber}`);
    console.log(`  服务类型: ${record.serviceType}`);
    console.log(`  开始时间: ${record.startTime}`);
    console.log(`  结束时间: ${record.endTime}`);
    console.log(`  时长: ${record.duration} 秒`);
    console.log(`  客服: ${record.agentName}`);
    console.log(chalk_1.default.cyan('\n处理信息:'));
    const statusColor = record.status === types_1.ProcessingStatus.SUCCESS ? chalk_1.default.green :
        record.status === types_1.ProcessingStatus.ABNORMAL ? chalk_1.default.red :
            record.status === types_1.ProcessingStatus.MANUALLY_CORRECTED ? chalk_1.default.yellow :
                chalk_1.default.gray;
    console.log(`  状态: ${statusColor(record.status)}`);
    console.log(`  摘要: ${record.summary}`);
    if (record.abnormalType) {
        console.log(chalk_1.default.red(`  异常类型: ${record.abnormalType}`));
        console.log(chalk_1.default.red(`  异常原因: ${record.abnormalReason}`));
        if (record.truncatedFields?.length) {
            console.log(chalk_1.default.red(`  截断字段: ${record.truncatedFields.join(', ')}`));
        }
    }
    if (record.status === types_1.ProcessingStatus.MANUALLY_CORRECTED) {
        console.log(chalk_1.default.yellow(`  修正人: ${record.correctedBy}`));
        console.log(chalk_1.default.yellow(`  修正原因: ${record.correctionReason}`));
        console.log(chalk_1.default.yellow(`  修正时间: ${record.correctionTime}`));
    }
    console.log(`  处理结果: ${record.processingResult || '-'}`);
    console.log(`  创建时间: ${record.createdAt}`);
    console.log(`  更新时间: ${record.updatedAt}`);
}
