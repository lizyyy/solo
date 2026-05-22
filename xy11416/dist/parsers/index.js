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
exports.TextParser = exports.ExcelParser = exports.CsvParser = exports.BaseParser = void 0;
exports.getParser = getParser;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const XLSX = __importStar(require("xlsx"));
class BaseParser {
    detectSourceType(filePath) {
        const filename = path_1.default.basename(filePath).toLowerCase();
        if (filename.includes('报修') || filename.includes('report') || filename.includes('resident')) {
            return 'resident_report';
        }
        if (filename.includes('回执') || filename.includes('receipt') || filename.includes('technician')) {
            return 'technician_receipt';
        }
        if (filename.includes('材料') || filename.includes('material') || filename.includes('usage')) {
            return 'material_usage';
        }
        if (filename.includes('批注') || filename.includes('note') || filename.includes('supervisor')) {
            return 'supervisor_note';
        }
        throw new Error(`无法识别文件类型: ${filename}，请在文件名中包含标识（报修/回执/材料/批注）`);
    }
}
exports.BaseParser = BaseParser;
class CsvParser extends BaseParser {
    async parse(filePath) {
        const results = [];
        let lineNumber = 1;
        return new Promise((resolve, reject) => {
            const stream = fs_1.default.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on('headers', () => {
                lineNumber = 2;
            })
                .on('data', (data) => {
                results.push({
                    rawLineNumber: lineNumber++,
                    rawContent: JSON.stringify(data),
                    fields: data,
                });
            })
                .on('end', () => {
                resolve(results);
            })
                .on('error', (error) => {
                reject(error);
            });
        });
    }
}
exports.CsvParser = CsvParser;
class ExcelParser extends BaseParser {
    async parse(filePath) {
        const results = [];
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (data.length < 2) {
            return results;
        }
        const headers = data[0].map(h => String(h || ''));
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const fields = {};
            headers.forEach((header, idx) => {
                fields[header] = String(row[idx] || '');
            });
            const hasData = Object.values(fields).some(v => v.trim() !== '');
            if (hasData) {
                results.push({
                    rawLineNumber: i + 1,
                    rawContent: JSON.stringify(fields),
                    fields,
                });
            }
        }
        return results;
    }
}
exports.ExcelParser = ExcelParser;
class TextParser extends BaseParser {
    async parse(filePath) {
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const results = [];
        let headers = null;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line)
                continue;
            const fields = line.split(/[\t,，\s]+/);
            if (!headers) {
                headers = fields;
                continue;
            }
            const rowData = {};
            headers.forEach((header, idx) => {
                rowData[header] = fields[idx] || '';
            });
            results.push({
                rawLineNumber: i + 1,
                rawContent: line,
                fields: rowData,
            });
        }
        return results;
    }
}
exports.TextParser = TextParser;
function getParser(filePath) {
    const ext = path_1.default.extname(filePath).toLowerCase();
    if (ext === '.csv') {
        return new CsvParser();
    }
    if (['.xlsx', '.xls', '.xlsm'].includes(ext)) {
        return new ExcelParser();
    }
    if (['.txt', '.tsv'].includes(ext)) {
        return new TextParser();
    }
    throw new Error(`不支持的文件格式: ${ext}，支持的格式: .csv, .xlsx, .xls, .txt, .tsv`);
}
//# sourceMappingURL=index.js.map