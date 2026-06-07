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
exports.parseContractFile = parseContractFile;
exports.importContractFile = importContractFile;
const fs = __importStar(require("fs"));
const sync_1 = require("csv-parse/sync");
const XLSX = __importStar(require("xlsx"));
const types_1 = require("../types");
function parseContractFile(filePath, batchId, sourceFileName) {
    const ext = filePath.toLowerCase().split('.').pop();
    let rows = [];
    if (ext === 'csv') {
        const content = fs.readFileSync(filePath, 'utf-8');
        rows = (0, sync_1.parse)(content, { skip_empty_lines: true });
    }
    else if (ext === 'xlsx' || ext === 'xls') {
        const workbook = XLSX.readFile(filePath);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    }
    else if (ext === 'txt') {
        const content = fs.readFileSync(filePath, 'utf-8');
        rows = content.split('\n').filter((l) => l.trim()).map((l) => [l]);
    }
    else {
        throw new Error(`不支持的文件格式: ${ext}，支持 CSV/XLSX/TXT`);
    }
    return rows.map((row) => {
        const rawContent = row.join(' | ');
        const line = rawContent;
        let performerName;
        let songName;
        let contractReference;
        let performanceDate;
        const performerMatch = line.match(/(?:表演者|演员|歌手|演奏者|学员|乙方)[:：\s]+([^\s,，|]+)/i);
        if (performerMatch) {
            performerName = performerMatch[1].trim();
        }
        else {
            const nameMatch = line.match(/^\s*(\d+[.、)\s]+)?([^\s,，|：:]+)/);
            if (nameMatch && nameMatch[2] && !nameMatch[2].match(/^\d+$/) && !nameMatch[2].match(/合同|编号|日期|曲目/)) {
                performerName = nameMatch[2].trim();
            }
        }
        const songMatch = line.match(/(?:曲目|歌曲|演奏|演唱|节目)[:：\s]+([^\s,，|]+)/i);
        if (songMatch) {
            songName = songMatch[1].trim();
        }
        const contractMatch = line.match(/(?:合同编号|合同号|编号|NO)[:：\s]+([^\s,，|]+)/i);
        if (contractMatch) {
            contractReference = contractMatch[1].trim();
        }
        const dateMatch = line.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/);
        if (dateMatch) {
            performanceDate = dateMatch[1].replace(/年|月/g, '-').replace(/日/g, '');
        }
        return {
            rawContent,
            performerName,
            songName,
            contractReference,
            performanceDate,
            importBatchId: batchId,
            sourceFileName: sourceFileName || filePath
        };
    });
}
function importContractFile(store, filePath, operator, isLateRefresh = false) {
    const batch = store.addBatch({
        source: types_1.DataSource.CONTRACT_SCREENSHOT,
        fileName: filePath,
        recordCount: 0,
        operator
    });
    const parsedRows = parseContractFile(filePath, batch.id, filePath);
    const records = store.addContractRecords(parsedRows, batch.id, operator);
    return {
        batchId: batch.id,
        recordCount: records.length,
        isLateRefresh
    };
}
//# sourceMappingURL=contract-screenshot.js.map