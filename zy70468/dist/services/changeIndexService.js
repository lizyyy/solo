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
exports.getDB = getDB;
exports.initDB = initDB;
exports.queryRecords = queryRecords;
exports.getRecordWithCorrections = getRecordWithCorrections;
exports.manualCorrect = manualCorrect;
exports.exportToJSON = exportToJSON;
exports.exportToMarkdown = exportToMarkdown;
exports.saveExportFile = saveExportFile;
exports.getBatches = getBatches;
exports.getRecordsByApprovalNode = getRecordsByApprovalNode;
exports.getApprovalNodeHistory = getApprovalNodeHistory;
const types_1 = require("../types");
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let dbInstance = null;
function getDB() {
    if (!dbInstance) {
        throw new Error('数据库未初始化，请先调用 initDB()');
    }
    return dbInstance;
}
async function initDB() {
    if (!dbInstance) {
        const { createDB } = await Promise.resolve().then(() => __importStar(require('../db')));
        dbInstance = await createDB();
    }
    return dbInstance;
}
function generateId() {
    return crypto_1.default.randomUUID();
}
function queryRecords(filter = {}) {
    return getDB().getRecords(filter);
}
function getRecordWithCorrections(recordId) {
    const db = getDB();
    const record = db.getRecordById(recordId);
    if (!record)
        return null;
    const corrections = db.getCorrectionsByRecordId(recordId);
    return { record, corrections };
}
async function manualCorrect(recordId, fieldName, oldValue, newValue, operator, remark, approvalNode) {
    const db = getDB();
    const record = db.getRecordById(recordId);
    if (!record) {
        throw new Error('记录不存在');
    }
    const correction = {
        id: generateId(),
        recordId,
        fieldName,
        oldValue,
        newValue,
        operator,
        remark,
        approvalNode: approvalNode,
        correctedAt: new Date().toISOString()
    };
    await db.insertCorrection(correction);
    record[fieldName] = newValue;
    record.status = types_1.ProcessingStatus.MANUAL_CORRECTED;
    record.updatedAt = new Date().toISOString();
    await db.updateRecord(record);
}
function exportToJSON(filter = {}) {
    const db = getDB();
    const records = db.getRecords(filter);
    const recordsWithCorrections = records.map(record => ({
        ...record,
        corrections: db.getCorrectionsByRecordId(record.id)
    }));
    return JSON.stringify(recordsWithCorrections, null, 2);
}
function exportToMarkdown(filter = {}) {
    const db = getDB();
    const records = db.getRecords(filter);
    let md = '# 多仓库变更索引 - 发票红冲记录\n\n';
    md += `导出时间：${new Date().toLocaleString()}\n\n`;
    md += `共 ${records.length} 条记录\n\n`;
    md += '---\n\n';
    records.forEach((record, index) => {
        const corrections = db.getCorrectionsByRecordId(record.id);
        md += `## 记录 ${index + 1}: ${record.invoiceNumber}\n\n`;
        md += `- **批次ID**: ${record.batchId}\n`;
        md += `- **操作人**: ${record.operator}\n`;
        md += `- **风险类型**: ${record.riskType}\n`;
        md += `- **状态**: ${record.status}\n`;
        md += `- **当前审批节点**: ${record.currentApprovalNode}\n`;
        md += `- **原金额**: ¥${record.originalAmount.toFixed(2)}\n`;
        md += `- **红冲金额**: ¥${record.redFlushAmount.toFixed(2)}\n`;
        md += `- **归档路径**: ${record.archivePath}\n`;
        md += `- **材料摘要**: ${record.materialSummary}\n`;
        md += `- **创建时间**: ${new Date(record.createdAt).toLocaleString()}\n`;
        if (record.failureReason) {
            md += `- **失败原因**: ${record.failureReason}\n`;
        }
        if (record.smsRecords.length > 0) {
            md += `\n### 短信发送清单\n\n`;
            md += '| 手机号 | 内容 | 发送时间 | 状态 |\n';
            md += '|--------|------|----------|------|\n';
            record.smsRecords.forEach(sms => {
                md += `| ${sms.phone} | ${sms.content} | ${new Date(sms.sendTime).toLocaleString()} | ${sms.status} |\n`;
            });
        }
        if (corrections.length > 0) {
            md += `\n### 人工修正记录\n\n`;
            md += '| 字段 | 原值 | 新值 | 操作人 | 备注 | 审批节点 | 修正时间 |\n';
            md += '|------|------|------|--------|------|----------|----------|\n';
            corrections.forEach(c => {
                md += `| ${c.fieldName} | ${c.oldValue} | ${c.newValue} | ${c.operator} | ${c.remark} | ${c.approvalNode} | ${new Date(c.correctedAt).toLocaleString()} |\n`;
            });
        }
        md += '\n---\n\n';
    });
    return md;
}
function saveExportFile(content, format, outputDir) {
    const dir = outputDir || process.cwd();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `change-index-export-${timestamp}.${format}`;
    const filepath = path_1.default.join(dir, filename);
    fs_1.default.writeFileSync(filepath, content, 'utf-8');
    return filepath;
}
function getBatches() {
    return getDB().getBatches();
}
function getRecordsByApprovalNode(approvalNode) {
    return getDB().getRecords({}).filter(r => r.currentApprovalNode === approvalNode);
}
function getApprovalNodeHistory(recordId) {
    return getDB().getCorrectionsByRecordId(recordId);
}
