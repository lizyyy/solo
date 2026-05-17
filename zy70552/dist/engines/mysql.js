"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MySqlEngine = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const database_1 = require("./database");
class MySqlEngine extends database_1.DatabaseEngine {
    constructor(config) {
        super(config);
        this.connection = null;
    }
    async connect() {
        this.connection = await promise_1.default.createConnection({
            host: this.config.host,
            port: this.config.port,
            user: this.config.username,
            password: this.config.password,
            database: this.config.database,
            multipleStatements: true,
            dateStrings: true
        });
    }
    async disconnect() {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }
    }
    async executeQuery(sql) {
        if (!this.connection) {
            throw new Error('Not connected to database');
        }
        if (!sql || sql.trim() === '') {
            return { rows: [], affectedRows: 0 };
        }
        try {
            const [result] = await this.connection.execute(sql);
            if (Array.isArray(result)) {
                return { rows: result, affectedRows: result.length };
            }
            const okPacket = result;
            return {
                rows: [],
                affectedRows: okPacket.affectedRows || 0
            };
        }
        catch (error) {
            throw new Error(`SQL execution failed: ${error.message}\nSQL: ${sql.substring(0, 200)}`);
        }
    }
    async beginTransaction() {
        if (!this.connection) {
            throw new Error('Not connected to database');
        }
        await this.connection.beginTransaction();
    }
    async commitTransaction() {
        if (!this.connection) {
            throw new Error('Not connected to database');
        }
        await this.connection.commit();
    }
    async rollbackTransaction() {
        if (!this.connection) {
            throw new Error('Not connected to database');
        }
        await this.connection.rollback();
    }
    async tableExists(tableName) {
        const result = await this.executeQuery(`SHOW TABLES LIKE '${tableName}'`);
        return result.rows.length > 0;
    }
    async getTableRowCount(tableName) {
        const result = await this.executeQuery(`SELECT COUNT(*) as count FROM \`${tableName}\``);
        return result.rows[0]?.count || 0;
    }
}
exports.MySqlEngine = MySqlEngine;
