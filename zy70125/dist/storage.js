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
exports.getDB = getDB;
exports.updateDB = updateDB;
exports.resetDB = resetDB;
exports.getDBPath = getDBPath;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'tour-db.json');
const INITIAL_DB = {
    equipmentCases: [],
    cities: [],
    tourManifests: [],
    borrowRecords: [],
    damageRecords: [],
    repairRecords: [],
    compensationActions: [],
};
let cachedDB = null;
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}
function loadDB() {
    if (cachedDB)
        return { ...cachedDB };
    ensureDataDir();
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), 'utf-8');
        cachedDB = { ...INITIAL_DB };
        return cachedDB;
    }
    try {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        cachedDB = JSON.parse(content);
        return { ...cachedDB };
    }
    catch {
        fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), 'utf-8');
        cachedDB = { ...INITIAL_DB };
        return cachedDB;
    }
}
function saveDB(db) {
    ensureDataDir();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    cachedDB = db;
}
function getDB() {
    return loadDB();
}
function updateDB(updater) {
    const current = loadDB();
    const updated = updater(current);
    saveDB(updated);
    return updated;
}
function resetDB() {
    ensureDataDir();
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), 'utf-8');
    cachedDB = { ...INITIAL_DB };
}
function getDBPath() {
    return DB_FILE;
}
