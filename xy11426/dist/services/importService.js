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
exports.readCSV = readCSV;
exports.readExcel = readExcel;
exports.readFile = readFile;
exports.mapRecord = mapRecord;
exports.createBatch = createBatch;
exports.processImportStrategy = processImportStrategy;
exports.insertRecords = insertRecords;
exports.importFile = importFile;
exports.getBatch = getBatch;
exports.getBatches = getBatches;
exports.getBatchRecords = getBatchRecords;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const XLSX = __importStar(require("xlsx"));
const database_1 = require("../db/database");
const utils_1 = require("../utils");
const auditService_1 = require("./auditService");
const taskService_1 = require("./taskService");
const types_1 = require("../types");
async function readCSV(filePath, skipHeader = true) {
    const records = [];
    let lineNo = skipHeader ? 2 : 1;
    return new Promise((resolve, reject) => {
        const stream = fs_1.default.createReadStream(filePath)
            .pipe((0, csv_parser_1.default)())
            .on('data', (data) => {
            records.push({
                originalLineNo: lineNo++,
                data
            });
        })
            .on('end', () => resolve(records))
            .on('error', reject);
    });
}
function readExcel(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const records = [];
    const headers = jsonData[0];
    for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.every((cell) => !cell))
            continue;
        const data = {};
        headers.forEach((header, idx) => {
            if (header) {
                data[header] = row[idx];
            }
        });
        records.push({
            originalLineNo: i + 1,
            data
        });
    }
    return records;
}
function readFile(filePath, skipHeader = true) {
    const ext = path_1.default.extname(filePath).toLowerCase();
    if (ext === '.csv') {
        return readCSV(filePath, skipHeader);
    }
    else if (ext === '.xlsx' || ext === '.xls') {
        return Promise.resolve(readExcel(filePath));
    }
    throw new Error(`不支持的文件格式: ${ext}`);
}
function mapRecord(raw, sourceType) {
    const data = raw.data;
    switch (sourceType) {
        case types_1.DataSourceType.VISITOR_APPOINTMENT:
            return {
                visitorName: data['姓名'] || data['访客姓名'] || data['name'] || '',
                visitorPhone: data['电话'] || data['手机号'] || data['phone'] || '',
                idCard: data['身份证'] || data['身份证号'] || data['idCard'] || '',
                plateNumber: data['车牌号'] || data['车牌'] || data['plate'] || '',
                visitDate: data['访问日期'] || data['日期'] || data['visitDate'] || '',
                startTime: data['开始时间'] || data['入场时间'] || data['startTime'] || '',
                endTime: data['结束时间'] || data['离场时间'] || data['endTime'] || '',
            };
        case types_1.DataSourceType.GATE_RECORD:
            return {
                visitorName: data['姓名'] || data['访客姓名'] || data['name'] || '',
                visitorPhone: data['电话'] || data['手机号'] || data['phone'] || '',
                plateNumber: data['车牌号'] || data['车牌'] || data['plate'] || '',
                visitDate: data['日期'] || data['通行日期'] || data['date'] || '',
                startTime: data['入场时间'] || data['通行时间'] || data['passTime'] || '',
                endTime: data['出场时间'] || data['endTime'] || data['visitDate'] || '',
                gatePassed: true,
                passTime: data['通行时间'] || data['passTime'] || '',
                gateNo: data['闸机号'] || data['gateNo'] || '',
            };
        case types_1.DataSourceType.TEMP_PLATE:
            return {
                visitorName: data['车主'] || data['姓名'] || data['owner'] || '',
                visitorPhone: data['联系电话'] || data['phone'] || '',
                plateNumber: data['车牌号'] || data['临时车牌'] || data['plate'] || '',
                visitDate: data['有效期开始'] || data['startDate'] || data['date'] || '',
                startTime: data['开始时间'] || '00:00:00',
                endTime: data['结束时间'] || '23:59:59',
            };
        case types_1.DataSourceType.REFUND_FLOW:
            return {
                visitorName: data['申请人'] || data['姓名'] || data['applicant'] || '',
                visitorPhone: data['联系电话'] || data['phone'] || '',
                visitDate: data['申请日期'] || data['refundDate'] || data['date'] || '',
                startTime: data['申请时间'] || '00:00:00',
                endTime: data['完成时间'] || '23:59:59',
            };
        default:
            return {};
    }
}
function createBatch(filePath, options) {
    const db = (0, database_1.getDatabase)();
    const batchId = (0, utils_1.generateId)();
    const hash = (0, utils_1.fileHash)(filePath);
    const fileName = path_1.default.basename(filePath);
    const existingBatch = db.prepare(`
    SELECT id FROM import_batches WHERE file_hash = ?
  `).get(hash);
    if (existingBatch && options.strategy === types_1.ImportStrategy.IGNORE) {
        throw new Error(`该文件已导入过，批次ID: ${existingBatch.id}`);
    }
    const stmt = db.prepare(`
    INSERT INTO import_batches (
      id, source_type, file_name, file_hash, strategy, operator, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(batchId, options.sourceType, fileName, hash, options.strategy, options.operator, 'processing', (0, utils_1.now)(), (0, utils_1.now)());
    (0, auditService_1.logAudit)({
        batchId,
        operator: options.operator,
        action: 'create_batch',
        newValue: { fileName, sourceType: options.sourceType, strategy: options.strategy }
    });
    return batchId;
}
function processImportStrategy(batchId, sourceType, strategy, operator) {
    const db = (0, database_1.getDatabase)();
    if (strategy === types_1.ImportStrategy.OVERWRITE) {
        const batches = db.prepare(`
      SELECT id FROM import_batches 
      WHERE source_type = ? AND id != ? AND status = 'completed'
    `).all(sourceType, batchId);
        for (const batch of batches) {
            db.prepare(`
        UPDATE import_batches 
        SET status = 'overwritten', updated_at = ? 
        WHERE id = ?
      `).run((0, utils_1.now)(), batch.id);
            (0, auditService_1.logAudit)({
                batchId: batch.id,
                operator,
                action: 'overwrite_batch',
                oldValue: { status: 'completed' },
                newValue: { status: 'overwritten' }
            });
        }
    }
}
function insertRecords(batchId, rawRecords, sourceType, operator) {
    const db = (0, database_1.getDatabase)();
    let success = 0;
    let failed = 0;
    const insertStmt = db.prepare(`
    INSERT INTO visitor_records (
      id, batch_id, source_type, original_line_no, visitor_name, visitor_phone,
      id_card, plate_number, visit_date, start_time, end_time, gate_passed,
      pass_time, gate_no, status, raw_data, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const transaction = db.transaction((records) => {
        for (const record of records) {
            insertStmt.run(record.id, record.batchId, record.sourceType, record.originalLineNo, record.visitorName, record.visitorPhone, record.idCard, record.plateNumber, record.visitDate, record.startTime, record.endTime, record.gatePassed ? 1 : 0, record.passTime, record.gateNo, record.status, record.rawData, record.createdAt, record.updatedAt);
        }
    });
    const recordsToInsert = [];
    for (const raw of rawRecords) {
        try {
            const mapped = mapRecord(raw, sourceType);
            recordsToInsert.push({
                id: (0, utils_1.generateId)(),
                batchId,
                sourceType,
                originalLineNo: raw.originalLineNo,
                visitorName: mapped.visitorName || '未知',
                visitorPhone: mapped.visitorPhone || '',
                idCard: mapped.idCard || '',
                plateNumber: mapped.plateNumber || '',
                visitDate: mapped.visitDate || '',
                startTime: mapped.startTime || '',
                endTime: mapped.endTime || '',
                gatePassed: mapped.gatePassed || false,
                passTime: mapped.passTime || '',
                gateNo: mapped.gateNo || '',
                status: types_1.RecordStatus.RAW,
                rawData: (0, utils_1.safeJsonStringify)(raw.data),
                createdAt: (0, utils_1.now)(),
                updatedAt: (0, utils_1.now)()
            });
            success++;
        }
        catch (error) {
            failed++;
        }
    }
    if (recordsToInsert.length > 0) {
        transaction(recordsToInsert);
    }
    db.prepare(`
    UPDATE import_batches 
    SET total_records = ?, status = 'imported', updated_at = ? 
    WHERE id = ?
  `).run(rawRecords.length, (0, utils_1.now)(), batchId);
    (0, auditService_1.logAudit)({
        batchId,
        operator,
        action: 'import_records',
        newValue: { total: rawRecords.length, success, failed }
    });
    return { total: rawRecords.length, success, failed };
}
async function importFile(filePath, options) {
    if (!fs_1.default.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
    }
    const batchId = createBatch(filePath, options);
    const taskId = (0, taskService_1.createTask)({
        batchId,
        taskType: 'import_file',
        maxRetries: 2
    });
    try {
        const rawRecords = await readFile(filePath, options.skipHeader);
        processImportStrategy(batchId, options.sourceType, options.strategy, options.operator);
        const result = insertRecords(batchId, rawRecords, options.sourceType, options.operator);
        const db = (0, database_1.getDatabase)();
        db.prepare(`
      UPDATE import_batches 
      SET status = 'completed', updated_at = ? 
      WHERE id = ?
    `).run((0, utils_1.now)(), batchId);
        (0, auditService_1.logAudit)({
            batchId,
            operator: options.operator,
            action: 'complete_import',
            newValue: result
        });
        return {
            batchId,
            totalRecords: result.total,
            importedRecords: result.success,
            skippedRecords: result.failed,
            strategy: options.strategy
        };
    }
    catch (error) {
        const db = (0, database_1.getDatabase)();
        db.prepare(`
      UPDATE import_batches 
      SET status = 'failed', updated_at = ? 
      WHERE id = ?
    `).run((0, utils_1.now)(), batchId);
        throw error;
    }
}
function getBatch(batchId) {
    const db = (0, database_1.getDatabase)();
    return db.prepare('SELECT * FROM import_batches WHERE id = ?').get(batchId);
}
function getBatches(sourceType, limit = 100) {
    const db = (0, database_1.getDatabase)();
    if (sourceType) {
        return db.prepare(`
      SELECT * FROM import_batches 
      WHERE source_type = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(sourceType, limit);
    }
    return db.prepare(`
    SELECT * FROM import_batches 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(limit);
}
function getBatchRecords(batchId, status) {
    const db = (0, database_1.getDatabase)();
    if (status) {
        return db.prepare(`
      SELECT * FROM visitor_records 
      WHERE batch_id = ? AND status = ? 
      ORDER BY original_line_no
    `).all(batchId, status);
    }
    return db.prepare(`
    SELECT * FROM visitor_records 
    WHERE batch_id = ? 
    ORDER BY original_line_no
  `).all(batchId);
}
