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
exports.readFile = readFile;
exports.writeFile = writeFile;
exports.readJsonFile = readJsonFile;
exports.writeJsonFile = writeJsonFile;
exports.readCsvFile = readCsvFile;
exports.writeCsvFile = writeCsvFile;
exports.listFiles = listFiles;
exports.ensureDir = ensureDir;
exports.fileExists = fileExists;
exports.getFileSize = getFileSize;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function readFile(filePath) {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
    }
    return fs.readFileSync(absolutePath, 'utf-8');
}
function writeFile(filePath, content) {
    const absolutePath = path.resolve(filePath);
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(absolutePath, content, 'utf-8');
}
function readJsonFile(filePath) {
    const content = readFile(filePath);
    return JSON.parse(content);
}
function writeJsonFile(filePath, data) {
    const content = JSON.stringify(data, null, 2);
    writeFile(filePath, content);
}
function readCsvFile(filePath, delimiter = ',') {
    const content = readFile(filePath);
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    return lines.map(line => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                }
                else {
                    inQuotes = !inQuotes;
                }
            }
            else if (char === delimiter && !inQuotes) {
                result.push(current.trim());
                current = '';
            }
            else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    });
}
function writeCsvFile(filePath, rows) {
    const content = rows.map(row => row.map(cell => {
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
    }).join(',')).join('\n');
    writeFile(filePath, content);
}
function listFiles(dirPath, pattern) {
    const absolutePath = path.resolve(dirPath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
        return [];
    }
    const files = fs.readdirSync(absolutePath);
    if (pattern) {
        const regex = new RegExp(pattern);
        return files.filter(f => regex.test(f));
    }
    return files;
}
function ensureDir(dirPath) {
    const absolutePath = path.resolve(dirPath);
    if (!fs.existsSync(absolutePath)) {
        fs.mkdirSync(absolutePath, { recursive: true });
    }
}
function fileExists(filePath) {
    return fs.existsSync(path.resolve(filePath));
}
function getFileSize(filePath) {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
        return 0;
    }
    return fs.statSync(absolutePath).size;
}
//# sourceMappingURL=file-utils.js.map