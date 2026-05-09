const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

class RetryHandler {
    static async recordFailedOperation(operationType, data, errorMessage, maxRetries = 3) {
        const operation = {
            id: uuidv4(),
            operation_type: operationType,
            data: JSON.stringify(data),
            error_message: errorMessage,
            retry_count: 0,
            max_retries: maxRetries,
            status: 'failed',
            created_at: Date.now(),
            next_retry_at: Date.now() + 1000
        };

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO failed_operations (
                    id, operation_type, data, error_message,
                    retry_count, max_retries, status,
                    created_at, next_retry_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    operation.id, operation.operation_type, operation.data,
                    operation.error_message, operation.retry_count, operation.max_retries,
                    operation.status, operation.created_at, operation.next_retry_at
                ],
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(operation);
                    }
                }
            );
        });
    }

    static async getPendingOperations() {
        const now = Date.now();
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM failed_operations 
                 WHERE status = 'failed' AND next_retry_at <= ?
                 ORDER BY next_retry_at ASC`,
                [now],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    static async updateOperationForRetry(operationId) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE failed_operations 
                 SET retry_count = retry_count + 1,
                     last_attempt_at = ?,
                     status = 'retrying'
                 WHERE id = ?`,
                [Date.now(), operationId],
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

    static async markOperationSuccess(operationId) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE failed_operations 
                 SET status = 'succeeded',
                     last_attempt_at = ?
                 WHERE id = ?`,
                [Date.now(), operationId],
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

    static async markOperationFailed(operationId, errorMessage) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM failed_operations WHERE id = ?',
                [operationId],
                (err, operation) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    const nextRetryCount = operation.retry_count + 1;
                    const shouldRetry = nextRetryCount < operation.max_retries;
                    const newStatus = shouldRetry ? 'failed' : 'permanently_failed';
                    const nextRetryAt = shouldRetry 
                        ? Date.now() + (1000 * Math.pow(2, nextRetryCount))
                        : null;

                    db.run(
                        `UPDATE failed_operations 
                         SET status = ?,
                             error_message = ?,
                             next_retry_at = ?
                         WHERE id = ?`,
                        [newStatus, errorMessage, nextRetryAt, operationId],
                        (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve({ status: newStatus, shouldRetry });
                            }
                        }
                    );
                }
            );
        });
    }

    static async executeWithRetry(fn, operationType, data, options = {}) {
        const {
            maxRetries = 3,
            delayMs = 1000
        } = options;

        let lastError;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                console.warn(`操作 ${operationType} 第 ${attempt + 1} 次尝试失败:`, error.message);
                
                if (attempt < maxRetries - 1) {
                    const waitTime = delayMs * Math.pow(2, attempt);
                    await this.sleep(waitTime);
                }
            }
        }

        await this.recordFailedOperation(operationType, data, lastError?.message, maxRetries);
        throw lastError;
    }

    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = RetryHandler;
