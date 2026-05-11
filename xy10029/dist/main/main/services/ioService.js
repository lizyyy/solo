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
exports.exportToExcel = exportToExcel;
exports.exportToCSV = exportToCSV;
exports.parseExcel = parseExcel;
exports.parseCSV = parseCSV;
exports.validateDeviceData = validateDeviceData;
exports.createBatchOperation = createBatchOperation;
exports.addBatchResult = addBatchResult;
exports.completeBatchOperation = completeBatchOperation;
exports.getBatchOperation = getBatchOperation;
exports.getBatchOperations = getBatchOperations;
const index_1 = require("../database/index");
const types_1 = require("@shared/types");
const utils_1 = require("@shared/utils");
const XLSX = __importStar(require("exceljs"));
const Papa = __importStar(require("papaparse"));
const fs = __importStar(require("fs"));
async function exportToExcel(options, getData) {
    const workbook = new XLSX.Workbook();
    const worksheet = workbook.addWorksheet(options.dataType);
    const data = getData();
    if (data.length > 0) {
        const headers = options.fields || Object.keys(data[0]);
        worksheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }));
        worksheet.addRows(data);
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}
async function exportToCSV(options, getData) {
    const data = getData();
    return Papa.unparse(data, {
        columns: options.fields,
        header: options.includeHeaders !== false
    });
}
function parseExcel(filePath) {
    const workbook = new XLSX.Workbook();
    const content = fs.readFileSync(filePath);
    const worksheet = workbook.xlsx.load(content);
    return [];
}
function parseCSV(content) {
    const result = Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
    });
    return result.data;
}
function validateDeviceData(data) {
    const valid = [];
    const errors = [];
    const requiredFields = ['deviceCode', 'name', 'category'];
    const validCategories = Object.values(types_1.DeviceCategory);
    data.forEach((row, index) => {
        const rowErrors = [];
        for (const field of requiredFields) {
            if (!row[field]) {
                rowErrors.push(`缺少必需字段: ${field}`);
            }
        }
        if (row.category && !validCategories.includes(row.category)) {
            rowErrors.push(`无效的设备类别: ${row.category}`);
        }
        if (rowErrors.length > 0) {
            errors.push({
                row: index + 1,
                message: rowErrors.join('; '),
                data: row
            });
        }
        else {
            valid.push(row);
        }
    });
    return { valid, errors };
}
async function createBatchOperation(operationType, totalCount, createdBy, createdByName) {
    const now = (0, utils_1.getCurrentTimestamp)();
    const operation = {
        id: (0, utils_1.generateId)(),
        operationType,
        totalCount,
        successCount: 0,
        failedCount: 0,
        status: types_1.BatchStatus.PENDING,
        startedAt: now,
        completedAt: null,
        results: [],
        createdBy,
        createdByName
    };
    await (0, index_1.run)(`
    INSERT INTO batch_operations (
      id, operation_type, total_count, success_count, failed_count,
      status, started_at, completed_at, results, created_by, created_by_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        operation.id,
        operation.operationType,
        operation.totalCount,
        operation.successCount,
        operation.failedCount,
        operation.status,
        operation.startedAt,
        operation.completedAt,
        JSON.stringify(operation.results),
        operation.createdBy,
        operation.createdByName
    ]);
    return operation;
}
async function addBatchResult(batchId, itemId, itemCode, success, errorMessage) {
    const now = (0, utils_1.getCurrentTimestamp)();
    const result = {
        id: (0, utils_1.generateId)(),
        batchOperationId: batchId,
        itemId,
        itemCode,
        success,
        errorMessage: errorMessage || null,
        timestamp: now
    };
    const operation = await getBatchOperation(batchId);
    if (operation) {
        operation.results.push(result);
        if (success) {
            operation.successCount++;
        }
        else {
            operation.failedCount++;
        }
        await (0, index_1.run)(`
      UPDATE batch_operations SET
        success_count = ?,
        failed_count = ?,
        results = ?
      WHERE id = ?
    `, [
            operation.successCount,
            operation.failedCount,
            JSON.stringify(operation.results),
            batchId
        ]);
    }
    return result;
}
async function completeBatchOperation(batchId) {
    const operation = await getBatchOperation(batchId);
    if (!operation)
        return null;
    const now = (0, utils_1.getCurrentTimestamp)();
    let status;
    if (operation.successCount === operation.totalCount) {
        status = types_1.BatchStatus.COMPLETED;
    }
    else if (operation.failedCount === operation.totalCount) {
        status = types_1.BatchStatus.FAILED;
    }
    else {
        status = types_1.BatchStatus.PARTIAL;
    }
    await (0, index_1.run)(`
    UPDATE batch_operations SET
      status = ?,
      completed_at = ?
    WHERE id = ?
  `, [status, now, batchId]);
    return getBatchOperation(batchId);
}
async function getBatchOperation(id) {
    const row = await (0, index_1.get)('SELECT * FROM batch_operations WHERE id = ?', [id]);
    return row ? mapBatchOperation(row) : null;
}
async function getBatchOperations(params) {
    const { page, pageSize, sortBy = 'created_at', sortOrder = 'desc' } = params;
    const countRow = await (0, index_1.get)('SELECT COUNT(*) as count FROM batch_operations', []);
    const total = countRow?.count || 0;
    const offset = (page - 1) * pageSize;
    const rows = await (0, index_1.all)(`SELECT * FROM batch_operations ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`, [pageSize, offset]);
    return {
        items: rows.map(mapBatchOperation),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
    };
}
function mapBatchOperation(row) {
    return {
        id: row.id,
        operationType: row.operation_type,
        totalCount: row.total_count,
        successCount: row.success_count,
        failedCount: row.failed_count,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        results: JSON.parse(row.results || '[]'),
        createdBy: row.created_by,
        createdByName: row.created_by_name
    };
}
//# sourceMappingURL=ioService.js.map