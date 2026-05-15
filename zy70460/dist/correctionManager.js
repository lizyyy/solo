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
exports.CorrectionManager = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class CorrectionManager {
    constructor(dataDir = './data') {
        this.historyFilePath = path.join(dataDir, 'detection_history.json');
        this.correctionsFilePath = path.join(dataDir, 'manual_corrections.json');
        this.ensureDataFiles();
    }
    ensureDataFiles() {
        const dir = path.dirname(this.historyFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(this.historyFilePath)) {
            fs.writeFileSync(this.historyFilePath, JSON.stringify([], null, 2));
        }
        if (!fs.existsSync(this.correctionsFilePath)) {
            fs.writeFileSync(this.correctionsFilePath, JSON.stringify([], null, 2));
        }
    }
    addCorrection(correction) {
        const corrections = this.loadCorrections();
        const newCorrection = {
            ...correction,
            correctionId: `COR-${crypto.randomUUID().slice(0, 8)}`,
            correctedAt: new Date().toISOString()
        };
        corrections.push(newCorrection);
        this.saveCorrections(corrections);
        return newCorrection;
    }
    addHistory(history) {
        const histories = this.loadHistories();
        const newHistory = {
            ...history,
            historyId: `HST-${crypto.randomUUID().slice(0, 8)}`,
            detectedAt: new Date().toISOString()
        };
        histories.push(newHistory);
        this.saveHistories(histories);
        return newHistory;
    }
    loadCorrections() {
        try {
            const data = fs.readFileSync(this.correctionsFilePath, 'utf-8');
            return JSON.parse(data);
        }
        catch {
            return [];
        }
    }
    saveCorrections(corrections) {
        fs.writeFileSync(this.correctionsFilePath, JSON.stringify(corrections, null, 2));
    }
    loadHistories() {
        try {
            const data = fs.readFileSync(this.historyFilePath, 'utf-8');
            return JSON.parse(data);
        }
        catch {
            return [];
        }
    }
    saveHistories(histories) {
        fs.writeFileSync(this.historyFilePath, JSON.stringify(histories, null, 2));
    }
    filterHistories(filterType, value) {
        const histories = this.loadHistories();
        switch (filterType) {
            case 'batch':
                return histories.filter(h => {
                    const batchIds = h.batchId.split(',');
                    return batchIds.includes(value);
                });
            case 'operator':
                return histories.filter(h => h.operator === value);
            case 'riskType':
                return histories.filter(h => h.riskType === value);
            default:
                return histories;
        }
    }
    getAllHistories() {
        return this.loadHistories();
    }
    getAllCorrections() {
        return this.loadCorrections();
    }
    getCorrectionsByBatch(batchId) {
        return this.loadCorrections().filter(c => c.batchId === batchId);
    }
}
exports.CorrectionManager = CorrectionManager;
