"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importMarkdown = void 0;
const fs_1 = __importDefault(require("fs"));
const database_1 = require("../database");
const validation_1 = require("../validation");
const parseBookBlock = (lines, startLine) => {
    const data = {
        isbn: '',
        title: '',
        condition: '',
        grade: '',
        donor: ''
    };
    let endLine = startLine;
    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('###') || line.startsWith('##')) {
            break;
        }
        if (line.startsWith('-') || line.startsWith('*')) {
            const content = line.substring(1).trim();
            const colonIndex = content.indexOf(':');
            if (colonIndex > 0) {
                const key = content.substring(0, colonIndex).trim().toLowerCase();
                const value = content.substring(colonIndex + 1).trim();
                if (key.includes('isbn') || key === '条码') {
                    data.isbn = value;
                }
                else if (key.includes('书名') || key.includes('名称') || key.includes('title')) {
                    data.title = value;
                }
                else if (key.includes('品相') || key.includes('成色') || key.includes('condition')) {
                    data.condition = value;
                }
                else if (key.includes('年级') || key.includes('grade')) {
                    data.grade = value;
                }
                else if (key.includes('捐赠人') || key.includes('捐赠') || key.includes('donor')) {
                    data.donor = value;
                }
            }
        }
        endLine = i + 1;
    }
    return { data: data.isbn ? data : null, endLine };
};
const importMarkdown = async (filePath, volunteer) => {
    const sessionId = database_1.sessionRepo.insert({
        source_type: 'markdown',
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
    const content = fs_1.default.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let currentLine = 0;
    while (currentLine < lines.length) {
        const line = lines[currentLine].trim();
        if (line.startsWith('###') && line.includes('新增图书')) {
            const { data, endLine } = parseBookBlock(lines, currentLine + 1);
            if (data) {
                totalRecords++;
                const lineNumber = currentLine + 1;
                try {
                    const validation = (0, validation_1.validateBookData)(data);
                    if (!validation.valid) {
                        errorCount++;
                        errors.push({
                            line: lineNumber,
                            type: validation.error.type,
                            message: validation.error.message
                        });
                        database_1.errorRepo.insert({
                            session_id: sessionId,
                            source_file: filePath,
                            row_number: lineNumber,
                            raw_data: JSON.stringify(data),
                            error_type: validation.error.type,
                            error_message: validation.error.message,
                            suggestion: validation.error.suggestion,
                            volunteer
                        });
                    }
                    else {
                        if (database_1.bookRepo.existsByIsbn(validation.data.isbn)) {
                            errorCount++;
                            errors.push({
                                line: lineNumber,
                                type: 'duplicate_isbn',
                                message: `ISBN 已存在: ${validation.data.isbn}`
                            });
                            database_1.errorRepo.insert({
                                session_id: sessionId,
                                source_file: filePath,
                                row_number: lineNumber,
                                raw_data: JSON.stringify(data),
                                error_type: 'duplicate_isbn',
                                error_message: `ISBN 已存在: ${validation.data.isbn}`,
                                suggestion: '请检查是否重复录入，或确认该书是否已入库',
                                volunteer
                            });
                        }
                        else {
                            const bookData = {
                                session_id: sessionId,
                                isbn: validation.data.isbn,
                                title: validation.data.title,
                                condition: validation.data.condition,
                                grade: validation.data.grade,
                                donor: validation.data.donor,
                                volunteer,
                                scanned_at: new Date().toISOString(),
                                status: 'pending',
                                notes: ''
                            };
                            database_1.bookRepo.insert(bookData);
                            successCount++;
                        }
                    }
                }
                catch (err) {
                    errorCount++;
                    const errorMessage = err instanceof Error ? err.message : '未知错误';
                    errors.push({
                        line: lineNumber,
                        type: 'parse_error',
                        message: errorMessage
                    });
                }
            }
            currentLine = endLine;
        }
        else {
            currentLine++;
        }
    }
    database_1.sessionRepo.updateCounts(sessionId, successCount, errorCount);
    return {
        sessionId,
        totalRecords,
        successCount,
        errorCount,
        errors
    };
};
exports.importMarkdown = importMarkdown;
