const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Location {
  static async create(data) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO locations (id, customer_id, name, floor, area, description) VALUES (?, ?, ?, ?, ?, ?)',
        [id, data.customer_id, data.name, data.floor, data.area, data.description],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...data });
        }
      );
    });
  }

  static async getByCustomer(customerId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM locations WHERE customer_id = ? ORDER BY name', [customerId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM locations WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM locations ORDER BY name', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = Location;
