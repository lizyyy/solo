const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Customer {
  static async create(data) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO customers (id, name, contact_person, phone, address) VALUES (?, ?, ?, ?, ?)',
        [id, data.name, data.contact_person, data.phone, data.address],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...data });
        }
      );
    });
  }

  static async getAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM customers ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM customers WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async update(id, data) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE customers SET name = ?, contact_person = ?, phone = ?, address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [data.name, data.contact_person, data.phone, data.address, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...data });
        }
      );
    });
  }
}

module.exports = Customer;
