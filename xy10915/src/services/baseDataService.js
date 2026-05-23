const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class BaseDataService {
  static async createElder(elderData) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { name, id_card, room_number, bed_number, health_status, guardian_name, guardian_phone } = elderData;
      
      const sql = `
        INSERT INTO elders (id, name, id_card, room_number, bed_number, health_status, guardian_name, guardian_phone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      db.run(sql, [id, name, id_card, room_number, bed_number, health_status, guardian_name, guardian_phone], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, ...elderData });
        }
      });
    });
  }

  static async getAllElders() {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM elders ORDER BY created_at DESC`;
      db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static async getElderById(id) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM elders WHERE id = ?`;
      db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  static async createVisitor(visitorData) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { name, id_card, phone, relation } = visitorData;
      
      const sql = `
        INSERT INTO visitors (id, name, id_card, phone, relation)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      db.run(sql, [id, name, id_card, phone, relation], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, ...visitorData });
        }
      });
    });
  }

  static async getAllVisitors() {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM visitors ORDER BY created_at DESC`;
      db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static async createRoom(roomData) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { room_number, capacity = 2, floor, area, description } = roomData;
      
      const sql = `
        INSERT INTO rooms (id, room_number, capacity, floor, area, description)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      db.run(sql, [id, room_number, capacity, floor, area, description], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, ...roomData });
        }
      });
    });
  }

  static async getAllRooms() {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM rooms ORDER BY room_number`;
      db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static async createTimeSlot(timeSlotData) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { date, start_time, end_time, max_visitors = 10 } = timeSlotData;
      
      const sql = `
        INSERT INTO time_slots (id, date, start_time, end_time, max_visitors, current_visitors, status)
        VALUES (?, ?, ?, ?, ?, 0, 'available')
      `;
      
      db.run(sql, [id, date, start_time, end_time, max_visitors], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, ...timeSlotData });
        }
      });
    });
  }

  static async getTimeSlotsByDate(date) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM time_slots WHERE date = ? ORDER BY start_time`;
      db.all(sql, [date], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static async getAvailableTimeSlots(date) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM time_slots 
        WHERE date = ? AND current_visitors < max_visitors AND status = 'available'
        ORDER BY start_time
      `;
      db.all(sql, [date], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

module.exports = BaseDataService;
