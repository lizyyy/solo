const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { SLAService, TICKET_STATUS } = require('./slaService');

class TicketService {
  // 创建工单
  static async createTicket(ticketData) {
    return new Promise((resolve, reject) => {
      const { title, customerId, priority = 'normal', assigneeId = null } = ticketData;
      
      if (!title || !customerId) {
        return reject(new Error('工单标题和客户ID不能为空'));
      }

      const ticketId = uuidv4();
      const now = moment().format();

      db.serialize(() => {
        // 先获取 SLA 配置
        db.get(`SELECT * FROM sla_configs WHERE priority = ? AND is_active = 1`, [priority], (err, config) => {
          if (err) return reject(err);
          
          // 计算初始截止时间
          const deadline = moment().add(config.resolution_time_hours, 'hours').format();
          
          db.run(
            `INSERT INTO tickets (id, title, customer_id, priority, sla_deadline, created_at, updated_at, assignee_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [ticketId, title, customerId, priority, deadline, now, now, assigneeId],
            (err) => {
              if (err) return reject(err);
              
              resolve({
                success: true,
                ticketId,
                deadline,
                status: TICKET_STATUS.OPEN
              });
            }
          );
        });
      });
    });
  }

  // 获取工单详情
  static async getTicket(ticketId) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM tickets WHERE id = ?`, [ticketId], async (err, ticket) => {
        if (err) return reject(err);
        if (!ticket) return reject(new Error('工单不存在'));

        try {
          // 获取 SLA 信息
          const slaInfo = await SLAService.calculateSLADeadline(ticketId);
          
          // 获取暂停历史
          const pauseHistory = await SLAService.getPauseHistory(ticketId);

          resolve({
            ...ticket,
            sla: slaInfo,
            pauseHistory
          });
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  // 更新工单状态
  static async updateTicketStatus(ticketId, newStatus, updatedBy) {
    return new Promise((resolve, reject) => {
      if (!Object.values(TICKET_STATUS).includes(newStatus)) {
        return reject(new Error('无效的工单状态'));
      }

      const now = moment().format();
      
      db.run(
        `UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?`,
        [newStatus, now, ticketId],
        (err) => {
          if (err) return reject(err);
          
          resolve({
            success: true,
            ticketId,
            newStatus,
            updatedAt: now
          });
        }
      );
    });
  }

  // 分配工单
  static async assignTicket(ticketId, assigneeId) {
    return new Promise((resolve, reject) => {
      const now = moment().format();
      
      db.run(
        `UPDATE tickets SET assignee_id = ?, updated_at = ? WHERE id = ?`,
        [assigneeId, now, ticketId],
        (err) => {
          if (err) return reject(err);
          
          resolve({
            success: true,
            ticketId,
            assigneeId,
            updatedAt: now
          });
        }
      );
    });
  }

  // 获取所有工单
  static async getAllTickets(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM tickets WHERE 1=1`;
      const params = [];

      if (filters.status) {
        query += ` AND status = ?`;
        params.push(filters.status);
      }

      if (filters.priority) {
        query += ` AND priority = ?`;
        params.push(filters.priority);
      }

      if (filters.customerId) {
        query += ` AND customer_id = ?`;
        params.push(filters.customerId);
      }

      query += ` ORDER BY created_at DESC`;

      db.all(query, params, (err, tickets) => {
        if (err) return reject(err);
        resolve(tickets);
      });
    });
  }

  // 关闭工单
  static async closeTicket(ticketId, closedBy) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // 检查是否有活跃的暂停
        db.get(
          `SELECT * FROM sla_pauses WHERE ticket_id = ? AND status = 'paused'`,
          [ticketId],
          (err, activePause) => {
            if (err) return reject(err);
            if (activePause) {
              return reject(new Error('工单存在活跃的暂停，请先恢复或撤销暂停'));
            }

            const now = moment().format();
            db.run(
              `UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?`,
              [TICKET_STATUS.CLOSED, now, ticketId],
              (err) => {
                if (err) return reject(err);
                
                resolve({
                  success: true,
                  ticketId,
                  closedAt: now,
                  message: '工单已关闭'
                });
              }
            );
          }
        );
      });
    });
  }
}

module.exports = TicketService;
