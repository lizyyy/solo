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
exports.batchService = exports.BatchService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const types_1 = require("../types");
const fileParser_1 = require("../utils/fileParser");
const BATCH_STORAGE_FILE = path.join(process.cwd(), 'data', 'batches.json');
class BatchService {
    constructor() {
        this.batches = [];
        this.initStorage();
        this.loadBatches();
    }
    initStorage() {
        const dataDir = path.dirname(BATCH_STORAGE_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(BATCH_STORAGE_FILE)) {
            fs.writeFileSync(BATCH_STORAGE_FILE, JSON.stringify([]));
        }
    }
    loadBatches() {
        try {
            const content = fs.readFileSync(BATCH_STORAGE_FILE, 'utf-8');
            this.batches = JSON.parse(content);
        }
        catch (error) {
            this.batches = [];
        }
    }
    saveBatches() {
        fs.writeFileSync(BATCH_STORAGE_FILE, JSON.stringify(this.batches, null, 2));
    }
    checkDuplicate(files) {
        const currentHashes = files.map(f => (0, fileParser_1.calculateFileHash)(fs.readFileSync(f.path)));
        for (const batch of this.batches) {
            if (batch.processed && this.areHashesEqual(currentHashes, batch.fileHashes)) {
                return { isDuplicate: true, existingBatch: batch };
            }
        }
        return { isDuplicate: false };
    }
    areHashesEqual(hashes1, hashes2) {
        if (hashes1.length !== hashes2.length)
            return false;
        const sorted1 = [...hashes1].sort();
        const sorted2 = [...hashes2].sort();
        return sorted1.every((h, i) => h === sorted2[i]);
    }
    registerBatch(batchId, files) {
        const fileHashes = files.map(f => (0, fileParser_1.calculateFileHash)(fs.readFileSync(f.path)));
        const batch = {
            batchId,
            uploadDate: new Date().toISOString(),
            fileHashes,
            processed: false
        };
        this.batches.push(batch);
        this.saveBatches();
        return batch;
    }
    markBatchProcessed(batchId) {
        const batch = this.batches.find(b => b.batchId === batchId);
        if (batch) {
            batch.processed = true;
            this.saveBatches();
        }
    }
    getBatchHistory() {
        return [...this.batches].sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    }
    createDuplicateError(batch) {
        return {
            originalData: {
                batchId: batch.batchId,
                uploadDate: batch.uploadDate,
                fileCount: batch.fileHashes.length
            },
            failReason: types_1.FailReason.DUPLICATE_BATCH,
            failDescription: `该批次文件已在 ${new Date(batch.uploadDate).toLocaleString()} 提交过，请勿重复处理`,
            suggestion: '请检查是否为重复导入，如有变更请修改文件内容后重新上传',
            source: 'system'
        };
    }
}
exports.BatchService = BatchService;
exports.batchService = new BatchService();
