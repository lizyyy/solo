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
exports.IdempotencyManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
class IdempotencyManager {
    constructor(outputDir) {
        this.stateFile = path.join(outputDir, '.run-state.json');
        this.state = this.loadState();
    }
    loadState() {
        if (fs.existsSync(this.stateFile)) {
            try {
                const content = fs.readFileSync(this.stateFile, 'utf8');
                return JSON.parse(content);
            }
            catch {
            }
        }
        return {
            lastRun: '',
            processedFiles: [],
            processedRecords: []
        };
    }
    saveState() {
        this.state.lastRun = new Date().toISOString();
        fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
        fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), 'utf8');
    }
    generateFileHash(filePath) {
        const content = fs.readFileSync(filePath);
        return (0, crypto_1.createHash)('md5').update(content).digest('hex');
    }
    isFileProcessed(filePath) {
        const fileHash = this.generateFileHash(filePath);
        return this.state.processedFiles.includes(fileHash);
    }
    isRecordProcessed(record) {
        return this.state.processedRecords.some(r => r.recordId === record.id);
    }
    markFileProcessed(filePath) {
        const fileHash = this.generateFileHash(filePath);
        if (!this.state.processedFiles.includes(fileHash)) {
            this.state.processedFiles.push(fileHash);
        }
    }
    markRecordProcessed(record) {
        const existing = this.state.processedRecords.find(r => r.recordId === record.id);
        if (!existing) {
            this.state.processedRecords.push({
                recordId: record.id,
                fileHash: '',
                processedAt: new Date().toISOString()
            });
        }
    }
    filterNewRecords(records) {
        return records.filter(record => !this.isRecordProcessed(record));
    }
    commit() {
        this.saveState();
    }
    reset() {
        this.state = {
            lastRun: '',
            processedFiles: [],
            processedRecords: []
        };
        this.saveState();
    }
    getProcessedCount() {
        return this.state.processedRecords.length;
    }
}
exports.IdempotencyManager = IdempotencyManager;
