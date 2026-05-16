"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthCheck = void 0;
const init_1 = require("../database/init");
exports.HealthCheck = {
    async performCheck() {
        const checks = [];
        const db = (0, init_1.getDatabase)();
        let dbConnected = false;
        let dbError;
        const dbStart = Date.now();
        try {
            await new Promise((resolve, reject) => {
                db.get('SELECT 1 as test', (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            dbConnected = true;
            checks.push({
                name: 'database_connection',
                status: 'pass',
                duration: `${Date.now() - dbStart}ms`
            });
        }
        catch (error) {
            dbError = error.message;
            checks.push({
                name: 'database_connection',
                status: 'fail',
                duration: `${Date.now() - dbStart}ms`,
                error: error.message
            });
        }
        const tablesCheckStart = Date.now();
        try {
            const tables = ['warmup_batches', 'cache_keys', 'failure_records', 'retry_records',
                'execution_nodes', 'data_sources'];
            const missingTables = [];
            for (const table of tables) {
                try {
                    await new Promise((resolve, reject) => {
                        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table], (err, row) => {
                            if (err)
                                reject(err);
                            else if (!row)
                                missingTables.push(table);
                            resolve();
                        });
                    });
                }
                catch (e) {
                    missingTables.push(table);
                }
            }
            if (missingTables.length === 0) {
                checks.push({
                    name: 'database_tables',
                    status: 'pass',
                    duration: `${Date.now() - tablesCheckStart}ms`
                });
            }
            else {
                checks.push({
                    name: 'database_tables',
                    status: 'fail',
                    duration: `${Date.now() - tablesCheckStart}ms`,
                    error: `Missing tables: ${missingTables.join(', ')}`
                });
            }
        }
        catch (error) {
            checks.push({
                name: 'database_tables',
                status: 'fail',
                duration: `${Date.now() - tablesCheckStart}ms`,
                error: error.message
            });
        }
        const allPassed = checks.every(c => c.status === 'pass');
        return {
            status: allPassed ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            database: {
                connected: dbConnected,
                error: dbError
            },
            checks
        };
    },
    async getDetailedStatus() {
        return this.performCheck();
    }
};
