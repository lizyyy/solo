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
exports.storage = exports.Storage = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dayjs_1 = __importDefault(require("dayjs"));
const uuid_1 = require("uuid");
const config_1 = require("./config");
class Storage {
    constructor() {
        this.db = null;
        this.writeLock = false;
        this.init();
    }
    init() {
        if (!fs.existsSync(config_1.DATA_DIR)) {
            fs.mkdirSync(config_1.DATA_DIR, { recursive: true });
        }
        if (!fs.existsSync(config_1.DB_FILE)) {
            this.initializeDatabase();
        }
        else {
            this.loadDatabase();
        }
    }
    initializeDatabase() {
        const now = (0, dayjs_1.default)().toISOString();
        this.db = {
            version: config_1.DB_VERSION,
            lastModified: now,
            equipment: [],
            booths: [],
            rentalRecords: [],
            auditLogs: [],
            snapshots: [],
            requestIds: []
        };
        this.persist();
    }
    loadDatabase() {
        try {
            const data = fs.readFileSync(config_1.DB_FILE, 'utf-8');
            this.db = JSON.parse(data);
            this.migrateDatabase();
        }
        catch (error) {
            console.error('加载数据库失败，尝试从备份恢复...', error);
            this.tryRestoreFromBackup();
        }
    }
    migrateDatabase() {
        if (!this.db)
            return;
        if (this.db.version !== config_1.DB_VERSION) {
            console.log(`数据库版本升级: ${this.db.version} -> ${config_1.DB_VERSION}`);
            this.db.version = config_1.DB_VERSION;
        }
        if (!this.db.requestIds) {
            this.db.requestIds = [];
        }
        if (!this.db.snapshots) {
            this.db.snapshots = [];
        }
    }
    tryRestoreFromBackup() {
        const backupDir = path.join(config_1.DATA_DIR, 'backups');
        if (fs.existsSync(backupDir)) {
            const backups = fs.readdirSync(backupDir)
                .filter(f => f.endsWith('.json'))
                .sort()
                .reverse();
            for (const backup of backups) {
                try {
                    const backupPath = path.join(backupDir, backup);
                    const data = fs.readFileSync(backupPath, 'utf-8');
                    this.db = JSON.parse(data);
                    console.log(`已从备份恢复: ${backup}`);
                    return;
                }
                catch {
                    continue;
                }
            }
        }
        console.log('无有效备份，创建新数据库');
        this.initializeDatabase();
    }
    createBackup() {
        const backupDir = path.join(config_1.DATA_DIR, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        const timestamp = (0, dayjs_1.default)().format('YYYYMMDD-HHmmss');
        const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
        if (this.db) {
            fs.writeFileSync(backupFile, JSON.stringify(this.db, null, 2));
        }
        this.cleanupOldBackups(backupDir);
    }
    cleanupOldBackups(backupDir) {
        const cutoff = (0, dayjs_1.default)().subtract(config_1.BACKUP_RETENTION_DAYS, 'day');
        const backups = fs.readdirSync(backupDir);
        for (const backup of backups) {
            const match = backup.match(/backup-(\d{8})-(\d{6})\.json/);
            if (match) {
                const dateStr = match[1];
                const backupDate = (0, dayjs_1.default)(dateStr, 'YYYYMMDD');
                if (backupDate.isBefore(cutoff)) {
                    fs.unlinkSync(path.join(backupDir, backup));
                }
            }
        }
    }
    persist() {
        if (!this.db || this.writeLock)
            return;
        this.writeLock = true;
        try {
            this.db.lastModified = (0, dayjs_1.default)().toISOString();
            this.createBackup();
            const tempFile = `${config_1.DB_FILE}.tmp`;
            fs.writeFileSync(tempFile, JSON.stringify(this.db, null, 2));
            fs.renameSync(tempFile, config_1.DB_FILE);
        }
        finally {
            this.writeLock = false;
        }
    }
    getEquipment() {
        return this.db?.equipment || [];
    }
    getEquipmentById(id) {
        return this.db?.equipment.find(e => e.id === id);
    }
    addEquipment(equipment) {
        const newEquipment = {
            ...equipment,
            id: (0, uuid_1.v4)(),
            lastUpdated: (0, dayjs_1.default)().toISOString()
        };
        this.db?.equipment.push(newEquipment);
        this.persist();
        return newEquipment;
    }
    updateEquipment(id, updates) {
        const index = this.db?.equipment.findIndex(e => e.id === id);
        if (index !== undefined && index >= 0 && this.db) {
            this.db.equipment[index] = {
                ...this.db.equipment[index],
                ...updates,
                lastUpdated: (0, dayjs_1.default)().toISOString()
            };
            this.persist();
            return this.db.equipment[index];
        }
        return undefined;
    }
    getBooths() {
        return this.db?.booths || [];
    }
    getBoothById(id) {
        return this.db?.booths.find(b => b.id === id);
    }
    getBoothByNumber(boothNumber) {
        return this.db?.booths.find(b => b.boothNumber === boothNumber);
    }
    addBooth(booth) {
        const newBooth = {
            ...booth,
            id: (0, uuid_1.v4)(),
            createdAt: (0, dayjs_1.default)().toISOString()
        };
        this.db?.booths.push(newBooth);
        this.persist();
        return newBooth;
    }
    getRentalRecords() {
        return this.db?.rentalRecords || [];
    }
    getRentalRecordById(id) {
        return this.db?.rentalRecords.find(r => r.id === id);
    }
    getRentalRecordByRequestId(requestId) {
        return this.db?.rentalRecords.find(r => r.requestId === requestId);
    }
    getRentalRecordsByBoothId(boothId) {
        return this.db?.rentalRecords.filter(r => r.boothId === boothId) || [];
    }
    addRentalRecord(record) {
        const newRecord = {
            ...record,
            id: (0, uuid_1.v4)(),
            createdAt: (0, dayjs_1.default)().toISOString(),
            updatedAt: (0, dayjs_1.default)().toISOString()
        };
        this.db?.rentalRecords.push(newRecord);
        this.persist();
        return newRecord;
    }
    updateRentalRecord(id, updates) {
        const index = this.db?.rentalRecords.findIndex(r => r.id === id);
        if (index !== undefined && index >= 0 && this.db) {
            this.db.rentalRecords[index] = {
                ...this.db.rentalRecords[index],
                ...updates,
                updatedAt: (0, dayjs_1.default)().toISOString()
            };
            this.persist();
            return this.db.rentalRecords[index];
        }
        return undefined;
    }
    getAuditLogs() {
        return this.db?.auditLogs || [];
    }
    addAuditLog(log) {
        const newLog = {
            ...log,
            id: (0, uuid_1.v4)(),
            timestamp: (0, dayjs_1.default)().toISOString()
        };
        this.db?.auditLogs.push(newLog);
        this.persist();
        return newLog;
    }
    addRequestId(requestId) {
        if (this.db && !this.db.requestIds.includes(requestId)) {
            this.db.requestIds.push(requestId);
            this.persist();
        }
    }
    hasRequestId(requestId) {
        return this.db?.requestIds.includes(requestId) || false;
    }
    getSnapshots() {
        return this.db?.snapshots || [];
    }
    createSnapshot(createdBy) {
        const equipment = this.getEquipment();
        const totalValue = equipment.reduce((sum, e) => {
            return sum + (e.pricePerDay || 0) * e.totalQuantity;
        }, 0);
        const snapshot = {
            id: (0, uuid_1.v4)(),
            timestamp: (0, dayjs_1.default)().toISOString(),
            equipment: JSON.parse(JSON.stringify(equipment)),
            totalValue,
            createdBy
        };
        this.db?.snapshots.push(snapshot);
        this.persist();
        return snapshot;
    }
    getBoothRentedQuantity(boothId, equipmentId) {
        return this.db?.rentalRecords
            .filter(r => r.boothId === boothId &&
            r.status === 'confirmed')
            .reduce((sum, r) => {
            const item = r.items.find(i => i.equipmentId === equipmentId);
            return sum + (item?.quantity || 0);
        }, 0) || 0;
    }
    exportDatabase() {
        return JSON.parse(JSON.stringify(this.db));
    }
}
exports.Storage = Storage;
exports.storage = new Storage();
