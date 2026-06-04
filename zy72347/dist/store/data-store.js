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
exports.saveRecord = saveRecord;
exports.getRecord = getRecord;
exports.getAllRecords = getAllRecords;
exports.getRecordsByStatus = getRecordsByStatus;
exports.getRecordsWithMixedFormat = getRecordsWithMixedFormat;
exports.clearAllRecords = clearAllRecords;
exports.createNewRecord = createNewRecord;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const id_1 = require("../utils/id");
const DATA_FILE = path.join(process.cwd(), 'data', 'records.json');
const DATA_DIR = path.join(process.cwd(), 'data');
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}
function serializeRecord(record) {
    return {
        id: record.id,
        originalRowNumber: record.originalRowNumber,
        sourceFile: record.sourceFile,
        importTimestamp: record.importTimestamp,
        importedBy: record.importedBy,
        rawValues: Array.from(record.rawValues.entries()).map(([k, v]) => [
            k,
            { original: v.original, numericValue: v.numericValue, format: v.format },
        ]),
        normalizedValues: Array.from(record.normalizedValues.entries()),
        status: record.status,
        currentStep: record.currentStep,
        formatDetected: record.formatDetected,
        hasMixedFormat: record.hasMixedFormat,
        changeHistory: record.changeHistory,
        annotations: record.annotations,
        reviewAssignee: record.reviewAssignee,
        reviewDecision: record.reviewDecision,
        reviewTimestamp: record.reviewTimestamp,
        completedBy: record.completedBy,
        completedTimestamp: record.completedTimestamp,
    };
}
function deserializeRecord(stored) {
    const rawValues = new Map();
    stored.rawValues.forEach(([k, v]) => rawValues.set(k, v));
    const normalizedValues = new Map();
    stored.normalizedValues.forEach(([k, v]) => normalizedValues.set(k, v));
    return {
        id: stored.id,
        originalRowNumber: stored.originalRowNumber,
        sourceFile: stored.sourceFile,
        importTimestamp: stored.importTimestamp,
        importedBy: stored.importedBy,
        rawValues: rawValues,
        normalizedValues,
        status: stored.status,
        currentStep: stored.currentStep,
        formatDetected: stored.formatDetected,
        hasMixedFormat: stored.hasMixedFormat,
        changeHistory: stored.changeHistory,
        annotations: stored.annotations,
        reviewAssignee: stored.reviewAssignee,
        reviewDecision: stored.reviewDecision,
        reviewTimestamp: stored.reviewTimestamp,
        completedBy: stored.completedBy,
        completedTimestamp: stored.completedTimestamp,
    };
}
function loadRecords() {
    ensureDataDir();
    if (!fs.existsSync(DATA_FILE)) {
        return [];
    }
    try {
        const content = fs.readFileSync(DATA_FILE, 'utf-8');
        const stored = JSON.parse(content);
        return stored.map(deserializeRecord);
    }
    catch {
        return [];
    }
}
function saveRecords(records) {
    ensureDataDir();
    const stored = records.map(serializeRecord);
    fs.writeFileSync(DATA_FILE, JSON.stringify(stored, null, 2), 'utf-8');
}
function saveRecord(record) {
    const records = loadRecords();
    const existingIndex = records.findIndex((r) => r.id === record.id);
    if (existingIndex >= 0) {
        records[existingIndex] = record;
    }
    else {
        records.push(record);
    }
    saveRecords(records);
    return { success: true, data: record, errors: [], warnings: [] };
}
function getRecord(id) {
    const records = loadRecords();
    const record = records.find((r) => r.id === id);
    if (!record) {
        return { success: false, errors: [`未找到记录 ${id}`], warnings: [] };
    }
    return { success: true, data: record, errors: [], warnings: [] };
}
function getAllRecords() {
    return loadRecords();
}
function getRecordsByStatus(status) {
    return loadRecords().filter((r) => r.status === status);
}
function getRecordsWithMixedFormat() {
    return loadRecords().filter((r) => r.hasMixedFormat);
}
function clearAllRecords() {
    saveRecords([]);
    return { success: true, errors: [], warnings: [] };
}
function createNewRecord(originalRowNumber, sourceFile, importedBy) {
    return {
        id: (0, id_1.generateId)('rec'),
        originalRowNumber,
        sourceFile,
        importTimestamp: Date.now(),
        importedBy,
        rawValues: new Map(),
        normalizedValues: new Map(),
        status: 'imported',
        currentStep: 'import',
        formatDetected: 'unknown',
        hasMixedFormat: false,
        changeHistory: [],
        annotations: [],
    };
}
//# sourceMappingURL=data-store.js.map