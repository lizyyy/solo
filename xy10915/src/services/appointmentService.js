const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const ExceptionService = require('./exceptionService');

const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  HEALTH_DECLARATION_SUBMITTED: 'health_submitted',
  CHECKED_IN: 'checked_in',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  RESCHEDULED: 'rescheduled',
  REJECTED: 'rejected'
};

const STATUS_TRANSITIONS = {
  [APPOINTMENT_STATUS.PENDING]: [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.REJECTED],
  [APPOINTMENT_STATUS.CONFIRMED]: [APPOINTMENT_STATUS.HEALTH_DECLARATION_SUBMITTED, APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.RESCHEDULED],
  [APPOINTMENT_STATUS.HEALTH_DECLARATION_SUBMITTED]: [APPOINTMENT_STATUS.CHECKED_IN, APPOINTMENT_STATUS.CANCELLED],
  [APPOINTMENT_STATUS.CHECKED_IN]: [APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.CANCELLED],
  [APPOINTMENT_STATUS.COMPLETED]: [],
  [APPOINTMENT_STATUS.CANCELLED]: [],
  [APPOINTMENT_STATUS.RESCHEDULED]: [APPOINTMENT_STATUS.CONFIRMED],
  [APPOINTMENT_STATUS.REJECTED]: []
};

class AppointmentService {
  static async validateCapacity(timeSlotId, roomId, visitorCount) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.get(`SELECT max_visitors, current_visitors FROM time_slots WHERE id = ?`, [timeSlotId], (err, timeSlot) => {
          if (err) {
            reject(err);
            return;
          }
          if (!timeSlot) {
            resolve({ valid: false, message: '时间段不存在' });
            return;
          }
          
          const remainingSlotCapacity = timeSlot.max_visitors - timeSlot.current_visitors;
          if (remainingSlotCapacity < visitorCount) {
            resolve({ valid: false, message: `时间段容量不足，剩余${remainingSlotCapacity}人，需要${visitorCount}人` });
            return;
          }

          db.get(`SELECT capacity FROM rooms WHERE id = ?`, [roomId], (err, room) => {
            if (err) {
              reject(err);
              return;
            }
            if (!room) {
              resolve({ valid: false, message: '房间不存在' });
              return;
            }

            db.get(`
              SELECT SUM(visitor_count) as current_room_visitors 
              FROM appointments 
              WHERE room_id = ? AND time_slot_id = ? AND status NOT IN ('cancelled', 'rejected')
            `, [roomId, timeSlotId], (err, result) => {
              if (err) {
                reject(err);
                return;
              }
              
              const currentRoomVisitors = result.current_room_visitors || 0;
              const remainingRoomCapacity = room.capacity - currentRoomVisitors;
              
              if (remainingRoomCapacity < visitorCount) {
                resolve({ valid: false, message: `房间容量不足，剩余${remainingRoomCapacity}人，需要${visitorCount}人` });
                return;
              }

              resolve({ valid: true });
            });
          });
        });
      });
    });
  }

  static async checkDuplicateAppointment(elderId, visitorId, timeSlotId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id FROM appointments 
        WHERE elder_id = ? AND visitor_id = ? AND time_slot_id = ? 
        AND status NOT IN ('cancelled', 'rejected')
      `;
      db.get(sql, [elderId, visitorId, timeSlotId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(!!row);
        }
      });
    });
  }

  static async createAppointment(appointmentData, createdBy = 'system') {
    try {
      const { elder_id, visitor_id, time_slot_id, room_id, visitor_count = 1, notes } = appointmentData;

      const isDuplicate = await this.checkDuplicateAppointment(elder_id, visitor_id, time_slot_id);
      if (isDuplicate) {
        await ExceptionService.logException(
          'create_appointment',
          appointmentData,
          'DUPLICATE_APPOINTMENT',
          '同一探访人在同一时间段不能重复预约',
          '拒绝重复预约',
          createdBy
        );
        throw new Error('DUPLICATE_APPOINTMENT: 同一探访人在同一时间段不能重复预约');
      }

      const capacityCheck = await this.validateCapacity(time_slot_id, room_id, visitor_count);
      if (!capacityCheck.valid) {
        await ExceptionService.logException(
          'create_appointment',
          appointmentData,
          'CAPACITY_EXCEEDED',
          capacityCheck.message,
          '拒绝预约，容量不足',
          createdBy
        );
        throw new Error(`CAPACITY_EXCEEDED: ${capacityCheck.message}`);
      }

      return new Promise((resolve, reject) => {
        db.serialize(() => {
          const appointmentId = uuidv4();
          const sql = `
            INSERT INTO appointments (id, elder_id, visitor_id, time_slot_id, room_id, visitor_count, status, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          db.run(sql, [appointmentId, elder_id, visitor_id, time_slot_id, room_id, visitor_count, APPOINTMENT_STATUS.PENDING, notes, createdBy], function(err) {
            if (err) {
              reject(err);
              return;
            }

            db.run(`
              UPDATE time_slots 
              SET current_visitors = current_visitors + ? 
              WHERE id = ?
            `, [visitor_count, time_slot_id], (err) => {
              if (err) {
                reject(err);
                return;
              }

              const historyId = uuidv4();
              db.run(`
                INSERT INTO appointment_status_history (id, appointment_id, previous_status, new_status, changed_by, change_reason)
                VALUES (?, ?, ?, ?, ?, ?)
              `, [historyId, appointmentId, null, APPOINTMENT_STATUS.PENDING, createdBy, '创建预约'], (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve({ id: appointmentId, ...appointmentData, status: APPOINTMENT_STATUS.PENDING });
                }
              });
            });
          });
        });
      });
    } catch (error) {
      throw error;
    }
  }

  static async updateStatus(appointmentId, newStatus, changeReason, changedBy = 'system') {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.get(`SELECT status, visitor_count, time_slot_id FROM appointments WHERE id = ?`, [appointmentId], (err, appointment) => {
          if (err) {
            reject(err);
            return;
          }
          if (!appointment) {
            reject(new Error('预约不存在'));
            return;
          }

          const allowedTransitions = STATUS_TRANSITIONS[appointment.status] || [];
          if (!allowedTransitions.includes(newStatus)) {
            ExceptionService.logException(
              'update_status',
              { appointmentId, currentStatus: appointment.status, newStatus },
              'INVALID_STATUS_TRANSITION',
              `不允许从 ${appointment.status} 转换到 ${newStatus}`,
              '拒绝状态变更',
              changedBy
            ).then(() => {
              reject(new Error(`INVALID_STATUS_TRANSITION: 不允许从 ${appointment.status} 转换到 ${newStatus}`));
            });
            return;
          }

          db.run(`
            UPDATE appointments 
            SET status = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `, [newStatus, appointmentId], (err) => {
            if (err) {
              reject(err);
              return;
            }

            if (newStatus === APPOINTMENT_STATUS.CANCELLED || newStatus === APPOINTMENT_STATUS.REJECTED) {
              db.run(`
                UPDATE time_slots 
                SET current_visitors = MAX(0, current_visitors - ?)
                WHERE id = ?
              `, [appointment.visitor_count, appointment.time_slot_id], () => {});
            }

            const historyId = uuidv4();
            db.run(`
              INSERT INTO appointment_status_history (id, appointment_id, previous_status, new_status, changed_by, change_reason)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [historyId, appointmentId, appointment.status, newStatus, changedBy, changeReason], (err) => {
              if (err) {
                reject(err);
              } else {
                resolve({ appointmentId, previousStatus: appointment.status, newStatus });
              }
            });
          });
        });
      });
    });
  }

  static async manualOverride(appointmentId, updateData, changedBy = 'admin') {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.get(`SELECT * FROM appointments WHERE id = ?`, [appointmentId], (err, oldAppointment) => {
          if (err) {
            reject(err);
            return;
          }
          if (!oldAppointment) {
            reject(new Error('预约不存在'));
            return;
          }

          const updates = [];
          const values = [];
          
          for (const [key, value] of Object.entries(updateData)) {
            if (key !== 'id' && value !== undefined) {
              updates.push(`${key} = ?`);
              values.push(value);
            }
          }
          
          if (updates.length === 0) {
            resolve({ message: '没有需要更新的字段' });
            return;
          }

          values.push(appointmentId);

          db.run(`
            UPDATE appointments 
            SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `, values, function(err) {
            if (err) {
              reject(err);
              return;
            }

            if (updateData.status) {
              const historyId = uuidv4();
              db.run(`
                INSERT INTO appointment_status_history (id, appointment_id, previous_status, new_status, changed_by, change_reason)
                VALUES (?, ?, ?, ?, ?, ?)
              `, [historyId, appointmentId, oldAppointment.status, updateData.status, changedBy, '人工修正'], (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve({ appointmentId, manualUpdated: true, newStatus: updateData.status });
                }
              });
            } else {
              resolve({ appointmentId, manualUpdated: true });
            }
          });
        });
      });
    });
  }

  static async getAppointmentById(id) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT a.*, e.name as elder_name, v.name as visitor_name, 
               ts.date, ts.start_time, ts.end_time, r.room_number
        FROM appointments a
        JOIN elders e ON a.elder_id = e.id
        JOIN visitors v ON a.visitor_id = v.id
        JOIN time_slots ts ON a.time_slot_id = ts.id
        JOIN rooms r ON a.room_id = r.id
        WHERE a.id = ?
      `;
      db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  static async getStatusHistory(appointmentId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM appointment_status_history WHERE appointment_id = ? ORDER BY changed_at ASC`;
      db.all(sql, [appointmentId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static async getAllAppointments(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT a.*, e.name as elder_name, v.name as visitor_name, 
               ts.date, ts.start_time, ts.end_time, r.room_number
        FROM appointments a
        JOIN elders e ON a.elder_id = e.id
        JOIN visitors v ON a.visitor_id = v.id
        JOIN time_slots ts ON a.time_slot_id = ts.id
        JOIN rooms r ON a.room_id = r.id
        WHERE 1=1
      `;
      const params = [];

      if (filters.status) {
        sql += ` AND a.status = ?`;
        params.push(filters.status);
      }
      if (filters.date) {
        sql += ` AND ts.date = ?`;
        params.push(filters.date);
      }
      if (filters.elder_id) {
        sql += ` AND a.elder_id = ?`;
        params.push(filters.elder_id);
      }

      sql += ` ORDER BY a.created_at DESC`;

      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

module.exports = { AppointmentService, APPOINTMENT_STATUS, STATUS_TRANSITIONS };
