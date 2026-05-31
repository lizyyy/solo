"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataImporter = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const xlsx_1 = __importDefault(require("xlsx"));
const calculator_1 = require("./calculator");
class DataImporter {
    constructor(db) {
        this.db = db;
        const calibration = db.getCalibration() || (0, calculator_1.getDefaultCalibration)();
        this.calculator = new calculator_1.CollisionCalculator(calibration);
        if (!db.getCalibration()) {
            db.saveCalibration(calibration);
        }
    }
    async importFromCSV(filePath, operator, reason) {
        return new Promise((resolve, reject) => {
            const records = [];
            const errors = [];
            let lineNumber = 1;
            fs_1.default.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => {
                lineNumber++;
                try {
                    records.push(data);
                }
                catch (e) {
                    errors.push(`行 ${lineNumber}: ${e.message}`);
                }
            })
                .on('end', () => {
                resolve(this.processRecords(records, filePath, operator, reason, errors));
            })
                .on('error', (err) => {
                reject(err);
            });
        });
    }
    importFromExcel(filePath, operator, reason) {
        const workbook = xlsx_1.default.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const records = xlsx_1.default.utils.sheet_to_json(sheet);
        return this.processRecords(records, filePath, operator, reason, []);
    }
    processRecords(rawRecords, filePath, operator, reason, initialErrors) {
        const batchId = this.generateBatchId();
        const errors = [...initialErrors];
        const unitErrors = [];
        let importedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        for (let i = 0; i < rawRecords.length; i++) {
            const raw = rawRecords[i];
            const lineNum = i + 2;
            try {
                const parsed = this.parseRawRecord(raw, lineNum);
                if (parsed.unitErrors.length > 0) {
                    unitErrors.push(...parsed.unitErrors);
                }
                const collisionRecord = this.createCollisionRecord(parsed.data, batchId);
                const existing = this.db.getRecord(collisionRecord.id);
                this.db.addRecord(collisionRecord, operator, reason);
                if (existing) {
                    updatedCount++;
                }
                else {
                    importedCount++;
                }
            }
            catch (e) {
                errors.push(`行 ${lineNum}: ${e.message}`);
                skippedCount++;
            }
        }
        const batch = {
            id: batchId,
            fileName: path_1.default.basename(filePath),
            importTime: new Date().toISOString(),
            recordCount: importedCount + updatedCount,
            operator,
            status: skippedCount === 0 && errors.length === 0 ? 'completed' : 'partial'
        };
        this.db.addBatch(batch);
        return {
            success: skippedCount === 0,
            batchId,
            importedCount,
            updatedCount,
            skippedCount,
            errorCount: errors.length,
            errors,
            unitErrors
        };
    }
    parseRawRecord(raw, lineNum) {
        const unitErrors = [];
        const requiredFields = ['studentId', 'studentName', 'experimentDate', 'ballMass', 'ballDiameter', 'initialHeight', 'horizontalDisplacement', 'collisionDisplacement'];
        for (const field of requiredFields) {
            if (raw[field] === undefined || raw[field] === null || raw[field] === '') {
                throw new Error(`缺少必填字段: ${field}`);
            }
        }
        const studentId = String(raw.studentId).trim();
        const recordId = `${studentId}_${String(raw.experimentDate).trim().replace(/-/g, '')}`;
        const student = {
            studentId,
            studentName: String(raw.studentName).trim(),
            groupId: raw.groupId ? String(raw.groupId).trim() : undefined,
            experimentDate: String(raw.experimentDate).trim()
        };
        const parseNumber = (value, field, unit, expectedRange) => {
            const strValue = String(value).trim();
            let num = parseFloat(strValue.replace(/[^\d.-]/g, ''));
            if (isNaN(num)) {
                throw new Error(`字段 ${field} 不是有效的数字: ${strValue}`);
            }
            if (expectedRange && (num < expectedRange[0] * 10 || num > expectedRange[1] * 10)) {
                if (num >= 1000 && field === 'ballMass') {
                    unitErrors.push({
                        recordId,
                        field,
                        rawValue: strValue,
                        expectedUnit: 'kg',
                        detectedUnit: 'g',
                        suggestion: `建议值: ${(num / 1000).toFixed(4)} kg`
                    });
                    num = num / 1000;
                }
            }
            return num;
        };
        const rawData = {
            recordId,
            ballMass: parseNumber(raw.ballMass, 'ballMass', 'kg', [0.05, 0.15]),
            ballDiameter: parseNumber(raw.ballDiameter, 'ballDiameter', 'm', [0.01, 0.05]),
            initialHeight: parseNumber(raw.initialHeight, 'initialHeight', 'cm'),
            horizontalDisplacement: parseNumber(raw.horizontalDisplacement, 'horizontalDisplacement', 'cm'),
            collisionDisplacement: parseNumber(raw.collisionDisplacement, 'collisionDisplacement', 'cm'),
            notes: raw.notes ? String(raw.notes).trim() : undefined
        };
        return { data: { student, rawData }, unitErrors };
    }
    createCollisionRecord(data, batchId) {
        const now = new Date().toISOString();
        const calculation = this.calculator.calculate(data.rawData);
        const anomalies = this.calculator.detectAnomalies(data.rawData, calculation);
        return {
            id: data.rawData.recordId,
            student: data.student,
            rawData: data.rawData,
            calculation,
            anomalies,
            status: anomalies.length === 0 ? 'imported' : 'pending',
            createdAt: now,
            updatedAt: now,
            version: 1,
            importBatchId: batchId
        };
    }
    generateBatchId() {
        return 'BATCH_' + Date.now().toString(36).toUpperCase();
    }
}
exports.DataImporter = DataImporter;
