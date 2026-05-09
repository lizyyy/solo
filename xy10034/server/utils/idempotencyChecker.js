const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

class IdempotencyChecker {
    static async checkRequest(requestId, method, endpoint) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM requests WHERE request_id = ?',
                [requestId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    static async markRequestStart(requestId, method, endpoint) {
        const existing = await this.checkRequest(requestId, method, endpoint);
        
        if (existing) {
            if (existing.status === 'pending') {
                return { exists: true, status: 'processing', request: existing };
            } else if (existing.status === 'completed') {
                return { exists: true, status: 'completed', request: existing };
            }
        }

        const newRequest = {
            id: uuidv4(),
            request_id: requestId,
            endpoint,
            method,
            status: 'pending',
            created_at: Date.now()
        };

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO requests (
                    id, request_id, endpoint, method, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    newRequest.id, newRequest.request_id, newRequest.endpoint,
                    newRequest.method, newRequest.status, newRequest.created_at
                ],
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ exists: false, status: 'new', request: newRequest });
                    }
                }
            );
        });
    }

    static async markRequestComplete(requestId) {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE requests SET status = ?, completed_at = ? WHERE request_id = ?',
                ['completed', Date.now(), requestId],
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(true);
                    }
                }
            );
        });
    }

    static async markRequestFailed(requestId) {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE requests SET status = ? WHERE request_id = ?',
                ['failed', requestId],
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(true);
                    }
                }
            );
        });
    }

    static middleware(req, res, next) {
        const requestId = req.headers['x-request-id'] || req.body?.requestId || uuidv4();
        
        res.locals.requestId = requestId;
        req.requestId = requestId;
        
        next();
    }
}

module.exports = IdempotencyChecker;
