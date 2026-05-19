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
exports.storage = exports.StorageService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sensitiveMask_1 = require("../utils/sensitiveMask");
const logger = (0, sensitiveMask_1.createSensitiveLogger)();
const DEFAULT_DATA_DIR = path.join(process.env.HOME || process.cwd(), '.clinic-escort');
const DEFAULT_DB_FILE = path.join(DEFAULT_DATA_DIR, 'database.json');
class StorageService {
    constructor(dbPath) {
        this.cache = null;
        this.dbPath = dbPath || DEFAULT_DB_FILE;
        this.ensureDataDirectory();
    }
    ensureDataDirectory() {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            logger.info('数据目录已创建', { directory: dir });
        }
    }
    getDefaultDatabase() {
        return {
            tasks: [],
            escorts: [],
            idempotencyRecords: [],
            lastUpdated: Date.now()
        };
    }
    load() {
        if (this.cache) {
            return { ...this.cache };
        }
        try {
            if (!fs.existsSync(this.dbPath)) {
                const defaultDb = this.getDefaultDatabase();
                this.save(defaultDb);
                logger.info('新建数据库文件');
                return defaultDb;
            }
            const content = fs.readFileSync(this.dbPath, 'utf-8');
            const db = JSON.parse(content);
            this.cache = db;
            logger.info('数据库加载成功', { taskCount: db.tasks.length, escortCount: db.escorts.length });
            return db;
        }
        catch (error) {
            logger.error('数据库加载失败，使用默认数据', error);
            return this.getDefaultDatabase();
        }
    }
    save(db) {
        try {
            db.lastUpdated = Date.now();
            const content = JSON.stringify(db, null, 2);
            fs.writeFileSync(this.dbPath, content, 'utf-8');
            this.cache = { ...db };
        }
        catch (error) {
            logger.error('数据库保存失败', error);
            throw new Error('数据库保存失败');
        }
    }
    saveBackup() {
        const db = this.load();
        const backupPath = `${this.dbPath}.backup.${Date.now()}`;
        fs.writeFileSync(backupPath, JSON.stringify(db, null, 2), 'utf-8');
        logger.info('数据库备份已创建', { backupPath });
        return backupPath;
    }
    getTasks() {
        const db = this.load();
        return [...db.tasks];
    }
    getTaskById(id) {
        const db = this.load();
        return db.tasks.find(t => t.id === id);
    }
    saveTask(task) {
        const db = this.load();
        const index = db.tasks.findIndex(t => t.id === task.id);
        if (index >= 0) {
            db.tasks[index] = task;
        }
        else {
            db.tasks.push(task);
        }
        this.save(db);
        logger.info('任务已保存', { taskId: task.id });
    }
    getEscorts() {
        const db = this.load();
        return [...db.escorts];
    }
    getEscortById(id) {
        const db = this.load();
        return db.escorts.find(e => e.id === id);
    }
    saveEscort(escort) {
        const db = this.load();
        const index = db.escorts.findIndex(e => e.id === escort.id);
        if (index >= 0) {
            db.escorts[index] = escort;
        }
        else {
            db.escorts.push(escort);
        }
        this.save(db);
        logger.info('陪检员已保存', { escortId: escort.id });
    }
    getIdempotencyRecord(key) {
        const db = this.load();
        return db.idempotencyRecords.find(r => r.key === key);
    }
    saveIdempotencyRecord(record) {
        const db = this.load();
        const existingIndex = db.idempotencyRecords.findIndex(r => r.key === record.key);
        if (existingIndex >= 0) {
            db.idempotencyRecords[existingIndex] = record;
        }
        else {
            db.idempotencyRecords.push(record);
        }
        this.save(db);
    }
    clearExpiredIdempotencyRecords(expireMs = 24 * 60 * 60 * 1000) {
        const db = this.load();
        const now = Date.now();
        const originalCount = db.idempotencyRecords.length;
        db.idempotencyRecords = db.idempotencyRecords.filter(r => now - r.createdAt < expireMs);
        const deletedCount = originalCount - db.idempotencyRecords.length;
        if (deletedCount > 0) {
            this.save(db);
            logger.info('已清理过期幂等记录', { count: deletedCount });
        }
        return deletedCount;
    }
    exportData(exportPath, includeSensitive = false) {
        const db = this.load();
        if (!includeSensitive) {
            const maskedDb = {
                ...db,
                tasks: db.tasks.map(task => (0, sensitiveMask_1.maskTask)(task)),
                escorts: db.escorts.map(escort => (0, sensitiveMask_1.maskEscort)(escort))
            };
            fs.writeFileSync(exportPath, JSON.stringify(maskedDb, null, 2), 'utf-8');
        }
        else {
            fs.writeFileSync(exportPath, JSON.stringify(db, null, 2), 'utf-8');
        }
        logger.info('数据已导出', { exportPath });
    }
    importData(importPath) {
        if (!fs.existsSync(importPath)) {
            throw new Error('导入文件不存在');
        }
        const content = fs.readFileSync(importPath, 'utf-8');
        const importedDb = JSON.parse(content);
        this.saveBackup();
        const db = this.load();
        for (const task of importedDb.tasks) {
            const existing = db.tasks.find(t => t.id === task.id);
            if (!existing) {
                db.tasks.push(task);
            }
        }
        for (const escort of importedDb.escorts) {
            const existing = db.escorts.find(e => e.id === escort.id);
            if (!existing) {
                db.escorts.push(escort);
            }
        }
        for (const record of importedDb.idempotencyRecords) {
            const existing = db.idempotencyRecords.find(r => r.key === record.key);
            if (!existing) {
                db.idempotencyRecords.push(record);
            }
        }
        this.save(db);
        logger.info('数据导入成功');
    }
    resetDatabase() {
        this.saveBackup();
        this.save(this.getDefaultDatabase());
        logger.warn('数据库已重置');
    }
    getDbPath() {
        return this.dbPath;
    }
}
exports.StorageService = StorageService;
exports.storage = new StorageService();
