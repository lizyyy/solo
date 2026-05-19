"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importCsv = void 0;
const fs_1 = __importDefault(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const database_1 = require("../database");
const validation_1 = require("../validation");
const importCsv = async (filePath, volunteer) => {
    const sessionId = database_1.sessionRepo.insert({
        source_type: 'csv',
        source_file: filePath,
        volunteer,
        total_records: 0,
        success_count: 0,
        error_count: 0
    });
    let successCount = 0;
    let errorCount = 0;
    let totalRecords = 0;
    const errors = [];
    return new Promise((resolve, reject) => {
        fs_1.default.createReadStream(filePath)
            .pipe((0, csv_parser_1.default)())
            .on('data', (row) => {
            totalRecords++;
            const rowNumber = totalRecords + 1;
            try {
                const normalizedData = (0, validation_1.normalizeBookData)(row);
                const validation = (0, validation_1.validateBookData)(normalizedData);
                if (!validation.valid) {
                    errorCount++;
                    errors.push({
                        row: rowNumber,
                        type: validation.error.type,
                        message: validation.error.message
                    });
                    database_1.errorRepo.insert({
                        session_id: sessionId,
                        source_file: filePath,
                        row_number: rowNumber,
                        raw_data: JSON.stringify(row),
                        error_type: validation.error.type,
                        error_message: validation.error.message,
                        suggestion: validation.error.suggestion,
                        volunteer
                    });
                    return;
                }
                if (database_1.bookRepo.existsByIsbn(validation.data.isbn)) {
                    errorCount++;
                    errors.push({
                        row: rowNumber,
                        type: 'duplicate_isbn',
                        message: `ISBN 已存在: ${validation.data.isbn}`
                    });
                    database_1.errorRepo.insert({
                        session_id: sessionId,
                        source_file: filePath,
                        row_number: rowNumber,
                        raw_data: JSON.stringify(row),
                        error_type: 'duplicate_isbn',
                        error_message: `ISBN 已存在: ${validation.data.isbn}`,
                        suggestion: '请检查是否重复扫码，或确认该书是否已入库',
                        volunteer
                    });
                    return;
                }
                const bookData = {
                    session_id: sessionId,
                    isbn: validation.data.isbn,
                    title: validation.data.title,
                    condition: validation.data.condition,
                    grade: validation.data.grade,
                    donor: validation.data.donor,
                    volunteer,
                    scanned_at: validation.data.scanned_at,
                    status: 'pending',
                    notes: ''
                };
                database_1.bookRepo.insert(bookData);
                successCount++;
            }
            catch (err) {
                errorCount++;
                const errorMessage = err instanceof Error ? err.message : '未知错误';
                errors.push({
                    row: rowNumber,
                    type: 'parse_error',
                    message: errorMessage
                });
                database_1.errorRepo.insert({
                    session_id: sessionId,
                    source_file: filePath,
                    row_number: rowNumber,
                    raw_data: JSON.stringify(row),
                    error_type: 'parse_error',
                    error_message: errorMessage,
                    suggestion: '请检查 CSV 文件格式是否正确',
                    volunteer
                });
            }
        })
            .on('end', () => {
            database_1.sessionRepo.updateCounts(sessionId, successCount, errorCount);
            resolve({
                sessionId,
                totalRecords,
                successCount,
                errorCount,
                errors
            });
        })
            .on('error', (err) => {
            reject(err);
        });
    });
};
exports.importCsv = importCsv;
