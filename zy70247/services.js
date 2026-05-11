const db = require('./database');
const crypto = require('crypto');

function generateId() {
  return crypto.randomUUID();
}

function getCurrentTime() {
  return new Date().toISOString();
}

const equipmentService = {
  getAll(callback) {
    db.all('SELECT * FROM equipment', callback);
  },

  getById(id, callback) {
    db.get('SELECT * FROM equipment WHERE id = ?', [id], callback);
  },

  create(equipment, callback) {
    const { name, category, type, is_consumable, quantity, unit, location, description } = equipment;
    const id = generateId();
    db.run(
      'INSERT INTO equipment (id, name, category, type, is_consumable, quantity, unit, location, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, category, type, is_consumable, quantity, unit, location, description],
      (err) => callback(err, id)
    );
  },

  update(id, updates, callback) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    db.run(`UPDATE equipment SET ${fields} WHERE id = ?`, values, callback);
  },

  delete(id, callback) {
    db.run('DELETE FROM equipment WHERE id = ?', [id], callback);
  },

  updateQuantity(id, change, callback) {
    db.run('UPDATE equipment SET quantity = quantity + ? WHERE id = ?', [change, id], callback);
  }
};

const classService = {
  getAll(callback) {
    db.all('SELECT * FROM classes', callback);
  },

  create(cls, callback) {
    const { name, grade } = cls;
    const id = generateId();
    db.run(
      'INSERT INTO classes (id, name, grade) VALUES (?, ?, ?)',
      [id, name, grade],
      (err) => callback(err, id)
    );
  }
};

const reservationService = {
  getAll(callback) {
    db.all(`
      SELECT r.*, c.name as class_name, e.name as equipment_name, e.category, e.type, e.is_consumable, e.unit
      FROM reservations r
      JOIN classes c ON r.class_id = c.id
      JOIN equipment e ON r.equipment_id = e.id
      ORDER BY r.created_at DESC
    `, callback);
  },

  getById(id, callback) {
    db.get(`
      SELECT r.*, c.name as class_name, e.name as equipment_name, e.category, e.type, e.is_consumable, e.unit
      FROM reservations r
      JOIN classes c ON r.class_id = c.id
      JOIN equipment e ON r.equipment_id = e.id
      WHERE r.id = ?
    `, [id], callback);
  },

  create(reservation, callback) {
    equipmentService.getById(reservation.equipment_id, (err, equipment) => {
      if (err) return callback(err);
      if (!equipment) return callback(new Error('器材不存在'));

      let status = '待审批';
      if (equipment.type === '普通') {
        status = '已确认';
      }

      const now = getCurrentTime();
      const id = generateId();

      db.run(
        `INSERT INTO reservations (id, class_id, equipment_id, quantity, reservation_date, purpose, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, reservation.class_id, reservation.equipment_id, reservation.quantity, reservation.reservation_date, reservation.purpose, status, now, now],
        (err) => {
          if (err) return callback(err);
          
          if (status === '已确认') {
            return this.processConsumableDeduction(id, (deductErr) => {
              callback(deductErr, id, status);
            });
          }
          
          callback(null, id, status);
        }
      );
    });
  },

  update(id, updates, callback) {
    this.getById(id, (err, reservation) => {
      if (err) return callback(err);
      if (!reservation) return callback(new Error('预约不存在'));
      if (reservation.status !== '待审批') {
        return callback(new Error('只能修改待审批的预约'));
      }

      const now = getCurrentTime();
      updates.updated_at = now;
      
      const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updates);
      values.push(id);
      
      db.run(`UPDATE reservations SET ${fields} WHERE id = ?`, values, callback);
    });
  },

  approve(id, approvedBy, comment, callback) {
    this.getById(id, (err, reservation) => {
      if (err) return callback(err);
      if (!reservation) return callback(new Error('预约不存在'));
      if (reservation.status !== '待审批') {
        return callback(new Error('只能审批待审批的预约'));
      }

      const now = getCurrentTime();
      db.run(
        `UPDATE reservations SET status = '已确认', approved_by = ?, approval_time = ?, approval_comment = ?, updated_at = ? WHERE id = ?`,
        [approvedBy, now, comment, now, id],
        (err) => {
          if (err) return callback(err);
          this.processConsumableDeduction(id, callback);
        }
      );
    });
  },

  reject(id, approvedBy, comment, callback) {
    this.getById(id, (err, reservation) => {
      if (err) return callback(err);
      if (!reservation) return callback(new Error('预约不存在'));
      if (reservation.status !== '待审批') {
        return callback(new Error('只能拒绝待审批的预约'));
      }

      const now = getCurrentTime();
      db.run(
        `UPDATE reservations SET status = '已拒绝', approved_by = ?, approval_time = ?, approval_comment = ?, updated_at = ? WHERE id = ?`,
        [approvedBy, now, comment, now, id],
        callback
      );
    });
  },

  complete(id, callback) {
    this.getById(id, (err, reservation) => {
      if (err) return callback(err);
      if (!reservation) return callback(new Error('预约不存在'));
      if (reservation.status !== '已确认') {
        return callback(new Error('只能完成已确认的预约'));
      }

      const now = getCurrentTime();
      db.run(`UPDATE reservations SET status = '已完成', updated_at = ? WHERE id = ?`, [now, id], callback);
    });
  },

  processConsumableDeduction(reservationId, callback) {
    this.getById(reservationId, (err, reservation) => {
      if (err) return callback(err);
      if (!reservation) return callback(new Error('预约不存在'));

      if (reservation.is_consumable) {
        db.get('SELECT * FROM equipment WHERE id = ?', [reservation.equipment_id], (eqErr, equipment) => {
          if (eqErr) return callback(eqErr);
          if (!equipment) return callback(new Error('器材不存在'));
          if (equipment.quantity < reservation.quantity) {
            return callback(new Error('易耗品库存不足'));
          }

          const deductionId = generateId();
          const now = getCurrentTime();

          db.run(
            `INSERT INTO consumable_deductions (id, reservation_id, equipment_id, quantity, deduction_time, operator) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [deductionId, reservationId, reservation.equipment_id, reservation.quantity, now, 'system'],
            (insertErr) => {
              if (insertErr) return callback(insertErr);
              
              equipmentService.updateQuantity(reservation.equipment_id, -reservation.quantity, (updateErr) => {
                callback(updateErr);
              });
            }
          );
        });
      } else {
        callback(null);
      }
    });
  }
};

const dataRunService = {
  hasRun(runName, callback) {
    db.get('SELECT * FROM data_runs WHERE run_name = ?', [runName], (err, row) => {
      callback(err, !!row);
    });
  },

  recordRun(runName, callback) {
    const id = generateId();
    const now = getCurrentTime();
    db.run('INSERT INTO data_runs (id, run_name, executed_at) VALUES (?, ?, ?)', [id, runName, now], callback);
  }
};

module.exports = {
  equipmentService,
  classService,
  reservationService,
  dataRunService
};
