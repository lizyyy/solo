"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("../database/db");
const schema_1 = require("../database/schema");
dotenv_1.default.config();
async function initDatabase() {
    console.log('Initializing database...');
    const db = await (0, db_1.getDb)();
    const tables = [
        'inventory_pool',
        'reservation',
        'timeout_task',
        'release_record',
        'compensation_action',
        'inventory_log',
    ];
    for (const table of tables) {
        await new Promise((resolve, reject) => {
            db.run(`DROP TABLE IF EXISTS ${table}`, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    const statements = schema_1.createTablesSQL.split(';').filter(s => s.trim());
    for (const stmt of statements) {
        if (stmt.trim()) {
            await new Promise((resolve, reject) => {
                db.run(stmt, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
    }
    console.log('Database tables created successfully');
    console.log('Database initialization complete');
}
initDatabase().catch(console.error);
