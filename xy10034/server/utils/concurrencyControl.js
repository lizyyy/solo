class ConcurrencyControl {
    static async executeWithOptimisticLock(db, entityId, expectedVersion, updateFn) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT version FROM logs WHERE id = ?',
                [entityId],
                (err, currentLog) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (!currentLog) {
                        reject(new Error('记录不存在'));
                        return;
                    }

                    if (currentLog.version !== expectedVersion) {
                        reject(new Error('数据已被其他用户修改，请刷新后重试'));
                        return;
                    }

                    const newVersion = expectedVersion + 1;
                    
                    updateFn(newVersion, (updateErr) => {
                        if (updateErr) {
                            reject(updateErr);
                        } else {
                            resolve(newVersion);
                        }
                    });
                }
            );
        });
    }

    static async safeUpdate(db, tableName, entityId, expectedVersion, updates) {
        const fields = Object.keys(updates);
        const values = Object.values(updates);
        
        fields.push('version');
        values.push(expectedVersion + 1);
        
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE ${tableName} SET ${setClause}, updated_at = ? 
                 WHERE id = ? AND version = ?`,
                [...values, Date.now(), entityId, expectedVersion],
                function(err) {
                    if (err) {
                        reject(err);
                    } else if (this.changes === 0) {
                        reject(new Error('数据已被其他用户修改，请刷新后重试'));
                    } else {
                        resolve(expectedVersion + 1);
                    }
                }
            );
        });
    }

    static wrapRoute(handler) {
        return async (req, res, next) => {
            try {
                await handler(req, res, next);
            } catch (error) {
                if (error.message.includes('数据已被其他用户修改')) {
                    return res.status(409).json({
                        success: false,
                        error: 'CONFLICT',
                        message: error.message
                    });
                }
                next(error);
            }
        };
    }
}

module.exports = ConcurrencyControl;
