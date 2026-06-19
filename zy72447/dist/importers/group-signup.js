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
exports.parseGroupSignupFile = parseGroupSignupFile;
exports.importGroupSignupFile = importGroupSignupFile;
const fs = __importStar(require("fs"));
const sync_1 = require("csv-parse/sync");
const XLSX = __importStar(require("xlsx"));
const types_1 = require("../types");
function parseGroupSignupFile(filePath, batchId) {
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
    return rows.map((row, idx) => {
        const rawContent = row.join(' | ');
        const rowNumber = idx + 1;
        let performerName;
        let songName;
        let isTemporarySubstitute = false;
        let substituteNote;
        const line = rawContent;
        const tempMatch = line.match(/(替补|代班|临时|替上)/i);
        if (tempMatch) {
            isTemporarySubstitute = true;
        }
        const performerMatch = line.match(/(?:表演者|演员|歌手|演奏者|学员)[:：\s]+([^\s,，|]+)/i);
        if (performerMatch) {
            performerName = performerMatch[1].trim();
        }
        else {
            const nameMatch = line.match(/^\s*(\d+[.、)\s]+)?([^\s,，|：:（(]+)/);
            if (nameMatch && nameMatch[2] && !nameMatch[2].match(/^\d+$/)) {
                performerName = nameMatch[2].trim();
            }
        }
        if (performerName) {
            performerName = performerName.replace(/[（(].*?[）)]/g, '').trim();
        }
        const parts = line.split(/[-—~]/).map((p) => p.trim()).filter((p) => p);
        const partsAfterName = parts.slice(1);
        const songMatch = line.match(/(?:曲目|歌曲|演奏|演唱)[:：\s]+([^\s,，|]+)/i);
        if (songMatch) {
            songName = songMatch[1].trim();
        }
        else if (partsAfterName.length === 1) {
            songName = partsAfterName[0].split(/[,，|]/)[0].trim();
        }
        else if (partsAfterName.length >= 2) {
            const firstPart = partsAfterName[0];
            const lastPart = partsAfterName[partsAfterName.length - 1];
            if (isTemporarySubstitute && tempMatch) {
                if (firstPart.match(/(替补|代班|临时|替上)/i)) {
                    substituteNote = firstPart;
                    songName = lastPart.split(/[,，|]/)[0].trim();
                }
                else if (lastPart.match(/(替补|代班|临时|替上)/i)) {
                    substituteNote = lastPart;
                    songName = firstPart.split(/[,，|]/)[0].trim();
                }
                else {
                    songName = lastPart.split(/[,，|]/)[0].trim();
                }
            }
            else {
                songName = lastPart.split(/[,，|]/)[0].trim();
            }
        }
        if (isTemporarySubstitute && !substituteNote) {
            const noteMatch = line.match(/([^-—~,，|]*?(?:替补|代班|临时|替上)[^-—~,，|]*)/i);
            if (noteMatch) {
                substituteNote = noteMatch[1].trim();
            }
        }
        return {
            originalRowNumber: rowNumber,
            rawContent,
            performerName,
            songName,
            isTemporarySubstitute,
            substituteNote,
            importBatchId: batchId
        };
    });
}
function importGroupSignupFile(store, filePath, operator) {
    const batch = store.addBatch({
        source: types_1.DataSource.GROUP_SIGNUP,
        fileName: filePath,
        recordCount: 0,
        operator
    });
    const parsedRows = parseGroupSignupFile(filePath, batch.id);
    const records = store.addGroupRecords(parsedRows, batch.id, operator);
    return {
        batchId: batch.id,
        recordCount: records.length
    };
}
//# sourceMappingURL=group-signup.js.map