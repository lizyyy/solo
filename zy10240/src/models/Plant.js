const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { PLANT_STATUSES } = require('../utils/constants');

class Plant {
  static async create(data) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO plants (id, location_id, name, species, pot_number, status, rental_start_date, monthly_rent, current_value) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, 
          data.location_id, 
          data.name, 
          data.species, 
          data.pot_number, 
          data.status || PLANT_STATUSES.HEALTHY,
          data.rental_start_date,
          data.monthly_rent || 0,
          data.current_value || 0
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...data });
        }
      );
    });
  }

  static async getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM plants WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getByLocation(locationId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM plants WHERE location_id = ? ORDER BY name', [locationId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async updateStatus(id, status) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE plants SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, status });
        }
      );
    });
  }

  static async updateLocation(id, locationId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE plants SET location_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [locationId, PLANT_STATUSES.MOVED, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, location_id: locationId });
        }
      );
    });
  }

  static async updatePotNumber(id, potNumber) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE plants SET pot_number = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [potNumber, PLANT_STATUSES.REPOTTED, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, pot_number: potNumber });
        }
      );
    });
  }

  static async getAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM plants ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = Plant;
