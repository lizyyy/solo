const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

class AuditLogger {
    static async log(action, options = {}) {
        const {
            userId = null,
            entityType = null,
            entityId = null,
            oldValue = null,
            newValue = null,
            ipAddress = null,
            userAgent = null,
            status = 'success'
        } = options;

        const auditLog = {
            id: uuidv4(),
            user_id: userId,
            action,
            entity_type: entityType,
            entity_id: entityId,
            old_value: oldValue ? JSON.stringify(oldValue) : null,
            new_value: newValue ? JSON.stringify(newValue) : null,
            ip_address: ipAddress,
            user_agent: userAgent,
            timestamp: Date.now(),
            status
        };

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO audit_logs (
                    id, user_id, action, entity_type, entity_id,
                    old_value, new_value, ip_address, user_agent,
                    timestamp, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    auditLog.id, auditLog.user_id, auditLog.action,
                    auditLog.entity_type, auditLog.entity_id,
                    auditLog.old_value, auditLog.new_value,
                    auditLog.ip_address, auditLog.user_agent,
                    auditLog.timestamp, auditLog.status
                ],
                (err) => {
                    if (err) {
                        console.error('审计日志记录失败:', err);
                        reject(err);
                    } else {
                        resolve(auditLog);
                    }
                }
            );
        });
    }

    static getAuditLogs(filters = {}) {
        const {
            userId,
            action,
            entityType,
            entityId,
            startTime,
            endTime,
            limit = 100,
            offset = 0
        } = filters;

        let query = 'SELECT * FROM audit_logs WHERE 1=1';
        const params = [];

        if (userId) {
            query += ' AND user_id = ?';
            params.push(userId);
        }
        if (action) {
            query += ' AND action = ?';
            params.push(action);
        }
        if (entityType) {
            query += ' AND entity_type = ?';
            params.push(entityType);
        }
        if (entityId) {
            query += ' AND entity_id = ?';
            params.push(entityId);
        }
        if (startTime) {
            query += ' AND timestamp >= ?';
            params.push(startTime);
        }
        if (endTime) {
            query += ' AND timestamp <= ?';
            params.push(endTime);
        }

        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => this.parseAuditLog(row)));
                }
            });
        });
    }

    static parseAuditLog(row) {
        return {
            ...row,
            old_value: row.old_value ? JSON.parse(row.old_value) : null,
            new_value: row.new_value ? JSON.parse(row.new_value) : null
        };
    }
}

module.exports = AuditLogger;
