"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importService = exports.ImportService = void 0;
const stream_1 = require("stream");
const csv_parser_1 = __importDefault(require("csv-parser"));
const types_1 = require("../types");
const store_1 = require("../store");
const candidate_service_1 = require("./candidate.service");
class ImportService {
    validateRow(row, rowNumber) {
        const errors = [];
        if (!row['姓名'] || String(row['姓名']).trim() === '') {
            errors.push({
                rowNumber,
                field: '姓名',
                message: '姓名不能为空',
                rawData: row
            });
        }
        if (!row['手机号'] || !/^1[3-9]\d{9}$/.test(String(row['手机号']))) {
            errors.push({
                rowNumber,
                field: '手机号',
                message: '手机号格式不正确',
                rawData: row
            });
        }
        if (!row['邮箱'] || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row['邮箱']))) {
            errors.push({
                rowNumber,
                field: '邮箱',
                message: '邮箱格式不正确',
                rawData: row
            });
        }
        const sourceChannelMap = {
            '猎头': types_1.SourceChannel.HEADHUNTER,
            '官网': types_1.SourceChannel.OFFICIAL_WEBSITE,
            '内推': types_1.SourceChannel.INTERNAL_RECOMMENDATION,
            '智联': types_1.SourceChannel.ZHAOPIN,
            '猎聘': types_1.SourceChannel.LIEPIN,
            'BOSS直聘': types_1.SourceChannel.BOSS,
            '其他': types_1.SourceChannel.OTHER
        };
        let sourceChannel;
        if (!row['来源渠道'] || !sourceChannelMap[String(row['来源渠道'])]) {
            errors.push({
                rowNumber,
                field: '来源渠道',
                message: '来源渠道不正确，可选值: 猎头、官网、内推、智联、猎聘、BOSS直聘、其他',
                rawData: row
            });
        }
        else {
            sourceChannel = sourceChannelMap[String(row['来源渠道'])];
        }
        if (errors.length > 0) {
            return { valid: false, errors };
        }
        return {
            valid: true,
            errors: [],
            data: {
                name: String(row['姓名']).trim(),
                phone: String(row['手机号']).trim(),
                email: String(row['邮箱']).trim(),
                sourceChannel: sourceChannel,
                position: row['应聘职位'] ? String(row['应聘职位']).trim() : undefined,
                resumeUrl: row['简历链接'] ? String(row['简历链接']).trim() : undefined
            }
        };
    }
    async importFromCsv(fileName, fileBuffer) {
        const importRecord = store_1.store.addImportRecord({
            fileName,
            totalRows: 0,
            successCount: 0,
            failedCount: 0,
            status: 'processing',
            errors: []
        });
        const results = [];
        const allErrors = [];
        let successCount = 0;
        let rowNumber = 0;
        const stream = stream_1.Readable.from(fileBuffer);
        await new Promise((resolve) => {
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                results.push(row);
            })
                .on('end', () => {
                resolve();
            });
        });
        for (const row of results) {
            rowNumber++;
            const validation = this.validateRow(row, rowNumber);
            if (!validation.valid) {
                allErrors.push(...validation.errors);
                continue;
            }
            try {
                candidate_service_1.candidateService.createCandidate(validation.data);
                successCount++;
            }
            catch (error) {
                allErrors.push({
                    rowNumber,
                    field: 'system',
                    message: error instanceof Error ? error.message : '导入失败',
                    rawData: row
                });
            }
        }
        store_1.store.updateImportRecord(importRecord.id, {
            totalRows: rowNumber,
            successCount,
            failedCount: allErrors.length,
            status: 'completed',
            completedAt: new Date(),
            errors: allErrors
        });
        return {
            importId: importRecord.id,
            successCount,
            failedCount: allErrors.length,
            errors: allErrors
        };
    }
    getImportRecord(id) {
        return store_1.store.getImportRecord(id);
    }
    getAllImportRecords() {
        return store_1.store.getAllImportRecords();
    }
}
exports.ImportService = ImportService;
exports.importService = new ImportService();
