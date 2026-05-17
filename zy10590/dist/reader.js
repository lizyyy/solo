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
exports.JsonlReader = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
class JsonlReader {
    constructor(options) {
        this.options = options;
    }
    async readAll() {
        const inputPath = this.options.input;
        const stats = fs.statSync(inputPath);
        if (stats.isDirectory()) {
            return this.readDirectory(inputPath);
        }
        else if (stats.isFile()) {
            return this.readFile(inputPath);
        }
        else {
            throw new Error(`输入路径不是文件也不是目录: ${inputPath}`);
        }
    }
    async readDirectory(dirPath) {
        const files = fs.readdirSync(dirPath)
            .filter(f => f.endsWith('.jsonl'))
            .map(f => path.join(dirPath, f));
        console.log(`找到 ${files.length} 个 JSONL 文件`);
        const allValid = [];
        const allBad = [];
        let totalRows = 0;
        for (const file of files) {
            const result = await this.readFile(file);
            allValid.push(...result.validRows);
            allBad.push(...result.badRows);
            totalRows += result.totalRows;
        }
        return { validRows: allValid, badRows: allBad, totalRows };
    }
    async readFile(filePath) {
        const validRows = [];
        const badRows = [];
        let lineNumber = 0;
        const rl = readline.createInterface({
            input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
            crlfDelay: Infinity
        });
        for await (const line of rl) {
            lineNumber++;
            const trimmedLine = line.trim();
            if (!trimmedLine) {
                continue;
            }
            try {
                const record = JSON.parse(trimmedLine);
                const validRow = this.validateAndTransformRow(filePath, lineNumber, record, trimmedLine);
                validRows.push(validRow);
            }
            catch (error) {
                badRows.push({
                    sourceFile: filePath,
                    lineNumber,
                    rawContent: trimmedLine,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        return { validRows, badRows, totalRows: lineNumber };
    }
    validateAndTransformRow(sourceFile, lineNumber, record, rawContent) {
        if (typeof record !== 'object' || record === null) {
            throw new Error('不是有效的 JSON 对象');
        }
        const sessionKey = record[this.options.sessionKeyField];
        if (sessionKey === undefined || sessionKey === null) {
            throw new Error(`缺少会话键字段: ${this.options.sessionKeyField}`);
        }
        const eventTimeValue = record[this.options.eventTimeField];
        if (eventTimeValue === undefined || eventTimeValue === null) {
            throw new Error(`缺少事件时间字段: ${this.options.eventTimeField}`);
        }
        let eventTime;
        if (typeof eventTimeValue === 'number') {
            eventTime = eventTimeValue;
        }
        else if (typeof eventTimeValue === 'string') {
            const parsed = Date.parse(eventTimeValue);
            if (isNaN(parsed)) {
                throw new Error(`事件时间格式无效: ${eventTimeValue}`);
            }
            eventTime = parsed;
        }
        else {
            throw new Error(`事件时间必须是数字或字符串: ${typeof eventTimeValue}`);
        }
        let shardId;
        if (this.options.shardIdField) {
            const shardValue = record[this.options.shardIdField];
            if (shardValue !== undefined && shardValue !== null) {
                if (typeof shardValue === 'number') {
                    shardId = shardValue;
                }
                else if (typeof shardValue === 'string') {
                    const parsed = parseInt(shardValue, 10);
                    if (!isNaN(parsed)) {
                        shardId = parsed;
                    }
                }
            }
        }
        return {
            sourceFile,
            lineNumber,
            record,
            sessionKey: String(sessionKey),
            eventTime,
            shardId
        };
    }
}
exports.JsonlReader = JsonlReader;
