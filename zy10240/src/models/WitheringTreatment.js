const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class WitheringTreatment {
  static async create(data, requestId) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO withering_treatments 
         (id, plant_id, location_id, maintenance_task_id, treatment_date, treatment_type, severity, result, handled_by, notes, request_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.plant_id,
          data.location_id,
          data.maintenance_task_id,
          data.treatment_date,
          data.treatment_type,
          data.severity,
          data.result,
          data.handled_by,
          data.notes,
          requestId
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
      db.get('SELECT * FROM withering_treatments WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getByPlant(plantId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM withering_treatments WHERE plant_id = ? ORDER BY treatment_date DESC',
        [plantId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async getAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM withering_treatments ORDER BY treatment_date DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = WitheringTreatment;
