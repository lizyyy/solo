const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const ConcurrencyControl = require('../utils/concurrencyControl');
const RetryHandler = require('../utils/retryHandler');
const AuditLogger = require('../utils/auditLogger');

class LogService {
    static async createLog(logData, auditContext = {}) {
        const {
            source_type,
            level,
            message,
            timestamp = Date.now(),
            metadata = {}
        } = logData;

        const log = {
            id: uuidv4(),
            source_type,
            level,
            message,
            timestamp,
            metadata: JSON.stringify(metadata),
            created_at: Date.now(),
            updated_at: Date.now(),
            status: 'pending',
            version: 1
        };

        const insertLog = () => new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO logs (
                    id, source_type, level, message, timestamp,
                    metadata, created_at, updated_at, status, version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    log.id, log.source_type, log.level, log.message, log.timestamp,
                    log.metadata, log.created_at, log.updated_at, log.status, log.version
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve(log);
                }
            );
        });

        try {
            const result = await RetryHandler.executeWithRetry(
                insertLog,
                'create_log',
                logData,
                { maxRetries: 3, delayMs: 1000 }
            );

            await AuditLogger.log('CREATE_LOG', {
                ...auditContext,
                entityType: 'log',
                entityId: log.id,
                newValue: { ...log, metadata }
            });

            return result;
        } catch (error) {
            await AuditLogger.log('CREATE_LOG', {
                ...auditContext,
                entityType: 'log',
                status: 'failed',
                newValue: logData
            });
            throw error;
        }
    }

    static async batchCreateLogs(logsData, auditContext = {}) {
        const createdLogs = [];
        const errors = [];

        for (const logData of logsData) {
            try {
                const log = await this.createLog(logData, auditContext);
                createdLogs.push(log);
            } catch (error) {
                errors.push({ logData, error: error.message });
            }
        }

        return {
            created: createdLogs.length,
            failed: errors.length,
            errors,
            logs: createdLogs
        };
    }

    static async getLog(id) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM logs WHERE id = ?', [id], (err, row) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    reject(new Error('日志不存在'));
                } else {
                    resolve(this.parseLog(row));
                }
            });
        });
    }

    static async getLogs(filters = {}) {
        const {
            level,
            source_type,
            status,
            startTime,
            endTime,
            search,
            limit = 50,
            offset = 0,
            sortBy = 'timestamp',
            sortOrder = 'DESC'
        } = filters;

        let query = 'SELECT * FROM logs WHERE 1=1';
        const params = [];

        if (level) {
            query += ' AND level = ?';
            params.push(level);
        }
        if (source_type) {
            query += ' AND source_type = ?';
            params.push(source_type);
        }
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        if (startTime) {
            query += ' AND timestamp >= ?';
            params.push(startTime);
        }
        if (endTime) {
            query += ' AND timestamp <= ?';
            params.push(endTime);
        }
        if (search) {
            query += ' AND (message LIKE ? OR metadata LIKE ?)';
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern);
        }

        const validSortFields = ['timestamp', 'created_at', 'level'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'timestamp';
        const validOrders = ['ASC', 'DESC'];
        const order = validOrders.includes(sortOrder?.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

        query += ` ORDER BY ${sortField} ${order} LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => this.parseLog(row)));
                }
            });
        });
    }

    static async updateLog(id, updates, expectedVersion, auditContext = {}) {
        const log = await this.getLog(id);
        
        const allowedUpdates = ['message', 'level', 'status', 'metadata'];
        const filteredUpdates = {};
        
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = key === 'metadata' 
                    ? JSON.stringify(updates[key]) 
                    : updates[key];
            }
        }

        if (Object.keys(filteredUpdates).length === 0) {
            throw new Error('没有可更新的字段');
        }

        const oldValue = { ...log };
        
        try {
            const newVersion = await ConcurrencyControl.safeUpdate(
                db, 'logs', id, expectedVersion, filteredUpdates
            );

            await AuditLogger.log('UPDATE_LOG', {
                ...auditContext,
                entityType: 'log',
                entityId: id,
                oldValue,
                newValue: { ...filteredUpdates, version: newVersion }
            });

            return { ...filteredUpdates, version: newVersion };
        } catch (error) {
            await AuditLogger.log('UPDATE_LOG', {
                ...auditContext,
                entityType: 'log',
                entityId: id,
                status: 'failed',
                oldValue,
                newValue: filteredUpdates
            });
            throw error;
        }
    }

    static async deleteLog(id, auditContext = {}) {
        const log = await this.getLog(id);

        return new Promise((resolve, reject) => {
            db.run('DELETE FROM logs WHERE id = ?', [id], async (err) => {
                if (err) {
                    await AuditLogger.log('DELETE_LOG', {
                        ...auditContext,
                        entityType: 'log',
                        entityId: id,
                        status: 'failed',
                        oldValue: log
                    });
                    reject(err);
                } else {
                    await AuditLogger.log('DELETE_LOG', {
                        ...auditContext,
                        entityType: 'log',
                        entityId: id,
                        oldValue: log
                    });
                    resolve({ success: true, id });
                }
            });
        });
    }

    static async getLogStats(filters = {}) {
        const { startTime, endTime, level, source_type } = filters;
        
        let query = `
            SELECT 
                level,
                COUNT(*) as count
            FROM logs
            WHERE 1=1
        `;
        const params = [];

        if (startTime) {
            query += ' AND timestamp >= ?';
            params.push(startTime);
        }
        if (endTime) {
            query += ' AND timestamp <= ?';
            params.push(endTime);
        }
        if (level) {
            query += ' AND level = ?';
            params.push(level);
        }
        if (source_type) {
            query += ' AND source_type = ?';
            params.push(source_type);
        }

        query += ' GROUP BY level';

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const stats = {
                        total: 0,
                        byLevel: {}
                    };
                    
                    rows.forEach(row => {
                        stats.byLevel[row.level] = row.count;
                        stats.total += row.count;
                    });

                    ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'].forEach(lvl => {
                        if (!stats.byLevel[lvl]) {
                            stats.byLevel[lvl] = 0;
                        }
                    });

                    resolve(stats);
                }
            });
        });
    }

    static parseLog(row) {
        return {
            ...row,
            metadata: row.metadata ? JSON.parse(row.metadata) : null
        };
    }
}

module.exports = LogService;
