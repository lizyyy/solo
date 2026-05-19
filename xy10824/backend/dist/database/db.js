"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.runQuery = runQuery;
exports.getOne = getOne;
exports.getAll = getAll;
exports.beginTransaction = beginTransaction;
exports.commitTransaction = commitTransaction;
exports.rollbackTransaction = rollbackTransaction;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let db = null;
async function getDb() {
    if (!db) {
        const dbDir = path_1.default.join(__dirname, '../../data');
        if (!fs_1.default.existsSync(dbDir)) {
            fs_1.default.mkdirSync(dbDir, { recursive: true });
        }
        const dbPath = path_1.default.join(dbDir, 'inventory.db');
        db = new sqlite3_1.default.Database(dbPath);
    }
    return db;
}
function runQuery(sql, params = []) {
    return new Promise(async (resolve, reject) => {
        const db = await getDb();
        db.run(sql, params, function (err) {
            if (err)
                reject(err);
            else
                resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}
function getOne(sql, params = []) {
    return new Promise(async (resolve, reject) => {
        const db = await getDb();
        db.get(sql, params, (err, row) => {
            if (err)
                reject(err);
            else
                resolve(row);
        });
    });
}
function getAll(sql, params = []) {
    return new Promise(async (resolve, reject) => {
        const db = await getDb();
        db.all(sql, params, (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    });
}
function beginTransaction() {
    return new Promise(async (resolve, reject) => {
        const db = await getDb();
        db.run('BEGIN TRANSACTION', (err) => {
            if (err)
                reject(err);
            else
                resolve();
        });
    });
}
function commitTransaction() {
    return new Promise(async (resolve, reject) => {
        const db = await getDb();
        db.run('COMMIT', (err) => {
            if (err)
                reject(err);
            else
                resolve();
        });
    });
}
function rollbackTransaction() {
    return new Promise(async (resolve, reject) => {
        const db = await getDb();
        db.run('ROLLBACK', (err) => {
            if (err)
                reject(err);
            else
                resolve();
        });
    });
}
