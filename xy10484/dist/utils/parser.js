"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJSON = parseJSON;
exports.parseCSV = parseCSV;
exports.parseOrders = parseOrders;
exports.parseSignRecords = parseSignRecords;
exports.parseRefuseRecords = parseRefuseRecords;
exports.parseClaimRecords = parseClaimRecords;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const sync_1 = require("csv-parse/sync");
function parseJSON(filePath) {
    const content = fs_extra_1.default.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
}
function parseCSV(filePath) {
    const content = fs_extra_1.default.readFileSync(filePath, 'utf-8');
    return (0, sync_1.parse)(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });
}
function parseOrders(filePath) {
    const ext = path_1.default.extname(filePath).toLowerCase();
    if (ext === '.json') {
        const data = parseJSON(filePath);
        return data;
    }
    if (ext === '.csv') {
        const rows = parseCSV(filePath);
        return rows.map((row, index) => ({
            orderNo: row.orderNo || row['订单号'] || `ORD-${index + 1}`,
            trackingNo: row.trackingNo || row['运单号'] || '',
            amount: parseFloat(row.amount || row['金额'] || '0'),
            shippedAt: row.shippedAt || row['发货时间'] || '',
            status: (row.status || row['状态'] || 'pending'),
            product: row.product || row['商品'] || '',
            customer: row.customer || row['客户'] || '',
        }));
    }
    throw new Error(`不支持的文件格式: ${ext}`);
}
function parseSignRecords(filePath) {
    const ext = path_1.default.extname(filePath).toLowerCase();
    if (ext === '.json') {
        const data = parseJSON(filePath);
        return data;
    }
    if (ext === '.csv') {
        const rows = parseCSV(filePath);
        return rows.map((row) => ({
            trackingNo: row.trackingNo || row['运单号'] || '',
            signedAt: row.signedAt || row['签收时间'] || '',
            signedBy: row.signedBy || row['签收人'] || '',
            hasPhoto: (row.hasPhoto || row['有照片'] || 'false').toLowerCase() === 'true',
            photoUrl: row.photoUrl || row['照片链接'] || undefined,
            batchId: row.batchId || row['批次号'] || '',
            status: (row.status || row['状态'] || 'success'),
        }));
    }
    throw new Error(`不支持的文件格式: ${ext}`);
}
function parseRefuseRecords(filePath) {
    const ext = path_1.default.extname(filePath).toLowerCase();
    if (ext === '.json') {
        const data = parseJSON(filePath);
        return data;
    }
    if (ext === '.csv') {
        const rows = parseCSV(filePath);
        return rows.map((row) => ({
            trackingNo: row.trackingNo || row['运单号'] || '',
            refusedAt: row.refusedAt || row['拒收时间'] || '',
            reason: row.reason || row['拒收原因'] || '',
            operator: row.operator || row['操作员'] || '',
            batchId: row.batchId || row['批次号'] || '',
        }));
    }
    throw new Error(`不支持的文件格式: ${ext}`);
}
function parseClaimRecords(filePath) {
    const ext = path_1.default.extname(filePath).toLowerCase();
    if (ext === '.json') {
        const data = parseJSON(filePath);
        return data;
    }
    if (ext === '.csv') {
        const rows = parseCSV(filePath);
        return rows.map((row) => ({
            claimId: row.claimId || row['赔付单号'] || '',
            trackingNo: row.trackingNo || row['运单号'] || '',
            amount: parseFloat(row.amount || row['赔付金额'] || '0'),
            appliedAt: row.appliedAt || row['申请时间'] || '',
            approvedAt: row.approvedAt || row['批准时间'] || undefined,
            status: (row.status || row['状态'] || 'pending'),
            reason: row.reason || row['赔付原因'] || '',
            batchId: row.batchId || row['批次号'] || '',
        }));
    }
    throw new Error(`不支持的文件格式: ${ext}`);
}
