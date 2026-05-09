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
exports.getDataDir = exports.getReportById = exports.getReports = exports.saveReport = exports.getCacheRecords = exports.saveCacheRecord = exports.getReplayTaskById = exports.getReplayTasks = exports.updateReplayTask = exports.saveReplayTask = exports.getCheckResultById = exports.getCheckResults = exports.saveCheckResult = exports.getSourceProducts = exports.getSourceById = exports.getSources = exports.saveSourceData = exports.getSnapshotProducts = exports.getSnapshotById = exports.getSnapshots = exports.saveSnapshot = exports.getHistory = exports.addHistoryEntry = exports.initializeStore = exports.isInitialized = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const moment_1 = __importDefault(require("moment"));
const config_1 = require("../utils/config");
const config = (0, config_1.getConfig)();
const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};
const readJsonFile = (filePath) => {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
};
const writeJsonFile = (filePath, data) => {
    const dir = path.dirname(filePath);
    ensureDir(dir);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
};
const isInitialized = () => {
    return (fs.existsSync(config.dataDir) &&
        fs.existsSync(config.snapshotsDir) &&
        fs.existsSync(config.sourcesDir) &&
        fs.existsSync(config.resultsDir) &&
        fs.existsSync(config.reportsDir));
};
exports.isInitialized = isInitialized;
const initializeStore = () => {
    if ((0, exports.isInitialized)()) {
        return false;
    }
    ensureDir(config.dataDir);
    ensureDir(config.snapshotsDir);
    ensureDir(config.sourcesDir);
    ensureDir(config.resultsDir);
    ensureDir(config.reportsDir);
    if (!fs.existsSync(config.historyFile)) {
        writeJsonFile(config.historyFile, []);
    }
    return true;
};
exports.initializeStore = initializeStore;
const addHistoryEntry = (type, action, status, details) => {
    const entries = readJsonFile(config.historyFile) || [];
    const now = (0, moment_1.default)().toISOString();
    const entry = {
        id: (0, uuid_1.v4)(),
        timestamp: now,
        type,
        action,
        status,
        details,
        createdAt: now,
    };
    entries.unshift(entry);
    writeJsonFile(config.historyFile, entries);
    return entry;
};
exports.addHistoryEntry = addHistoryEntry;
const getHistory = (limit, type) => {
    const entries = readJsonFile(config.historyFile) || [];
    let filtered = entries;
    if (type) {
        filtered = entries.filter((e) => e.type === type);
    }
    if (limit) {
        return filtered.slice(0, limit);
    }
    return filtered;
};
exports.getHistory = getHistory;
const saveSnapshot = (name, products, description) => {
    const now = (0, moment_1.default)().toISOString();
    const snapshotId = (0, uuid_1.v4)();
    const fileName = `snapshot-${snapshotId}.json`;
    const filePath = path.join(config.snapshotsDir, fileName);
    writeJsonFile(filePath, products);
    const snapshot = {
        id: snapshotId,
        timestamp: now,
        name,
        description,
        productCount: products.length,
        filePath,
        createdAt: now,
    };
    const metaFile = path.join(config.snapshotsDir, 'meta.json');
    const metas = readJsonFile(metaFile) || [];
    metas.unshift(snapshot);
    writeJsonFile(metaFile, metas);
    return snapshot;
};
exports.saveSnapshot = saveSnapshot;
const getSnapshots = () => {
    const metaFile = path.join(config.snapshotsDir, 'meta.json');
    return readJsonFile(metaFile) || [];
};
exports.getSnapshots = getSnapshots;
const getSnapshotById = (id) => {
    const snapshots = (0, exports.getSnapshots)();
    return snapshots.find((s) => s.id === id) || null;
};
exports.getSnapshotById = getSnapshotById;
const getSnapshotProducts = (id) => {
    const snapshot = (0, exports.getSnapshotById)(id);
    if (!snapshot) {
        return null;
    }
    return readJsonFile(snapshot.filePath);
};
exports.getSnapshotProducts = getSnapshotProducts;
const saveSourceData = (name, products, sourceType, description) => {
    const now = (0, moment_1.default)().toISOString();
    const sourceId = (0, uuid_1.v4)();
    const fileName = `source-${sourceId}.json`;
    const filePath = path.join(config.sourcesDir, fileName);
    writeJsonFile(filePath, products);
    const source = {
        id: sourceId,
        timestamp: now,
        name,
        description,
        productCount: products.length,
        filePath,
        sourceType,
        createdAt: now,
    };
    const metaFile = path.join(config.sourcesDir, 'meta.json');
    const metas = readJsonFile(metaFile) || [];
    metas.unshift(source);
    writeJsonFile(metaFile, metas);
    return source;
};
exports.saveSourceData = saveSourceData;
const getSources = () => {
    const metaFile = path.join(config.sourcesDir, 'meta.json');
    return readJsonFile(metaFile) || [];
};
exports.getSources = getSources;
const getSourceById = (id) => {
    const sources = (0, exports.getSources)();
    return sources.find((s) => s.id === id) || null;
};
exports.getSourceById = getSourceById;
const getSourceProducts = (id) => {
    const source = (0, exports.getSourceById)(id);
    if (!source) {
        return null;
    }
    return readJsonFile(source.filePath);
};
exports.getSourceProducts = getSourceProducts;
const saveCheckResult = (result) => {
    const now = (0, moment_1.default)().toISOString();
    const resultId = (0, uuid_1.v4)();
    const fullResult = {
        ...result,
        id: resultId,
        timestamp: now,
        createdAt: now,
    };
    const fileName = `check-${resultId}.json`;
    const filePath = path.join(config.resultsDir, fileName);
    writeJsonFile(filePath, fullResult);
    const metaFile = path.join(config.resultsDir, 'meta.json');
    const metas = readJsonFile(metaFile) || [];
    metas.unshift(fullResult);
    writeJsonFile(metaFile, metas);
    return fullResult;
};
exports.saveCheckResult = saveCheckResult;
const getCheckResults = () => {
    const metaFile = path.join(config.resultsDir, 'meta.json');
    return readJsonFile(metaFile) || [];
};
exports.getCheckResults = getCheckResults;
const getCheckResultById = (id) => {
    const results = (0, exports.getCheckResults)();
    return results.find((r) => r.id === id) || null;
};
exports.getCheckResultById = getCheckResultById;
const saveReplayTask = (task) => {
    const now = (0, moment_1.default)().toISOString();
    const taskId = (0, uuid_1.v4)();
    const fullTask = {
        ...task,
        id: taskId,
        createdAt: now,
    };
    const metaFile = path.join(config.dataDir, 'replays.json');
    const tasks = readJsonFile(metaFile) || [];
    tasks.unshift(fullTask);
    writeJsonFile(metaFile, tasks);
    return fullTask;
};
exports.saveReplayTask = saveReplayTask;
const updateReplayTask = (taskId, updates) => {
    const metaFile = path.join(config.dataDir, 'replays.json');
    const tasks = readJsonFile(metaFile) || [];
    const index = tasks.findIndex((t) => t.id === taskId);
    if (index === -1) {
        return null;
    }
    tasks[index] = { ...tasks[index], ...updates };
    writeJsonFile(metaFile, tasks);
    return tasks[index];
};
exports.updateReplayTask = updateReplayTask;
const getReplayTasks = () => {
    const metaFile = path.join(config.dataDir, 'replays.json');
    return readJsonFile(metaFile) || [];
};
exports.getReplayTasks = getReplayTasks;
const getReplayTaskById = (id) => {
    const tasks = (0, exports.getReplayTasks)();
    return tasks.find((t) => t.id === id) || null;
};
exports.getReplayTaskById = getReplayTaskById;
const saveCacheRecord = (record) => {
    const now = (0, moment_1.default)().toISOString();
    const recordId = (0, uuid_1.v4)();
    const fullRecord = {
        ...record,
        id: recordId,
        createdAt: now,
    };
    const metaFile = path.join(config.dataDir, 'cache-records.json');
    const records = readJsonFile(metaFile) || [];
    records.unshift(fullRecord);
    writeJsonFile(metaFile, records);
    return fullRecord;
};
exports.saveCacheRecord = saveCacheRecord;
const getCacheRecords = () => {
    const metaFile = path.join(config.dataDir, 'cache-records.json');
    return readJsonFile(metaFile) || [];
};
exports.getCacheRecords = getCacheRecords;
const saveReport = (name, type, content, checkResultId, replayTaskId, cacheRecordId) => {
    const now = (0, moment_1.default)().toISOString();
    const reportId = (0, uuid_1.v4)();
    const fileName = `report-${reportId}.md`;
    const filePath = path.join(config.reportsDir, fileName);
    fs.writeFileSync(filePath, content, 'utf-8');
    const report = {
        id: reportId,
        timestamp: now,
        name,
        type,
        checkResultId,
        replayTaskId,
        cacheRecordId,
        filePath,
        createdAt: now,
    };
    const metaFile = path.join(config.reportsDir, 'meta.json');
    const metas = readJsonFile(metaFile) || [];
    metas.unshift(report);
    writeJsonFile(metaFile, metas);
    return report;
};
exports.saveReport = saveReport;
const getReports = () => {
    const metaFile = path.join(config.reportsDir, 'meta.json');
    return readJsonFile(metaFile) || [];
};
exports.getReports = getReports;
const getReportById = (id) => {
    const reports = (0, exports.getReports)();
    return reports.find((r) => r.id === id) || null;
};
exports.getReportById = getReportById;
const getDataDir = () => config.dataDir;
exports.getDataDir = getDataDir;
//# sourceMappingURL=store.js.map