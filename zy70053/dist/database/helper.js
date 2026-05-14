"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseHelper = void 0;
const init_1 = require("./init");
const uuid_1 = require("uuid");
class DatabaseHelper {
    constructor(dbPath) {
        this.db = (0, init_1.initDatabase)(dbPath);
    }
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    runWithResult(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err)
                    reject(err);
                else
                    resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row);
            });
        });
    }
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows);
            });
        });
    }
    beginTransaction() {
        return this.run('BEGIN IMMEDIATE');
    }
    commit() {
        return this.run('COMMIT');
    }
    rollback() {
        return this.run('ROLLBACK');
    }
    close() {
        this.db.close();
    }
    async withTransaction(fn) {
        await this.beginTransaction();
        try {
            const result = await fn();
            await this.commit();
            return result;
        }
        catch (error) {
            try {
                await this.rollback();
            }
            catch (rollbackError) {
                console.error('回滚事务失败:', rollbackError);
            }
            throw error;
        }
    }
    async withWriteLock(fn) {
        return this.withTransaction(fn);
    }
    static generateId() {
        return (0, uuid_1.v4)();
    }
    static now() {
        return new Date().toISOString();
    }
}
exports.DatabaseHelper = DatabaseHelper;
