"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.all = exports.get = exports.run = exports.db = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const dbPath = path_1.default.join(__dirname, '../../waste-recycling.db');
exports.db = new sqlite3_1.default.Database(dbPath, (err) => {
    if (err) {
        console.error('数据库连接失败:', err.message);
    }
    else {
        console.log('数据库连接成功');
    }
});
const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        exports.db.run(sql, params, function (err) {
            if (err)
                reject(err);
            else
                resolve(this.lastID);
        });
    });
};
exports.run = run;
const get = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        exports.db.get(sql, params, (err, row) => {
            if (err)
                reject(err);
            else
                resolve(row);
        });
    });
};
exports.get = get;
const all = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        exports.db.all(sql, params, (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    });
};
exports.all = all;
