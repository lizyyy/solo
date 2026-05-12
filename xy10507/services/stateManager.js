const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const RulesEngine = require('./rulesEngine');

class StateManager {
  static STATUS_TRANSITIONS = {
    draft: ['pending_review'],
    pending_review: ['approved', 'rejected'],
    rejected: ['pending_review'],
    approved: ['scheduled', 'running'],
    scheduled: ['running', 'paused'],
    running: ['paused', 'stopped'],
    paused: ['running', 'stopped'],
    stopped: []
  };

  static async transitionState(materialChannelId, newStatus, action, reason, operator, extra = {}) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.get(
          `SELECT * FROM material_channels WHERE id = ?`,
          [materialChannelId],
          async (err, mc) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }
            if (!mc) {
              db.run('ROLLBACK');
              return reject(new Error('素材渠道关系不存在'));
            }

            const oldStatus = mc.status;
            const validTransitions = this.STATUS_TRANSITIONS[oldStatus] || [];

            if (!validTransitions.includes(newStatus)) {
              db.run('ROLLBACK');
              return reject(new Error(`无效的状态转换: ${oldStatus} -> ${newStatus}`));
            }

            const historyId = uuidv4();
            db.run(
              `INSERT INTO status_history (id, material_channel_id, old_status, new_status, action, reason, operator, extra)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [historyId, materialChannelId, oldStatus, newStatus, action, reason, operator, JSON.stringify(extra)],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }

                db.run(
                  `UPDATE material_channels SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                  [newStatus, materialChannelId],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      return reject(err);
                    }

                    db.run('COMMIT', (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                      }
                      resolve({
                        success: true,
                        oldStatus,
                        newStatus,
                        action,
                        historyId
                      });
                    });
                  }
                );
              }
            );
          }
        );
      });
    });
  }

  static async submitForReview(materialChannelId, operator) {
    return this.transitionState(
      materialChannelId,
      'pending_review',
      'submit_review',
      '提交审核',
      operator
    );
  }

  static async approveReview(materialChannelId, operator, reason) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.get(
          `SELECT * FROM material_channels WHERE id = ?`,
          [materialChannelId],
          async (err, mc) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            const oldReviewStatus = mc.review_status;
            const oldStatus = mc.status;

            const historyId = uuidv4();
            db.run(
              `INSERT INTO status_history (id, material_channel_id, old_status, new_status, action, reason, operator)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [historyId, materialChannelId, oldStatus, 'approved', 'approve', reason, operator],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }

                db.run(
                  `UPDATE material_channels
                   SET review_status = 'approved', review_reason = ?, review_by = ?, review_at = CURRENT_TIMESTAMP,
                       status = 'approved', updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`,
                  [reason, operator, materialChannelId],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      return reject(err);
                    }

                    db.run('COMMIT', (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                      }
                      resolve({
                        success: true,
                        oldReviewStatus,
                        newReviewStatus: 'approved',
                        oldStatus,
                        newStatus: 'approved',
                        historyId
                      });
                    });
                  }
                );
              }
            );
          }
        );
      });
    });
  }

  static async rejectReview(materialChannelId, operator, reason) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.get(
          `SELECT * FROM material_channels WHERE id = ?`,
          [materialChannelId],
          (err, mc) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            const oldReviewStatus = mc.review_status;
            const oldStatus = mc.status;

            const historyId = uuidv4();
            db.run(
              `INSERT INTO status_history (id, material_channel_id, old_status, new_status, action, reason, operator)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [historyId, materialChannelId, oldStatus, 'rejected', 'reject', reason, operator],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }

                db.run(
                  `UPDATE material_channels
                   SET review_status = 'rejected', review_reason = ?, review_by = ?, review_at = CURRENT_TIMESTAMP,
                       status = 'rejected', updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`,
                  [reason, operator, materialChannelId],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      return reject(err);
                    }

                    db.run('COMMIT', (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                      }
                      resolve({
                        success: true,
                        oldReviewStatus,
                        newReviewStatus: 'rejected',
                        oldStatus,
                        newStatus: 'rejected',
                        historyId,
                        rejectionReason: reason
                      });
                    });
                  }
                );
              }
            );
          }
        );
      });
    });
  }

  static async launch(materialChannelId, operator, requestId) {
    if (requestId) {
      const existing = await RulesEngine.checkIdempotent(requestId);
      if (existing) {
        return { success: true, idempotent: true, result: existing };
      }
    }

    const validation = await RulesEngine.validateLaunch(materialChannelId);
    if (!validation.success) {
      const result = {
        success: false,
        errors: validation.errors,
        code: 'VALIDATION_FAILED',
        materialChannel: validation.materialChannel
      };
      if (requestId) {
        await RulesEngine.saveIdempotentResult(requestId, 'launch', result);
      }
      return result;
    }

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.get(
          `SELECT mc.*, c.name as channel_name, m.title as material_title, m.version
           FROM material_channels mc
           JOIN channels c ON mc.channel_id = c.id
           JOIN materials m ON mc.material_id = m.id
           WHERE mc.id = ?`,
          [materialChannelId],
          (err, mc) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            const oldStatus = mc.status;

            const historyId = uuidv4();
            db.run(
              `INSERT INTO status_history (id, material_channel_id, old_status, new_status, action, reason, operator)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [historyId, materialChannelId, oldStatus, 'running', 'launch', '上线投放', operator],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }

                db.run(
                  `UPDATE material_channels
                   SET status = 'running', is_active = 1, updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`,
                  [materialChannelId],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      return reject(err);
                    }

                    db.run('COMMIT', async (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                      }

                      const result = {
                        success: true,
                        idempotent: false,
                        result: {
                          oldStatus,
                          newStatus: 'running',
                          historyId,
                          launched: true,
                          channel: mc.channel_name,
                          material: mc.material_title,
                          version: mc.version
                        }
                      };

                      if (requestId) {
                        await RulesEngine.saveIdempotentResult(requestId, 'launch', result);
                      }
                      resolve(result);
                    });
                  }
                );
              }
            );
          }
        );
      });
    });
  }

  static async pause(materialChannelId, operator, reason) {
    return this.transitionState(
      materialChannelId,
      'paused',
      'pause',
      reason || '暂停投放',
      operator
    );
  }

  static async resume(materialChannelId, operator, requestId) {
    if (requestId) {
      const existing = await RulesEngine.checkIdempotent(requestId);
      if (existing) {
        return { success: true, idempotent: true, result: existing };
      }
    }

    const budgetCheck = await RulesEngine.checkBudgetBeforeSpend(materialChannelId, 0);
    if (budgetCheck.remaining <= 0) {
      const result = {
        success: false,
        errors: [{
          rule: '预算检查',
          violation: '预算耗尽不能恢复投放',
          detail: `预算: ${budgetCheck.budget}, 已消耗: ${budgetCheck.spent}, 剩余: ${budgetCheck.remaining}`,
          suggestion: '请增加预算'
        }],
        code: 'BUDGET_EXHAUSTED'
      };
      if (requestId) {
        await RulesEngine.saveIdempotentResult(requestId, 'resume', result);
      }
      return result;
    }

    const result = await this.transitionState(
      materialChannelId,
      'running',
      'resume',
      '恢复投放',
      operator
    );

    if (requestId) {
      await RulesEngine.saveIdempotentResult(requestId, 'resume', result);
    }

    return { success: true, idempotent: false, result };
  }

  static async stop(materialChannelId, operator, reason) {
    return this.transitionState(
      materialChannelId,
      'stopped',
      'stop',
      reason || '停止投放',
      operator
    );
  }

  static async rollback(materialChannelId, targetMaterialId, operator, reason, requestId) {
    if (requestId) {
      const existing = await RulesEngine.checkIdempotent(requestId);
      if (existing) {
        return { success: true, idempotent: true, result: existing };
      }
    }

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.get(
          `SELECT mc.*, m.title as current_title, m.version as current_version,
                  mt.title as target_title, mt.version as target_version
           FROM material_channels mc
           JOIN materials m ON mc.material_id = m.id
           JOIN materials mt ON mt.id = ?
           WHERE mc.id = ?`,
          [targetMaterialId, materialChannelId],
          async (err, mc) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }
            if (!mc) {
              db.run('ROLLBACK');
              return reject(new Error('目标版本不存在'));
            }

            const fromMaterialId = mc.material_id;
            const oldStatus = mc.status;

            const rollbackId = uuidv4();
            db.run(
              `INSERT INTO rollback_records (id, material_channel_id, from_material_id, to_material_id, operator, reason)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [rollbackId, materialChannelId, fromMaterialId, targetMaterialId, operator, reason],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }

                const historyId = uuidv4();
                db.run(
                  `INSERT INTO status_history (id, material_channel_id, old_status, new_status, action, reason, operator, extra)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  [historyId, materialChannelId, oldStatus, 'running', 'rollback', reason, operator,
                   JSON.stringify({
                     from: { material_id: fromMaterialId, version: mc.current_version },
                     to: { material_id: targetMaterialId, version: mc.target_version }
                   })],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      return reject(err);
                    }

                    db.run(
                      `UPDATE material_channels
                       SET material_id = ?, status = 'running', is_active = 1,
                           review_status = 'approved', updated_at = CURRENT_TIMESTAMP
                       WHERE id = ?`,
                      [targetMaterialId, materialChannelId],
                      (err) => {
                        if (err) {
                          db.run('ROLLBACK');
                          return reject(err);
                        }

                        db.run('COMMIT', async (err) => {
                          if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                          }

                          const result = {
                            success: true,
                            idempotent: false,
                            result: {
                              rollbackId,
                              historyId,
                              from: {
                                materialId: fromMaterialId,
                                title: mc.current_title,
                                version: mc.current_version
                              },
                              to: {
                                materialId: targetMaterialId,
                                title: mc.target_title,
                                version: mc.target_version
                              },
                              operator,
                              reason
                            }
                          };

                          if (requestId) {
                            await RulesEngine.saveIdempotentResult(requestId, 'rollback', result);
                          }
                          resolve(result);
                        });
                      }
                    );
                  }
                );
              }
            );
          }
        );
      });
    });
  }

  static async recordPerformance(materialChannelId, data, requestId) {
    if (requestId) {
      const existing = await RulesEngine.checkIdempotent(requestId);
      if (existing) {
        return { success: true, idempotent: true, result: existing };
      }
    }

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.get(
          `SELECT * FROM material_channels WHERE id = ?`,
          [materialChannelId],
          async (err, mc) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }
            if (!mc) {
              db.run('ROLLBACK');
              return reject(new Error('素材渠道关系不存在'));
            }

            const budgetCheck = await RulesEngine.checkBudgetBeforeSpend(materialChannelId, data.cost || 0);
            if (!budgetCheck.canSpend) {
              db.run('ROLLBACK');
              const result = {
                success: false,
                errors: [{
                  rule: '预算检查',
                  violation: '预算不足，无法记录消耗',
                  detail: `预算: ${budgetCheck.budget}, 已消耗: ${budgetCheck.spent}, 剩余: ${budgetCheck.remaining}, 需要: ${data.cost}`,
                  suggestion: '请增加预算或暂停投放'
                }],
                code: 'BUDGET_EXHAUSTED'
              };
              if (requestId) {
                await RulesEngine.saveIdempotentResult(requestId, 'performance', result);
              }
              return resolve(result);
            }

            const performanceId = uuidv4();
            db.run(
              `INSERT INTO performance_data (id, material_channel_id, impressions, clicks, conversions, cost)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [performanceId, materialChannelId,
               data.impressions || 0, data.clicks || 0, data.conversions || 0, data.cost || 0],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }

                const newSpent = mc.spent + (data.cost || 0);
                db.run(
                  `UPDATE material_channels SET spent = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                  [newSpent, materialChannelId],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      return reject(err);
                    }

                    db.run('COMMIT', async (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                      }

                      const result = {
                        success: true,
                        idempotent: false,
                        result: {
                          performanceId,
                          previousSpent: mc.spent,
                          currentSpent: newSpent,
                          budget: mc.budget,
                          remaining: mc.budget - newSpent,
                          performance: data
                        }
                      };

                      if (requestId) {
                        await RulesEngine.saveIdempotentResult(requestId, 'performance', result);
                      }
                      resolve(result);
                    });
                  }
                );
              }
            );
          }
        );
      });
    });
  }

  static async manualCorrect(targetId, targetType, beforeData, afterData, operator, reason) {
    return new Promise((resolve, reject) => {
      const correctionId = uuidv4();
      db.run(
        `INSERT INTO manual_corrections (id, target_id, target_type, before_data, after_data, operator, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [correctionId, targetId, targetType, JSON.stringify(beforeData), JSON.stringify(afterData), operator, reason],
        (err) => {
          if (err) return reject(err);
          resolve({
            success: true,
            correctionId,
            targetId,
            targetType,
            beforeData,
            afterData,
            operator,
            reason
          });
        }
      );
    });
  }
}

module.exports = StateManager;
