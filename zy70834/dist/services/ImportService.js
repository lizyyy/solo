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
exports.DataImportService = void 0;
const fs = __importStar(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const date_1 = require("../utils/date");
class DataImportService {
    async importHealthCheckCSV(filePath) {
        const records = [];
        return new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                const record = this.parseHealthCheckRow(row);
                if (record) {
                    records.push(record);
                }
            })
                .on('end', () => resolve(records))
                .on('error', reject);
        });
    }
    parseHealthCheckRow(row) {
        try {
            const symptoms = row.symptoms ? row.symptoms.split('、').filter(Boolean) : [];
            return {
                id: (0, date_1.generateId)(),
                studentId: row.studentId || row['学号'],
                studentName: row.studentName || row['姓名'],
                checkDate: row.checkDate || row['日期'],
                temperature: parseFloat(row.temperature || row['体温']),
                hasSymptoms: (row.hasSymptoms || row['有症状']) === '是' || row.hasSymptoms === 'true',
                symptoms,
                isIsolated: (row.isIsolated || row['已隔离']) === '是' || row.isIsolated === 'true',
                checker: row.checker || row['检查人'],
                notes: row.notes || row['备注'],
                source: 'csv',
            };
        }
        catch (e) {
            console.error('解析晨检记录失败:', row, e);
            return null;
        }
    }
    async importMedicationJSON(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        return data.map((item) => ({
            id: (0, date_1.generateId)(),
            studentId: item.studentId,
            studentName: item.studentName,
            medicationName: item.medicationName,
            category: item.category,
            dosage: item.dosage,
            frequency: item.frequency,
            expirationDate: item.expirationDate,
            parentConfirmed: item.parentConfirmed,
            confirmedDate: item.confirmedDate,
            authorizedBy: item.authorizedBy,
            effectiveDate: item.effectiveDate,
            expiryDate: item.expiryDate,
        }));
    }
    async importClassListCSV(filePath) {
        const students = [];
        return new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                const student = this.parseStudentRow(row);
                if (student) {
                    students.push(student);
                }
            })
                .on('end', () => resolve(students))
                .on('error', reject);
        });
    }
    parseStudentRow(row) {
        try {
            return {
                id: (0, date_1.generateId)(),
                studentId: row.studentId || row['学号'],
                name: row.name || row['姓名'],
                className: row.className || row['班级'],
                grade: row.grade || row['年级'],
                parentPhone: row.parentPhone || row['家长电话'],
            };
        }
        catch (e) {
            console.error('解析学生记录失败:', row, e);
            return null;
        }
    }
    validateHealthCheckRecords(records) {
        const valid = [];
        const invalid = [];
        records.forEach((record) => {
            const errors = [];
            if (!record.studentId)
                errors.push('缺少学号');
            if (!record.checkDate)
                errors.push('缺少日期');
            if (isNaN(record.temperature))
                errors.push('体温无效');
            if (record.temperature < 35 || record.temperature > 42)
                errors.push('体温超出正常范围');
            if (errors.length > 0) {
                invalid.push({ record, errors });
            }
            else {
                valid.push(record);
            }
        });
        return { valid, invalid };
    }
    validateMedicationAuthorizations(auths) {
        const valid = [];
        const invalid = [];
        auths.forEach((auth) => {
            const errors = [];
            if (!auth.studentId)
                errors.push('缺少学号');
            if (!auth.medicationName)
                errors.push('缺少药品名称');
            if (!auth.expiryDate)
                errors.push('缺少有效期');
            if (errors.length > 0) {
                invalid.push({ auth, errors });
            }
            else {
                valid.push(auth);
            }
        });
        return { valid, invalid };
    }
}
exports.DataImportService = DataImportService;
