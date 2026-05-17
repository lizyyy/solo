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
exports.DictionaryParser = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sync_1 = require("csv-parse/sync");
class DictionaryParser {
    parseErrors = [];
    parse(filePath, systemName) {
        this.parseErrors = [];
        const ext = path.extname(filePath).toLowerCase();
        let fields;
        if (ext === '.csv') {
            fields = this.parseCsv(filePath);
        }
        else if (ext === '.json') {
            fields = this.parseJson(filePath);
        }
        else {
            throw new Error(`不支持的文件格式: ${ext}，仅支持 .csv 和 .json`);
        }
        return {
            systemName,
            filePath,
            fields,
            errors: [...this.parseErrors]
        };
    }
    parseCsv(filePath) {
        const fields = new Map();
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        if (lines.length === 0) {
            return fields;
        }
        const records = (0, sync_1.parse)(content, {
            columns: true,
            skip_empty_lines: true,
            relax_column_count: true
        });
        const headers = Object.keys(records[0] || {});
        const fieldNameIdx = this.findColumn(headers, '字段名', 'fieldName', 'name', 'field');
        const typeIdx = this.findColumn(headers, '类型', 'type', 'dataType');
        const enumIdx = this.findColumn(headers, '枚举值', 'enum', 'enumValues', 'options');
        const descIdx = this.findColumn(headers, '业务说明', '说明', 'description', 'desc', 'comment');
        records.forEach((record, index) => {
            const lineNumber = index + 2;
            try {
                const fieldName = record[fieldNameIdx]?.toString().trim();
                if (!fieldName) {
                    this.addParseError(filePath, lineNumber, JSON.stringify(record), '字段名为空');
                    return;
                }
                const type = (record[typeIdx] || 'string').toString().trim();
                const enumStr = (record[enumIdx] || '').toString().trim();
                const description = (record[descIdx] || '').toString().trim();
                const enumValues = enumStr
                    ? enumStr.split(/[,，;；]/).map((v) => v.trim()).filter(Boolean)
                    : [];
                fields.set(fieldName, {
                    fieldName,
                    type,
                    enumValues,
                    description
                });
            }
            catch (e) {
                this.addParseError(filePath, lineNumber, JSON.stringify(record), `解析失败: ${e instanceof Error ? e.message : String(e)}`);
            }
        });
        return fields;
    }
    parseJson(filePath) {
        const fields = new Map();
        const content = fs.readFileSync(filePath, 'utf-8');
        let data;
        try {
            data = JSON.parse(content);
        }
        catch (e) {
            this.addParseError(filePath, 0, content.substring(0, 200), `JSON解析失败: ${e instanceof Error ? e.message : String(e)}`);
            return fields;
        }
        const fieldList = Array.isArray(data) ? data : (data.fields || data);
        fieldList.forEach((item, index) => {
            const lineNumber = index + 1;
            try {
                const fieldName = item.fieldName || item.name || item.字段名;
                if (!fieldName) {
                    this.addParseError(filePath, lineNumber, JSON.stringify(item), '字段名为空');
                    return;
                }
                const type = item.type || item.类型 || 'string';
                const enumValues = item.enumValues || item.enum || item.枚举值 || [];
                const description = item.description || item.desc || item.业务说明 || item.说明 || '';
                fields.set(fieldName, {
                    fieldName,
                    type,
                    enumValues: Array.isArray(enumValues) ? enumValues : [],
                    description
                });
            }
            catch (e) {
                this.addParseError(filePath, lineNumber, JSON.stringify(item), `解析失败: ${e instanceof Error ? e.message : String(e)}`);
            }
        });
        return fields;
    }
    findColumn(headers, ...candidates) {
        for (const candidate of candidates) {
            const found = headers.find(h => h.toLowerCase() === candidate.toLowerCase());
            if (found)
                return found;
        }
        return candidates[0];
    }
    addParseError(filePath, lineNumber, rawContent, reason) {
        this.parseErrors.push({
            filePath,
            lineNumber,
            rawContent,
            reason
        });
    }
    getErrors() {
        return [...this.parseErrors];
    }
}
exports.DictionaryParser = DictionaryParser;
