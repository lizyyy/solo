const db = require('../config/db');
const historyService = require('./historyService');
const reservationService = require('./reservationService');

function createEquipment(data) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO equipments (kitchen_id, name, type, status)
       VALUES (?, ?, ?, ?)`,
      [data.kitchen_id, data.name, data.type || '', 'available'],
      async function(err) {
        if (err) reject(err);
        else {
          await historyService.logHistory(
            historyService.entityTypes.EQUIPMENT_BOOKING,
            this.lastID,
            historyService.actions.CREATE,
            null,
            data
          );
          resolve(this.lastID);
        }
      }
    );
  });
}

function getEquipment(id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT e.*, k.name as kitchen_name
       FROM equipments e
       JOIN kitchens k ON e.kitchen_id = k.id
       WHERE e.id = ?`,
      [id],
      (err, row) => { if (err) reject(err); else resolve(row); }
    );
  });
}

function getEquipmentsByKitchen(kitchenId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM equipments WHERE kitchen_id = ? ORDER BY name`,
      [kitchenId],
      (err, rows) => { if (err) reject(err); else resolve(rows); }
    );
  });
}

function getAllEquipments() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT e.*, k.name as kitchen_name
       FROM equipments e
       JOIN kitchens k ON e.kitchen_id = k.id
       ORDER BY k.name, e.name`,
      (err, rows) => { if (err) reject(err); else resolve(rows); }
    );
  });
}

function createEquipmentBooking(data) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO equipment_bookings (equipment_id, reservation_id, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.equipment_id,
        data.reservation_id,
        data.start_time,
        data.end_time,
        reservationService.equipmentBookingStatuses.PENDING
      ],
      async function(err) {
        if (err) reject(err);
        else {
          const bookingId = this.lastID;
          await historyService.logHistory(
            historyService.entityTypes.EQUIPMENT_BOOKING,
            bookingId,
            historyService.actions.CREATE,
            null,
            data
          );
          resolve(bookingId);
        }
      }
    );
  });
}

function getEquipmentBookingsByReservation(reservationId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT eb.*, e.name as equipment_name, e.type as equipment_type, k.name as kitchen_name
       FROM equipment_bookings eb
       JOIN equipments e ON eb.equipment_id = e.id
       JOIN kitchens k ON e.kitchen_id = k.id
       WHERE eb.reservation_id = ?
       ORDER BY eb.start_time`,
      [reservationId],
      (err, rows) => { if (err) reject(err); else resolve(rows); }
    );
  });
}

function getEquipmentBookingsByEquipment(equipmentId, status = null) {
  return new Promise((resolve, reject) => {
    let sql = `SELECT eb.*, r.id as reservation_id, t.name as team_name
               FROM equipment_bookings eb
               LEFT JOIN reservations r ON eb.reservation_id = r.id
               LEFT JOIN teams t ON r.team_id = t.id
               WHERE eb.equipment_id = ?`;
    const params = [equipmentId];
    
    if (status) {
      sql += ` AND eb.status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY eb.start_time`;
    
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function cancelEquipmentBooking(id) {
  return new Promise(async (resolve, reject) => {
    const booking = await new Promise((res, rej) => {
      db.get(`SELECT * FROM equipment_bookings WHERE id = ?`, [id], (err, row) => {
        if (err) rej(err); else res(row);
      });
    });
    
    if (!booking) {
      reject(new Error('设备预约记录不存在'));
      return;
    }
    
    db.run(
      `UPDATE equipment_bookings SET status = ? WHERE id = ?`,
      [reservationService.equipmentBookingStatuses.CANCELLED, id],
      async function(err) {
        if (err) reject(err);
        else {
          await historyService.logHistory(
            historyService.entityTypes.EQUIPMENT_BOOKING,
            id,
            historyService.actions.STATUS_CHANGE,
            { status: booking.status },
            { status: reservationService.equipmentBookingStatuses.CANCELLED }
          );
          resolve(true);
        }
      }
    );
  });
}

module.exports = {
  createEquipment,
  getEquipment,
  getEquipmentsByKitchen,
  getAllEquipments,
  createEquipmentBooking,
  getEquipmentBookingsByReservation,
  getEquipmentBookingsByEquipment,
  cancelEquipmentBooking
};
