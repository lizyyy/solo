const db = require('../database');
const { STATUS, CONFLICT_THRESHOLD } = require('../constants');
const { validateTicket, validateStatusUpdate } = require('../validation');

class TicketService {
  async createTicket(data) {
    const { error, value } = validateTicket(data);
    if (error) {
      throw new Error(`验证失败: ${error.details.map(d => d.message).join(', ')}`);
    }

    const status = value.status || STATUS.AUTO_PROCESS;
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO tickets (session_id, bot_tag, human_queue, customer_emotion, status)
         VALUES (?, ?, ?, ?, ?)`,
        [value.session_id, value.bot_tag, value.human_queue, value.customer_emotion, status],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint')) {
              reject(new Error('会话编号已存在'));
            } else {
              reject(err);
            }
          } else {
            const ticketId = this.lastID;
            db.run(
              `INSERT INTO ticket_history (ticket_id, new_status, action, remark)
               VALUES (?, ?, 'create', '创建工单')`,
              [ticketId, status],
              (histErr) => {
                if (histErr) console.error('记录历史失败:', histErr);
                resolve({ id: ticketId, ...value, status });
              }
            );
          }
        }
      );
    });
  }

  async getTicket(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM tickets WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getTicketBySessionId(sessionId) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM tickets WHERE session_id = ?`, [sessionId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async listTickets(params = {}) {
    const { status, page = 1, pageSize = 20 } = params;
    let whereClause = '';
    let queryParams = [];

    if (status) {
      whereClause = 'WHERE status = ?';
      queryParams.push(status);
    }

    const offset = (page - 1) * pageSize;

    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM tickets ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...queryParams, pageSize, offset],
        (err, rows) => {
          if (err) reject(err);
          else {
            db.get(
              `SELECT COUNT(*) as total FROM tickets ${whereClause}`,
              queryParams,
              (countErr, countRow) => {
                if (countErr) reject(countErr);
                else resolve({
                  data: rows,
                  pagination: {
                    page: parseInt(page),
                    pageSize: parseInt(pageSize),
                    total: countRow.total
                  }
                });
              }
            );
          }
        }
      );
    });
  }

  async updateStatus(id, updateData) {
    const { error, value } = validateStatusUpdate(updateData);
    if (error) {
      throw new Error(`验证失败: ${error.details.map(d => d.message).join(', ')}`);
    }

    const ticket = await this.getTicket(id);
    if (!ticket) {
      throw new Error('工单不存在');
    }

    const conflictInfo = await this.checkConflict(ticket.session_id, value.status);
    
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE tickets 
         SET status = ?, updated_at = CURRENT_TIMESTAMP,
             conflict_count = ?, last_conflict_at = ?
         WHERE id = ?`,
        [
          value.status,
          conflictInfo.newConflictCount,
          conflictInfo.isConflict ? new Date().toISOString() : ticket.last_conflict_at,
          id
        ],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO ticket_history (ticket_id, old_status, new_status, action, operator, remark)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          ticket.status,
          value.status,
          conflictInfo.isConflict ? 'conflict_transfer' : 'status_update',
          value.operator,
          value.remark || (conflictInfo.isConflict ? '检测到冲突：多次转回自助流程' : '')
        ],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    return {
      id,
      old_status: ticket.status,
      new_status: value.status,
      is_conflict: conflictInfo.isConflict,
      conflict_count: conflictInfo.newConflictCount
    };
  }

  async checkConflict(sessionId, newStatus) {
    const transfers = await new Promise((resolve, reject) => {
      db.all(
        `SELECT h.* FROM ticket_history h
         JOIN tickets t ON h.ticket_id = t.id
         WHERE t.session_id = ? AND h.action = 'conflict_transfer'
         ORDER BY h.created_at DESC`,
        [sessionId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    const currentTicket = await this.getTicketBySessionId(sessionId);
    const isConflict = currentTicket && 
                       newStatus === STATUS.AUTO_PROCESS && 
                       currentTicket.status !== STATUS.AUTO_PROCESS;

    const newConflictCount = isConflict 
      ? (currentTicket.conflict_count || 0) + 1 
      : (currentTicket?.conflict_count || 0);

    return {
      isConflict,
      conflictCount: transfers.length,
      newConflictCount,
      isOverThreshold: newConflictCount >= CONFLICT_THRESHOLD
    };
  }

  async getHistory(ticketId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM ticket_history WHERE ticket_id = ? ORDER BY created_at DESC`,
        [ticketId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async getAllForExport() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, 
                (SELECT COUNT(*) FROM ticket_history h WHERE h.ticket_id = t.id) as history_count
         FROM tickets t ORDER BY t.created_at DESC`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async saveValidationResult(batchId, results) {
    for (const result of results) {
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO import_validation (batch_id, row_number, session_id, is_valid, errors)
           VALUES (?, ?, ?, ?, ?)`,
          [
            batchId,
            result.rowNumber,
            result.data?.session_id || null,
            result.isValid,
            result.errors.length > 0 ? JSON.stringify(result.errors) : null
          ],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
  }

  async getValidationResults(batchId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM import_validation WHERE batch_id = ? ORDER BY row_number`,
        [batchId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(r => ({
            ...r,
            errors: r.errors ? JSON.parse(r.errors) : []
          })));
        }
      );
    });
  }
}

module.exports = new TicketService();
