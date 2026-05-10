"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
exports.setDatabaseForTest = setDatabaseForTest;
exports.createEmptyState = createEmptyState;
exports.saveToFile = saveToFile;
exports.loadFromFile = loadFromFile;
exports.getAuditLogsByTargetKey = getAuditLogsByTargetKey;
exports.getFreezeKey = getFreezeKey;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
let dbInstance = null;
let persistTimer = null;
function getDatabase() {
    if (dbInstance) {
        return dbInstance;
    }
    dbInstance = createEmptyState();
    loadFromFile();
    setupAutoPersist();
    return dbInstance;
}
function closeDatabase() {
    if (persistTimer) {
        clearInterval(persistTimer);
        persistTimer = null;
    }
    saveToFile();
    dbInstance = null;
}
function setDatabaseForTest(state) {
    if (persistTimer) {
        clearInterval(persistTimer);
        persistTimer = null;
    }
    dbInstance = state;
}
function createEmptyState() {
    return {
        users: new Map(),
        collections: new Map(),
        transferRecords: new Map(),
        transferHistories: new Map(),
        freezeRecords: new Map(),
        auditLogs: new Map(),
    };
}
function saveToFile() {
    if (!dbInstance)
        return;
    const dbDir = path_1.default.dirname(config_1.config.dbPath);
    if (!fs_1.default.existsSync(dbDir)) {
        fs_1.default.mkdirSync(dbDir, { recursive: true });
    }
    const data = {
        users: Array.from(dbInstance.users.entries()),
        collections: Array.from(dbInstance.collections.entries()),
        transferRecords: Array.from(dbInstance.transferRecords.entries()),
        transferHistories: Array.from(dbInstance.transferHistories.entries()),
        freezeRecords: Array.from(dbInstance.freezeRecords.entries()),
        auditLogs: Array.from(dbInstance.auditLogs.entries()),
    };
    fs_1.default.writeFileSync(config_1.config.dbPath + '.json', JSON.stringify(data, null, 2));
}
function loadFromFile() {
    if (!dbInstance)
        return;
    const filePath = config_1.config.dbPath + '.json';
    if (!fs_1.default.existsSync(filePath))
        return;
    try {
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        dbInstance.users = new Map(data.users || []);
        dbInstance.collections = new Map(data.collections || []);
        dbInstance.transferRecords = new Map(data.transferRecords || []);
        dbInstance.transferHistories = new Map(data.transferHistories || []);
        dbInstance.freezeRecords = new Map(data.freezeRecords || []);
        dbInstance.auditLogs = new Map(data.auditLogs || []);
    }
    catch (error) {
        console.error('加载数据库文件失败:', error);
    }
}
function setupAutoPersist() {
    persistTimer = setInterval(() => {
        saveToFile();
    }, 5000);
}
function getAuditLogsByTargetKey(targetType, targetId) {
    return `${targetType}:${targetId}`;
}
function getFreezeKey(targetType, targetId) {
    return `${targetType}:${targetId}`;
}
//# sourceMappingURL=database.js.map