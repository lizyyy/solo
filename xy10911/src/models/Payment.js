const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Payment {
  static async create(data) {
    return new Promise((resolve, reject) => {
      const paymentId = data.payment_id || uuidv4();
      const { machine_id, amount, pay_time, payer_id, pay_channel, status } = data;

      db.run(
        `INSERT INTO payments (payment_id, machine_id, amount, pay_time, payer_id, pay_channel, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [paymentId, machine_id, amount, pay_time, payer_id, pay_channel, status || 'success'],
        function(err) {
          if (err) reject(err);
          else resolve({ payment_id: paymentId, ...data });
        }
      );
    });
  }

  static async findById(paymentId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM payments WHERE payment_id = ?`,
        [paymentId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static async findByMachineId(machineId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM payments WHERE machine_id = ? ORDER BY pay_time DESC`,
        [machineId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
}

module.exports = Payment;
