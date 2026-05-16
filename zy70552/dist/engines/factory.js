"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDatabaseEngine = createDatabaseEngine;
const mysql_1 = require("./mysql");
function createDatabaseEngine(config) {
    switch (config.type) {
        case 'mysql':
            return new mysql_1.MySqlEngine(config);
        case 'postgresql':
            throw new Error('PostgreSQL not implemented yet');
        default:
            throw new Error(`Unsupported database type: ${config.type}`);
    }
}
