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
exports.exportAbnormalSamples = exportAbnormalSamples;
exports.exportRenewalReport = exportRenewalReport;
exports.getExportFormatHelp = getExportFormatHelp;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const XLSX = __importStar(require("xlsx"));
const csv_writer_1 = require("csv-writer");
const database_1 = require("./database");
async function exportAbnormalSamples(options) {
    const samples = await (0, database_1.queryAbnormalSamples)(options.filter || {});
    if (samples.length === 0) {
        throw new Error('没有找到可导出的异常样本');
    }
    const exportData = await enrichExportData(samples, options.includeRawData || false);
    const fileName = `abnormal-samples-${Date.now()}`;
    const outputPath = options.outputPath || process.cwd();
    let filePath;
    switch (options.format) {
        case 'csv':
            filePath = await exportToCsv(exportData, outputPath, fileName);
            break;
        case 'xlsx':
            filePath = await exportToXlsx(exportData, outputPath, fileName);
            break;
        case 'json':
            filePath = await exportToJson(exportData, outputPath, fileName);
            break;
        default:
            throw new Error(`不支持的导出格式: ${options.format}`);
    }
    if (options.markExported) {
        for (const sample of samples) {
            await (0, database_1.markSampleAsExported)(sample.id);
        }
    }
    return { filePath, count: samples.length };
}
async function enrichExportData(samples, includeRawData) {
    const enrichedData = [];
    for (const sample of samples) {
        let sourceInfo = {};
        if (sample.sourceType === 'renewal') {
            const renewals = await (0, database_1.queryOfflineMemberRenewals)({});
            const renewal = renewals.find(r => r.memberId === sample.sourceId);
            if (renewal) {
                sourceInfo = {
                    会员ID: renewal.memberId,
                    会员姓名: renewal.memberName,
                    联系电话: renewal.phoneNumber,
                    续费套餐: renewal.renewedPlan,
                    续费金额: renewal.renewalAmount,
                    支付方式: renewal.paymentMethod,
                    交易编号: renewal.transactionId,
                    操作员: renewal.operatorName,
                    门店: renewal.storeName,
                    续费日期: renewal.renewalDate,
                    白名单状态: renewal.isWhitelisted ? '是' : '否'
                };
                if (includeRawData) {
                    sourceInfo.原始输入 = JSON.stringify(renewal.rawInput, null, 2);
                }
            }
        }
        else if (sample.sourceType === 'lab') {
            const labSamples = await (0, database_1.queryLabSamples)({});
            const labSample = labSamples.find(l => l.sampleCode === sample.sourceId);
            if (labSample) {
                sourceInfo = {
                    样本编号: labSample.sampleCode,
                    样本类型: labSample.sampleType,
                    调用方: labSample.requester,
                    采集日期: labSample.collectionDate,
                    采集地点: labSample.collectionSite,
                    采集人: labSample.collector,
                    检测人: labSample.tester,
                    检测结果: labSample.testResult,
                    人工备注: labSample.manualNotes,
                    审核人: labSample.reviewer || '未审核',
                    状态: labSample.status
                };
            }
        }
        else if (sample.sourceType === 'whitelist') {
            const whitelists = await (0, database_1.queryWhitelistRecords)({});
            const whitelist = whitelists.find(w => w.memberId === sample.sourceId);
            if (whitelist) {
                sourceInfo = {
                    会员ID: whitelist.memberId,
                    会员姓名: whitelist.memberName,
                    白名单原因: whitelist.reason,
                    创建人: whitelist.operatorName,
                    创建日期: new Date(whitelist.createdAt).toLocaleDateString(),
                    有效期至: new Date(whitelist.expiryDate).toLocaleDateString(),
                    是否已撤销: whitelist.isRevoked ? '是' : '否',
                    撤销原因: whitelist.revokeReason || '-'
                };
            }
        }
        enrichedData.push({
            异常记录ID: sample.id,
            来源类型: sample.sourceType === 'renewal' ? '会员续费' : sample.sourceType === 'lab' ? '实验室样本' : '白名单',
            来源ID: sample.sourceId,
            批次号: sample.batchId,
            风险类型: sample.riskType,
            风险等级: sample.riskLevel,
            风险描述: sample.description,
            发现时间: new Date(sample.detectedAt).toLocaleString(),
            发现者: sample.detectedBy,
            当前状态: sample.status === 'pending' ? '待处理' : sample.status === 'reviewed' ? '已审核' : '已解决',
            负责人: sample.assignee || '未分配',
            导出状态: sample.exportStatus === 'exported' ? '已导出' : '未导出',
            备注: sample.notes || '-',
            ...sourceInfo
        });
    }
    return enrichedData;
}
async function exportToCsv(data, outputPath, fileName) {
    if (!fs_1.default.existsSync(outputPath)) {
        fs_1.default.mkdirSync(outputPath, { recursive: true });
    }
    const filePath = path_1.default.join(outputPath, `${fileName}.csv`);
    const headers = Object.keys(data[0]).map(key => ({
        id: key,
        title: key
    }));
    const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
        path: filePath,
        header: headers
    });
    await csvWriter.writeRecords(data);
    return filePath;
}
async function exportToXlsx(data, outputPath, fileName) {
    if (!fs_1.default.existsSync(outputPath)) {
        fs_1.default.mkdirSync(outputPath, { recursive: true });
    }
    const filePath = path_1.default.join(outputPath, `${fileName}.xlsx`);
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '异常样本');
    XLSX.writeFile(workbook, filePath);
    return filePath;
}
async function exportToJson(data, outputPath, fileName) {
    if (!fs_1.default.existsSync(outputPath)) {
        fs_1.default.mkdirSync(outputPath, { recursive: true });
    }
    const filePath = path_1.default.join(outputPath, `${fileName}.json`);
    fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return filePath;
}
async function exportRenewalReport(batchId, outputPath) {
    const renewals = await (0, database_1.queryOfflineMemberRenewals)({ batchId });
    if (renewals.length === 0) {
        throw new Error(`批次 ${batchId} 没有找到续费记录`);
    }
    const reportData = renewals.map(r => ({
        会员ID: r.memberId,
        会员姓名: r.memberName,
        联系电话: r.phoneNumber,
        原套餐: r.originalPlan,
        新套餐: r.renewedPlan,
        续费金额: r.renewalAmount,
        支付方式: r.paymentMethod,
        交易编号: r.transactionId,
        操作员ID: r.operatorId,
        操作员姓名: r.operatorName,
        续费日期: r.renewalDate,
        生效日期: r.effectiveDate,
        到期日期: r.expiryDate,
        门店ID: r.storeId,
        门店名称: r.storeName,
        风险类型: r.riskType,
        风险等级: r.riskLevel,
        白名单状态: r.isWhitelisted ? '是' : '否',
        白名单有效期: r.whitelistExpiry || '-',
        白名单操作员: r.whitelistOperator || '-',
        白名单原因: r.whitelistReason || '-',
        实验室样本ID: r.labSampleId || '-',
        实验室备注: r.labNotes || '-'
    }));
    const fileName = `renewal-report-${batchId}-${Date.now()}`;
    const actualOutputPath = outputPath || process.cwd();
    if (!fs_1.default.existsSync(actualOutputPath)) {
        fs_1.default.mkdirSync(actualOutputPath, { recursive: true });
    }
    const filePath = path_1.default.join(actualOutputPath, `${fileName}.xlsx`);
    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '会员续费明细');
    const summaryData = [
        { 统计项: '总记录数', 数值: renewals.length },
        { 统计项: '总金额', 数值: renewals.reduce((sum, r) => sum + r.renewalAmount, 0) },
        { 统计项: '高风险', 数值: renewals.filter(r => r.riskLevel === '高').length },
        { 统计项: '中风险', 数值: renewals.filter(r => r.riskLevel === '中').length },
        { 统计项: '低风险', 数值: renewals.filter(r => r.riskLevel === '低').length },
        { 统计项: '白名单', 数值: renewals.filter(r => r.isWhitelisted).length }
    ];
    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, '统计汇总');
    XLSX.writeFile(workbook, filePath);
    return filePath;
}
function getExportFormatHelp() {
    return `
导出功能说明：

支持的导出格式：
- csv: 逗号分隔值，兼容所有电子表格软件
- xlsx: Excel格式，支持多工作表
- json: JSON格式，适合程序处理

导出内容包含：
1. 异常样本基本信息（风险类型、等级、描述等）
2. 关联的原始数据（会员续费、实验室样本等）
3. 可选：完整的原始输入数据（用于溯源）

使用示例：
audit-sign export --format xlsx --batch-id BATCH-001 --mark-exported
  `;
}
