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
exports.parseTicketCsv = parseTicketCsv;
exports.importTicketCsv = importTicketCsv;
const crypto = __importStar(require("crypto"));
const sync_1 = require("csv-parse/sync");
const data_store_1 = require("../store/data-store");
function computeFileHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
}
function extractField(raw, possibleNames) {
    for (const name of possibleNames) {
        if (raw[name] !== undefined && raw[name] !== null && raw[name].trim() !== '') {
            return raw[name].trim();
        }
    }
    return '';
}
function parseTicketCsv(csvContent) {
    const records = (0, sync_1.parse)(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });
    return records.map((r, idx) => ({
        rowNumber: idx + 2,
        rawData: r,
    }));
}
function importTicketCsv(csvContent, fileName, importedBy, forceReimport = false) {
    const fileHash = computeFileHash(csvContent);
    if (!forceReimport && data_store_1.dataStore.hasFileHash(fileHash)) {
        const existingBatch = data_store_1.dataStore.getAllImportBatches().find(b => b.fileHash === fileHash);
        throw new Error(`该文件已导入过，批次ID: ${existingBatch?.id}，请使用 forceReimport=true 强制重新导入`);
    }
    const parsedRows = parseTicketCsv(csvContent);
    const batchId = data_store_1.dataStore.generateId();
    const importedIds = [];
    const duplicateDetails = [];
    for (const parsed of parsedRows) {
        const { rowNumber, rawData } = parsed;
        const studentName = extractField(rawData, ['学生姓名', '姓名', 'student_name', 'name']);
        const instrument = extractField(rawData, ['乐器', '专业', 'instrument', 'major']);
        const trackId = extractField(rawData, ['轨道编号', '轨道', 'track_id', 'track']);
        if (!studentName || !instrument || !trackId) {
            continue;
        }
        const existing = data_store_1.dataStore.findDuplicateRow(studentName, instrument, trackId);
        if (existing) {
            duplicateDetails.push({ rowNumber, studentName, existingId: existing.id });
            continue;
        }
        const now = new Date().toISOString();
        const row = {
            id: data_store_1.dataStore.generateId(),
            importBatchId: batchId,
            originalRowNumber: rowNumber,
            rawData,
            manualChanges: [],
            processingStatus: 'imported',
            studentName,
            instrument,
            trackId,
            trackRemarks: [],
            rehearsalChanges: [],
            importedAt: now,
            importedBy,
            lastUpdatedAt: now,
            lastUpdatedBy: importedBy,
        };
        data_store_1.dataStore.addTicketRow(row);
        importedIds.push(row.id);
    }
    const batch = {
        id: batchId,
        fileName,
        importedAt: new Date().toISOString(),
        importedBy,
        rowCount: parsedRows.length,
        duplicateCount: duplicateDetails.length,
        fileHash,
    };
    data_store_1.dataStore.addImportBatch(batch);
    return {
        batchId,
        totalRows: parsedRows.length,
        importedRows: importedIds.length,
        duplicateRows: duplicateDetails.length,
        importedIds,
        duplicateDetails,
    };
}
