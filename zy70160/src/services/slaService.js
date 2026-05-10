const db = require('../config/database');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

// 暂停原因类型
const PAUSE_REASONS = {
  USER_AWAITING: 'user_awaiting',
  THIRD_PARTY: 'third_party',
  EXCEPTION: 'system_exception',
  CUSTOM: 'custom'
};

// 工单状态
const TICKET_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  AWAITING_USER: 'awaiting_user',
  PAUSED: 'paused',
  RESOLVED: 'resolved',
  CLOSED: 'closed'
};

// 暂停状态
const PAUSE_STATUS = {
  PAUSED: 'paused',
  RESUMED: 'resumed',
  CANCELLED: 'cancelled'
};

class SLAService {
  // 计算 SLA 截止时间
  static async calculateSLADeadline(ticketId) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.get(`SELECT * FROM tickets WHERE id = ?`, [ticketId], (err, ticket) => {
          if (err) return reject(err);
          if (!ticket) return reject(new Error('工单不存在'));

          db.get(`SELECT * FROM sla_configs WHERE priority = ? AND is_active = 1`, [ticket.priority], (err, config) => {
            if (err) return reject(err);
            if (!config) return reject(new Error('未找到 SLA 配置'));

            // 计算已用时间和暂停总时长
            db.all(`SELECT * FROM sla_pauses WHERE ticket_id = ? AND status = 'resumed'`, [ticketId], (err, pauses) => {
              if (err) return reject(err);

              let totalPausedMinutes = 0;
              pauses.forEach(pause => {
                if (pause.resumed_at) {
                  const pausedAt = moment(pause.paused_at);
                  const resumedAt = moment(pause.resumed_at);
                  totalPausedMinutes += resumedAt.diff(pausedAt, 'minutes');
                }
              });

              const createdTime = moment(ticket.created_at);
              const now = moment();
              const elapsedMinutes = now.diff(createdTime, 'minutes') - totalPausedMinutes;
              const remainingMinutes = (config.resolution_time_hours * 60) - elapsedMinutes;
              
              const deadline = moment().add(Math.max(0, remainingMinutes), 'minutes');
              
              resolve({
                deadline: deadline.format(),
                remainingMinutes: Math.max(0, remainingMinutes),
                totalPausedMinutes,
                config
              });
            });
          });
        });
      });
    });
  }

  // 暂停 SLA
  static async pauseSLA(ticketId, reason, pausedBy, notes = '') {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // 检查工单是否存在
        db.get(`SELECT * FROM tickets WHERE id = ?`, [ticketId], (err, ticket) => {
          if (err) return reject(err);
          if (!ticket) return reject(new Error('工单不存在'));
          
          // 检查工单状态是否允许暂停
          if (['resolved', 'closed'].includes(ticket.status)) {
            return reject(new Error('已结束的工单无法暂停 SLA'));
          }

          // 检查是否已有活跃的暂停（冲突检测）
          db.get(
            `SELECT * FROM sla_pauses WHERE ticket_id = ? AND status = 'paused'`,
            [ticketId],
            (err, activePause) => {
              if (err) return reject(err);
              if (activePause) {
                return reject(new Error('工单 SLA 已处于暂停状态，无法重复暂停'));
              }

              // 验证暂停原因
              if (!Object.values(PAUSE_REASONS).includes(reason) && reason !== PAUSE_REASONS.CUSTOM) {
                return reject(new Error('无效的暂停原因'));
              }

              const pauseId = uuidv4();
              const now = moment().format();

              db.run(
                `INSERT INTO sla_pauses (id, ticket_id, reason, paused_by, notes, status) VALUES (?, ?, ?, ?, ?, ?)`,
                [pauseId, ticketId, reason, pausedBy, notes, PAUSE_STATUS.PAUSED],
                (err) => {
                  if (err) return reject(err);

                  // 更新工单状态为暂停（如果是等待用户）
                  let updateStatus = '';
                  let params = [];
                  
                  if (reason === PAUSE_REASONS.USER_AWAITING) {
                    updateStatus = `UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?`;
                    params = [TICKET_STATUS.AWAITING_USER, now, ticketId];
                  } else {
                    updateStatus = `UPDATE tickets SET updated_at = ? WHERE id = ?`;
                    params = [now, ticketId];
                  }

                  db.run(updateStatus, params, (err) => {
                    if (err) return reject(err);
                    
                    resolve({
                      success: true,
                      pauseId,
                      ticketId,
                      reason,
                      pausedAt: now,
                      status: PAUSE_STATUS.PAUSED
                    });
                  });
                }
              );
            }
          );
        });
      });
    });
  }

  // 恢复 SLA
  static async resumeSLA(ticketId, resumedBy, notes = '') {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.get(`SELECT * FROM tickets WHERE id = ?`, [ticketId], (err, ticket) => {
          if (err) return reject(err);
          if (!ticket) return reject(new Error('工单不存在'));

          // 查找活跃的暂停记录
          db.get(
            `SELECT * FROM sla_pauses WHERE ticket_id = ? AND status = 'paused'`,
            [ticketId],
            (err, activePause) => {
              if (err) return reject(err);
              if (!activePause) {
                return reject(new Error('工单 SLA 未处于暂停状态，无法恢复'));
              }

              const now = moment().format();
              
              db.run(
                `UPDATE sla_pauses SET status = ?, resumed_at = ?, notes = COALESCE(notes, '') || ? WHERE id = ?`,
                [PAUSE_STATUS.RESUMED, now, notes ? `\n恢复备注: ${notes}` : '', activePause.id],
                (err) => {
                  if (err) return reject(err);

                  // 重新计算并更新 SLA 截止时间
                  SLAService.calculateSLADeadline(ticketId).then((slaInfo) => {
                    // 更新工单状态为进行中
                    db.run(
                      `UPDATE tickets SET sla_deadline = ?, status = ?, updated_at = ? WHERE id = ?`,
                      [slaInfo.deadline, TICKET_STATUS.IN_PROGRESS, now, ticketId],
                      (err) => {
                        if (err) return reject(err);
                        
                        resolve({
                          success: true,
                          pauseId: activePause.id,
                          ticketId,
                          resumedAt: now,
                          newDeadline: slaInfo.deadline,
                          remainingMinutes: slaInfo.remainingMinutes
                        });
                      }
                    );
                  }).catch(reject);
                }
              );
            }
          );
        });
      });
    });
  }

  // 撤销暂停（取消暂停操作，不计入暂停时长）
  static async cancelPause(ticketId, cancelledBy, reason = '') {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.get(
          `SELECT * FROM sla_pauses WHERE ticket_id = ? AND status = 'paused'`,
          [ticketId],
          (err, activePause) => {
            if (err) return reject(err);
            if (!activePause) {
              return reject(new Error('没有活跃的暂停可以撤销'));
            }

            const now = moment().format();
            const notes = `\n撤销原因: ${reason}\n撤销时间: ${now}\n撤销人: ${cancelledBy}`;

            db.run(
              `UPDATE sla_pauses SET status = ?, notes = COALESCE(notes, '') || ? WHERE id = ?`,
              [PAUSE_STATUS.CANCELLED, notes, activePause.id],
              (err) => {
                if (err) return reject(err);

                // 恢复工单状态
                db.run(
                  `UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?`,
                  [TICKET_STATUS.IN_PROGRESS, now, ticketId],
                  (err) => {
                    if (err) return reject(err);
                    
                    resolve({
                      success: true,
                      pauseId: activePause.id,
                      cancelledAt: now,
                      message: '暂停已撤销，不计入暂停时长'
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

  // 检查超时并升级
  static async checkAndEscalate() {
    return new Promise((resolve, reject) => {
      const now = moment().format();
      const escalatedTickets = [];

      db.serialize(() => {
        // 查找所有未暂停且可能超时的工单
        db.all(
          `SELECT t.* FROM tickets t 
           LEFT JOIN sla_pauses p ON t.id = p.ticket_id AND p.status = 'paused'
           WHERE t.status NOT IN ('resolved', 'closed') 
           AND p.id IS NULL
           AND t.sla_deadline IS NOT NULL
           AND DATETIME(t.sla_deadline) < DATETIME(?)`,
          [now],
          (err, tickets) => {
            if (err) return reject(err);
            if (tickets.length === 0) {
              return resolve({ count: 0, tickets: [] });
            }

            let processed = 0;
            tickets.forEach(ticket => {
              // 检查是否已升级
              db.get(
                `SELECT * FROM escalations WHERE ticket_id = ? AND escalation_type = 'sla_timeout'`,
                [ticket.id],
                (err, existing) => {
                  if (err) return reject(err);
                  
                  if (!existing) {
                    const escalationId = uuidv4();
                    db.run(
                      `INSERT INTO escalations (id, ticket_id, escalation_type, details) 
                       VALUES (?, ?, 'sla_timeout', ?)`,
                      [escalationId, ticket.id, `SLA 超时，原截止时间: ${ticket.sla_deadline}`],
                      (err) => {
                        if (err) return reject(err);
                        escalatedTickets.push({ ticketId: ticket.id, escalationId });
                      }
                    );
                  }

                  processed++;
                  if (processed === tickets.length) {
                    resolve({ count: escalatedTickets.length, tickets: escalatedTickets });
                  }
                }
              );
            });
          }
        );
      });
    });
  }

  // 获取暂停历史
  static async getPauseHistory(ticketId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM sla_pauses WHERE ticket_id = ? ORDER BY paused_at DESC`,
        [ticketId],
        (err, pauses) => {
          if (err) return reject(err);
          resolve(pauses);
        }
      );
    });
  }

  // 生成客服报表
  static async generateReport(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const report = {
        period: { start: startDate, end: endDate },
        summary: {},
        details: {}
      };

      db.serialize(() => {
        // 总工单统计
        db.get(
          `SELECT COUNT(*) as total FROM tickets WHERE created_at BETWEEN ? AND ?`,
          [startDate, endDate],
          (err, totalResult) => {
            if (err) return reject(err);
            report.summary.totalTickets = totalResult.total;

            // 暂停次数统计
            db.get(
              `SELECT COUNT(*) as paused_count FROM sla_pauses 
               WHERE paused_at BETWEEN ? AND ? AND status = 'resumed'`,
              [startDate, endDate],
              (err, pauseResult) => {
                if (err) return reject(err);
                report.summary.totalPauses = pauseResult.paused_count;

                // 平均暂停时长
                db.get(
                  `SELECT AVG(JULIANDAY(resumed_at) - JULIANDAY(paused_at)) * 24 * 60 as avg_pause_minutes 
                   FROM sla_pauses 
                   WHERE paused_at BETWEEN ? AND ? 
                   AND resumed_at IS NOT NULL 
                   AND status = 'resumed'`,
                  [startDate, endDate],
                  (err, avgResult) => {
                    if (err) return reject(err);
                    report.summary.averagePauseMinutes = avgResult.avg_pause_minutes || 0;

                    // 暂停原因分布
                    db.all(
                      `SELECT reason, COUNT(*) as count 
                       FROM sla_pauses 
                       WHERE paused_at BETWEEN ? AND ? 
                       GROUP BY reason`,
                      [startDate, endDate],
                      (err, reasons) => {
                        if (err) return reject(err);
                        report.summary.pauseReasons = reasons;

                        // 超时统计
                        db.get(
                          `SELECT COUNT(*) as timeout_count FROM escalations 
                           WHERE escalated_at BETWEEN ? AND ? 
                           AND escalation_type = 'sla_timeout'`,
                          [startDate, endDate],
                          (err, timeoutResult) => {
                            if (err) return reject(err);
                            report.summary.slaTimeouts = timeoutResult.timeout_count;

                            resolve(report);
                          }
                        );
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
}

module.exports = {
  SLAService,
  PAUSE_REASONS,
  TICKET_STATUS,
  PAUSE_STATUS
};
