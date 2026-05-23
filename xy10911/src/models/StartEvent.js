const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class StartEvent {
  static async create(data) {
    return new Promise((resolve, reject) => {
      const eventId = data.event_id || uuidv4();
      const { machine_id, payment_id, start_time, success, error_code, error_message } = data;

      db.run(
        `INSERT INTO start_events (event_id, machine_id, payment_id, start_time, success, error_code, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [eventId, machine_id, payment_id, start_time, success ? 1 : 0, error_code, error_message],
        function(err) {
          if (err) reject(err);
          else resolve({ event_id: eventId, ...data });
        }
      );
    });
  }

  static async findById(eventId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM start_events WHERE event_id = ?`,
        [eventId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static async findByPaymentId(paymentId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM start_events WHERE payment_id = ? ORDER BY start_time DESC`,
        [paymentId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async findByMachineAndTime(machineId, startTime, endTime) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM start_events 
         WHERE machine_id = ? AND start_time >= ? AND start_time <= ?
         ORDER BY start_time DESC`,
        [machineId, startTime, endTime],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
}

module.exports = StartEvent;
