"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MySqlEngine = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const database_1 = require("./database");
class MySqlEngine extends database_1.DatabaseEngine {
    async connect() { this.connection = promise_1.default.createConnection({}); }
    async disconnect() { if (this.connection)
        await this.connection.end(); }
    async executeQuery(sql) { return { rows: [], affectedRows: 0 }; }
    async beginTransaction() { }
    async commitTransaction() { }
    async rollbackTransaction() { }
}
exports.MySqlEngine = MySqlEngine;
