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
const DATA_DIR = path.join(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
class Storage {
    static ensureDirs() {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }
    }
    static exists() {
        return fs.existsSync(STATE_FILE);
    }
    static load() {
        if (!this.exists()) {
            throw new Error('项目未初始化，请先运行 init 命令');
        }
        const content = fs.readFileSync(STATE_FILE, 'utf-8');
        return JSON.parse(content);
    }
    static save(state) {
        this.ensureDirs();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(BACKUP_DIR, `state-${timestamp}.json`);
        if (fs.existsSync(STATE_FILE)) {
            fs.copyFileSync(STATE_FILE, backupFile);
        }
        state.lastUpdatedAt = new Date().toISOString();
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    }
    static initialize(state) {
        this.ensureDirs();
        if (fs.existsSync(STATE_FILE)) {
            throw new Error('项目已存在，如需重新初始化请先清理数据');
        }
        this.save(state);
    }
    static clear() {
        if (fs.existsSync(DATA_DIR)) {
            fs.rmSync(DATA_DIR, { recursive: true, force: true });
        }
    }
    static getDataDir() {
        return DATA_DIR;
    }
    static getBackupDir() {
        return BACKUP_DIR;
    }
    static listBackups() {
        if (!fs.existsSync(BACKUP_DIR))
            return [];
        return fs.readdirSync(BACKUP_DIR)
            .filter(f => f.endsWith('.json'))
            .sort()
            .reverse();
    }
    static restoreBackup(backupName) {
        const backupFile = path.join(BACKUP_DIR, backupName);
        if (!fs.existsSync(backupFile)) {
            throw new Error(`备份文件不存在: ${backupName}`);
        }
        fs.copyFileSync(backupFile, STATE_FILE);
    }
}
exports.Storage = Storage;
