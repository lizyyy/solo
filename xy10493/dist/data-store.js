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
exports.dataStore = exports.DataStore = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DATA_DIR = path.join(process.cwd(), '.audit-data');
const AUDITS_DIR = path.join(DATA_DIR, 'audits');
const HISTORY_DIR = path.join(DATA_DIR, 'history');
class DataStore {
    constructor() {
        this.ensureDirectories();
    }
    ensureDirectories() {
        if (!fs.existsSync(DATA_DIR))
            fs.mkdirSync(DATA_DIR, { recursive: true });
        if (!fs.existsSync(AUDITS_DIR))
            fs.mkdirSync(AUDITS_DIR, { recursive: true });
        if (!fs.existsSync(HISTORY_DIR))
            fs.mkdirSync(HISTORY_DIR, { recursive: true });
    }
    getAuditDir(auditId) {
        return path.join(AUDITS_DIR, auditId);
    }
    ensureAuditDir(auditId) {
        const auditDir = this.getAuditDir(auditId);
        if (!fs.existsSync(auditDir))
            fs.mkdirSync(auditDir, { recursive: true });
    }
    saveAuditSession(session) {
        this.ensureAuditDir(session.id);
        const filePath = path.join(this.getAuditDir(session.id), 'session.json');
        fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    }
    getAuditSession(auditId) {
        const filePath = path.join(this.getAuditDir(auditId), 'session.json');
        if (!fs.existsSync(filePath))
            return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    getAllAuditSessions() {
        if (!fs.existsSync(AUDITS_DIR))
            return [];
        const sessions = [];
        const dirs = fs.readdirSync(AUDITS_DIR);
        for (const dir of dirs) {
            const session = this.getAuditSession(dir);
            if (session)
                sessions.push(session);
        }
        return sessions;
    }
    saveBookInventory(auditId, inventories) {
        this.ensureAuditDir(auditId);
        const filePath = path.join(this.getAuditDir(auditId), 'book-inventory.json');
        fs.writeFileSync(filePath, JSON.stringify(inventories, null, 2));
    }
    getBookInventory(auditId) {
        const filePath = path.join(this.getAuditDir(auditId), 'book-inventory.json');
        if (!fs.existsSync(filePath))
            return [];
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    saveActualCount(auditId, counts) {
        this.ensureAuditDir(auditId);
        const filePath = path.join(this.getAuditDir(auditId), 'actual-count.json');
        fs.writeFileSync(filePath, JSON.stringify(counts, null, 2));
    }
    getActualCount(auditId) {
        const filePath = path.join(this.getAuditDir(auditId), 'actual-count.json');
        if (!fs.existsSync(filePath))
            return [];
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    saveLocationOwners(owners) {
        const filePath = path.join(DATA_DIR, 'location-owners.json');
        fs.writeFileSync(filePath, JSON.stringify(owners, null, 2));
    }
    getLocationOwners() {
        const filePath = path.join(DATA_DIR, 'location-owners.json');
        if (!fs.existsSync(filePath))
            return [];
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    saveDifferences(auditId, differences) {
        this.ensureAuditDir(auditId);
        const filePath = path.join(this.getAuditDir(auditId), 'differences.json');
        fs.writeFileSync(filePath, JSON.stringify(differences, null, 2));
    }
    getDifferences(auditId) {
        const filePath = path.join(this.getAuditDir(auditId), 'differences.json');
        if (!fs.existsSync(filePath))
            return [];
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    updateDifference(auditId, differenceId, updates) {
        const differences = this.getDifferences(auditId);
        const index = differences.findIndex(d => d.id === differenceId);
        if (index === -1)
            return false;
        differences[index] = {
            ...differences[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        this.saveDifferences(auditId, differences);
        return true;
    }
    saveAdjustmentHistory(history) {
        const filePath = path.join(HISTORY_DIR, `${history.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
    }
    getAdjustmentHistory(auditId) {
        if (!fs.existsSync(HISTORY_DIR))
            return [];
        const files = fs.readdirSync(HISTORY_DIR);
        const histories = [];
        for (const file of files) {
            const history = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, file), 'utf-8'));
            if (!auditId || history.auditId === auditId) {
                histories.push(history);
            }
        }
        return histories.sort((a, b) => new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime());
    }
    saveReport(auditId, report) {
        this.ensureAuditDir(auditId);
        const filePath = path.join(this.getAuditDir(auditId), 'report.json');
        fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    }
    getReport(auditId) {
        const filePath = path.join(this.getAuditDir(auditId), 'report.json');
        if (!fs.existsSync(filePath))
            return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
}
exports.DataStore = DataStore;
exports.dataStore = new DataStore();
