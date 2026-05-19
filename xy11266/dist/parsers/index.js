"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sensitiveWordsParser = exports.metadataParser = exports.transcriptParser = exports.SensitiveWordsParser = exports.MetadataParser = exports.TranscriptParser = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const csv_parser_1 = __importDefault(require("csv-parser"));
class TranscriptParser {
    async parseFile(filePath) {
        const results = [];
        const errors = [];
        try {
            const content = fs_1.default.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            const fileName = path_1.default.basename(filePath);
            let currentCall = {};
            let transcriptLines = [];
            let lineNumber = 0;
            for (const line of lines) {
                lineNumber++;
                const trimmedLine = line.trim();
                if (!trimmedLine)
                    continue;
                if (trimmedLine.startsWith('通话ID:')) {
                    if (currentCall.callId && transcriptLines.length > 0) {
                        this.addValidCall(results, currentCall, transcriptLines, errors, fileName, lineNumber);
                    }
                    currentCall = { callId: trimmedLine.replace('通话ID:', '').trim() };
                    transcriptLines = [];
                }
                else if (trimmedLine.startsWith('坐席姓名:')) {
                    currentCall.agentName = trimmedLine.replace('坐席姓名:', '').trim();
                }
                else if (trimmedLine.startsWith('坐席工号:')) {
                    currentCall.agentId = trimmedLine.replace('坐席工号:', '').trim();
                }
                else if (trimmedLine.startsWith('通话日期:')) {
                    currentCall.callDate = trimmedLine.replace('通话日期:', '').trim();
                }
                else if (trimmedLine.startsWith('通话时长:')) {
                    const durationStr = trimmedLine.replace('通话时长:', '').trim();
                    currentCall.callDuration = this.parseDuration(durationStr);
                }
                else if (trimmedLine.match(/^\[\d{2}:\d{2}:\d{2}\]/)) {
                    transcriptLines.push(trimmedLine);
                }
                else if (trimmedLine.match(/^客服:|^用户:/)) {
                    transcriptLines.push(trimmedLine);
                }
                else if (trimmedLine.includes('---') || trimmedLine.includes('===')) {
                    if (currentCall.callId && transcriptLines.length > 0) {
                        this.addValidCall(results, currentCall, transcriptLines, errors, fileName, lineNumber);
                        currentCall = {};
                        transcriptLines = [];
                    }
                }
            }
            if (currentCall.callId && transcriptLines.length > 0) {
                this.addValidCall(results, currentCall, transcriptLines, errors, fileName, lineNumber);
            }
            return { success: true, data: results, errors };
        }
        catch (error) {
            errors.push({
                sourceFile: path_1.default.basename(filePath),
                originalPosition: 'file_read_error',
                rawContent: '',
                errorType: 'FILE_READ_ERROR',
                errorMessage: error.message,
                suggestion: '检查文件路径是否正确，文件是否有读取权限',
                status: 'unresolved'
            });
            return { success: false, errors };
        }
    }
    addValidCall(results, currentCall, transcriptLines, errors, fileName, lineNumber) {
        const requiredFields = ['callId', 'agentName', 'agentId', 'callDate', 'callDuration'];
        const missingFields = requiredFields.filter(field => !currentCall[field]);
        if (missingFields.length > 0) {
            errors.push({
                sourceFile: fileName,
                originalPosition: `line_${lineNumber}`,
                rawContent: JSON.stringify(currentCall),
                errorType: 'MISSING_FIELDS',
                errorMessage: `缺少必填字段: ${missingFields.join(', ')}`,
                suggestion: '请补充通话ID、坐席姓名、坐席工号、通话日期和通话时长',
                status: 'unresolved'
            });
            return;
        }
        if (transcriptLines.length === 0) {
            errors.push({
                sourceFile: fileName,
                originalPosition: `line_${lineNumber}`,
                rawContent: JSON.stringify(currentCall),
                errorType: 'EMPTY_TRANSCRIPT',
                errorMessage: '通话转写内容为空',
                suggestion: '请检查通话记录格式，确保包含对话内容',
                status: 'unresolved'
            });
            return;
        }
        results.push({
            callId: currentCall.callId,
            agentName: currentCall.agentName,
            agentId: currentCall.agentId,
            callDate: currentCall.callDate,
            callDuration: currentCall.callDuration,
            transcript: transcriptLines.join('\n'),
            status: 'pending'
        });
    }
    parseDuration(durationStr) {
        const match = durationStr.match(/(\d+):(\d+):(\d+)/) || durationStr.match(/(\d+)分(\d+)秒/);
        if (match) {
            const hours = parseInt(match[1]) || 0;
            const minutes = parseInt(match[2]) || 0;
            const seconds = parseInt(match[3]) || 0;
            return hours * 3600 + minutes * 60 + seconds;
        }
        const seconds = parseInt(durationStr);
        return isNaN(seconds) ? 0 : seconds;
    }
}
exports.TranscriptParser = TranscriptParser;
class MetadataParser {
    async parseFile(filePath) {
        const results = [];
        const errors = [];
        const fileName = path_1.default.basename(filePath);
        let lineNumber = 0;
        try {
            await new Promise((resolve) => {
                fs_1.default.createReadStream(filePath)
                    .pipe((0, csv_parser_1.default)())
                    .on('data', (data) => {
                    lineNumber++;
                    results.push(data);
                })
                    .on('end', resolve);
            });
            return { success: true, data: results, errors };
        }
        catch (error) {
            errors.push({
                sourceFile: fileName,
                originalPosition: `line_${lineNumber}`,
                rawContent: '',
                errorType: 'CSV_PARSE_ERROR',
                errorMessage: error.message,
                suggestion: '检查CSV文件格式是否正确，分隔符是否为逗号',
                status: 'unresolved'
            });
            return { success: false, errors };
        }
    }
}
exports.MetadataParser = MetadataParser;
class SensitiveWordsParser {
    async parseFile(filePath) {
        const results = [];
        const errors = [];
        try {
            const content = fs_1.default.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            const fileName = path_1.default.basename(filePath);
            let lineNumber = 0;
            for (const line of lines) {
                lineNumber++;
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.startsWith('#'))
                    continue;
                const parts = trimmedLine.split(/[,，\t]/);
                const word = parts[0]?.trim();
                if (!word) {
                    errors.push({
                        sourceFile: fileName,
                        originalPosition: `line_${lineNumber}`,
                        rawContent: trimmedLine,
                        errorType: 'EMPTY_WORD',
                        errorMessage: '敏感词为空',
                        suggestion: '请输入有效的敏感词',
                        status: 'unresolved'
                    });
                    continue;
                }
                results.push({
                    word,
                    category: parts[1]?.trim() || '其他',
                    severity: parts[2]?.trim()?.toLowerCase() || 'medium'
                });
            }
            return { success: true, data: results, errors };
        }
        catch (error) {
            errors.push({
                sourceFile: path_1.default.basename(filePath),
                originalPosition: 'file_read_error',
                rawContent: '',
                errorType: 'FILE_READ_ERROR',
                errorMessage: error.message,
                suggestion: '检查敏感词文件路径是否正确',
                status: 'unresolved'
            });
            return { success: false, errors };
        }
    }
}
exports.SensitiveWordsParser = SensitiveWordsParser;
exports.transcriptParser = new TranscriptParser();
exports.metadataParser = new MetadataParser();
exports.sensitiveWordsParser = new SensitiveWordsParser();
