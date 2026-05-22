"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportData = exportData;
exports.exportFailedRecords = exportFailedRecords;
const database_1 = require("../database");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function exportData(options) {
    const { sourceType, status, batchId, includeDirty = false, outputPath } = options;
    const outputDir = path_1.default.dirname(outputPath);
    if (!fs_1.default.existsSync(outputDir)) {
        fs_1.default.mkdirSync(outputDir, { recursive: true });
    }
    const data = {
        exportTime: new Date().toISOString(),
        filters: { sourceType, status, batchId, includeDirty }
    };
    if (!sourceType || sourceType === 'inspection') {
        data.inspections = await queryTable('inspections', status, batchId);
    }
    if (!sourceType || sourceType === 'repair_quote') {
        data.repairQuotes = await queryTable('repair_quotes', status, batchId);
    }
    if (!sourceType || sourceType === 'photo_list') {
        data.photoLists = await queryTable('photo_lists', status, batchId);
    }
    if (!sourceType || sourceType === 'shift_record') {
        data.shiftRecords = await queryTable('shift_records', status, batchId);
    }
    if (!sourceType || sourceType === 'manual_price') {
        data.manualPrices = await queryTable('manual_prices', status, batchId);
    }
    if (includeDirty) {
        data.dirtyRecords = await queryDirtyRecords(sourceType);
    }
    fs_1.default.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
}
async function queryTable(table, status, batchId) {
    const db = await (0, database_1.getDatabase)();
    let sql = `SELECT * FROM ${table}`;
    const params = [];
    const conditions = [];
    if (status) {
        conditions.push('status = ?');
        params.push(status);
    }
    if (batchId) {
        conditions.push('batchId = ?');
        params.push(batchId);
    }
    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY sourceRow';
    return db.all(sql, params);
}
async function queryDirtyRecords(sourceType) {
    const db = await (0, database_1.getDatabase)();
    let sql = 'SELECT * FROM dirty_records';
    const params = [];
    if (sourceType) {
        sql += ' WHERE sourceType = ?';
        params.push(sourceType);
    }
    sql += ' ORDER BY createdAt DESC';
    return db.all(sql, params);
}
async function exportFailedRecords(batchId, outputPath) {
    const db = await (0, database_1.getDatabase)();
    const batch = await db.get('SELECT * FROM import_batches WHERE id = ?', [batchId]);
    if (!batch) {
        throw new Error(`批次不存在: ${batchId}`);
    }
    const dirtyRecords = await db.all(`
    SELECT dr.*,
      CASE dr.sourceType
        WHEN 'inspection' THEN i.sourceRow
        WHEN 'repair_quote' THEN rq.sourceRow
        WHEN 'photo_list' THEN pl.sourceRow
        WHEN 'shift_record' THEN sr.sourceRow
        WHEN 'manual_price' THEN mp.sourceRow
      END as sourceRow,
      CASE dr.sourceType
        WHEN 'inspection' THEN i.sourceFile
        WHEN 'repair_quote' THEN rq.sourceFile
        WHEN 'photo_list' THEN pl.sourceFile
        WHEN 'shift_record' THEN sr.sourceFile
        WHEN 'manual_price' THEN mp.sourceFile
      END as sourceFile
    FROM dirty_records dr
    LEFT JOIN inspections i ON dr.sourceType = 'inspection' AND dr.sourceId = i.id
    LEFT JOIN repair_quotes rq ON dr.sourceType = 'repair_quote' AND dr.sourceId = rq.id
    LEFT JOIN photo_lists pl ON dr.sourceType = 'photo_list' AND dr.sourceId = pl.id
    LEFT JOIN shift_records sr ON dr.sourceType = 'shift_record' AND dr.sourceId = sr.id
    LEFT JOIN manual_prices mp ON dr.sourceType = 'manual_price' AND dr.sourceId = mp.id
    WHERE dr.batchId = ?
  `, [batchId]);
    const output = {
        batchId,
        batchInfo: batch,
        exportTime: new Date().toISOString(),
        totalDirty: dirtyRecords.length,
        records: dirtyRecords.map((r) => ({
            sourceType: r.sourceType,
            sourceRow: r.sourceRow,
            sourceFile: r.sourceFile,
            dirtyType: r.dirtyType,
            fieldName: r.fieldName,
            originalValue: r.originalValue,
            expectedValue: r.expectedValue,
            description: r.description,
            suggestion: r.suggestion,
            isFixed: r.isFixed,
            fixedValue: r.fixedValue
        }))
    };
    const outputDir = path_1.default.dirname(outputPath);
    if (!fs_1.default.existsSync(outputDir)) {
        fs_1.default.mkdirSync(outputDir, { recursive: true });
    }
    fs_1.default.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
}
