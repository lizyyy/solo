"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.saveDb = saveDb;
exports.closeDb = closeDb;
exports.getNextTicketId = getNextTicketId;
exports.getNextReminderId = getNextReminderId;
exports.getNextAudioId = getNextAudioId;
exports.resetDb = resetDb;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.join(process.cwd(), 'data');
const DB_FILE = path_1.default.join(DATA_DIR, 'db.json');
let dbCache = null;
function initData() {
    return {
        ticketBatches: [],
        tickets: [],
        audioFiles: [],
        authReminders: [],
        auditLogs: []
    };
}
function getDb() {
    if (!dbCache) {
        if (!fs_1.default.existsSync(DATA_DIR)) {
            fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
        }
        if (fs_1.default.existsSync(DB_FILE)) {
            try {
                const content = fs_1.default.readFileSync(DB_FILE, 'utf-8');
                dbCache = JSON.parse(content);
            }
            catch (e) {
                dbCache = initData();
            }
        }
        else {
            dbCache = initData();
        }
    }
    return dbCache;
}
function saveDb() {
    if (!fs_1.default.existsSync(DATA_DIR)) {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs_1.default.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
}
function closeDb() {
    saveDb();
    dbCache = null;
}
let nextTicketId = 1;
let nextBatchId = 1;
let nextReminderId = 1;
let nextAudioId = 1;
function getNextTicketId() {
    const db = getDb();
    if (db.tickets.length > 0) {
        nextTicketId = Math.max(...db.tickets.map(t => t.id || 0)) + 1;
    }
    return nextTicketId++;
}
function getNextReminderId() {
    const db = getDb();
    if (db.authReminders.length > 0) {
        nextReminderId = Math.max(...db.authReminders.map(r => r.id || 0)) + 1;
    }
    return nextReminderId++;
}
function getNextAudioId() {
    const db = getDb();
    if (db.audioFiles.length > 0) {
        nextAudioId = Math.max(...db.audioFiles.map(a => a.id || 0)) + 1;
    }
    return nextAudioId++;
}
function resetDb() {
    dbCache = initData();
    saveDb();
}
