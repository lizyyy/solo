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
exports.RequestSizeGuardrail = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const DEFAULT_CONFIG = {
    maxFieldLength: 500,
    maxRequestSize: 1024 * 1024,
    enableTruncation: false,
    autoDetectEncoding: true,
    strictMode: true
};
class RequestSizeGuardrail {
    constructor(config, dataDir = './src/data') {
        this.records = new Map();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.dataDir = path.resolve(dataDir);
        fs.ensureDirSync(this.dataDir);
        this.loadRecords();
    }
    generateHash(input) {
        return crypto.createHash('sha256')
            .update(JSON.stringify(input))
            .digest('hex');
    }
    generateId() {
        return `REC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }
    checkObject(obj, prefix = '') {
        const issues = [];
        for (const [key, value] of Object.entries(obj)) {
            const fieldPath = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'object' && value !== null) {
                if (Array.isArray(value)) {
                    value.forEach((item, index) => {
                        if (typeof item === 'object' && item !== null) {
                            issues.push(...this.checkObject(item, `${fieldPath}[${index}]`));
                        }
                        else if (typeof item === 'string') {
                            issues.push(...this.checkStringField(`${fieldPath}[${index}]`, item));
                        }
                    });
                }
                else {
                    issues.push(...this.checkObject(value, fieldPath));
                }
            }
            else if (typeof value === 'string') {
                issues.push(...this.checkStringField(fieldPath, value));
            }
        }
        return issues.filter(i => i !== null);
    }
    checkStringField(fieldPath, value) {
        const issues = [];
        const byteLength = Buffer.byteLength(value, 'utf8');
        if (byteLength > this.config.maxFieldLength) {
            const issue = {
                fieldPath,
                originalValue: value,
                maxLength: this.config.maxFieldLength,
                actualLength: byteLength,
                issueType: this.config.enableTruncation ? 'truncated' : 'overflow',
                severity: byteLength > this.config.maxFieldLength * 2 ? 'critical' :
                    byteLength > this.config.maxFieldLength * 1.5 ? 'high' :
                        byteLength > this.config.maxFieldLength * 1.2 ? 'medium' : 'low'
            };
            if (this.config.enableTruncation) {
                issue.truncatedValue = value.slice(0, Math.floor(this.config.maxFieldLength / 3));
            }
            issues.push(issue);
        }
        return issues;
    }
    processRequest(source, requestType, input, metadata = {}) {
        const requestHash = this.generateHash(input);
        const existing = Array.from(this.records.values()).find(r => r.requestHash === requestHash);
        if (existing) {
            return {
                record: existing,
                isDuplicate: true,
                existingRecord: existing
            };
        }
        const fieldIssues = this.checkObject(input);
        const record = {
            id: this.generateId(),
            requestHash,
            timestamp: new Date().toISOString(),
            source,
            requestType,
            originalInput: JSON.parse(JSON.stringify(input)),
            fieldIssues,
            corrections: [],
            status: fieldIssues.length > 0 ? 'pending' : 'reviewed',
            metadata
        };
        this.records.set(record.id, record);
        this.saveRecords();
        return { record, isDuplicate: false };
    }
    addCorrection(recordId, fieldPath, operator, originalDecision, correctedDecision, reason, evidence) {
        const record = this.records.get(recordId);
        if (!record)
            return null;
        const correction = {
            id: `COR-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
            timestamp: new Date().toISOString(),
            operator,
            fieldPath,
            originalDecision,
            correctedDecision,
            reason,
            evidence
        };
        record.corrections.push(correction);
        record.status = 'corrected';
        this.saveRecords();
        return correction;
    }
    getFieldOriginalValue(recordId, fieldPath) {
        const record = this.records.get(recordId);
        if (!record)
            return null;
        const parts = fieldPath.split(/\./);
        let current = record.originalInput;
        for (const part of parts) {
            const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
            if (arrayMatch) {
                const [, arrName, index] = arrayMatch;
                current = current[arrName]?.[parseInt(index)];
            }
            else {
                current = current[part];
            }
            if (current === undefined)
                return null;
        }
        return current;
    }
    findRecordsByFieldIssue(fieldPath) {
        return Array.from(this.records.values()).filter(r => r.fieldIssues.some(i => i.fieldPath === fieldPath));
    }
    getPendingRecords() {
        return Array.from(this.records.values()).filter(r => r.status === 'pending');
    }
    getRecordById(id) {
        return this.records.get(id);
    }
    getAllRecords() {
        return Array.from(this.records.values());
    }
    saveRecords() {
        const data = {
            records: Array.from(this.records.values()),
            savedAt: new Date().toISOString()
        };
        fs.writeJSONSync(path.join(this.dataDir, 'records.json'), data, { spaces: 2 });
    }
    loadRecords() {
        const filePath = path.join(this.dataDir, 'records.json');
        if (fs.existsSync(filePath)) {
            try {
                const data = fs.readJSONSync(filePath);
                data.records.forEach((r) => {
                    this.records.set(r.id, r);
                });
            }
            catch (e) {
                console.warn('Failed to load records, starting fresh');
            }
        }
    }
    getConfig() {
        return { ...this.config };
    }
}
exports.RequestSizeGuardrail = RequestSizeGuardrail;
