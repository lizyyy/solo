"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportService = void 0;
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const moment_1 = __importDefault(require("moment"));
const parsers_1 = require("../parsers");
const standardizer_1 = require("./standardizer");
class ImportService {
    constructor(db, workDir) {
        this.db = db;
        this.workDir = workDir;
    }
    async importFile(filePath, options = {}) {
        const batchId = options.batchId || (0, uuid_1.v4)().slice(0, 8);
        const operator = options.operator || 'system';
        const mode = options.mode || 'update';
        const absolutePath = path_1.default.resolve(filePath);
        const fileName = path_1.default.basename(absolutePath);
        const parser = (0, parsers_1.getParser)(absolutePath);
        const sourceType = options.sourceType || this.detectSourceType(fileName);
        const rows = await parser.parse(absolutePath);
        const session = await this.db.createImportSession({
            batchId,
            sourceType,
            sourceFile: fileName,
            totalRecords: rows.length,
        });
        const failedRecords = [];
        let successCount = 0;
        let failedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        try {
            for (const row of rows) {
                const result = await this.processRow(row, fileName, sourceType, batchId, mode, operator);
                if (result.success) {
                    successCount++;
                    if (result.updated) {
                        updatedCount++;
                    }
                }
                else if (result.skipped) {
                    skippedCount++;
                }
                else {
                    failedCount++;
                    failedRecords.push({
                        rawRecordId: result.rawRecordId,
                        sourceFile: fileName,
                        rawLineNumber: row.rawLineNumber,
                        rawContent: row.rawContent,
                        errors: result.errors,
                    });
                }
            }
            await this.db.updateImportSession(batchId, rows.length, 'completed');
        }
        catch (error) {
            await this.db.updateImportSession(batchId, 0, 'failed');
            throw error;
        }
        return {
            batchId,
            totalRecords: rows.length,
            successCount,
            failedCount,
            updatedCount,
            skippedCount,
            failedRecords,
            importedAt: (0, moment_1.default)().toISOString(),
        };
    }
    async processRow(row, fileName, sourceType, batchId, mode, operator) {
        const errors = [];
        let rawRecordId = '';
        let updated = false;
        const existing = await this.db.findRawRecordByFingerprint(fileName, row.rawLineNumber, batchId);
        if (existing && mode === 'skip') {
            return { success: false, skipped: true, updated: false, errors: [], rawRecordId: existing.id };
        }
        const rawRecord = await this.db.insertRawRecord({
            sourceFile: fileName,
            sourceType,
            rawLineNumber: row.rawLineNumber,
            rawContent: row.rawContent,
            importBatchId: batchId,
            status: 'pending',
        });
        rawRecordId = rawRecord.id;
        const stdResult = (0, standardizer_1.standardizeRow)(row, sourceType);
        if (!stdResult.success || !stdResult.data) {
            errors.push(...stdResult.errors.map(e => e.message));
            await this.db.updateRawRecordStatus(rawRecord.id, 'failed');
            for (const err of stdResult.errors) {
                await this.db.insertValidationError({
                    recordId: rawRecord.id,
                    fieldName: err.field,
                    errorCode: err.code,
                    errorMessage: err.message,
                    severity: 'error',
                });
            }
            return { success: false, skipped: false, updated: false, errors, rawRecordId };
        }
        const validationErrors = (0, standardizer_1.validateStandardizedData)(stdResult.data, sourceType);
        if (validationErrors.length > 0) {
            errors.push(...validationErrors.map(e => e.message));
            for (const err of validationErrors) {
                await this.db.insertValidationError({
                    recordId: rawRecord.id,
                    fieldName: err.field,
                    errorCode: err.code,
                    errorMessage: err.message,
                    severity: err.severity,
                });
            }
        }
        const orderNumber = stdResult.data.orderNumber;
        if (!orderNumber) {
            errors.push('缺少工单号，无法关联事实记录');
            await this.db.updateRawRecordStatus(rawRecord.id, 'failed');
            return { success: false, skipped: false, updated: false, errors, rawRecordId };
        }
        let factRecord = await this.db.findFactByOrderNumber(orderNumber);
        if (factRecord) {
            if (factRecord.isFrozen) {
                errors.push(`工单 ${orderNumber} 已冻结，无法修改`);
                await this.db.updateRawRecordStatus(rawRecord.id, 'failed');
                return { success: false, skipped: false, updated: false, errors, rawRecordId };
            }
            updated = true;
            await this.db.logChange(factRecord.id, 'import', 'existing', 'updated', operator, `从 ${fileName} 更新数据`);
            await this.db.updateFactRecord(factRecord.id, {
                currentStatus: this.determineStatus(sourceType, stdResult.data),
            });
        }
        else {
            factRecord = await this.db.createFactRecord(orderNumber, this.determineStatus(sourceType, stdResult.data));
            await this.db.logChange(factRecord.id, 'import', 'new', 'created', operator, `从 ${fileName} 创建工单`);
        }
        await this.db.insertStandardizedRecord({
            rawRecordId: rawRecord.id,
            factId: factRecord.id,
            orderNumber: stdResult.data.orderNumber,
            residentName: stdResult.data.residentName,
            roomNumber: stdResult.data.roomNumber,
            phoneNumber: stdResult.data.phoneNumber,
            repairType: stdResult.data.repairType,
            description: stdResult.data.description,
            reportTime: stdResult.data.reportTime,
            technicianName: stdResult.data.technicianName,
            arrivalTime: stdResult.data.arrivalTime,
            completionTime: stdResult.data.completionTime,
            repairResult: stdResult.data.repairResult,
            materialName: stdResult.data.materialName,
            materialQuantity: stdResult.data.materialQuantity,
            materialUnit: stdResult.data.materialUnit,
            supervisorNote: stdResult.data.supervisorNote,
            standardizedAt: (0, moment_1.default)().toISOString(),
            standardizedBy: operator,
            isManualOverride: false,
            confidence: stdResult.confidence,
        });
        const hasErrors = validationErrors.some(e => e.severity === 'error');
        await this.db.updateRawRecordStatus(rawRecord.id, hasErrors ? 'failed' : 'imported');
        return {
            success: !hasErrors,
            skipped: false,
            updated,
            errors,
            rawRecordId,
        };
    }
    detectSourceType(fileName) {
        const lower = fileName.toLowerCase();
        if (lower.includes('报修') || lower.includes('report') || lower.includes('resident')) {
            return 'resident_report';
        }
        if (lower.includes('回执') || lower.includes('receipt') || lower.includes('technician')) {
            return 'technician_receipt';
        }
        if (lower.includes('材料') || lower.includes('material') || lower.includes('usage')) {
            return 'material_usage';
        }
        if (lower.includes('批注') || lower.includes('note') || lower.includes('supervisor')) {
            return 'supervisor_note';
        }
        return 'resident_report';
    }
    determineStatus(sourceType, data) {
        switch (sourceType) {
            case 'resident_report':
                return '已报修';
            case 'technician_receipt':
                return data.repairResult ? '已完成' : '处理中';
            case 'material_usage':
                return '材料已领用';
            case 'supervisor_note':
                return '主管已批注';
            default:
                return '待处理';
        }
    }
    async withdrawRecord(rawRecordId, operator) {
        const rawRecords = await this.db.getRawRecordsByBatch('');
        const rawRecord = rawRecords.find(r => r.id === rawRecordId);
        if (!rawRecord) {
            return false;
        }
        await this.db.updateRawRecordStatus(rawRecordId, 'withdrawn');
        await this.db.logChange(rawRecordId, 'status', rawRecord.status, 'withdrawn', operator, '撤回记录');
        return true;
    }
}
exports.ImportService = ImportService;
//# sourceMappingURL=importer.js.map