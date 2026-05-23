const db = require('../config/database');
const moment = require('moment');

class ReservationService {
  async reserveParts(workorderId, engineerId, parts) {
    return new Promise((resolve, reject) => {
      db.serialize(async () => {
        try {
          db.run('BEGIN TRANSACTION');

          const workorder = await this.getWorkorderById(workorderId);
          if (!workorder) {
            throw new Error('工单不存在');
          }

          for (const part of parts) {
            const existingReservation = await this.getActiveReservation(workorderId, part.partId);
            if (existingReservation) {
              throw new Error(`备件ID ${part.partId} 已被该工单预占，请勿重复操作`);
            }

            const sparePart = await this.getSparePartById(part.partId);
            if (!sparePart) {
              throw new Error(`备件ID ${part.partId} 不存在`);
            }

            const reservedQuantity = await this.getReservedQuantity(part.partId);
            const availableQuantity = sparePart.quantity - reservedQuantity;

            if (availableQuantity < part.quantity) {
              throw new Error(`备件 ${sparePart.part_name} 库存不足。可用: ${availableQuantity}, 需要: ${part.quantity}`);
            }

            const expiredAt = moment().add(4, 'hours').toISOString();

            await this.createReservation({
              workorderId,
              partId: part.partId,
              quantity: part.quantity,
              engineerId,
              expiredAt
            });
          }

          db.run('COMMIT');
          resolve({ success: true, message: '备件预占成功' });
        } catch (error) {
          db.run('ROLLBACK');
          reject(error);
        }
      });
    });
  }

  async releaseExpiredReservations() {
    return new Promise((resolve, reject) => {
      const now = moment().toISOString();
      db.all(
        `SELECT * FROM reservation_records 
         WHERE status = '已预占' AND expired_at < ?`,
        [now],
        async (err, expiredReservations) => {
          if (err) return reject(err);

          let releasedCount = 0;
          for (const reservation of expiredReservations) {
            await this.releaseReservation(reservation.id, 'TIMEOUT', '系统自动超时释放');
            releasedCount++;
          }

          resolve({ success: true, releasedCount, message: `已释放 ${releasedCount} 条超时预占记录` });
        }
      );
    });
  }

  async reassignWorkorder(workorderId, newEngineerId) {
    return new Promise((resolve, reject) => {
      db.serialize(async () => {
        try {
          db.run('BEGIN TRANSACTION');

          const workorder = await this.getWorkorderById(workorderId);
          if (!workorder) {
            throw new Error('工单不存在');
          }

          const activeReservations = await this.getActiveReservationsByWorkorder(workorderId);
          for (const reservation of activeReservations) {
            await this.releaseReservation(reservation.id, 'REASSIGN', '工单改派释放');
          }

          db.run(
            `UPDATE repair_workorders 
             SET engineer_id = ?, status = '已分配', updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [newEngineerId, workorderId]
          );

          db.run('COMMIT');
          resolve({ 
            success: true, 
            message: '工单改派成功，原预占备件已释放',
            releasedCount: activeReservations.length
          });
        } catch (error) {
          db.run('ROLLBACK');
          reject(error);
        }
      });
    });
  }

  async fulfillWorkorder(workorderId, fulfillmentData) {
    return new Promise((resolve, reject) => {
      db.serialize(async () => {
        try {
          db.run('BEGIN TRANSACTION');

          const activeReservations = await this.getActiveReservationsByWorkorder(workorderId);
          
          for (const reservation of activeReservations) {
            db.run(
              `UPDATE spare_parts 
               SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP 
               WHERE id = ?`,
              [reservation.quantity, reservation.part_id]
            );

            await this.releaseReservation(reservation.id, 'COMPLETE', '工单完成扣减');
          }

          db.run(
            `INSERT INTO fulfillment_summaries 
             (workorder_id, engineer_id, parts_used, actual_start_time, actual_end_time, fulfillment_status, remarks) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              workorderId,
              fulfillmentData.engineerId,
              JSON.stringify(fulfillmentData.partsUsed || []),
              fulfillmentData.actualStartTime,
              fulfillmentData.actualEndTime,
              fulfillmentData.status || '已完成',
              fulfillmentData.remarks
            ]
          );

          db.run(
            `UPDATE repair_workorders 
             SET status = '已完成', updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [workorderId]
          );

          db.run('COMMIT');
          resolve({ success: true, message: '工单履约完成，备件已扣减' });
        } catch (error) {
          db.run('ROLLBACK');
          reject(error);
        }
      });
    });
  }

  async manualCorrection(reservationId, correctionData) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE reservation_records 
         SET status = ?, released_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [correctionData.status || '已人工释放', reservationId],
        function(err) {
          if (err) return reject(err);
          resolve({ success: true, message: '人工修正成功', changes: this.changes });
        }
      );
    });
  }

  getWorkorderById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM repair_workorders WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  getSparePartById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM spare_parts WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  getActiveReservation(workorderId, partId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM reservation_records 
         WHERE workorder_id = ? AND part_id = ? AND status = '已预占'`,
        [workorderId, partId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  getReservedQuantity(partId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COALESCE(SUM(quantity), 0) as reserved 
         FROM reservation_records 
         WHERE part_id = ? AND status = '已预占'`,
        [partId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.reserved);
        }
      );
    });
  }

  getActiveReservationsByWorkorder(workorderId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM reservation_records 
         WHERE workorder_id = ? AND status = '已预占'`,
        [workorderId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  createReservation(data) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO reservation_records 
         (workorder_id, part_id, quantity, engineer_id, expired_at) 
         VALUES (?, ?, ?, ?, ?)`,
        [data.workorderId, data.partId, data.quantity, data.engineerId, data.expiredAt],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
  }

  releaseReservation(reservationId, reasonCode, remarks) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id FROM release_reasons WHERE reason_code = ?`,
        [reasonCode],
        (err, reason) => {
          if (err) return reject(err);
          
          db.run(
            `UPDATE reservation_records 
             SET status = '已释放', released_at = CURRENT_TIMESTAMP, release_reason_id = ? 
             WHERE id = ?`,
            [reason ? reason.id : null, reservationId],
            function(updateErr) {
              if (updateErr) reject(updateErr);
              else resolve({ success: true, changes: this.changes });
            }
          );
        }
      );
    });
  }
}

module.exports = new ReservationService();