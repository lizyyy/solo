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
exports.Storage = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'quota-data.json');
class Storage {
    constructor() {
        this.ensureDataDir();
        this.data = this.loadData();
    }
    static getInstance() {
        if (!Storage.instance) {
            Storage.instance = new Storage();
        }
        return Storage.instance;
    }
    ensureDataDir() {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
    }
    loadData() {
        if (fs.existsSync(DATA_FILE)) {
            try {
                const content = fs.readFileSync(DATA_FILE, 'utf-8');
                return JSON.parse(content);
            }
            catch (error) {
                console.error('Failed to load data, initializing empty store:', error);
            }
        }
        return {
            quotaConfigs: [],
            usageRecords: [],
            rejectEvents: [],
            auditLogs: []
        };
    }
    saveData() {
        fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    }
    getQuotaConfigs() {
        return [...this.data.quotaConfigs];
    }
    getQuotaConfig(id) {
        return this.data.quotaConfigs.find(q => q.id === id);
    }
    findQuotaConfig(teamName, modelName, usageTag) {
        return this.data.quotaConfigs.find(q => q.teamName === teamName &&
            q.modelName === modelName &&
            q.usageTag === usageTag);
    }
    addQuotaConfig(config) {
        this.data.quotaConfigs.push(config);
        this.saveData();
    }
    updateQuotaConfig(id, updates) {
        const index = this.data.quotaConfigs.findIndex(q => q.id === id);
        if (index === -1)
            return undefined;
        this.data.quotaConfigs[index] = {
            ...this.data.quotaConfigs[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        this.saveData();
        return this.data.quotaConfigs[index];
    }
    addUsageRecord(record) {
        this.data.usageRecords.push(record);
        this.saveData();
    }
    getUsageRecords(quotaId) {
        if (quotaId) {
            return this.data.usageRecords.filter(r => r.quotaId === quotaId);
        }
        return [...this.data.usageRecords];
    }
    addRejectEvent(event) {
        this.data.rejectEvents.push(event);
        this.saveData();
    }
    getRejectEvents(quotaId) {
        if (quotaId) {
            return this.data.rejectEvents.filter(e => e.quotaId === quotaId);
        }
        return [...this.data.rejectEvents];
    }
    addAuditLog(log) {
        this.data.auditLogs.push(log);
        this.saveData();
    }
    getAuditLogs(quotaId) {
        if (quotaId) {
            return this.data.auditLogs.filter(l => l.quotaId === quotaId);
        }
        return [...this.data.auditLogs];
    }
    getAllData() {
        return { ...this.data };
    }
}
exports.Storage = Storage;
