"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseHelper = void 0;
const init_1 = require("./init");
const uuid_1 = require("uuid");
class DatabaseHelper {
    constructor(dbPath) {
        this.transactionDepth = 0;
        this.savepointCounter = 0;
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
        return this.run('BEGIN TRANSACTION');
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
        if (this.transactionDepth === 0) {
            this.transactionDepth++;
            await this.beginTransaction();
            try {
                const result = await fn();
                await this.commit();
                this.transactionDepth--;
                return result;
            }
            catch (error) {
                await this.rollback();
                this.transactionDepth--;
                throw error;
            }
        }
        else {
            const savepointName = `sp_${this.savepointCounter++}`;
            await this.run(`SAVEPOINT ${savepointName}`);
            try {
                const result = await fn();
                await this.run(`RELEASE SAVEPOINT ${savepointName}`);
                return result;
            }
            catch (error) {
                await this.run(`ROLLBACK TO SAVEPOINT ${savepointName}`);
                throw error;
            }
        }
    }
    static generateId() {
        return (0, uuid_1.v4)();
    }
    static now() {
        return new Date().toISOString();
    }
}
exports.DatabaseHelper = DatabaseHelper;
