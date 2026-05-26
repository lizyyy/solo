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
exports.IdempotencyService = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class IdempotencyService {
    constructor(storageDir = './data') {
        this.processedBatches = new Map();
        this.storagePath = path.join(storageDir, 'processed-batches.json');
        this.ensureStorageExists();
        this.loadBatches();
    }
    ensureStorageExists() {
        const dir = path.dirname(this.storagePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(this.storagePath)) {
            fs.writeFileSync(this.storagePath, JSON.stringify([]));
        }
    }
    loadBatches() {
        try {
            const data = fs.readFileSync(this.storagePath, 'utf-8');
            const batches = JSON.parse(data);
            batches.forEach(batch => {
                this.processedBatches.set(batch.batchId, batch);
            });
        }
        catch (e) {
            this.processedBatches = new Map();
        }
    }
    saveBatches() {
        const batches = Array.from(this.processedBatches.values());
        fs.writeFileSync(this.storagePath, JSON.stringify(batches, null, 2));
    }
    generateFileHash(filePath) {
        const content = fs.readFileSync(filePath);
        return crypto.createHash('md5').update(content).digest('hex');
    }
    generateBatchId(fileHashes) {
        const combined = fileHashes.sort().join('|');
        return crypto.createHash('md5').update(combined).digest('hex');
    }
    isBatchProcessed(batchId) {
        return this.processedBatches.has(batchId);
    }
    getExistingBatch(batchId) {
        return this.processedBatches.get(batchId);
    }
    markBatchAsProcessed(batchId, fileHashes, recordCount) {
        const batch = {
            batchId,
            processedAt: new Date().toISOString(),
            fileHashes,
            recordCount,
        };
        this.processedBatches.set(batchId, batch);
        this.saveBatches();
        return batch;
    }
    checkFilesAlreadyProcessed(filePaths) {
        const fileHashes = filePaths.map(fp => this.generateFileHash(fp));
        const batchId = this.generateBatchId(fileHashes);
        if (this.isBatchProcessed(batchId)) {
            return {
                isDuplicate: true,
                existingBatch: this.getExistingBatch(batchId),
            };
        }
        return { isDuplicate: false };
    }
}
exports.IdempotencyService = IdempotencyService;
