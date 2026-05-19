const db = require('../config/database');
const moment = require('moment');

class Inventory {
  static create(data) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO inventory (medicineId, batchNumber, quantity, unit, productionDate, expiryDate)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [data.medicineId, data.batchNumber, data.quantity, data.unit, data.productionDate, data.expiryDate],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...data });
        }
      );
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT i.*, m.name as medicineName, m.specification 
        FROM inventory i 
        LEFT JOIN medicines m ON i.medicineId = m.id 
        ORDER BY i.createdAt DESC
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT i.*, m.name as medicineName 
        FROM inventory i 
        LEFT JOIN medicines m ON i.medicineId = m.id 
        WHERE i.id = ?
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static findAvailableByMedicineId(medicineId) {
    return new Promise((resolve, reject) => {
      const today = moment().format('YYYY-MM-DD');
      db.all(`
        SELECT i.*, m.name as medicineName 
        FROM inventory i 
        LEFT JOIN medicines m ON i.medicineId = m.id 
        WHERE i.medicineId = ? AND i.expiryDate >= ? AND i.quantity > 0
        ORDER BY i.expiryDate ASC
      `, [medicineId, today], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static updateQuantity(id, quantity) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE inventory SET quantity = ? WHERE id = ?`,
        [quantity, id],
        function(err) {
          if (err) reject(err);
          else resolve({ success: this.changes > 0 });
        }
      );
    });
  }
}

module.exports = Inventory;
