"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runUpdate = exports.runInsert = exports.runQuery = exports.closeDbConnection = exports.getDbConnection = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const schema_1 = require("./schema");
const path_1 = __importDefault(require("path"));
const DB_PATH = path_1.default.join(process.cwd(), 'data', 'verification.db');
let dbInstance = null;
const getDbConnection = () => {
    if (!dbInstance) {
        dbInstance = new sqlite3_1.default.Database(DB_PATH, (err) => {
            if (err) {
                console.error('数据库连接失败:', err.message);
                throw err;
            }
            console.log('已连接到 SQLite 数据库');
        });
        dbInstance.serialize(() => {
            dbInstance.exec(schema_1.CREATE_TABLES_SQL, (err) => {
                if (err) {
                    console.error('表创建失败:', err.message);
                    throw err;
                }
                console.log('数据库表初始化完成');
            });
        });
    }
    return dbInstance;
};
exports.getDbConnection = getDbConnection;
const closeDbConnection = () => {
    if (dbInstance) {
        dbInstance.close((err) => {
            if (err) {
                console.error('关闭数据库失败:', err.message);
            }
            else {
                console.log('数据库连接已关闭');
            }
        });
        dbInstance = null;
    }
};
exports.closeDbConnection = closeDbConnection;
const runQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        const db = (0, exports.getDbConnection)();
        db.all(sql, params, (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    });
};
exports.runQuery = runQuery;
const runInsert = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        const db = (0, exports.getDbConnection)();
        db.run(sql, params, function (err) {
            if (err)
                reject(err);
            else
                resolve(this.lastID);
        });
    });
};
exports.runInsert = runInsert;
const runUpdate = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        const db = (0, exports.getDbConnection)();
        db.run(sql, params, function (err) {
            if (err)
                reject(err);
            else
                resolve(this.changes);
        });
    });
};
exports.runUpdate = runUpdate;
